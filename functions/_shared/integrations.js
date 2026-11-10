import { envValue, supabaseCount, supabaseRequest } from './supabase.js';
import { getGoogleAccessToken } from './google-auth.js';

function isoDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function defaultRange(fromParam, toParam, fallbackDays = 7) {
  const now = new Date();
  const to = toParam ? new Date(toParam) : now;
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - (fallbackDays - 1) * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return {
      from: new Date(now.getTime() - 6 * 86400000),
      to: now
    };
  }
  return { from, to };
}

export async function fetchSupabaseHealth(env, auth) {
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();
  try {
    const tables = [
      'companies',
      'interview_questions',
      'hiring_news',
      'question_categories',
      'analytics_events',
      'visitor_sessions',
      'page_views',
      'quiz_attempts',
      'feedback',
      'website_settings',
      'admin_profiles',
      'admin_activity_logs'
    ];

    const counts = await Promise.all(
      tables.map(async (table) => {
        try {
          const count = await supabaseCount(env, `/rest/v1/${table}?select=id`, auth.token);
          return { table, rows: count, status: 'reachable' };
        } catch {
          try {
            // Tables without 'id' PK fallback cleanly to select=*
            const count = await supabaseCount(env, `/rest/v1/${table}?select=*`, auth.token);
            return { table, rows: count, status: 'reachable' };
          } catch (err) {
            return { table, rows: null, status: 'error', error: err.message };
          }
        }
      })
    );

    const secretKey = env.SUPABASE_SECRET_KEY;
    const supabaseUrl = envValue(env, 'SUPABASE_URL').replace(/\/$/, '');

    let storageBuckets = null;
    let authUsersCount = null;
    if (secretKey) {
      try {
        const bucketRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
          headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` }
        });
        if (bucketRes.ok) {
          const buckets = await bucketRes.json();
          if (Array.isArray(buckets)) {
            storageBuckets = buckets.map((b) => ({ name: b.name, public: Boolean(b.public) }));
          }
        }
      } catch {
        // Storage API optional
      }

      try {
        const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
          headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` }
        });
        if (usersRes.ok) {
          const payload = await usersRes.json();
          if (typeof payload?.total === 'number') {
            authUsersCount = payload.total;
          } else if (Array.isArray(payload?.users)) {
            authUsersCount = payload.users.length;
          }
        }
      } catch {
        // Auth admin summary optional
      }
    }

    const recentLogs = await supabaseRequest(
      env,
      '/rest/v1/admin_activity_logs?select=action,resource,created_at&order=created_at.desc&limit=10',
      { accessToken: auth.token }
    ).catch(() => []);

    const errorsCount = counts.filter((c) => c.status === 'error').length;
    const totalRows = counts.reduce((sum, c) => sum + (Number.isFinite(c.rows) ? c.rows : 0), 0);

    return {
      service: 'supabase',
      name: 'Supabase Database & Auth',
      status: errorsCount === counts.length ? 'Connection error' : 'Connected',
      lastSyncedAt: checkedAt,
      latencyMs: Date.now() - startedAt,
      error: errorsCount > 0 ? `${errorsCount} table count query failed` : null,
      missingCredentials: [],
      availableMetrics: [
        'Table row counts',
        'Query latency',
        'Storage bucket status',
        'Auth registered users',
        'Admin activity stream'
      ],
      data: {
        reachable: true,
        totalRows,
        tablesCount: tables.length,
        errorTables: errorsCount,
        tables: counts,
        storageBuckets,
        authUsersCount,
        recentAdminActivity: Array.isArray(recentLogs) ? recentLogs : []
      }
    };
  } catch (err) {
    return {
      service: 'supabase',
      name: 'Supabase Database & Auth',
      status: 'Connection error',
      lastSyncedAt: null,
      latencyMs: Date.now() - startedAt,
      error: err.message,
      missingCredentials: [],
      availableMetrics: [],
      data: null
    };
  }
}

