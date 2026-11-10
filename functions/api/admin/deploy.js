import { json, readJsonBody, requireAdmin, supabaseRequest, writeActivityLog } from '../../_shared/supabase.js';
import { fetchCloudflareData, runLiveWebsiteHealthChecks } from '../../_shared/integrations.js';

const PRIMARY_REPO = 'RayyanShajahan/prepwise';
const BACKUP_REPO = 'Sreesidh-git/prepwise';
const TARGET_BRANCH = 'main';
const EXPECTED_PROJECT = 'prepwise-7ij';

function getCfEnv(env) {
  return {
    apiToken: (env.CLOUDFLARE_API_TOKEN || '').trim(),
    accountId: (env.CLOUDFLARE_ACCOUNT_ID || '').trim(),
    project: (env.CLOUDFLARE_PAGES_PROJECT || EXPECTED_PROJECT).trim().replace(/^https?:\/\//i, '').replace(/\.pages\.dev$/i, '').replace(/\/.*$/, '') || EXPECTED_PROJECT
  };
}

async function fetchGitHubBranchHead(repo, branch, githubToken = '') {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'PrepWise-Admin-Deploy-Center'
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  const resp = await fetch(`https://api.github.com/repos/${repo}/branches/${encodeURIComponent(branch)}`, { headers });
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok || !payload?.commit?.sha) {
    return {
      ok: false,
      repo,
      branch,
      error: payload?.message || `GitHub API returned HTTP ${resp.status} for ${repo}`
    };
  }
  return {
    ok: true,
    repo,
    branch,
    sha: payload.commit.sha,
    shortSha: payload.commit.sha.slice(0, 7),
    message: payload.commit.commit?.message?.split('\n')[0] || '—',
    author: payload.commit.commit?.author?.name || payload.commit.author?.login || '—',
    committedAt: payload.commit.commit?.author?.date || null
  };
}

async function checkReposSync(env) {
  const githubToken = (env.GITHUB_TOKEN || '').trim();
  try {
    const [primary, backup] = await Promise.all([
      fetchGitHubBranchHead(PRIMARY_REPO, TARGET_BRANCH, githubToken),
      fetchGitHubBranchHead(BACKUP_REPO, TARGET_BRANCH, githubToken)
    ]);
    const bothOk = Boolean(primary.ok && backup.ok);
    const synchronized = bothOk && primary.sha === backup.sha;
    return {
      checked: bothOk,
      synchronized,
      primary,
      backup,
      error: !primary.ok ? primary.error : (!backup.ok ? backup.error : (synchronized ? null : `Repositories have diverged (${primary.shortSha} vs ${backup.shortSha}).`))
    };
  } catch (err) {
    return {
      checked: false,
      synchronized: false,
      primary: { ok: false, repo: PRIMARY_REPO },
      backup: { ok: false, repo: BACKUP_REPO },
      error: err.message || 'Unable to inspect GitHub repositories'
    };
  }
}

async function verifyCloudflareToken(apiToken) {
  if (!apiToken) {
    return { checked: false, active: false, status: 'missing', error: 'CLOUDFLARE_API_TOKEN is missing.' };
  }
  const resp = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }
  }).catch(() => null);
  if (!resp) {
    return { checked: false, active: false, status: 'unreachable', error: 'Unable to reach Cloudflare token verification endpoint.' };
  }
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok || !payload?.success) {
    return {
      checked: true,
      active: false,
      status: resp.status === 401 || resp.status === 403 ? 'invalid' : 'error',
      error: payload?.errors?.[0]?.message || `Token verification returned HTTP ${resp.status}.`
    };
  }
  const tokenStatus = payload?.result?.status || 'active';
  return {
    checked: true,
    active: tokenStatus === 'active',
    status: tokenStatus,
    error: tokenStatus === 'active' ? null : `Token status is "${tokenStatus}".`
  };
}