export async function fetchGa4Data(env, fromDate, toDate) {
  const checkedAt = new Date().toISOString();
  const propertyId = (env.GA4_PROPERTY_ID || '').trim();
  const baseMeta = {
    service: 'ga4',
    name: 'Google Analytics 4',
    measurementId: env.PUBLIC_GA4_MEASUREMENT_ID || 'G-K6P94Q968B',
    gtmContainerId: 'GTM-PHCDRQNJ',
    availableMetrics: [
      'Active users',
      'New users',
      'Page views',
      'Sessions',
      'Average engagement time',
      'Top events',
      'Traffic sources',
      'Landing pages'
    ],
    setupInstructions: 'Provision GA4_PROPERTY_ID (numeric Property ID from GA4 Admin -> Property Settings, NOT Measurement ID G-K6P94Q968B) and GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY) in Cloudflare Pages Secrets, then grant the Service Account Viewer role on the GA4 property.'
  };

  if (!propertyId) {
    const authProbe = await getGoogleAccessToken(env, 'https://www.googleapis.com/auth/analytics.readonly');
    const missing = ['GA4_PROPERTY_ID', ...(authProbe.missing || [])];
    return {
      ...baseMeta,
      status: 'Not configured',
      lastSyncedAt: null,
      error: `Missing server environment variable(s): ${missing.join(', ')}. Note: GA4_PROPERTY_ID is the numeric ID, distinct from Measurement ID G-K6P94Q968B.`,
      missingCredentials: missing,
      data: null
    };
  }

  if (!/^\d+$/.test(propertyId)) {
    return {
      ...baseMeta,
      status: 'Not configured',
      lastSyncedAt: null,
      error: `GA4_PROPERTY_ID must be numeric (got "${propertyId}"). Do not use Measurement ID G-K6P94Q968B here.`,
      missingCredentials: ['GA4_PROPERTY_ID (numeric)'],
      data: null
    };
  }

  const tokenResult = await getGoogleAccessToken(env, 'https://www.googleapis.com/auth/analytics.readonly');
  if (!tokenResult.ok) {
    return {
      ...baseMeta,
      status: tokenResult.missing ? 'Not configured' : 'Authentication required',
      lastSyncedAt: null,
      error: tokenResult.error || `Missing Google credentials: ${(tokenResult.missing || []).join(', ')}`,
      missingCredentials: tokenResult.missing || [],
      data: null
    };
  }

  const startDate = isoDay(fromDate);
  const endDate = isoDay(toDate);
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const headers = {
    Authorization: `Bearer ${tokenResult.accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const [summaryResp, dailyResp, landingResp, sourceResp, eventResp] = await Promise.all([
      fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'screenPageViews' },
            { name: 'sessions' },
            { name: 'userEngagementDuration' },
            { name: 'eventCount' }
          ]
        })
      }),
      fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'screenPageViews' },
            { name: 'sessions' },
            { name: 'userEngagementDuration' },
            { name: 'eventCount' }
          ],
          orderBys: [{ dimension: { dimensionName: 'date' } }]
        })
      }),
      fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'landingPage' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
          limit: 10
        })
      }),
      fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          limit: 10
        })
      }),
      fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          limit: 15
        })
      })
    ]);

    if (!dailyResp.ok) {
      const errBody = await dailyResp.json().catch(() => ({}));
      const msg = errBody?.error?.message || `GA4 Data API returned HTTP ${dailyResp.status}`;
      return {
        ...baseMeta,
        status: dailyResp.status === 401 || dailyResp.status === 403 ? 'Authentication required' : 'Connection error',
        lastSyncedAt: null,
        error: msg,
        missingCredentials: [],
        data: null
      };
    }

    const dailyJson = await dailyResp.json();
    const landingJson = landingResp.ok ? await landingResp.json() : { rows: [] };
    const sourceJson = sourceResp.ok ? await sourceResp.json() : { rows: [] };
    const eventJson = eventResp.ok ? await eventResp.json() : { rows: [] };

    const daily = (dailyJson.rows || []).map((row) => {
      const rawDate = row.dimensionValues?.[0]?.value || '';
      const formattedDate = rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
      const m = (idx) => Number(row.metricValues?.[idx]?.value || 0);
      return {
        date: formattedDate,
        activeUsers: m(0),
        newUsers: m(1),
        views: m(2),
        sessions: m(3),
        engagementSeconds: m(4),
        events: m(5)
      };
    });

    const summaryJson = summaryResp.ok ? await summaryResp.json().catch(() => null) : null;
    const summaryRow = summaryJson?.rows?.[0]?.metricValues;
    const summedTotals = daily.reduce(
      (acc, d) => {
        acc.activeUsers += d.activeUsers;
        acc.newUsers += d.newUsers;
        acc.views += d.views;
        acc.sessions += d.sessions;
        acc.engagementSeconds += d.engagementSeconds;
        acc.events += d.events;
        return acc;
      },
      { activeUsers: 0, newUsers: 0, views: 0, sessions: 0, engagementSeconds: 0, events: 0 }
    );
    const totals = Array.isArray(summaryRow)
      ? {
          activeUsers: Number(summaryRow[0]?.value || 0),
          newUsers: Number(summaryRow[1]?.value || 0),
          views: Number(summaryRow[2]?.value || 0),
          sessions: Number(summaryRow[3]?.value || 0),
          engagementSeconds: Number(summaryRow[4]?.value || 0),
          events: Number(summaryRow[5]?.value || 0)
        }
      : summedTotals;

    const avgEngagementSeconds = totals.activeUsers > 0
      ? Math.round(totals.engagementSeconds / totals.activeUsers)
      : 0;

    return {
      ...baseMeta,
      status: 'Connected',
      lastSyncedAt: checkedAt,
      error: null,
      missingCredentials: [],
      data: {
        dateRange: { startDate, endDate },
        totals: { ...totals, avgEngagementSeconds },
        daily,
        landingPages: (landingJson.rows || []).map((r) => ({
          page: r.dimensionValues?.[0]?.value || '(not set)',
          sessions: Number(r.metricValues?.[0]?.value || 0),
          activeUsers: Number(r.metricValues?.[1]?.value || 0),
          views: Number(r.metricValues?.[2]?.value || 0)
        })),
        trafficSources: (sourceJson.rows || []).map((r) => ({
          channel: r.dimensionValues?.[0]?.value || 'Direct',
          sessions: Number(r.metricValues?.[0]?.value || 0),
          activeUsers: Number(r.metricValues?.[1]?.value || 0)
        })),
        events: (eventJson.rows || []).map((r) => ({
          eventName: r.dimensionValues?.[0]?.value || 'unknown',
          count: Number(r.metricValues?.[0]?.value || 0)
        }))
      }
    };
  } catch (err) {
    return {
      ...baseMeta,
      status: 'Connection error',
      lastSyncedAt: null,
      error: err.message,
      missingCredentials: [],
      data: null
    };
  }
}

export async function fetchAdsterraData(env, fromDate, toDate) {
  const checkedAt = new Date().toISOString();
  const apiToken = (env.ADSTERRA_API_TOKEN || '').trim();
  const baseMeta = {
    service: 'adsterra',
    name: 'Adsterra Publisher API',
    availableMetrics: [
      'Impressions',
      'Clicks',
      'CPM',
      'Estimated revenue',
      'Performance by placement & format',
      'Daily revenue trend'
    ],
    setupInstructions: 'Generate a read-only Publisher API Token in Adsterra Dashboard -> API, and add ADSTERRA_API_TOKEN in Cloudflare Pages Settings -> Environment variables.'
  };

  if (!apiToken) {
    return {
      ...baseMeta,
      status: 'Not configured',
      lastSyncedAt: null,
      error: 'Missing server environment variable: ADSTERRA_API_TOKEN. Only local ad placement configuration is shown; zero live revenue/impression numbers are simulated.',
      missingCredentials: ['ADSTERRA_API_TOKEN'],
      data: null
    };
  }

  const startDate = isoDay(fromDate);
  const finishDate = isoDay(toDate);

  try {
    const headers = { 'X-API-Key': apiToken, Accept: 'application/json' };
    const [statsDateRes, statsPlacementRes, placementsRes] = await Promise.all([
      fetch(`https://api3.adsterratools.com/publisher/stats.json?start_date=${encodeURIComponent(startDate)}&finish_date=${encodeURIComponent(finishDate)}&group_by[]=date`, { headers }),
      fetch(`https://api3.adsterratools.com/publisher/stats.json?start_date=${encodeURIComponent(startDate)}&finish_date=${encodeURIComponent(finishDate)}&group_by[]=placement`, { headers }),
      fetch('https://api3.adsterratools.com/publisher/placements.json', { headers }).catch(() => null)
    ]);

    if (statsDateRes.status === 401 || statsDateRes.status === 403) {
      return {
        ...baseMeta,
        status: 'Authentication required',
        lastSyncedAt: null,
        error: `Adsterra API rejected token (HTTP ${statsDateRes.status}). Check ADSTERRA_API_TOKEN.`,
        missingCredentials: [],
        data: null
      };
    }

    if (!statsDateRes.ok) {
      return {
        ...baseMeta,
        status: 'Connection error',
        lastSyncedAt: null,
        error: `Adsterra Publisher API returned HTTP ${statsDateRes.status}.`,
        missingCredentials: [],
        data: null
      };
    }

    const datePayload = await statsDateRes.json();
    const placementPayload = statsPlacementRes.ok ? await statsPlacementRes.json() : { items: [] };
    const metaPayload = placementsRes && placementsRes.ok ? await placementsRes.json() : { items: [] };

    const placementNames = new Map();
    for (const p of metaPayload.items || []) {
      placementNames.set(String(p.id), p.title || p.alias || `Unit ${p.id}`);
    }

    const daily = (datePayload.items || []).map((item) => ({
      date: item.date,
      impressions: Number(item.impression || 0),
      clicks: Number(item.clicks || 0),
      ctr: Number(item.ctr || 0),
      cpm: Number(item.cpm || 0),
      revenue: Number(item.revenue || 0)
    }));

    const byPlacement = (placementPayload.items || []).map((item) => {
      const pid = String(item.placement || '');
      return {
        placementId: pid,
        name: placementNames.get(pid) || `Unit ${pid}`,
        impressions: Number(item.impression || 0),
        clicks: Number(item.clicks || 0),
        ctr: Number(item.ctr || 0),
        cpm: Number(item.cpm || 0),
        revenue: Number(item.revenue || 0)
      };
    });

    const totals = daily.reduce(
      (acc, d) => {
        acc.impressions += d.impressions;
        acc.clicks += d.clicks;
        acc.revenue += d.revenue;
        return acc;
      },
      { impressions: 0, clicks: 0, revenue: 0 }
    );
    totals.cpm = totals.impressions > 0 ? Math.round((totals.revenue / totals.impressions) * 100000) / 100 : 0;
    totals.ctr = totals.impressions > 0 ? Math.round((totals.clicks / totals.impressions) * 10000) / 100 : 0;
    totals.revenue = Math.round(totals.revenue * 1000) / 1000;

    return {
      ...baseMeta,
      status: 'Connected',
      lastSyncedAt: checkedAt,
      error: null,
      missingCredentials: [],
      data: {
        totals,
        daily,
        byPlacement,
        popunderStatus: 'Unit 32172757 permanently disabled'
      }
    };
  } catch (err) {
    return {
      ...baseMeta,
      status: 'Connection error',
      lastSyncedAt: null,
      error: err.message,
      missingCredentials: [],
      data: null
    };
  }
}

export async function fetchSearchConsoleData(env, fromDate, toDate) {
  const checkedAt = new Date().toISOString();
  const siteUrl = (env.GSC_SITE_URL || '').trim();
  const baseMeta = {
    service: 'gsc',
    name: 'Google Search Console',
    availableMetrics: [
      'Search clicks',
      'Impressions',
      'CTR',
      'Average search position',
      'Top search queries',
      'Top landing pages',
      'Sitemap status'
    ],
    setupInstructions: 'Set GSC_SITE_URL (e.g. https://prepwises.online/ or sc-domain:prepwises.online) and GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY) in Cloudflare Pages Secrets, and add the Service Account email in Google Search Console -> Settings -> Users & permissions.'
  };

  if (!siteUrl) {
    const authProbe = await getGoogleAccessToken(env, 'https://www.googleapis.com/auth/webmasters.readonly');
    const missing = ['GSC_SITE_URL', ...(authProbe.missing || [])];
    return {
      ...baseMeta,
      status: 'Not configured',
      lastSyncedAt: null,
      error: `Missing server environment variable(s): ${missing.join(', ')}.`,
      missingCredentials: missing,
      data: null
    };
  }

  const tokenResult = await getGoogleAccessToken(env, 'https://www.googleapis.com/auth/webmasters.readonly');
  if (!tokenResult.ok) {
    return {
      ...baseMeta,
      status: tokenResult.missing ? 'Not configured' : 'Authentication required',
      lastSyncedAt: null,
      error: tokenResult.error || `Missing Google credentials: ${(tokenResult.missing || []).join(', ')}`,
      missingCredentials: tokenResult.missing || [],
      data: null
    };
  }

  const startDate = isoDay(fromDate);
  const endDate = isoDay(toDate);
  const encodedSite = encodeURIComponent(siteUrl);
  const headers = {
    Authorization: `Bearer ${tokenResult.accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const queryUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;
    const [dailyResp, queryResp, pageResp, sitemapResp] = await Promise.all([
      fetch(queryUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ startDate, endDate, dimensions: ['date'], rowLimit: 90 })
      }),
      fetch(queryUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 15 })
      }),
      fetch(queryUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ startDate, endDate, dimensions: ['page'], rowLimit: 15 })
      }),
      fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps`, { headers }).catch(() => null)
    ]);

    if (!dailyResp.ok) {
      const errBody = await dailyResp.json().catch(() => ({}));
      return {
        ...baseMeta,
        status: dailyResp.status === 401 || dailyResp.status === 403 ? 'Authentication required' : 'Connection error',
        lastSyncedAt: null,
        error: errBody?.error?.message || `Search Console API returned HTTP ${dailyResp.status}`,
        missingCredentials: [],
        data: null
      };
    }

    const dailyJson = await dailyResp.json();
    const queryJson = queryResp.ok ? await queryResp.json() : { rows: [] };
    const pageJson = pageResp.ok ? await pageResp.json() : { rows: [] };
    const sitemapJson = sitemapResp && sitemapResp.ok ? await sitemapResp.json() : { sitemap: [] };

    const daily = (dailyJson.rows || []).map((r) => ({
      date: r.keys?.[0] || '',
      clicks: Number(r.clicks || 0),
      impressions: Number(r.impressions || 0),
      ctr: Math.round(Number(r.ctr || 0) * 10000) / 100,
      position: Math.round(Number(r.position || 0) * 10) / 10
    }));

    const totals = daily.reduce(
      (acc, d) => {
        acc.clicks += d.clicks;
        acc.impressions += d.impressions;
        acc.posWeighted += d.position * d.impressions;
        return acc;
      },
      { clicks: 0, impressions: 0, posWeighted: 0 }
    );

    const ctr = totals.impressions > 0 ? Math.round((totals.clicks / totals.impressions) * 10000) / 100 : 0;
    const avgPosition = totals.impressions > 0 ? Math.round((totals.posWeighted / totals.impressions) * 10) / 10 : null;

    return {
      ...baseMeta,
      status: 'Connected',
      lastSyncedAt: checkedAt,
      error: null,
      missingCredentials: [],
      data: {
        siteUrl,
        dateRange: { startDate, endDate },
        totals: { clicks: totals.clicks, impressions: totals.impressions, ctr, avgPosition },
        daily,
        topQueries: (queryJson.rows || []).map((r) => ({
          query: r.keys?.[0] || '',
          clicks: Number(r.clicks || 0),
          impressions: Number(r.impressions || 0),
          ctr: Math.round(Number(r.ctr || 0) * 10000) / 100,
          position: Math.round(Number(r.position || 0) * 10) / 10
        })),
        topPages: (pageJson.rows || []).map((r) => ({
          page: r.keys?.[0] || '',
          clicks: Number(r.clicks || 0),
          impressions: Number(r.impressions || 0),
          ctr: Math.round(Number(r.ctr || 0) * 10000) / 100,
          position: Math.round(Number(r.position || 0) * 10) / 10
        })),
        sitemaps: (sitemapJson.sitemap || []).map((s) => ({
          path: s.path,
          lastSubmitted: s.lastSubmitted,
          lastDownloaded: s.lastDownloaded,
          isPending: Boolean(s.isPending),
          warnings: Number(s.warnings || 0),
          errors: Number(s.errors || 0),
          contents: s.contents || []
        }))
      }
    };
  } catch (err) {
    return {
      ...baseMeta,
      status: 'Connection error',
      lastSyncedAt: null,
      error: err.message,
      missingCredentials: [],
      data: null
    };
  }
}