async function fetchPagesProjectDetails(apiToken, accountId, projectName) {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}`,
    { headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
  ).catch(() => null);
  if (!resp) return { ok: false, status: 502, error: 'Failed to reach Cloudflare API' };
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok || !payload?.success) {
    return {
      ok: false,
      status: resp.status,
      error: payload?.errors?.[0]?.message || `Cloudflare API returned HTTP ${resp.status}`
    };
  }
  const p = payload.result || {};
  return {
    ok: true,
    project: {
      name: p.name,
      subdomain: p.subdomain,
      domains: Array.isArray(p.domains) ? p.domains : [],
      productionBranch: p.production_branch || null,
      repoOwner: p.source?.config?.owner || null,
      repoName: p.source?.config?.repo_name || null
    }
  };
}

function mapDeployment(d) {
  if (!d) return null;
  return {
    id: d.short_id || d.id?.slice(0, 8),
    fullId: d.id,
    environment: d.environment,
    url: d.url,
    status: d.latest_stage?.status || 'unknown',
    stage: d.latest_stage?.name || 'deploy',
    stages: Array.isArray(d.stages)
      ? d.stages.map((s) => ({ name: s.name, status: s.status, startedOn: s.started_on, endedOn: s.ended_on }))
      : [],
    commitHash: d.deployment_trigger?.metadata?.commit_hash?.slice(0, 7) || '—',
    commitFullHash: d.deployment_trigger?.metadata?.commit_hash || null,
    commitMessage: d.deployment_trigger?.metadata?.commit_message || '—',
    branch: d.deployment_trigger?.metadata?.branch || null,
    createdOn: d.created_on
  };
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  const url = new URL(context.request.url);
  const deploymentId = (url.searchParams.get('deploymentId') || '').trim();
  const verifySite = url.searchParams.get('verifySite') === 'true';
  const cfEnv = getCfEnv(context.env);

  try {
    // Poll single deployment progress (+ optional live site check)
    if (deploymentId) {
      if (!cfEnv.apiToken || !cfEnv.accountId) {
        return json({ error: 'Cloudflare API credentials are not configured.' }, 400);
      }
      const cfReport = await fetchCloudflareData(context.env, new Date(Date.now() - 6 * 86400000), new Date());
      const resolvedProject = cfReport?.projectName || cfEnv.project;
      const resp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfEnv.accountId)}/pages/projects/${encodeURIComponent(resolvedProject)}/deployments/${encodeURIComponent(deploymentId)}`,
        { headers: { Authorization: `Bearer ${cfEnv.apiToken}`, 'Content-Type': 'application/json' } }
      );
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || !payload?.success) {
        return json({ error: payload?.errors?.[0]?.message || `Unable to inspect deployment (${resp.status})` }, resp.status || 500);
      }
      const mapped = mapDeployment(payload.result);
      let siteHealth = null;
      if (verifySite && mapped?.status === 'success') {
        siteHealth = await runLiveWebsiteHealthChecks(context.env, context.request.url);
      }
      return json({ data: { deployment: mapped, siteHealth } });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 6 * 86400000);
    let auditLogsError = null;
    const [cfReport, repoSync, logs, tokenInfo] = await Promise.all([
      fetchCloudflareData(context.env, weekAgo, now),
      checkReposSync(context.env),
      supabaseRequest(
        context.env,
        '/rest/v1/admin_activity_logs?select=id,admin_user_id,action,entity_type,metadata,created_at&entity_type=eq.deployment&order=created_at.desc&limit=15',
        { accessToken: auth.token }
      ).catch((err) => {
        auditLogsError = err?.message || 'Unable to load deployment audit logs';
        return [];
      }),
      verifyCloudflareToken(cfEnv.apiToken)
    ]);

    const resolvedProject = cfReport?.projectName || cfEnv.project;
    let projectDetails = null;
    let projectDetailsRes = { ok: false, error: null };
    if (cfEnv.apiToken && cfEnv.accountId && (cfReport?.status === 'Connected' || tokenInfo.active)) {
      projectDetailsRes = await fetchPagesProjectDetails(cfEnv.apiToken, cfEnv.accountId, resolvedProject);
      if (projectDetailsRes.ok) projectDetails = projectDetailsRes.project;
    }

    const latestProd = cfReport?.data?.latestProduction || null;
    const deployments = cfReport?.data?.deployments || [];
    const failedList = deployments.filter((d) => d.status === 'failure' || d.status === 'failed');

    const productionBranch = projectDetails?.productionBranch || null;
    const projectVerified = Boolean(
      cfReport?.status === 'Connected' &&
      projectDetailsRes.ok &&
      (resolvedProject === EXPECTED_PROJECT || projectDetails?.subdomain === `${EXPECTED_PROJECT}.pages.dev`)
    );
    const branchVerified = Boolean(projectDetailsRes.ok && productionBranch === TARGET_BRANCH);

    const pagesReadOk = Boolean(cfReport?.status === 'Connected' && projectDetailsRes.ok);
    const zoneAnalyticsStatus = cfReport?.data?.zoneStatus || (cfReport?.status === 'Connected' ? 'not_configured' : 'unavailable');
    const blockingReasons = [];
    if (!auth.isOwner) blockingReasons.push('Owner authorization is required to trigger production deployments.');
    if (cfReport?.status !== 'Connected') {
      blockingReasons.push(cfReport?.error || `Cloudflare Pages connection is ${cfReport?.status || 'Not configured'}.`);
    } else if (!projectDetailsRes.ok) {
      blockingReasons.push(projectDetailsRes.error || 'Unable to inspect Cloudflare Pages project configuration (check Account: Cloudflare Pages: Read).');
    } else if (!projectVerified) {
      blockingReasons.push(`Cloudflare Pages project "${resolvedProject}" does not match expected "${EXPECTED_PROJECT}".`);
    }
    if (projectDetailsRes.ok && !branchVerified) {
      blockingReasons.push(`Production branch is "${productionBranch || 'unknown'}", expected "${TARGET_BRANCH}".`);
    }
    if (!repoSync.checked || !repoSync.synchronized) {
      blockingReasons.push(repoSync.error || 'Primary and backup GitHub main branches could not be verified as synchronized.');
    }

    const preflight = {
      ownerAuthorized: auth.isOwner,
      cloudflareConfigured: cfReport?.status === 'Connected',
      cloudflareStatus: cfReport?.status || 'Not configured',
      cloudflareError: cfReport?.error || projectDetailsRes.error || null,
      cloudflareToken: tokenInfo,
      cloudflarePermissions: {
        pagesRead: {
          ok: pagesReadOk,
          status: pagesReadOk ? 'verified' : (cfReport?.status === 'Authentication required' || projectDetailsRes.status === 401 || projectDetailsRes.status === 403 ? 'missing_permission' : 'unavailable'),
          detail: pagesReadOk
            ? 'Verified (project & deployment history readable)'
            : (cfReport?.error || projectDetailsRes.error || 'Account: Cloudflare Pages: Read could not be verified')
        },
        pagesEdit: {
          ok: null,
          status: tokenInfo.active && pagesReadOk ? 'ready_to_trigger' : 'blocked',
          detail: tokenInfo.active && pagesReadOk
            ? 'Required when triggering POST /deployments (403 surfaces if scope missing)'
            : 'Requires valid active token with Account: Cloudflare Pages: Edit'
        },
        zoneAnalyticsRead: {
          ok: zoneAnalyticsStatus === 'connected',
          status: zoneAnalyticsStatus,
          detail: zoneAnalyticsStatus === 'connected'
            ? 'Verified (Zone: Analytics: Read GraphQL active)'
            : (cfReport?.data?.zoneError || 'CLOUDFLARE_ZONE_ID or Zone: Analytics: Read not verified')
        }
      },
      projectVerified,
      projectName: resolvedProject,
      productionBranch,
      branchVerified,
      currentCommitSha: latestProd?.commitFullHash || null,
      currentCommitShortSha: latestProd?.commitHash || null,
      expectedCommitSha: repoSync.primary?.sha || null,
      expectedCommitShortSha: repoSync.primary?.shortSha || null,
      repositoriesSynchronized: repoSync.synchronized,
      repoSync,
      workingTreeCheck: 'edge_unverifiable_confirm_required',
      blockingReasons,
      readyToDeploy: blockingReasons.length === 0
    };

    return json({
      data: {
        canDeploy: auth.isOwner,
        project: projectDetails || { name: resolvedProject, productionBranch },
        latestProduction: latestProd,
        failedCount: cfReport?.data?.failedDeployments ?? failedList.length,
        failedDeployments: failedList,
        deployments,
        preflight,
        auditLogs: Array.isArray(logs) ? logs : [],
        auditLogsError
      }
    });
  } catch (err) {
    console.error('Deployment Center GET error:', err);
    return json({ error: `Failed to inspect deployment center: ${err.message}` }, 500);
  }
}