function normalizeCloudflareProjectSlug(rawValue, fallbackSlug = 'prepwise-7ij') {
  let cleaned = String(rawValue || '').trim().replace(/^['"]+|['"]+$/g, '');
  if (!cleaned) return fallbackSlug;
  cleaned = cleaned.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (/\.pages\.dev$/i.test(cleaned)) {
    cleaned = cleaned.replace(/\.pages\.dev$/i, '');
  }
  return cleaned || fallbackSlug;
}

function getSiteHostname(env) {
  const raw = (env.PUBLIC_SITE_URL || 'https://prepwises.online').trim();
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return 'prepwises.online';
  }
}

export async function fetchCloudflareData(env, fromDate, toDate) {
  const checkedAt = new Date().toISOString();
  const apiToken = (env.CLOUDFLARE_API_TOKEN || '').trim();
  const accountId = (env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  let project = normalizeCloudflareProjectSlug(env.CLOUDFLARE_PAGES_PROJECT, 'prepwise-7ij');
  const zoneId = (env.CLOUDFLARE_ZONE_ID || '').trim();
  const siteHost = getSiteHostname(env);

  const baseMeta = {
    service: 'cloudflare',
    name: 'Cloudflare Pages & Analytics',
    projectName: project,
    availableMetrics: [
      'Pages deployment history',
      'Latest production deployment status',
      'Failed deployments',
      'Zone requests & bandwidth (with CLOUDFLARE_ZONE_ID)'
    ],
    setupInstructions: 'Create a read-only Cloudflare API Token with Account:Cloudflare Pages:Read and Zone:Analytics:Read. Add CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and optionally CLOUDFLARE_ZONE_ID (plus optional CLOUDFLARE_PAGES_PROJECT, defaulting to prepwise-7ij) in Cloudflare Pages Secrets.'
  };

  const missing = [];
  if (!apiToken) missing.push('CLOUDFLARE_API_TOKEN');
  if (!accountId) missing.push('CLOUDFLARE_ACCOUNT_ID');

  if (missing.length > 0) {
    return {
      ...baseMeta,
      status: 'Not configured',
      lastSyncedAt: null,
      error: `Missing server environment variable(s): ${missing.join(', ')}.`,
      missingCredentials: missing,
      data: null
    };
  }

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  };

  const fetchDeploymentsForProject = async (slug) => {
    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(slug)}/deployments?per_page=10`,
      { headers }
    );
    const payload = await resp.json().catch(() => ({}));
    return { resp, payload };
  };

  try {
    let { resp: depResp, payload: depPayload } = await fetchDeploymentsForProject(project);

    if (depResp.status === 401 || depResp.status === 403) {
      return {
        ...baseMeta,
        status: 'Authentication required',
        lastSyncedAt: null,
        error: depPayload?.errors?.[0]?.message || `Cloudflare API authentication error (HTTP ${depResp.status}).`,
        missingCredentials: [],
        data: null
      };
    }

    const isProjectNotFound =
      depResp.status === 404 ||
      depPayload?.errors?.some((err) => err?.code === 8000007 || /project not found/i.test(err?.message || ''));

    // If the initial project slug is not found, inspect the account's Pages projects (Pages:Read)
    // to match prepwise-7ij, prepwise-7ij.pages.dev, or prepwises.online and recover automatically.
    if (isProjectNotFound) {
      const listResp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects`,
        { headers }
      ).catch(() => null);
      const listPayload = listResp ? await listResp.json().catch(() => ({})) : {};
      const projects = Array.isArray(listPayload?.result) ? listPayload.result : [];

      const matched =
        projects.find((p) => p?.name === 'prepwise-7ij') ||
        projects.find((p) => (p?.subdomain || '').toLowerCase() === 'prepwise-7ij.pages.dev') ||
        projects.find(
          (p) =>
            Array.isArray(p?.domains) &&
            p.domains.some((dom) => {
              const dLower = String(dom || '').toLowerCase();
              return dLower === 'prepwise-7ij.pages.dev' || dLower === siteHost;
            })
        );

      if (matched?.name && matched.name !== project) {
        project = matched.name;
        baseMeta.projectName = project;
        ({ resp: depResp, payload: depPayload } = await fetchDeploymentsForProject(project));
      } else if (!matched && listResp?.ok) {
        const available = projects
          .slice(0, 10)
          .map((p) => (p?.subdomain ? `${p.name} (${p.subdomain})` : p?.name))
          .filter(Boolean);
        const origMsg = depPayload?.errors?.[0]?.message || `Cloudflare API error (HTTP ${depResp.status}).`;
        return {
          ...baseMeta,
          status: 'Connection error',
          lastSyncedAt: null,
          error: available.length
            ? `${origMsg} Requested project: "${project}". Available projects in configured account: ${available.join(', ')}.`
            : `${origMsg} Requested project: "${project}". No Pages projects were returned for the configured CLOUDFLARE_ACCOUNT_ID.`,
          missingCredentials: [],
          data: null
        };
      }
    }

    if (!depResp.ok || !depPayload.success) {
      return {
        ...baseMeta,
        status: 'Connection error',
        lastSyncedAt: null,
        error: `${depPayload?.errors?.[0]?.message || `Cloudflare API error (HTTP ${depResp.status}).`} (project: "${project}")`,
        missingCredentials: [],
        data: null
      };
    }

    const deployments = (depPayload.result || []).map((d) => ({
      id: d.short_id || d.id?.slice(0, 8),
      environment: d.environment,
      url: d.url,
      status: d.latest_stage?.status || 'unknown',
      stage: d.latest_stage?.name || 'deploy',
      commitHash: d.deployment_trigger?.metadata?.commit_hash?.slice(0, 7) || '—',
      commitMessage: d.deployment_trigger?.metadata?.commit_message || '—',
      createdOn: d.created_on
    }));

    const latestProd = deployments.find((d) => d.environment === 'production') || deployments[0] || null;
    const failedCount = deployments.filter((d) => d.status === 'failure' || d.status === 'failed').length;

    let traffic = null;
    let zoneStatus = zoneId ? 'error' : 'not_configured';
    let zoneError = zoneId
      ? null
      : 'CLOUDFLARE_ZONE_ID is not configured in Cloudflare Pages Production Variables for prepwises.online.';

    if (zoneId) {
      const startDay = isoDay(fromDate);
      const endDay = isoDay(toDate);
      const gqlQuery = {
        query: `query ($zoneTag: String!, $since: Date!, $until: Date!) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequests1dGroups(limit: 90, filter: { date_geq: $since, date_leq: $until }, orderBy: [date_ASC]) {
                dimensions { date }
                sum { requests cachedRequests bytes pageViews threats }
              }
            }
          }
        }`,
        variables: { zoneTag: zoneId, since: startDay, until: endDay }
      };

      const gqlResp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify(gqlQuery)
      }).catch((err) => ({ ok: false, _fetchError: err?.message }));

      if (gqlResp && gqlResp.ok) {
        const gqlPayload = await gqlResp.json().catch(() => ({}));
        if (Array.isArray(gqlPayload?.errors) && gqlPayload.errors.length > 0) {
          zoneStatus = 'error';
          zoneError = gqlPayload.errors[0]?.message || 'Cloudflare GraphQL query returned an error.';
        } else {
          const groups = gqlPayload?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
          const dailyTraffic = groups.map((g) => ({
            date: g.dimensions?.date,
            requests: g.sum?.requests || 0,
            cachedRequests: g.sum?.cachedRequests || 0,
            bytes: g.sum?.bytes || 0,
            pageViews: g.sum?.pageViews || 0,
            threats: g.sum?.threats || 0
          }));
          const totals = dailyTraffic.reduce(
            (acc, row) => {
              acc.requests += row.requests;
              acc.cachedRequests += row.cachedRequests;
              acc.bytes += row.bytes;
              acc.pageViews += row.pageViews;
              return acc;
            },
            { requests: 0, cachedRequests: 0, bytes: 0, pageViews: 0 }
          );
          traffic = { totals, daily: dailyTraffic };
          zoneStatus = 'connected';
          zoneError = null;
        }
      } else {
        zoneStatus = 'error';
        zoneError = gqlResp?._fetchError || `Cloudflare GraphQL API returned HTTP ${gqlResp?.status || 'error'}. Check Zone:Analytics:Read permission and CLOUDFLARE_ZONE_ID.`;
      }
    }

    return {
      ...baseMeta,
      status: 'Connected',
      lastSyncedAt: checkedAt,
      error: null,
      missingCredentials: [],
      data: {
        latestProduction: latestProd,
        failedDeployments: failedCount,
        deployments,
        zoneConfigured: Boolean(zoneId),
        zoneStatus,
        zoneError,
        traffic
      }
    };
  } catch (err) {
    return {
      ...baseMeta,
      status: 'Connection error',
      lastSyncedAt: null,
      error: err.message,
      missingCredentials: [],
      data: null
    };
  }
}

export async function runLiveWebsiteHealthChecks(env, requestUrl) {
  const checkedAt = new Date().toISOString();
  let origin;
  try {
    origin = (env.PUBLIC_SITE_URL || new URL(requestUrl).origin).replace(/\/$/, '');
  } catch {
    origin = 'https://prepwises.online';
  }

  const probes = [
    { name: 'Homepage', path: '/' },
    { name: 'Company Profile (TCS)', path: '/company?id=tcs' },
    { name: 'Quiz Page', path: '/quiz' },
    { name: 'API Health (/api/health)', path: '/api/health' },
    { name: 'Public Config (/api/config)', path: '/api/config' },
    { name: 'Sitemap XML', path: '/sitemap.xml' },
    { name: 'App Script (/js/app.js)', path: '/js/app.js' }
  ];

  const results = await Promise.all(
    probes.map(async (probe) => {
      const targetUrl = `${origin}${probe.path}`;
      const start = Date.now();
      try {
        const res = await fetch(targetUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'PrepWise-HealthMonitor/1.0' }
        });
        const latencyMs = Date.now() - start;
        await res.arrayBuffer().catch(() => {});
        return {
          name: probe.name,
          url: targetUrl,
          status: res.status,
          ok: res.ok,
          latencyMs
        };
      } catch (err) {
        return {
          name: probe.name,
          url: targetUrl,
          status: 0,
          ok: false,
          latencyMs: Date.now() - start,
          error: err.message
        };
      }
    })
  );

  const failed = results.filter((r) => !r.ok);
  const avgLatencyMs = results.length
    ? Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length)
    : 0;

  return {
    service: 'health',
    name: 'Live Endpoint Health',
    status: failed.length === 0 ? 'Connected' : (failed.length === results.length ? 'Connection error' : 'Data unavailable'),
    lastSyncedAt: checkedAt,
    error: failed.length > 0 ? `${failed.length}/${results.length} endpoint checks failed` : null,
    missingCredentials: [],
    availableMetrics: ['HTTP status codes', 'Response latency (ms)', 'Sitemap & API availability'],
    data: {
      origin,
      allHealthy: failed.length === 0,
      healthyCount: results.length - failed.length,
      totalCount: results.length,
      avgLatencyMs,
      checkedAt,
      endpoints: results
    }
  };
}