function formatDeployAdmin(auth) {
  return {
    id: auth.user.id,
    email: auth.user.email || null,
    displayName: auth.profile?.display_name || auth.user.email || auth.user.id,
    role: auth.role
  };
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context.request, context.env);
  if (auth.response) return auth.response;

  const adminInfo = formatDeployAdmin(auth);
  const timestamp = new Date().toISOString();
  if (!auth.isOwner) {
    await writeActivityLog(context.env, auth.token, auth.user.id, 'cloudflare_deploy_denied', 'deployment', EXPECTED_PROJECT, {
      administrator: adminInfo,
      timestamp,
      success: false,
      reason: 'Only the Owner can initiate production deployments.'
    });
    return json({ error: 'Only the Owner can trigger production deployments.' }, 403);
  }

  let body;
  try {
    body = await readJsonBody(context.request);
  } catch (err) {
    return json({ error: err.message || 'Invalid JSON body' }, 400);
  }

  if (body.confirm !== true || body.localCleanConfirmed !== true) {
    return json({
      error: 'Explicit deployment confirmation and clean local working-tree confirmation are required.'
    }, 400);
  }

  const cfEnv = getCfEnv(context.env);
  if (!cfEnv.apiToken || !cfEnv.accountId) {
    return json({
      error: 'Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID server environment variables.'
    }, 400);
  }

  // Re-run all server preflight checks live before triggering
  const cfReport = await fetchCloudflareData(context.env, new Date(Date.now() - 6 * 86400000), new Date());
  if (cfReport.status !== 'Connected') {
    return json({ error: cfReport.error || `Cloudflare connection is ${cfReport.status}.` }, 409);
  }

  const resolvedProject = cfReport.projectName || cfEnv.project;
  const projectRes = await fetchPagesProjectDetails(cfEnv.apiToken, cfEnv.accountId, resolvedProject);
  if (!projectRes.ok) {
    return json({ error: projectRes.error || 'Unable to verify Cloudflare Pages project settings.' }, 409);
  }
  if (projectRes.project.productionBranch !== TARGET_BRANCH) {
    return json({
      error: `Production branch mismatch: expected "${TARGET_BRANCH}", got "${projectRes.project.productionBranch}".`
    }, 409);
  }

  const repoSync = await checkReposSync(context.env);
  if (!repoSync.checked || !repoSync.synchronized) {
    await writeActivityLog(context.env, auth.token, auth.user.id, 'cloudflare_deploy_blocked_sync', 'deployment', resolvedProject, {
      administrator: adminInfo,
      timestamp,
      success: false,
      reason: repoSync.error || 'Repositories not synchronized'
    });
    return json({
      error: `Deployment blocked: ${repoSync.error || 'Primary and backup main branches could not be verified as synchronized.'}`
    }, 409);
  }

  if (body.expectedCommitSha && repoSync.primary.sha !== body.expectedCommitSha) {
    return json({
      error: `Repository HEAD changed (${body.expectedCommitSha.slice(0, 7)} -> ${repoSync.primary.shortSha}). Refresh preflight checks before deploying.`
    }, 409);
  }

  // Trigger Cloudflare Pages deployment on production branch (main)
  const form = new FormData();
  form.append('branch', TARGET_BRANCH);

  const triggerResp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfEnv.accountId)}/pages/projects/${encodeURIComponent(resolvedProject)}/deployments`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfEnv.apiToken}` },
      body: form
    }
  );
  const triggerPayload = await triggerResp.json().catch(() => ({}));

  if (!triggerResp.ok || !triggerPayload?.success) {
    const cfMsg = triggerPayload?.errors?.[0]?.message || `Cloudflare API returned HTTP ${triggerResp.status}`;
    const permissionHint = (triggerResp.status === 401 || triggerResp.status === 403)
      ? ' Note: Triggering deployments requires Account:Cloudflare Pages:Edit permission on CLOUDFLARE_API_TOKEN.'
      : '';
    await writeActivityLog(context.env, auth.token, auth.user.id, 'cloudflare_deploy_failed', 'deployment', resolvedProject, {
      administrator: adminInfo,
      commitSha: repoSync.primary.sha,
      timestamp,
      success: false,
      error: cfMsg
    });
    return json({ error: `${cfMsg}.${permissionHint}` }, triggerResp.status >= 400 ? triggerResp.status : 502);
  }

  const triggered = mapDeployment(triggerPayload.result);
  await writeActivityLog(context.env, auth.token, auth.user.id, 'cloudflare_deploy_triggered', 'deployment', resolvedProject, {
    administrator: adminInfo,
    project: resolvedProject,
    branch: TARGET_BRANCH,
    commitSha: repoSync.primary.sha,
    deploymentId: triggered?.fullId || triggered?.id,
    timestamp,
    success: true
  });

  return json({
    data: {
      deployment: triggered,
      commitSha: repoSync.primary.sha,
      project: resolvedProject,
      branch: TARGET_BRANCH
    }
  }, 202);
}