export async function gatherIntegrationsReport(context, options = {}) {
  const url = new URL(context.request.url);
  const range = defaultRange(url.searchParams.get('from'), url.searchParams.get('to'), 7);
  const targetService = options.service || url.searchParams.get('service') || 'all';

  const tasks = {};
  if (targetService === 'all' || targetService === 'supabase') {
    tasks.supabase = fetchSupabaseHealth(context.env, context.auth);
  }
  if (targetService === 'all' || targetService === 'ga4') {
    tasks.ga4 = fetchGa4Data(context.env, range.from, range.to);
  }
  if (targetService === 'all' || targetService === 'adsterra') {
    tasks.adsterra = fetchAdsterraData(context.env, range.from, range.to);
  }
  if (targetService === 'all' || targetService === 'gsc') {
    tasks.gsc = fetchSearchConsoleData(context.env, range.from, range.to);
  }
  if (targetService === 'all' || targetService === 'cloudflare') {
    tasks.cloudflare = fetchCloudflareData(context.env, range.from, range.to);
  }
  if (targetService === 'all' || targetService === 'health') {
    tasks.health = runLiveWebsiteHealthChecks(context.env, context.request.url);
  }

  const keys = Object.keys(tasks);
  const settled = await Promise.all(keys.map((k) => tasks[k]));
  const integrations = {};
  keys.forEach((k, idx) => {
    integrations[k] = settled[idx];
  });

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString()
    },
    generatedAt: new Date().toISOString(),
    integrations
  };
}

