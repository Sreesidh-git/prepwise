(function () {
  'use strict';

  const config = window.PREPWISE_CONFIG || {};
  if (!config.supabaseAnonKey) {
    config.supabaseAnonKey = config.supabasePublishableKey || '';
  }

  function getAdsterraConfigUnits() {
    const cfg = window.PREPWISE_ADSTERRA_CONFIG;
    if (!cfg || !cfg.units) return [];
    return Object.values(cfg.units);
  }

  function getUnitPolicyStatusMeta(unitId, controls, controlsError, opts = {}) {
    const isPop = String(unitId) === '32172757';
    if (!controls || !controls.units) {
      return {
        pillClass: 'status-unavailable',
        label: controlsError ? 'Unavailable' : (opts.loadingLabel || 'Checking...'),
        unitEnabled: false,
        masterOn: false,
        loaded: false
      };
    }
    const masterOn = controls.masterEnabled !== false;
    const unitEnabled = controls.units[String(unitId)] === true;
    if (!unitEnabled) {
      return {
        pillClass: 'status-inactive',
        label: isPop ? 'OFF (Default, Owner-Controlled)' : 'OFF',
        unitEnabled: false,
        masterOn,
        loaded: true
      };
    }
    if (!masterOn) {
      return {
        pillClass: 'status-unavailable',
        label: 'Paused (Master OFF)',
        unitEnabled: true,
        masterOn: false,
        loaded: true
      };
    }
    return {
      pillClass: isPop ? 'status-error' : 'status-connected',
      label: isPop ? 'ON (Owner Enabled)' : 'ON',
      unitEnabled: true,
      masterOn: true,
      loaded: true
    };
  }

  function getPopunderPolicySummary(controls, controlsError) {
    if (!controls || !controls.units) {
      return controlsError
        ? 'Popunder unit <code>32172757</code> is OFF by default and Owner-controlled (saved controls unavailable).'
        : 'Popunder unit <code>32172757</code> is OFF by default and Owner-controlled (loading saved controls...).';
    }
    const masterOn = controls.masterEnabled !== false;
    const popOn = controls.units['32172757'] === true;
    if (!popOn) {
      return 'Popunder unit <code>32172757</code> is OFF (default; Owner-controlled).';
    }
    if (!masterOn) {
      return 'Popunder unit <code>32172757</code> is saved ON by Owner, currently paused while Master Advertising is OFF.';
    }
    return 'Popunder unit <code>32172757</code> is ON (explicitly enabled by Owner).';
  }

  function syncAdvertisingFilterFromOverview() {
    const ovPeriod = document.getElementById('overviewPeriod')?.value || '7';
    const adPeriodEl = document.getElementById('advertisingPeriod');
    const adFromEl = document.getElementById('advertisingFrom');
    const adToEl = document.getElementById('advertisingTo');
    const adForm = document.getElementById('advertisingFilters');
    if (adPeriodEl) adPeriodEl.value = ovPeriod;
    if (adFromEl) adFromEl.value = document.getElementById('overviewFrom')?.value || '';
    if (adToEl) adToEl.value = document.getElementById('overviewTo')?.value || '';
    if (adForm) adForm.classList.toggle('is-custom', ovPeriod === 'custom');
  }

  function formatAdReportingRange(adsterra, fallbackParams = null) {
    const dr = adsterra?.data?.dateRange;
    if (dr?.startDate && dr?.endDate) {
      return `${dr.startDate} to ${dr.endDate} (UTC)`;
    }
    if (fallbackParams) {
      const from = fallbackParams.get('from')?.slice(0, 10);
      const to = fallbackParams.get('to')?.slice(0, 10);
      if (from && to) return `${from} to ${to} (UTC)`;
    }
    return 'selected period';
  }

  function renderAdvertisingPlacements() {
    const container = document.getElementById('advertisingPlacements');
    if (!container) return;
    const placements = window.PREPWISE_AD_REGISTRY?.placements || [];
    const cfg = window.PREPWISE_ADSTERRA_CONFIG;
    const controls = state.adControls;
    const controlsError = state.adControlsError;
    const controlsLoaded = Boolean(controls && controls.units);
    const permissions = state.adControlsPermissions || { canToggleUnits: true, canTogglePopunder: state.isOwner };
    const adApi = state.lastAdReport || state.integrationsReport?.integrations?.adsterra;
    const apiStatsMap = new Map();
    if (adApi?.status === 'Connected' && Array.isArray(adApi.data?.byPlacement)) {
      adApi.data.byPlacement.forEach((p) => apiStatsMap.set(String(p.placementId), p));
    }

    const masterSwitchEl = document.getElementById('adMasterSwitch');
    const masterLabelEl = document.getElementById('adMasterLabel');
    const enableEligibleBtn = document.getElementById('adEnableEligibleBtn');
    const disableAllBtn = document.getElementById('adDisableAllBtn');
    const masterOn = controlsLoaded ? controls.masterEnabled !== false : false;
    if (masterSwitchEl) {
      masterSwitchEl.checked = masterOn;
      masterSwitchEl.disabled = !controlsLoaded;
    }
    if (masterLabelEl) {
      masterLabelEl.textContent = controlsLoaded ? (masterOn ? 'ON' : 'OFF') : (controlsError ? 'Unavailable' : 'Loading...');
    }
    if (enableEligibleBtn) enableEligibleBtn.disabled = !controlsLoaded;
    if (disableAllBtn) disableAllBtn.disabled = !controlsLoaded;

    const unitCardsHtml = getAdsterraConfigUnits().map((u) => {
      const apiRow = apiStatsMap.get(String(u.unitId));
      const isPopunder = u.unitId === '32172757';
      const statusMeta = getUnitPolicyStatusMeta(u.unitId, controls, controlsError, { loadingLabel: 'Loading...' });
      const canToggleThis = controlsLoaded && (isPopunder ? Boolean(permissions.canTogglePopunder) : Boolean(permissions.canToggleUnits));
      const permissionBadge = isPopunder
        ? (state.isOwner ? 'Owner Only (Confirm Required)' : 'Owner Only (Locked for Admin)')
        : 'Admin & Owner';
      const switchStateText = !controlsLoaded ? '—' : (statusMeta.unitEnabled ? 'ON' : 'OFF');

      return `
        <article class="ad-unit-card" data-unit-card="${escapeHtml(u.unitId)}">
          <div class="ad-unit-card-head">
            <div>
              <strong>Unit ${escapeHtml(u.unitId)} &mdash; ${escapeHtml(u.name || u.format)}</strong>
              <div class="ad-unit-card-meta">
                <span>Format: <code>${escapeHtml(u.format)}</code></span>
                <span>&bull;</span>
                <span>${escapeHtml(permissionBadge)}</span>
              </div>
            </div>
            <span class="status-pill ${statusMeta.pillClass}">${escapeHtml(statusMeta.label)}</span>
          </div>
          <div class="ad-unit-control-row">
            <label class="switch-toggle" title="${!controlsLoaded ? 'Saved ad controls unavailable' : (isPopunder && !canToggleThis ? 'Owner approval required for Popunder unit 32172757' : `Toggle Unit ${u.unitId}`)}">
              <input type="checkbox" class="ad-unit-toggle" data-unit-id="${escapeHtml(u.unitId)}" aria-label="Toggle Unit ${escapeHtml(u.unitId)} (${escapeHtml(u.name || u.format)})" ${statusMeta.unitEnabled ? 'checked' : ''} ${canToggleThis ? '' : 'disabled'}>
              <span class="switch-slider"></span>
              <span class="ad-toggle-state-text">${switchStateText}</span>
            </label>
            <span class="muted" style="font-size:11px;">${!controlsLoaded ? 'Controls unavailable' : (isPopunder ? (canToggleThis ? 'Confirmation modal required to enable' : 'Requires Owner login') : 'Independent unit toggle')}</span>
          </div>
          <div class="ad-unit-stats-row">
            <div><span>Impressions</span><strong>${apiRow ? apiRow.impressions.toLocaleString() : '—'}</strong></div>
            <div><span>Clicks</span><strong>${apiRow ? apiRow.clicks.toLocaleString() : '—'}</strong></div>
            <div><span>CPM</span><strong>${apiRow ? `$${Number(apiRow.cpm).toFixed(2)}` : '—'}</strong></div>
            <div><span>Revenue</span><strong>${apiRow ? `$${Number(apiRow.revenue).toFixed(3)}` : '—'}</strong></div>
          </div>
        </article>
      `;
    }).join('');

    const placementRows = placements.map((placement) => {
      const pc = cfg?.placements?.[placement.id];
      const activeUnit = pc ? (pc.desktopUnitId || pc.mobileUnitId || pc.unitId || '—') : '—';
      const isProhibited = placement.status === 'permanently-disabled' || placement.prohibited;
      const pillClass = isProhibited ? 'status-inactive' : (placement.enabled ? 'status-connected' : 'status-unavailable');
      const pillLabel = isProhibited ? 'Prohibited' : (placement.enabled ? 'Active' : 'Disabled');
      return `
        <tr>
          <td><code>${escapeHtml(placement.id)}</code></td>
          <td>${escapeHtml(placement.page)}</td>
          <td>${escapeHtml(placement.format)}</td>
          <td>${escapeHtml(placement.devices.join(', '))}</td>
          <td>${escapeHtml(activeUnit)}</td>
          <td><span class="status-pill ${pillClass}">${escapeHtml(pillLabel)}</span></td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="ad-units-grid" id="adUnitsGrid">
        ${unitCardsHtml || '<div class="empty-state">No Adsterra units found in config.</div>'}
      </div>
      <table>
        <thead><tr><th>DOM Placement Slot</th><th>Page</th><th>Format</th><th>Devices</th><th>Mapped Unit</th><th>Slot Status</th></tr></thead>
        <tbody>${placementRows}</tbody>
      </table>
    `;

    container.querySelectorAll('.ad-unit-toggle').forEach((checkbox) => {
      checkbox.addEventListener('change', (event) => {
        const unitId = event.currentTarget.dataset.unitId;
        const targetEnabled = event.currentTarget.checked;
        if (unitId === '32172757' && targetEnabled) {
          event.currentTarget.checked = false;
          openPopunderConfirmModal();
          return;
        }
        submitAdControlMutation({ action: 'toggle_unit', unitId, enabled: targetEnabled });
      });
    });
  }

  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginStatus = document.getElementById('loginStatus');
  const state = {
    session: null,
    currentUser: null,
    isOwner: false,
    resource: 'companies',
    records: [],
    chart: null,
    charts: {},
    analytics: { period: '7', page: 1 },
    integrationsReport: null,
    overviewReport: null,
    activeSetupService: null,
    adControls: null,
    adControlsPermissions: null,
    adControlsError: null,
    lastAdReport: null,
    advertisingFilterCustomized: false,
    deployReport: null,
    deployInFlight: false,
    deployPollTimer: null
  };
  const resources = ['companies', 'interview_questions', 'hiring_news', 'feedback', 'website_settings', 'admin_activity_logs'];

  function setStatus(element, message, isError = true) {
    element.textContent = message || '';
    element.style.color = isError ? 'var(--danger)' : 'var(--primary)';
  }

  function configured() {
    const publishableKey = config?.supabasePublishableKey || config?.supabaseAnonKey;
    return config && config.supabaseUrl && publishableKey &&
      !config.supabaseUrl.includes('your-project-ref') &&
      !publishableKey.includes('your-supabase');
  }

  async function supabaseAuth(path, body, token) {
    const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey;
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: publishableKey, Authorization: 'Bearer ' + (token || publishableKey), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || 'Authentication request failed');
    return payload;
  }

  async function api(path, options = {}) {
    const { timeoutMs = 20000, ...fetchOpts } = options;
    const request = () => {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
      return fetch(path, {
        ...fetchOpts,
        ...(controller && !fetchOpts.signal ? { signal: controller.signal } : {}),
        headers: { ...(fetchOpts.headers || {}), Authorization: 'Bearer ' + state.session.access_token, 'Content-Type': 'application/json' }
      }).finally(() => {
        if (timer) clearTimeout(timer);
      });
    };
    let response;
    try {
      response = await request();
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s while loading ${path}`);
      }
      throw err;
    }
    if (response.status === 401 && state.session.refresh_token) {
      try {
        const refreshed = await supabaseAuth('token?grant_type=refresh_token', { refresh_token: state.session.refresh_token });
        state.session = { ...state.session, ...refreshed };
        localStorage.setItem('prepwise_admin_session', JSON.stringify(state.session));
        response = await request();
      } catch {
        localStorage.removeItem('prepwise_admin_session');
        showLogin('Your session expired. Please sign in again.');
        throw new Error('Your session expired. Please sign in again.');
      }
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Admin request failed');
    return payload;
  }

  function updateUserIdentity() {
    const identEl = document.getElementById('adminIdentity');
    if (!identEl) return;
    const user = state.currentUser || {};
    const email = user.email || state.session?.user?.email || 'Authenticated user';
    const isOwner = Boolean(state.isOwner);
    const badgeClass = isOwner ? 'role-owner' : 'role-admin';
    const badgeLabel = isOwner ? 'Owner' : 'Full Admin';
    identEl.innerHTML = `${escapeHtml(email)} <span class="role-badge ${badgeClass}" style="margin-left:8px;">${badgeLabel}</span>`;

    const navAdmins = document.getElementById('nav-administrators');
    if (navAdmins) {
      navAdmins.hidden = !isOwner;
    }
  }

  function showDashboard(session) {
    state.session = session;
    loginView.hidden = true;
    dashboardView.hidden = false;
    updateUserIdentity();
    loadOverview();
    loadContentSummary();
    loadResource();
    renderAdvertisingPlacements();
    renderSecurityStatus();
    setupQuestionImport();
    setupAdministratorManagement();
    setupSettingsManagement();
  }

  function showLogin(message = '') {
    state.session = null;
    loginView.hidden = false;
    dashboardView.hidden = true;
    setStatus(loginStatus, message);
  }

  function renderCards(container, entries) {
    container.innerHTML = entries.map(([label, value]) => `<article class="stat-card"><span class="muted">${escapeHtml(label)}</span><span class="number">${Number.isFinite(value) ? value.toLocaleString() : 'Unavailable'}</span></article>`).join('');
  }

  function formatValue(value, suffix = '') {
    return value === null || value === undefined ? 'Unavailable' : `${Number(value).toLocaleString()}${suffix}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function renderSecurityStatus() {
    const container = document.getElementById('securityCards');
    const expiresAt = state.session?.expires_at ? new Date(state.session.expires_at * 1000).toLocaleString() : 'Unavailable';
    const entries = [
      ['Auth session', state.session?.access_token ? 'Authenticated' : 'Unavailable'],
      ['Multi-user administration', state.isOwner ? 'Owner access active' : 'Full Admin active'],
      ['Active owner profile', 'Server enforced'],
      ['Token expiry', expiresAt],
      ['Secret key exposure', 'Not exposed'],
      ['Public signup route', 'Not implemented']
    ];
    container.innerHTML = entries.map(([label, value]) => `<article class="stat-card"><span class="muted">${escapeHtml(label)}</span><span class="number">${escapeHtml(value)}</span></article>`).join('');
  }

  async function loadAdministrators() {
    const tableContainer = document.getElementById('administratorsTable');
    if (!tableContainer) return;
    tableContainer.innerHTML = '<div class="empty-state">Loading administrator accounts...</div>';
    try {
      const result = await api('/api/admin/administrators');
      const admins = Array.isArray(result.data) ? result.data : [];
      renderAdministratorsTable(tableContainer, admins);
    } catch (error) {
      tableContainer.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderAdministratorsTable(container, admins) {
    if (admins.length === 0) {
      container.innerHTML = '<div class="empty-state">No administrator accounts found.</div>';
      return;
    }

    const rows = admins.map((admin) => {
      const isOwnerRow = admin.role === 'owner';
      const roleBadge = isOwnerRow
        ? '<span class="role-badge role-owner">Owner</span>'
        : '<span class="role-badge role-admin">Full Admin</span>';
      const statusPill = admin.is_active
        ? '<span class="status-pill status-active">Active</span>'
        : '<span class="status-pill status-inactive">Inactive</span>';

      let actionsHtml = '';
      if (isOwnerRow) {
        actionsHtml = '<span class="muted" style="font-size:12px;">Protected Owner</span>';
      } else {
        const toggleBtnLabel = admin.is_active ? 'Deactivate' : 'Reactivate';
        const toggleBtnClass = admin.is_active ? 'secondary' : 'primary';
        actionsHtml = `
          <div style="display:flex; gap:6px;">
            <button class="${toggleBtnClass} btn-sm admin-toggle-btn" data-id="${escapeHtml(admin.user_id)}" data-active="${Boolean(admin.is_active)}">${toggleBtnLabel}</button>
            <button class="secondary btn-sm admin-remove-btn" data-id="${escapeHtml(admin.user_id)}" data-name="${escapeHtml(admin.display_name || '')}" style="color:var(--danger);">Remove</button>
          </div>
        `;
      }

      return `
        <tr>
          <td><strong>${escapeHtml(admin.display_name || 'Unnamed')}</strong></td>
          <td><code>${escapeHtml(admin.email || admin.user_id)}</code></td>
          <td>${roleBadge}</td>
          <td>${statusPill}</td>
          <td>${new Date(admin.created_at).toLocaleDateString()}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email / User UID</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.admin-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const userId = e.currentTarget.dataset.id;
        const currentActive = e.currentTarget.dataset.active === 'true';
        await toggleAdminStatus(userId, currentActive);
      });
    });

    container.querySelectorAll('.admin-remove-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const userId = e.currentTarget.dataset.id;
        const name = e.currentTarget.dataset.name;
        await removeAdministrator(userId, name);
      });
    });
  }

  async function toggleAdminStatus(userId, currentActive) {
    const actionWord = currentActive ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${actionWord} this administrator?`)) return;
    try {
      await api('/api/admin/administrators', {
        method: 'PATCH',
        body: JSON.stringify({ user_id: userId, is_active: !currentActive })
      });
      await loadAdministrators();
    } catch (err) {
      alert(`Failed to update administrator: ${err.message}`);
    }
  }

  async function removeAdministrator(userId, name) {
    if (!confirm(`Are you sure you want to permanently remove administrator "${name}"? They will lose all admin access immediately.`)) return;
    try {
      await api(`/api/admin/administrators?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });
      await loadAdministrators();
    } catch (err) {
      alert(`Failed to remove administrator: ${err.message}`);
    }
  }

  function setupAdministratorManagement() {
    if (setupAdministratorManagement.initialized) return;
    setupAdministratorManagement.initialized = true;

    document.getElementById('refreshAdminsButton')?.addEventListener('click', loadAdministrators);

    document.getElementById('newAdminButton')?.addEventListener('click', () => {
      const formPanel = document.getElementById('adminEditorForm');
      if (formPanel) {
        formPanel.hidden = !formPanel.hidden;
        if (!formPanel.hidden) {
          document.getElementById('adminUserIdInput')?.focus();
        }
      }
    });

    document.getElementById('cancelAdminButton')?.addEventListener('click', () => {
      const formPanel = document.getElementById('adminEditorForm');
      if (formPanel) formPanel.hidden = true;
    });

    document.getElementById('adminProfileForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('adminFormStatus');
      const userId = (document.getElementById('adminUserIdInput')?.value || '').trim();
      const displayName = (document.getElementById('adminDisplayNameInput')?.value || '').trim();

      try {
        setStatus(status, 'Saving administrator...', false);
        await api('/api/admin/administrators', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, display_name: displayName })
        });
        setStatus(status, '');
        document.getElementById('adminProfileForm').reset();
        document.getElementById('adminEditorForm').hidden = true;
        await loadAdministrators();
      } catch (err) {
        setStatus(status, err.message);
      }
    });
  }

  function analyticsQuery(period, fromId, toId) {
    const params = new URLSearchParams();
    if (period === 'today') {
      const today = new Date();
      params.set('from', `${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
    } else if (period === 'custom') {
      const fromVal = document.getElementById(fromId)?.value;
      const toVal = document.getElementById(toId)?.value;
      if (fromVal) params.set('from', `${fromVal}T00:00:00.000Z`);
      if (toVal) params.set('to', `${toVal}T23:59:59.999Z`);
    } else {
      const days = Number(period) || 7;
      const startDate = new Date(Date.now() - (days - 1) * 86400000);
      startDate.setUTCHours(0, 0, 0, 0);
      params.set('from', startDate.toISOString());
    }
    params.set('to', params.get('to') || new Date().toISOString());
    return params;
  }

  function renderSimpleTable(containerId, rows, emptyMessage = 'No recorded activity for this period.') {
    const container = document.getElementById(containerId);
    if (!rows.length) {
      container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
      return;
    }
    container.innerHTML = `<table><thead><tr><th>Label</th><th>Count</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${Number(row.count).toLocaleString()}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderChart(key, canvasId, type, labels, values, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (state.charts[key]) {
      state.charts[key].destroy();
      state.charts[key] = null;
    }
    if (!window.Chart) return;
    canvas.removeAttribute('style');
    canvas.style.maxHeight = '180px';
    canvas.style.maxWidth = '100%';
    state.charts[key] = new Chart(canvas, {
      type,
      data: {
        labels: Array.isArray(labels) ? [...labels] : [],
        datasets: [{
          label,
          data: Array.isArray(values) ? [...values] : [],
          backgroundColor: '#2563eb',
          borderColor: '#2563eb',
          tension: 0.25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: { legend: { display: false } }
      }
    });
  }

  function renderAnalytics(result) {
    const totals = result.data.totals;
    const scoreDisplay = totals.averageScore != null
      ? (totals.averageScorePercentage != null ? `${totals.averageScore} pts (${totals.averageScorePercentage}%)` : `${totals.averageScore} pts`)
      : 'Unavailable';
    renderStatCards('analyticsCards', [
      ['First-Party Sessions', totals.visitors, 'Supabase', 'visitor_sessions rows'],
      ['First-Party Unique Visitors', totals.uniqueVisitors, 'Supabase', 'distinct anonymous_id'],
      ['First-Party Page Views', totals.pageViews, 'Supabase', 'page_view events'],
      ['Quiz Starts', totals.quizStarts, 'Supabase', 'quiz_start events'],
      ['Quiz Completions', totals.quizCompletions, 'Supabase', 'quiz_complete events'],
      ['Completion Rate', totals.completionRate != null ? `${totals.completionRate}%` : 'Unavailable', 'Supabase', 'completions / starts'],
      ['Logged Attempts (DB)', totals.quizAttempts, 'Supabase', 'recorded at completion'],
      ['Completed Attempts (DB)', totals.completedAttempts, 'Supabase', 'non-abandoned rows'],
      ['Average Score', scoreDisplay, 'Supabase', 'completed attempts']
    ]);
    renderChart('daily', 'dailyActivityChart', 'line', result.data.dailyActivity.map((item) => item.label), result.data.dailyActivity.map((item) => item.count), 'All First-Party Events');
    renderChart('quiz', 'quizActivityChart', 'bar', result.data.eventTypes.filter((item) => item.label.startsWith('quiz_')).map((item) => item.label), result.data.eventTypes.filter((item) => item.label.startsWith('quiz_')).map((item) => item.count), 'Quiz Events');
    renderChart('pages', 'pagePopularityChart', 'bar', result.data.popularPages.slice(0, 10).map((item) => item.label), result.data.popularPages.slice(0, 10).map((item) => item.count), 'Page views');
    renderSimpleTable('popularCompanies', result.data.popularCompanies);
    renderSimpleTable('popularCategories', result.data.popularCategories);
    const companyPerformance = document.getElementById('companyPerformance');
    companyPerformance.innerHTML = document.getElementById('popularCompanies').innerHTML;
  }

  function integrationStatusClass(status) {
    if (status === 'Connected') return 'status-connected';
    if (status === 'Not configured') return 'status-not-configured';
    if (status === 'Authentication required') return 'status-auth-required';
    if (status === 'Connection error') return 'status-error';
    return 'status-unavailable';
  }

  function renderStatusPill(status) {
    return `<span class="status-pill ${integrationStatusClass(status)}">${escapeHtml(status || 'Data unavailable')}</span>`;
  }

  function renderStatCards(containerId, cards) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = cards.map(([label, val, source, sub]) => `
      <article class="stat-card">
        <div class="stat-meta">
          <span>${escapeHtml(label)}</span>
          ${source ? `<span class="source-tag">${escapeHtml(source)}</span>` : ''}
        </div>
        <span class="number">${typeof val === 'number' ? val.toLocaleString() : escapeHtml(val ?? 'Unavailable')}</span>
        ${sub ? `<span class="stat-sub">${escapeHtml(sub)}</span>` : ''}
      </article>
    `).join('');
  }

  function formatDurationSeconds(sec) {
    if (!Number.isFinite(sec)) return 'Unavailable';
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return 'Unavailable';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  }

  function downloadCsv(filename, rows, columns) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function aggregateDailyByGranularity(rows, granularity, dateKey, valueKeys) {
    if (!Array.isArray(rows) || !rows.length) return [];
    if (granularity === 'daily') return rows;
    const buckets = new Map();
    rows.forEach((row) => {
      const raw = row[dateKey];
      if (!raw) return;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return;
      let key;
      if (granularity === 'weekly') {
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
        key = monday.toISOString().slice(0, 10);
      } else {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      }
      const existing = buckets.get(key) || { [dateKey]: key };
      valueKeys.forEach((vk) => {
        existing[vk] = (existing[vk] || 0) + Number(row[vk] || 0);
      });
      buckets.set(key, existing);
    });
    return [...buckets.values()].sort((a, b) => String(a[dateKey]).localeCompare(String(b[dateKey])));
  }

  function renderMultiChart(key, canvasId, type, labels, datasets) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (state.charts[key]) {
      state.charts[key].destroy();
      state.charts[key] = null;
    }
    if (!window.Chart) return;
    canvas.removeAttribute('style');
    canvas.style.maxHeight = '190px';
    canvas.style.maxWidth = '100%';
    state.charts[key] = new Chart(canvas, {
      type,
      data: {
        labels: Array.isArray(labels) ? [...labels] : [],
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: datasets.length > 1 } }
      }
    });
  }

  async function loadAnalytics() {
    const status = document.getElementById('analyticsStatus');
    status.textContent = 'Loading analytics...';
    try {
      const params = analyticsQuery(document.getElementById('analyticsPeriod').value, 'analyticsFrom', 'analyticsTo');
      const [result, intRes] = await Promise.all([
        api(`/api/admin/analytics?${params}`),
        api(`/api/admin/integrations?service=ga4&${params}`).catch(() => null)
      ]);
      renderAnalytics(result);
      const ga4 = intRes?.data?.integrations?.ga4;
      const ga4Wrap = document.getElementById('ga4DetailContainer');
      if (ga4Wrap) {
        if (ga4?.status === 'Connected' && ga4.data) {
          const t = ga4.data.totals || {};
          const dr = ga4.data.dateRange;
          const drLabel = dr ? ` &bull; GA4 Range: ${escapeHtml(dr.startDate)} to ${escapeHtml(dr.endDate)}` : '';
          ga4Wrap.innerHTML = `
            <div class="cc-block" style="margin-bottom:16px;">
              <div class="cc-block-header">
                <div class="cc-block-title"><h3>Google Analytics 4 Live Reporting (Property connected)</h3>${renderStatusPill(ga4.status)}</div>
                <span class="muted" style="font-size:12px;">Measurement ID: ${escapeHtml(ga4.measurementId)} &bull; GTM: ${escapeHtml(ga4.gtmContainerId)}${drLabel}</span>
              </div>
              <div class="cards">
                <article class="stat-card"><span class="stat-meta">GA4 Active Users</span><span class="number">${Number(t.activeUsers || 0).toLocaleString()}</span></article>
                <article class="stat-card"><span class="stat-meta">GA4 New Users</span><span class="number">${Number(t.newUsers || 0).toLocaleString()}</span></article>
                <article class="stat-card"><span class="stat-meta">GA4 Views</span><span class="number">${Number(t.views || 0).toLocaleString()}</span></article>
                <article class="stat-card"><span class="stat-meta">GA4 Sessions</span><span class="number">${Number(t.sessions || 0).toLocaleString()}</span></article>
                <article class="stat-card"><span class="stat-meta">Avg Engagement Time</span><span class="number">${formatDurationSeconds(t.avgEngagementSeconds)}</span></article>
              </div>
              <p class="muted" style="font-size:12px; margin:8px 0 12px;">Source comparison: GA4 reports consented traffic where Google tags were not blocked (ad blockers/CSP history) in property timezone, whereas First-Party Supabase metrics below capture consented same-origin telemetry.</p>
              <div class="analytics-columns">
                <div><h4>GA4 Landing Pages</h4><div class="table-wrap"><table><thead><tr><th>Landing Page</th><th>Sessions</th><th>Users</th></tr></thead><tbody>${(ga4.data.landingPages || []).map((r) => `<tr><td>${escapeHtml(r.page)}</td><td>${r.sessions}</td><td>${r.activeUsers}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No rows</td></tr>'}</tbody></table></div></div>
                <div><h4>GA4 Traffic Sources</h4><div class="table-wrap"><table><thead><tr><th>Channel</th><th>Sessions</th><th>Users</th></tr></thead><tbody>${(ga4.data.trafficSources || []).map((r) => `<tr><td>${escapeHtml(r.channel)}</td><td>${r.sessions}</td><td>${r.activeUsers}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No rows</td></tr>'}</tbody></table></div></div>
              </div>
            </div>
          `;
        } else {
          ga4Wrap.innerHTML = `<div class="alert-banner is-warning"><strong>GA4 Data API (${escapeHtml(ga4?.status || 'Not configured')}):</strong> ${escapeHtml(ga4?.error || 'GA4 Data API credentials not configured.')} First-party Supabase metrics remain live below.</div>`;
        }
      }
      state.lastAnalyticsResult = result;
      status.textContent = `Showing ${new Date(result.range.from).toLocaleString()} - ${new Date(result.range.to).toLocaleString()}.`;
      status.style.color = 'var(--primary)';
    } catch (error) {
      status.textContent = error.message;
      status.style.color = 'var(--danger)';
    }
  }

  async function loadActivity() {
    const status = document.getElementById('activityStatus');
    status.textContent = 'Loading visitor activity...';
    try {
      const period = document.getElementById('activityPeriod')?.value || '7';
      const params = analyticsQuery(period, 'activityFrom', 'activityTo');

      try {
        const summary = await api(`/api/admin/analytics?${params.toString()}`);
        if (summary?.data) {
          renderSimpleTable('visitorPopularPages', summary.data.popularPages?.slice(0, 10) || [], 'No page visits recorded for this period.');
          renderSimpleTable('visitorPopularCompanies', summary.data.popularCompanies?.slice(0, 10) || [], 'No company visits recorded for this period.');
        }
      } catch (e) {}

      params.set('view', 'activity');
      params.set('sort', document.getElementById('activitySort').value);
      const eventType = document.getElementById('activityEvent').value;
      if (eventType) params.set('eventType', eventType);
      params.set('page', state.analytics.page);
      params.set('pageSize', '50');
      const result = await api(`/api/admin/analytics?${params}`);
      const container = document.getElementById('visitorActivityTable');
      if (!result.data.length) container.innerHTML = '<div class="empty-state">No non-sensitive visitor activity recorded for this period.</div>';
      else container.innerHTML = `<table><thead><tr><th>Event</th><th>Page</th><th>Company</th><th>Category</th><th>Device</th><th>Timestamp</th></tr></thead><tbody>${result.data.map((row) => `<tr><td>${escapeHtml(row.eventType)}</td><td>${escapeHtml(row.page)}</td><td>${escapeHtml(row.company)}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.device)}</td><td>${escapeHtml(new Date(row.timestamp).toLocaleString())}</td></tr>`).join('')}</tbody></table>`;
      document.getElementById('activityPageLabel').textContent = `Page ${result.pagination.page}`;
      document.getElementById('activityPrevious').disabled = result.pagination.page <= 1;
      document.getElementById('activityNext').disabled = !result.pagination.hasNext;
      status.textContent = `Showing ${result.pagination.total.toLocaleString()} available events.`;
      status.style.color = 'var(--primary)';
    } catch (error) {
      status.textContent = error.message;
      status.style.color = 'var(--danger)';
    }
  }

  function renderQuiz(result) {
    const totals = result.data?.totals || {};
    const scoreDisplay = totals.averageScore != null
      ? (totals.averageScorePercentage != null ? `${totals.averageScore} pts (${totals.averageScorePercentage}%)` : `${totals.averageScore} pts`)
      : 'Unavailable';
    renderStatCards('quizCards', [
      ['Quiz starts', totals.quizStarts ?? 0, 'Events', 'quiz_start events'],
      ['Quiz completions', totals.quizCompletions ?? 0, 'Events', 'quiz_complete events'],
      ['Completion rate', totals.completionRate != null ? `${totals.completionRate}%` : 'Unavailable', 'Events', 'completions / starts'],
      ['Recorded attempts (DB)', totals.quizAttempts ?? 0, 'quiz_attempts', 'logged on quiz completion'],
      ['Completed attempts (DB)', totals.completedAttempts ?? 0, 'quiz_attempts', 'non-abandoned submissions'],
      ['Average score', scoreDisplay, 'quiz_attempts', 'completed attempts']
    ]);

    const scores = result.data?.scoreDistribution || [];
    renderChart('quizScore', 'quizScoreChart', 'bar', scores.map((item) => item.label), scores.map((item) => item.count), 'Completed Attempts');

    const dailyQuiz = result.data?.dailyQuizActivity || [];
    renderMultiChart(
      'quizDaily',
      'quizDailyChart',
      'line',
      dailyQuiz.map((item) => item.label),
      [
        { label: 'Quiz Starts', data: dailyQuiz.map((item) => item.starts ?? 0), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.2 },
        { label: 'Quiz Completions', data: dailyQuiz.map((item) => item.completions ?? 0), borderColor: '#09090b', tension: 0.2 }
      ]
    );

    const quizEvents = (result.data?.eventTypes || []).filter((item) => item.label.startsWith('quiz_'));
    renderChart('quizEvents', 'quizEventsChart', 'bar', quizEvents.map((item) => item.label), quizEvents.map((item) => item.count), 'Quiz events');

    renderSimpleTable('quizCategoriesTable', result.data?.popularCategories || [], 'No completed quiz category data available for this period.');
    renderSimpleTable('quizCompaniesTable', result.data?.popularQuizCompanies || [], 'No quiz start company data available for this period.');
  }

  async function loadQuiz() {
    const status = document.getElementById('quizStatus');
    status.textContent = 'Loading quiz analytics...';
    status.style.color = 'var(--primary)';
    try {
      const period = document.getElementById('quizPeriod')?.value || '7';
      const params = analyticsQuery(period, 'quizFrom', 'quizTo');
      const result = await api(`/api/admin/analytics?${params}`);
      renderQuiz(result);
      status.textContent = `Showing verified quiz metrics for ${new Date(result.range.from).toLocaleDateString()} - ${new Date(result.range.to).toLocaleDateString()}.`;
    } catch (error) {
      status.textContent = error.message;
      status.style.color = 'var(--danger)';
    }
  }

  async function loadHealth() {
    const cards = document.getElementById('healthCards');
    const epTable = document.getElementById('healthEndpointsTable');
    if (cards) cards.innerHTML = '<div class="empty-state">Running live system &amp; endpoint checks...</div>';
    try {
      const [sysRes, healthRes] = await Promise.all([
        api('/api/admin/system'),
        api('/api/admin/integrations?service=health')
      ]);
      const d = sysRes.data || {};
      if (d.adControlsLoaded && d.adControls) {
        state.adControls = d.adControls;
        state.adControlsError = null;
      } else if (!state.adControls) {
        state.adControlsError = 'Saved ad controls unavailable.';
      }
      const controls = state.adControls;
      const controlsLoaded = Boolean(controls && controls.units);
      const popOn = controlsLoaded && controls.units['32172757'] === true;
      const masterOn = controlsLoaded && controls.masterEnabled !== false;
      const activeEligibleCount = controlsLoaded
        ? ['32172758', '32172759', '32172760', '32172761', '32172762'].filter((id) => controls.units[id] === true).length
        : 0;
      const adPolicyVal = !controlsLoaded
        ? 'Controls Unavailable'
        : (masterOn ? `${activeEligibleCount}/5 Units + Popunder ${popOn ? 'ON' : 'OFF'}` : 'Master OFF');
      const adPolicySub = !controlsLoaded
        ? 'Popunder 32172757 OFF by default (Owner-controlled)'
        : (popOn
          ? (masterOn ? 'Unit 32172757 ON (explicitly enabled by Owner)' : 'Popunder 32172757 saved ON, paused by Master')
          : 'Unit 32172757 OFF (default; Owner-controlled)');

      const h = healthRes?.data?.integrations?.health;
      const hd = h?.data || {};
      if (cards) {
        renderStatCards('healthCards', [
          ['Endpoint Availability', `${hd.healthyCount ?? 0} / ${hd.totalCount ?? 0} OK`, 'Live Probe', hd.allHealthy ? 'All routes passing' : 'Degraded route detected'],
          ['Avg Response Time', hd.avgLatencyMs != null ? `${hd.avgLatencyMs} ms` : 'Unavailable', 'HTTP Check', `Checked ${new Date(h?.lastSyncedAt || Date.now()).toLocaleTimeString()}`],
          ['Database Reachability', d.databaseAvailability || 'standby', 'Supabase', `Query ${d.responseMs || 0} ms`],
          ['Content Records', `${d.contentRecords ?? 0} Co / ${d.questionRecords ?? 0} Qs`, 'Supabase', 'Live count'],
          ['Ad Policy Status', adPolicyVal, 'Policy', adPolicySub]
        ]);
      }
      if (epTable) {
        const eps = hd.endpoints || [];
        epTable.innerHTML = eps.length
          ? `<table><thead><tr><th>Endpoint / Route</th><th>Target URL</th><th>HTTP Status</th><th>Latency</th><th>Health</th></tr></thead><tbody>${eps.map((ep) => `<tr><td><strong>${escapeHtml(ep.name)}</strong></td><td><code>${escapeHtml(ep.url)}</code></td><td>${ep.status || 'ERR'}</td><td>${ep.latencyMs} ms</td><td><span class="status-pill ${ep.ok ? 'status-connected' : 'status-error'}">${ep.ok ? 'Healthy' : 'Failed'}</span></td></tr>`).join('')}</tbody></table>`
          : '<div class="empty-state">No endpoint probe results returned.</div>';
      }
    } catch (error) {
      if (cards) {
        cards.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}<br><button class="secondary" id="retryHealth" style="margin-top:8px;">Retry</button></div>`;
        document.getElementById('retryHealth')?.addEventListener('click', loadHealth);
      }
    }
  }

  function renderAdOverviewSection(adsterra, granularity) {
    const pill = document.getElementById('overviewAdStatusPill');
    const notice = document.getElementById('overviewAdNotice');
    if (pill) {
      pill.className = `status-pill ${integrationStatusClass(adsterra?.status || 'Not configured')}`;
      pill.textContent = adsterra?.status || 'Not configured';
    }
    const isConnected = adsterra?.status === 'Connected' && adsterra?.data;
    const t = adsterra?.data?.totals || {};
    const controls = state.adControls;
    const controlsError = state.adControlsError;
    const rangeLabel = formatAdReportingRange(adsterra);
    const popSummary = getPopunderPolicySummary(controls, controlsError);
    const controlsErrHtml = controlsError
      ? ` <span style="display:block;margin-top:4px;font-size:12px;">Saved ad controls request failed (${escapeHtml(controlsError)}); unit policy statuses below are withheld rather than assumed enabled.</span>`
      : '';

    if (notice) {
      if (isConnected) {
        notice.innerHTML = `<div class="alert-banner is-success"><strong>Connected to Adsterra Publisher API (${escapeHtml(rangeLabel)}):</strong> Displaying live authenticated impressions, clicks, CPM, and estimated earnings. ${popSummary}${controlsErrHtml}</div>`;
      } else {
        notice.innerHTML = `<div class="alert-banner is-warning"><strong>Adsterra Publisher API (${escapeHtml(adsterra?.status || 'Not configured')}):</strong> ${escapeHtml(adsterra?.error || 'Provide ADSTERRA_API_TOKEN in Cloudflare Pages Secrets to retrieve live revenue and impressions.')} ${popSummary}${controlsErrHtml}</div>`;
      }
    }

    renderStatCards('overviewAdCards', [
      ['Ad Impressions', isConnected ? t.impressions : 'Unavailable', isConnected ? 'Adsterra API' : 'Not configured'],
      ['Ad Clicks', isConnected ? t.clicks : 'Unavailable', isConnected ? 'Adsterra API' : 'Not configured'],
      ['CPM / eCPM', isConnected ? `$${Number(t.cpm || 0).toFixed(2)}` : 'Unavailable', isConnected ? 'Adsterra API' : 'Not configured'],
      ['Estimated Revenue', isConnected ? `$${Number(t.revenue || 0).toFixed(3)}` : 'Unavailable', isConnected ? 'Adsterra API' : 'Not configured']
    ]);

    const dailyRev = aggregateDailyByGranularity(adsterra?.data?.daily || [], granularity, 'date', ['revenue', 'impressions']);
    renderMultiChart('overviewRev', 'overviewRevenueChart', 'line',
      dailyRev.map((d) => d.date),
      [{ label: 'Est. Revenue ($)', data: dailyRev.map((d) => d.revenue), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.1)', fill: true, tension: 0.25 }]
    );

    const byPlacement = adsterra?.data?.byPlacement || [];
    renderMultiChart('overviewAdFmt', 'overviewAdFormatChart', 'bar',
      byPlacement.map((p) => p.name || `Unit ${p.placementId}`),
      [{ label: 'Impressions', data: byPlacement.map((p) => p.impressions), backgroundColor: '#2563eb' }]
    );

    const tableEl = document.getElementById('overviewAdPlacementsTable');
    if (tableEl) {
      const units = getAdsterraConfigUnits();
      const apiMap = new Map((byPlacement || []).map((p) => [String(p.placementId), p]));
      tableEl.innerHTML = `<table><thead><tr><th>Unit ID</th><th>Format</th><th>Policy Status</th><th>Impressions</th><th>Clicks</th><th>CPM</th><th>Revenue</th></tr></thead><tbody>${units.map((u) => {
        const row = apiMap.get(String(u.unitId));
        const statusMeta = getUnitPolicyStatusMeta(u.unitId, controls, controlsError);
        return `<tr><td><strong>${escapeHtml(u.unitId)}</strong> (${escapeHtml(u.name)})</td><td>${escapeHtml(u.format)}</td><td><span class="status-pill ${statusMeta.pillClass}">${escapeHtml(statusMeta.label)}</span></td><td>${row ? row.impressions.toLocaleString() : '—'}</td><td>${row ? row.clicks.toLocaleString() : '—'}</td><td>${row ? `$${Number(row.cpm).toFixed(2)}` : '—'}</td><td>${row ? `$${Number(row.revenue).toFixed(3)}` : '—'}</td></tr>`;
      }).join('')}</tbody></table>`;
    }
  }

  function renderSeoOverviewSection(gsc) {
    const pill = document.getElementById('overviewSeoStatusPill');
    const notice = document.getElementById('overviewSeoNotice');
    if (pill) {
      pill.className = `status-pill ${integrationStatusClass(gsc?.status || 'Not configured')}`;
      pill.textContent = gsc?.status || 'Not configured';
    }
    const ok = gsc?.status === 'Connected' && gsc?.data;
    const t = gsc?.data?.totals || {};
    const dr = gsc?.data?.dateRange;
    const rangeText = dr ? `${dr.startDate} to ${dr.endDate}` : 'selected period';
    if (notice) {
      notice.innerHTML = ok
        ? `<div class="alert-banner is-success"><strong>Connected:</strong> Search Console property <code>${escapeHtml(gsc.data.siteUrl)}</code> verified (${escapeHtml(rangeText)} &middot; GSC search analytics normally lags 2–3 days).</div>`
        : `<div class="alert-banner is-warning"><strong>Google Search Console (${escapeHtml(gsc?.status || 'Not configured')}):</strong> ${escapeHtml(gsc?.error || 'Missing server-side Search Console OAuth/Service Account credentials.')}</div>`;
    }
    renderStatCards('overviewSeoCards', [
      ['Search Clicks', ok ? (t.clicks ?? 0) : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
      ['Search Impressions', ok ? (t.impressions ?? 0) : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
      ['CTR', ok ? `${t.ctr ?? 0}%` : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
      ['Avg Position', ok ? (t.avgPosition != null ? t.avgPosition : '— (0 impr.)') : 'Unavailable', ok ? 'GSC API' : 'Not configured']
    ]);

    const qEl = document.getElementById('overviewSeoQueries');
    const pEl = document.getElementById('overviewSeoPages');
    if (qEl) {
      const qs = gsc?.data?.topQueries || [];
      qEl.innerHTML = qs.length
        ? `<table><thead><tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>Pos</th></tr></thead><tbody>${qs.slice(0, 8).map((r) => `<tr><td>${escapeHtml(r.query)}</td><td>${r.clicks}</td><td>${r.impressions}</td><td>${r.position}</td></tr>`).join('')}</tbody></table>`
        : `<div class="empty-state">${ok ? `Connected — 0 search queries recorded for ${escapeHtml(rangeText)} (normal if recent or lagging 2–3 days).` : 'Connect Google Search Console to view top search queries.'}</div>`;
    }
    if (pEl) {
      const pgs = gsc?.data?.topPages || [];
      const maps = gsc?.data?.sitemaps || [];
      if (pgs.length || maps.length) {
        pEl.innerHTML = `<table><thead><tr><th>Landing Page / Sitemap</th><th>Clicks</th><th>Impressions / Status</th></tr></thead><tbody>${pgs.slice(0, 6).map((r) => `<tr><td>${escapeHtml(r.page)}</td><td>${r.clicks}</td><td>${r.impressions}</td></tr>`).join('')}${maps.map((m) => `<tr><td><strong>Sitemap:</strong> ${escapeHtml(m.path)}</td><td>—</td><td>Errors: ${m.errors}, Warnings: ${m.warnings}</td></tr>`).join('')}</tbody></table>`;
      } else {
        pEl.innerHTML = `<div class="empty-state">${ok ? `Connected — 0 landing page impressions or sitemaps reported for ${escapeHtml(rangeText)}.` : 'Connect Google Search Console to view landing pages &amp; sitemap indexing.'}</div>`;
      }
    }
  }

  function renderDbOverviewSection(supa) {
    const pill = document.getElementById('overviewDbStatusPill');
    if (pill) {
      pill.className = `status-pill ${integrationStatusClass(supa?.status || 'Connection error')}`;
      pill.textContent = supa?.status || 'Unknown';
    }
    const d = supa?.data || {};
    renderStatCards('overviewDbCards', [
      ['Project Health', supa?.status || 'Unavailable', 'Supabase', `Latency: ${supa?.latencyMs ?? 0} ms`],
      ['Total DB Rows', d.totalRows ?? 'Unavailable', 'Supabase', `${d.tablesCount ?? 0} tables inspected`],
      ['Storage Buckets', Array.isArray(d.storageBuckets) ? d.storageBuckets.length : 'Unavailable', 'Storage API'],
      ['Auth Accounts', d.authUsersCount != null ? d.authUsersCount : 'Unavailable', 'Auth API'],
      ['Table Query Errors', d.errorTables ?? 0, 'Diagnostics']
    ]);
    const el = document.getElementById('overviewDbTable');
    if (el) {
      const tbls = d.tables || [];
      el.innerHTML = tbls.length
        ? `<table><thead><tr><th>Table</th><th>Rows</th><th>Status</th></tr></thead><tbody>${tbls.map((t) => `<tr><td><code>${escapeHtml(t.table)}</code></td><td>${t.rows != null ? t.rows.toLocaleString() : '—'}</td><td><span class="status-pill ${t.status === 'reachable' ? 'status-connected' : 'status-error'}">${escapeHtml(t.status)}</span></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty-state">Database telemetry unavailable.</div>';
    }
  }

  function getCloudflareZoneMeta(ok, d) {
    const zoneTag = !ok
      ? 'Not connected'
      : (d.zoneStatus === 'connected' ? 'CF GraphQL' : (d.zoneStatus === 'error' ? 'GraphQL / Permission Error' : 'CLOUDFLARE_ZONE_ID needed'));
    const zoneSub = ok && !d.traffic && d.zoneError ? d.zoneError : '';
    return { zoneTag, zoneSub };
  }

  function renderInfraOverviewSection(cf) {
    const pill = document.getElementById('overviewInfraStatusPill');
    const notice = document.getElementById('overviewInfraNotice');
    if (pill) {
      pill.className = `status-pill ${integrationStatusClass(cf?.status || 'Not configured')}`;
      pill.textContent = cf?.status || 'Not configured';
    }
    const ok = cf?.status === 'Connected' && cf?.data;
    const d = cf?.data || {};
    const lp = d.latestProduction;
    const { zoneTag, zoneSub } = getCloudflareZoneMeta(ok, d);
    if (notice) {
      notice.innerHTML = ok
        ? `<div class="alert-banner is-success"><strong>Connected to Cloudflare Pages (${escapeHtml(cf.projectName)}):</strong> Latest production deployment <code>${escapeHtml(lp?.id || '—')}</code> (${escapeHtml(lp?.status || '—')}).${zoneSub ? ` <span style="display:block;margin-top:4px;font-size:12px;">Zone Traffic: ${escapeHtml(zoneSub)}</span>` : ''}</div>`
        : `<div class="alert-banner is-warning"><strong>Cloudflare API (${escapeHtml(cf?.status || 'Not configured')}${cf?.projectName ? ` · ${escapeHtml(cf.projectName)}` : ''}):</strong> ${escapeHtml(cf?.error || 'Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in Cloudflare Pages Secrets.')}</div>`;
    }
    const tr = d.traffic?.totals;
    renderStatCards('overviewInfraCards', [
      ['Latest Prod Status', ok && lp ? lp.status : 'Unavailable', ok ? 'Cloudflare API' : 'Not configured', ok && lp ? `Commit ${lp.commitHash}` : ''],
      ['Failed Deploys (last 10)', ok ? d.failedDeployments : 'Unavailable', ok ? 'Cloudflare API' : 'Not configured'],
      ['Edge Requests', tr ? tr.requests : 'Unavailable', zoneTag, zoneSub],
      ['Bandwidth', tr ? formatBytes(tr.bytes) : 'Unavailable', zoneTag, zoneSub]
    ]);
    const el = document.getElementById('overviewInfraDeployments');
    if (el) {
      const deps = d.deployments || [];
      el.innerHTML = deps.length
        ? `<table><thead><tr><th>Deploy ID</th><th>Env</th><th>Commit</th><th>Message</th><th>Status</th><th>Created</th></tr></thead><tbody>${deps.slice(0, 6).map((dp) => `<tr><td><code>${escapeHtml(dp.id)}</code></td><td>${escapeHtml(dp.environment)}</td><td><code>${escapeHtml(dp.commitHash)}</code></td><td>${escapeHtml(dp.commitMessage)}</td><td><span class="status-pill ${dp.status === 'success' ? 'status-connected' : (dp.status === 'failure' ? 'status-error' : 'status-unavailable')}">${escapeHtml(dp.status)}</span></td><td>${escapeHtml(new Date(dp.createdOn).toLocaleString())}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty-state">Connect Cloudflare API token to inspect live Pages deployment history and edge bandwidth.</div>';
    }
  }

  function renderHealthOverviewSection(health) {
    const pill = document.getElementById('overviewHealthStatusPill');
    if (pill) {
      pill.className = `status-pill ${integrationStatusClass(health?.status || 'Data unavailable')}`;
      pill.textContent = health?.data?.allHealthy ? 'Healthy' : (health?.status || 'Unavailable');
    }
    const hd = health?.data || {};
    renderStatCards('overviewHealthCards', [
      ['Production Routes', `${hd.healthyCount ?? 0} / ${hd.totalCount ?? 0} OK`, 'Live Probe'],
      ['Avg HTTP Latency', hd.avgLatencyMs != null ? `${hd.avgLatencyMs} ms` : 'Unavailable', 'Live Probe'],
      ['Broken Endpoints', (hd.endpoints || []).filter((e) => !e.ok).length, 'Live Probe'],
      ['Last Health Check', hd.checkedAt ? new Date(hd.checkedAt).toLocaleTimeString() : 'Never', 'UTC/Local']
    ]);
    const el = document.getElementById('overviewSystemHealth');
    if (el) {
      const eps = hd.endpoints || [];
      el.innerHTML = eps.length
        ? `<table><thead><tr><th>Route</th><th>HTTP Status</th><th>Latency</th><th>Result</th></tr></thead><tbody>${eps.map((ep) => `<tr><td><strong>${escapeHtml(ep.name)}</strong></td><td>${ep.status || 'ERR'}</td><td>${ep.latencyMs} ms</td><td><span class="status-pill ${ep.ok ? 'status-connected' : 'status-error'}">${ep.ok ? 'Available' : 'Failed'}</span></td></tr>`).join('')}</tbody></table>`
        : '<div class="empty-state">Endpoint health probes have not completed yet.</div>';
    }
  }

  async function loadOverview() {
    const cards = document.getElementById('overviewCards');
    const status = document.getElementById('overviewStatus');
    const alertsEl = document.getElementById('overviewAlerts');
    cards.innerHTML = '<div class="empty-state">Synchronizing PrepWise Control Center...</div>';
    try {
      const period = document.getElementById('overviewPeriod')?.value || '7';
      const granularity = document.getElementById('overviewGranularity')?.value || 'daily';
      const params = analyticsQuery(period, 'overviewFrom', 'overviewTo');

      let adControlsErr = null;
      const [result, intRes, ctrlRes] = await Promise.all([
        api(`/api/admin/overview?${params}`),
        api(`/api/admin/integrations?service=all&${params}`).catch(() => null),
        api('/api/admin/ad-controls').catch((err) => { adControlsErr = err; return null; })
      ]);

      state.overviewReport = result;
      if (intRes?.data) state.integrationsReport = intRes.data;
      if (ctrlRes?.data?.controls) {
        state.adControls = ctrlRes.data.controls;
        state.adControlsPermissions = ctrlRes.data.permissions || null;
        state.adControlsError = null;
      } else {
        state.adControls = null;
        state.adControlsError = adControlsErr?.message || 'Unable to load saved ad controls.';
      }

      const d = result.data || {};
      if (d.currentUser) {
        state.currentUser = d.currentUser;
        state.isOwner = Boolean(d.currentUser.isOwner);
        updateUserIdentity();
      }
      renderAdvertisingPlacements();

      const ints = state.integrationsReport?.integrations || {};
      const ga4 = ints.ga4;
      const ga4Ok = ga4?.status === 'Connected' && ga4.data;
      const m = d.metrics || {};
      const gt = ga4?.data?.totals || {};

      const srcTag = document.getElementById('websiteSourceTag');
      if (srcTag) srcTag.textContent = ga4Ok ? 'GA4 Data API + Supabase' : 'First-Party Supabase Telemetry';

      // Alerts banner if any integration has an auth/connection error
      if (alertsEl) {
        const failedInts = Object.values(ints).filter((i) => i.status === 'Connection error' || i.status === 'Authentication required');
        alertsEl.innerHTML = failedInts.length
          ? `<div class="alert-banner is-error"><strong>Integration Alerts:</strong> ${failedInts.map((i) => `${escapeHtml(i.name)} (${escapeHtml(i.status)}: ${escapeHtml(i.error || '')})`).join(' &bull; ')}</div>`
          : '';
      }

      // Section A: Website Overview Cards (keep GA4 & First-Party sources separately identifiable)
      const ga4Dr = ga4?.data?.dateRange;
      renderStatCards('overviewCards', ga4Ok ? [
        ['GA4 Active Users', gt.activeUsers ?? 0, 'GA4 API', `${gt.newUsers ?? 0} new users`],
        ['GA4 Page Views', gt.views ?? 0, 'GA4 API', `${gt.sessions ?? 0} GA4 sessions`],
        ['GA4 Avg Engagement', formatDurationSeconds(gt.avgEngagementSeconds), 'GA4 API', 'Per active user'],
        ['First-Party Unique Visitors', m.uniqueVisitors ?? 0, 'First-Party (Supabase)', `${m.visitorSessions ?? 0} sessions`],
        ['First-Party Page Views', m.pageViews ?? 0, 'First-Party (Supabase)', 'Consented non-admin views'],
        ['Quiz Starts', m.quizStarts ?? 0, 'First-Party (Supabase)', `${m.quizAttempts ?? 0} DB attempt rows`],
        ['Quiz Completions', m.quizCompletions ?? 0, 'First-Party (Supabase)', 'quiz_complete events'],
        ['Quiz Completion Rate', m.completionRate != null ? `${m.completionRate}%` : 'Unavailable', 'First-Party (Supabase)', 'completions / starts']
      ] : [
        ['First-Party Unique Visitors', m.uniqueVisitors ?? 0, 'First-Party (Supabase)', `${m.visitorSessions ?? 0} sessions`],
        ['First-Party Page Views', m.pageViews ?? 0, 'First-Party (Supabase)', 'Consented non-admin views'],
        ['GA4 Data API', ga4?.status || 'Not configured', 'GA4 API', 'See Integrations'],
        ['Avg Engagement Time', 'GA4 Required', 'GA4 API', 'Pending GA4 API'],
        ['Quiz Starts', m.quizStarts ?? 0, 'First-Party (Supabase)', `${m.quizAttempts ?? 0} DB attempt rows`],
        ['Quiz Completions', m.quizCompletions ?? 0, 'First-Party (Supabase)', 'quiz_complete events'],
        ['Quiz Completion Rate', m.completionRate != null ? `${m.completionRate}%` : 'Unavailable', 'First-Party (Supabase)', 'completions / starts']
      ]);

      const ga4WindowText = ga4Ok && ga4Dr ? ` | GA4: ${ga4Dr.startDate} – ${ga4Dr.endDate} (GA4 excludes ad-blocked/pre-CSP visits)` : '';
      document.getElementById('overviewNote').textContent = `First-Party Range (UTC): ${new Date(result.range.from).toLocaleDateString()} – ${new Date(result.range.to).toLocaleDateString()} | Granularity: ${granularity}${ga4WindowText}`;
      const luEl = document.getElementById('overviewLastUpdated');
      if (luEl) luEl.textContent = `Last updated: ${new Date(result.generatedAt).toLocaleTimeString()}`;

      // Website Traffic Chart (Daily/Weekly/Monthly)
      const trafficRows = ga4Ok
        ? aggregateDailyByGranularity(ga4.data.daily, granularity, 'date', ['views', 'sessions', 'activeUsers'])
        : aggregateDailyByGranularity(d.dailyActivity || [], granularity, 'date', ['pageViews', 'quizStarts', 'totalEvents']);

      renderMultiChart('overviewTraffic', 'overviewChart', 'line',
        trafficRows.map((r) => r.date),
        ga4Ok
          ? [
              { label: 'Views', data: trafficRows.map((r) => r.views), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.2 },
              { label: 'Sessions', data: trafficRows.map((r) => r.sessions), borderColor: '#09090b', tension: 0.2 }
            ]
          : [
              { label: 'Page Views', data: trafficRows.map((r) => r.pageViews), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.2 },
              { label: 'Quiz Starts', data: trafficRows.map((r) => r.quizStarts), borderColor: '#eab308', tension: 0.2 }
            ]
      );

      // Visitor vs Revenue Comparison Chart
      const adDaily = aggregateDailyByGranularity(ints.adsterra?.data?.daily || [], granularity, 'date', ['revenue']);
      const adMap = new Map(adDaily.map((r) => [r.date, r.revenue]));
      renderMultiChart('overviewComp', 'overviewComparisonChart', 'bar',
        trafficRows.map((r) => r.date),
        [
          { label: ga4Ok ? 'Active Users' : 'Page Views', data: trafficRows.map((r) => (ga4Ok ? r.activeUsers : r.pageViews)), backgroundColor: '#2563eb' },
          { label: 'Ad Revenue ($)', data: trafficRows.map((r) => adMap.get(r.date) || 0), backgroundColor: '#facc15' }
        ]
      );

      renderSimpleTable('overviewPopularPages', d.popularPages || [], 'No page view paths recorded for this period.');
      renderSimpleTable('overviewPopularCompanies', d.popularCompanies || [], 'No company visits recorded for this period.');
      renderSimpleTable('overviewPopularCategories', d.popularCategories || [], 'No category visits recorded for this period.');

      const activityContainer = document.getElementById('overviewRecentActivity');
      const activities = d.recentActivity || [];
      if (!activities.length) {
        activityContainer.innerHTML = '<div class="empty-state">No recent activity events recorded.</div>';
      } else {
        activityContainer.innerHTML = `<table><thead><tr><th>Event</th><th>Path</th><th>Time</th></tr></thead><tbody>${activities.map((a) => `<tr><td><strong>${escapeHtml(a.event)}</strong></td><td>${escapeHtml(a.path)}</td><td>${escapeHtml(new Date(a.timestamp).toLocaleTimeString())}</td></tr>`).join('')}</tbody></table>`;
      }

      // Blocks B - F
      renderAdOverviewSection(ints.adsterra, granularity);
      renderSeoOverviewSection(ints.gsc);
      renderDbOverviewSection(ints.supabase);
      renderInfraOverviewSection(ints.cloudflare);
      renderHealthOverviewSection(ints.health);

      if (status) status.textContent = '';
    } catch (error) {
      cards.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      if (status) setStatus(status, error.message);
    }
  }

  function openIntegrationSetupModal(serviceKey) {
    const modal = document.getElementById('integrationSetupModal');
    const title = document.getElementById('setupModalTitle');
    const body = document.getElementById('setupModalBody');
    if (!modal || !body) return;
    state.activeSetupService = serviceKey;
    const item = state.integrationsReport?.integrations?.[serviceKey];
    title.textContent = `Configure / Reconnect: ${item?.name || serviceKey}`;

    const envVarsList = (item?.missingCredentials && item.missingCredentials.length)
      ? `<p><strong>Missing Server Environment Variables:</strong></p><ul>${item.missingCredentials.map((c) => `<li><code>${escapeHtml(c)}</code></li>`).join('')}</ul>`
      : '<p><strong>Required secrets:</strong> Currently configured in server environment (values remain hidden).</p>';

    body.innerHTML = `
      <div class="alert-banner ${item?.status === 'Connected' ? 'is-success' : 'is-warning'}" style="margin-top:8px;">
        <strong>Current Status:</strong> ${escapeHtml(item?.status || 'Not configured')}
        ${item?.error ? `<br><span>${escapeHtml(item.error)}</span>` : ''}
      </div>
      ${envVarsList}
      <p style="font-size:13px; line-height:1.55;"><strong>How to configure securely:</strong><br>${escapeHtml(item?.setupInstructions || 'Provision the required read-only API token in Cloudflare Dashboard -> Workers & Pages -> prepwise-7ij -> Settings -> Environment variables (encrypted secret).')}</p>
      <div class="code-block">Cloudflare Dashboard -> Pages -> prepwise-7ij -> Settings -> Variables & Secrets -> Add Secret</div>
    `;
    modal.hidden = false;
  }

  async function loadIntegrations(targetService = 'all') {
    const grid = document.getElementById('integrationsGrid');
    if (grid && targetService === 'all') {
      grid.innerHTML = '<div class="empty-state">Probing configured service integrations...</div>';
    }
    try {
      const res = await api(`/api/admin/integrations?service=${encodeURIComponent(targetService)}`);
      if (targetService === 'all' || !state.integrationsReport) {
        state.integrationsReport = res.data;
      } else if (res.data?.integrations?.[targetService]) {
        state.integrationsReport.integrations[targetService] = res.data.integrations[targetService];
      }
      const ints = state.integrationsReport?.integrations || {};
      const order = ['ga4', 'adsterra', 'gsc', 'supabase', 'cloudflare', 'health'];
      const icons = { ga4: 'GA4', adsterra: 'AD', gsc: 'GSC', supabase: 'DB', cloudflare: 'CF', health: 'OK' };

      if (grid) {
        grid.innerHTML = order.map((key) => {
          const item = ints[key];
          if (!item) return '';
          const isBad = item.status === 'Connection error' || item.status === 'Authentication required';
          return `
            <article class="integration-card">
              <div class="integration-card-head">
                <div class="integration-title-wrap">
                  <div class="integration-icon">${icons[key] || 'API'}</div>
                  <div>
                    <h3>${escapeHtml(item.name)}</h3>
                    <span class="muted" style="font-size:11px;">${escapeHtml(key.toUpperCase())}</span>
                  </div>
                </div>
                ${renderStatusPill(item.status)}
              </div>
              <div class="integration-meta-row">
                <span>Last sync: <strong>${item.lastSyncedAt ? escapeHtml(new Date(item.lastSyncedAt).toLocaleString()) : 'Never'}</strong></span>
                ${item.latencyMs != null ? `<span>${item.latencyMs} ms</span>` : ''}
              </div>
              ${item.error ? `<div class="integration-error-box ${isBad ? 'is-err' : ''}">${escapeHtml(item.error)}</div>` : ''}
              <div class="metric-chips">
                ${(item.availableMetrics || []).map((mName) => `<span class="metric-chip">${escapeHtml(mName)}</span>`).join('')}
              </div>
              <div class="integration-actions">
                <button type="button" class="primary btn-sm" data-test-integration="${escapeHtml(key)}">Test Connection</button>
                <button type="button" class="secondary btn-sm" data-setup-integration="${escapeHtml(key)}">Configure / Details</button>
              </div>
            </article>
          `;
        }).join('');

        grid.querySelectorAll('[data-test-integration]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Testing...';
            await loadIntegrations(btn.dataset.testIntegration);
          });
        });
        grid.querySelectorAll('[data-setup-integration]').forEach((btn) => {
          btn.addEventListener('click', () => openIntegrationSetupModal(btn.dataset.setupIntegration));
        });
      }
    } catch (error) {
      if (grid) grid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function openPopunderConfirmModal() {
    const modal = document.getElementById('popunderConfirmModal');
    const cb = document.getElementById('popunderAckCheckbox');
    const btn = document.getElementById('confirmPopunderBtn');
    if (cb) cb.checked = false;
    if (btn) btn.disabled = true;
    if (modal) modal.hidden = false;
  }

  function renderAdControlsAudit(logs) {
    const el = document.getElementById('adControlsAuditTable');
    if (!el) return;
    const rows = Array.isArray(logs) ? logs : [];
    if (!rows.length) {
      el.innerHTML = '<div class="empty-state">No advertising control changes recorded yet.</div>';
      return;
    }
    el.innerHTML = `
      <table>
        <thead><tr><th>Timestamp</th><th>Administrator</th><th>Unit / Action</th><th>Previous State</th><th>New State</th><th>Result</th></tr></thead>
        <tbody>${rows.map((r) => {
          const m = r.metadata || {};
          const who = m.administrator?.displayName || m.administrator?.email || r.admin_user_id || 'Admin';
          const unitOrAction = m.unitId || r.action || 'ad_controls';
          const prevStr = typeof m.previousState === 'boolean' ? (m.previousState ? 'ON' : 'OFF') : (m.previousState ? JSON.stringify(m.previousState.masterEnabled ? 'Master ON' : 'Master OFF') : '—');
          const nextRaw = m.newState !== undefined ? m.newState : m.attemptedState;
          const nextStr = typeof nextRaw === 'boolean' ? (nextRaw ? 'ON' : 'OFF') : (nextRaw && typeof nextRaw.masterEnabled === 'boolean' ? (nextRaw.masterEnabled ? 'Master ON' : 'Master OFF') : '—');
          const ok = m.success !== false;
          return `<tr>
            <td>${escapeHtml(new Date(r.created_at).toLocaleString())}</td>
            <td>${escapeHtml(who)}</td>
            <td><code>${escapeHtml(String(unitOrAction))}</code> <span class="muted" style="font-size:11px;">(${escapeHtml(m.action || r.action || '')})</span></td>
            <td>${escapeHtml(String(prevStr))}</td>
            <td>${escapeHtml(String(nextStr))}</td>
            <td><span class="status-pill ${ok ? 'status-connected' : 'status-error'}">${ok ? 'Success' : 'Blocked / Failed'}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    `;
  }

  async function submitAdControlMutation(payload) {
    const statusEl = document.getElementById('adControlsStatus');
    setStatus(statusEl, 'Saving change...', false);
    try {
      const res = await api('/api/admin/ad-controls', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res?.data?.controls) {
        state.adControls = res.data.controls;
        state.adControlsError = null;
      }
      renderAdvertisingPlacements();
      if (state.integrationsReport?.integrations?.adsterra) {
        renderAdOverviewSection(state.integrationsReport.integrations.adsterra, document.getElementById('overviewGranularity')?.value || 'daily');
      }
      const refreshRes = await api('/api/admin/ad-controls').catch(() => null);
      if (refreshRes?.data) {
        state.adControls = refreshRes.data.controls;
        state.adControlsPermissions = refreshRes.data.permissions;
        state.adControlsError = null;
        renderAdvertisingPlacements();
        if (state.integrationsReport?.integrations?.adsterra) {
          renderAdOverviewSection(state.integrationsReport.integrations.adsterra, document.getElementById('overviewGranularity')?.value || 'daily');
        }
        renderAdControlsAudit(refreshRes.data.auditLogs);
      }
      setStatus(statusEl, 'Saved to Supabase & audit logged. Takes effect on fresh page loads (already-loaded ads remain until refresh).', false);
    } catch (err) {
      setStatus(statusEl, err.message, true);
      renderAdvertisingPlacements();
    }
  }

  async function loadAdvertising() {
    const banner = document.getElementById('advertisingApiBanner');
    const controlsNotice = document.getElementById('adControlsNotice');
    const rangeTag = document.getElementById('advertisingRangeLabel');
    try {
      if (!state.advertisingFilterCustomized) {
        syncAdvertisingFilterFromOverview();
      }
      const period = document.getElementById('advertisingPeriod')?.value || '7';
      const params = analyticsQuery(period, 'advertisingFrom', 'advertisingTo');
      let adControlsErr = null;
      const [res, ctrlRes] = await Promise.all([
        api(`/api/admin/integrations?service=adsterra&${params}`),
        api('/api/admin/ad-controls').catch((err) => { adControlsErr = err; return null; })
      ]);
      const ad = res?.data?.integrations?.adsterra;
      state.lastAdReport = ad;
      if (!state.advertisingFilterCustomized) {
        if (!state.integrationsReport) state.integrationsReport = { integrations: {} };
        state.integrationsReport.integrations.adsterra = ad;
      }

      if (ctrlRes?.data?.controls) {
        state.adControls = ctrlRes.data.controls;
        state.adControlsPermissions = ctrlRes.data.permissions || null;
        state.adControlsError = null;
        if (controlsNotice && ctrlRes.data.runtimeEnforcement?.note) {
          controlsNotice.innerHTML = `<div class="alert-banner is-info" style="margin-bottom:12px;"><strong>Runtime Persistence:</strong> ${escapeHtml(ctrlRes.data.runtimeEnforcement.note)}</div>`;
        }
        renderAdControlsAudit(ctrlRes.data.auditLogs);
      } else {
        state.adControls = null;
        state.adControlsError = adControlsErr?.message || 'Unable to verify saved ad controls.';
        if (controlsNotice) {
          controlsNotice.innerHTML = `<div class="alert-banner is-warning" style="margin-bottom:12px;"><strong>Ad Controls Unavailable:</strong> ${escapeHtml(state.adControlsError)} Interactive controls are locked until saved settings load; Popunder unit <code>32172757</code> remains OFF by default and Owner-controlled.</div>`;
        }
      }

      const ok = ad?.status === 'Connected' && ad?.data;
      const t = ad?.data?.totals || {};
      const rangeText = formatAdReportingRange(ad, params);
      if (rangeTag) rangeTag.textContent = `Window: ${rangeText}`;

      const controlsLoaded = Boolean(state.adControls && state.adControls.units);
      const masterOn = controlsLoaded && state.adControls.masterEnabled !== false;
      const popOn = controlsLoaded && state.adControls.units['32172757'] === true;

      if (banner) {
        banner.innerHTML = ok
          ? `<div class="alert-banner is-success"><strong>Connected:</strong> Authenticated Adsterra Publisher API telemetry loaded for <strong>${escapeHtml(rangeText)}</strong>. ${getPopunderPolicySummary(state.adControls, state.adControlsError)}</div>`
          : `<div class="alert-banner is-warning"><strong>Adsterra Publisher API (${escapeHtml(ad?.status || 'Not configured')}):</strong> ${escapeHtml(ad?.error || 'Set ADSTERRA_API_TOKEN to view live earnings & impressions.')} Requested window: <strong>${escapeHtml(rangeText)}</strong>.</div>`;
      }

      const popCard = !controlsLoaded
        ? ['Popunder (32172757)', 'Unavailable', 'Owner Guard', 'OFF by default; controls unavailable']
        : (popOn
          ? ['Popunder (32172757)', masterOn ? 'ENABLED' : 'PAUSED (Master OFF)', 'Owner Guard', masterOn ? 'Explicitly enabled by Owner' : 'Saved ON; paused by Master OFF']
          : ['Popunder (32172757)', 'OFF (Default)', 'Owner Guard', 'Owner-controlled; OFF by default']);

      renderStatCards('advertisingSummaryCards', [
        ['Impressions', ok ? t.impressions : 'Unavailable', ok ? `Adsterra API · ${rangeText}` : 'Not configured'],
        ['Clicks & CTR', ok ? `${t.clicks} (${t.ctr}%)` : 'Unavailable', ok ? `Adsterra API · ${rangeText}` : 'Not configured'],
        ['CPM', ok ? `$${Number(t.cpm || 0).toFixed(2)}` : 'Unavailable', ok ? `Adsterra API · ${rangeText}` : 'Not configured'],
        ['Est. Revenue', ok ? `$${Number(t.revenue || 0).toFixed(3)}` : 'Unavailable', ok ? `Adsterra API · ${rangeText}` : 'Not configured'],
        popCard
      ]);
      const daily = ad?.data?.daily || [];
      renderMultiChart('adDetRev', 'adDetailRevenueChart', 'line', daily.map((r) => r.date), [{ label: 'Revenue ($)', data: daily.map((r) => r.revenue), borderColor: '#16a34a', tension: 0.2 }]);
      renderMultiChart('adDetImp', 'adDetailImpressionsChart', 'bar', daily.map((r) => r.date), [{ label: 'Impressions', data: daily.map((r) => r.impressions), backgroundColor: '#2563eb' }]);
      renderAdvertisingPlacements();
    } catch (error) {
      if (banner) banner.innerHTML = `<div class="alert-banner is-error">${escapeHtml(error.message)}</div>`;
    }
  }

  async function loadSeo() {
    const banner = document.getElementById('seoApiBanner');
    try {
      const params = analyticsQuery(document.getElementById('overviewPeriod')?.value || '7', 'overviewFrom', 'overviewTo');
      const res = await api(`/api/admin/integrations?service=gsc&${params}`);
      const gsc = res?.data?.integrations?.gsc;
      state.lastSeoReport = gsc;
      const ok = gsc?.status === 'Connected' && gsc?.data;
      const t = gsc?.data?.totals || {};
      const dr = gsc?.data?.dateRange;
      const rangeText = dr ? `${dr.startDate} to ${dr.endDate}` : 'selected period';
      if (banner) {
        banner.innerHTML = ok
          ? `<div class="alert-banner is-success"><strong>Connected:</strong> Search Console property <code>${escapeHtml(gsc.data.siteUrl)}</code> &middot; Range: ${escapeHtml(rangeText)} (Search Console data normally lags 2–3 days).</div>`
          : `<div class="alert-banner is-warning"><strong>Google Search Console (${escapeHtml(gsc?.status || 'Not configured')}):</strong> ${escapeHtml(gsc?.error || 'Missing Search Console credentials.')}</div>`;
      }
      renderStatCards('seoCards', [
        ['Clicks', ok ? (t.clicks ?? 0) : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
        ['Impressions', ok ? (t.impressions ?? 0) : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
        ['Average CTR', ok ? `${t.ctr ?? 0}%` : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
        ['Average Position', ok ? (t.avgPosition != null ? t.avgPosition : '— (0 impr.)') : 'Unavailable', ok ? 'GSC API' : 'Not configured']
      ]);
      const daily = gsc?.data?.daily || [];
      renderMultiChart('seoDet', 'seoDetailChart', 'line', daily.map((d) => d.date), [
        { label: 'Clicks', data: daily.map((d) => d.clicks), borderColor: '#2563eb', tension: 0.2 },
        { label: 'Impressions', data: daily.map((d) => d.impressions), borderColor: '#facc15', tension: 0.2 }
      ]);
      const qEl = document.getElementById('seoQueriesTable');
      const pEl = document.getElementById('seoPagesTable');
      const sEl = document.getElementById('seoSitemapsTable');
      if (qEl) qEl.innerHTML = ok && gsc.data.topQueries.length ? `<table><thead><tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>${gsc.data.topQueries.map((r) => `<tr><td>${escapeHtml(r.query)}</td><td>${r.clicks}</td><td>${r.impressions}</td><td>${r.ctr}%</td><td>${r.position}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">${ok ? `Connected — 0 search queries recorded for ${escapeHtml(rangeText)} (normal if recent or lagging 2–3 days).` : 'No Search Console query data available.'}</div>`;
      if (pEl) pEl.innerHTML = ok && gsc.data.topPages.length ? `<table><thead><tr><th>Page</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>${gsc.data.topPages.map((r) => `<tr><td>${escapeHtml(r.page)}</td><td>${r.clicks}</td><td>${r.impressions}</td><td>${r.ctr}%</td><td>${r.position}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">${ok ? `Connected — 0 landing page impressions recorded for ${escapeHtml(rangeText)}.` : 'No Search Console landing page data available.'}</div>`;
      if (sEl) sEl.innerHTML = ok && gsc.data.sitemaps.length ? `<table><thead><tr><th>Sitemap</th><th>Last Submitted</th><th>Pending</th><th>Warnings</th><th>Errors</th></tr></thead><tbody>${gsc.data.sitemaps.map((m) => `<tr><td><code>${escapeHtml(m.path)}</code></td><td>${m.lastSubmitted ? escapeHtml(new Date(m.lastSubmitted).toLocaleString()) : '—'}</td><td>${m.isPending ? 'Yes' : 'No'}</td><td>${m.warnings}</td><td>${m.errors}</td></tr>`).join('')}</tbody></table>` : `<div class="empty-state">${ok ? 'Connected — no sitemap index entries reported yet for this property.' : 'No sitemap index telemetry available.'}</div>`;
    } catch (error) {
      if (banner) banner.innerHTML = `<div class="alert-banner is-error">${escapeHtml(error.message)}</div>`;
    }
  }

  async function loadDatabaseMonitoring() {
    try {
      const res = await api('/api/admin/integrations?service=supabase');
      const supa = res?.data?.integrations?.supabase;
      const d = supa?.data || {};
      renderStatCards('databaseCards', [
        ['Project Health', supa?.status || 'Unavailable', 'Supabase', `Latency ${supa?.latencyMs ?? 0} ms`],
        ['Total Records', d.totalRows ?? 'Unavailable', 'Supabase'],
        ['Tables Verified', `${(d.tablesCount ?? 0) - (d.errorTables ?? 0)} / ${d.tablesCount ?? 0}`, 'Supabase'],
        ['Storage Buckets', Array.isArray(d.storageBuckets) ? d.storageBuckets.length : 'Unavailable', 'Storage API'],
        ['Auth Accounts', d.authUsersCount != null ? d.authUsersCount : 'Unavailable', 'Auth API']
      ]);
      const tEl = document.getElementById('databaseTablesTable');
      const eEl = document.getElementById('databaseExtrasTable');
      if (tEl) tEl.innerHTML = (d.tables || []).length ? `<table><thead><tr><th>Table Name</th><th>Row Count</th><th>Status</th></tr></thead><tbody>${d.tables.map((t) => `<tr><td><code>${escapeHtml(t.table)}</code></td><td>${t.rows != null ? t.rows.toLocaleString() : '—'}</td><td><span class="status-pill ${t.status === 'reachable' ? 'status-connected' : 'status-error'}">${escapeHtml(t.status)}</span></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">No table metrics available.</div>';
      if (eEl) eEl.innerHTML = (d.recentAdminActivity || []).length ? `<table><thead><tr><th>Admin Action</th><th>Resource</th><th>Timestamp</th></tr></thead><tbody>${d.recentAdminActivity.map((a) => `<tr><td><strong>${escapeHtml(a.action)}</strong></td><td>${escapeHtml(a.resource)}</td><td>${escapeHtml(new Date(a.created_at).toLocaleString())}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">No recent admin audit log rows.</div>';
    } catch (error) {
      renderStatCards('databaseCards', [['Database Status', 'Connection error', 'Error', error.message]]);
    }
  }

  async function loadInfrastructureMonitoring() {
    const banner = document.getElementById('infraApiBanner');
    try {
      const params = analyticsQuery(document.getElementById('overviewPeriod')?.value || '7', 'overviewFrom', 'overviewTo');
      const res = await api(`/api/admin/integrations?service=cloudflare&${params}`);
      const cf = res?.data?.integrations?.cloudflare;
      const ok = cf?.status === 'Connected' && cf?.data;
      const d = cf?.data || {};
      const tr = d.traffic?.totals;
      const { zoneTag, zoneSub } = getCloudflareZoneMeta(ok, d);
      if (banner) {
        banner.innerHTML = ok
          ? `<div class="alert-banner is-success"><strong>Connected:</strong> Cloudflare Pages project <code>${escapeHtml(cf.projectName)}</code>.${zoneSub ? ` <span style="display:block;margin-top:4px;font-size:12px;">Zone Analytics: ${escapeHtml(zoneSub)}</span>` : ''}</div>`
          : `<div class="alert-banner is-warning"><strong>Cloudflare API (${escapeHtml(cf?.status || 'Not configured')}${cf?.projectName ? ` · ${escapeHtml(cf.projectName)}` : ''}):</strong> ${escapeHtml(cf?.error || 'Missing Cloudflare credentials.')}</div>`;
      }
      renderStatCards('infrastructureCards', [
        ['Latest Prod Deploy', ok && d.latestProduction ? d.latestProduction.status : 'Unavailable', ok ? 'Cloudflare' : 'Not configured'],
        ['Failed Deploys (10)', ok ? d.failedDeployments : 'Unavailable', ok ? 'Cloudflare' : 'Not configured'],
        ['Edge Requests', tr ? tr.requests : 'Unavailable', zoneTag, zoneSub],
        ['Total Bandwidth', tr ? formatBytes(tr.bytes) : 'Unavailable', zoneTag, zoneSub]
      ]);
      const daily = d.traffic?.daily || [];
      renderMultiChart('infraTraf', 'infraTrafficChart', 'line', daily.map((r) => r.date), [{ label: 'Requests', data: daily.map((r) => r.requests), borderColor: '#2563eb', tension: 0.2 }]);
      const depEl = document.getElementById('infrastructureDeploymentsTable');
      if (depEl) depEl.innerHTML = ok && (d.deployments || []).length ? `<table><thead><tr><th>Deploy</th><th>Env</th><th>Commit</th><th>Message</th><th>Status</th><th>Date</th></tr></thead><tbody>${d.deployments.map((dp) => `<tr><td><code>${escapeHtml(dp.id)}</code></td><td>${escapeHtml(dp.environment)}</td><td><code>${escapeHtml(dp.commitHash)}</code></td><td>${escapeHtml(dp.commitMessage)}</td><td><span class="status-pill ${dp.status === 'success' ? 'status-connected' : 'status-error'}">${escapeHtml(dp.status)}</span></td><td>${escapeHtml(new Date(dp.createdOn).toLocaleString())}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Connect Cloudflare API token to inspect deployments.</div>';
    } catch (error) {
      if (banner) banner.innerHTML = `<div class="alert-banner is-error">${escapeHtml(error.message)}</div>`;
    }
  }

  async function loadDeploymentCenter() {
    const banner = document.getElementById('deployBanner');
    const blockEl = document.getElementById('deployBlockReason');
    const preflightEl = document.getElementById('deployPreflightGrid');
    const deployBtn = document.getElementById('deployToProductionBtn');
    const histEl = document.getElementById('deployHistoryTable');
    const failEl = document.getElementById('deployFailedTable');

    if (banner) banner.innerHTML = '<div class="alert-banner is-info">Running live pre-deployment verification checks...</div>';
    if (blockEl) { blockEl.hidden = true; blockEl.innerHTML = ''; }
    if (preflightEl) preflightEl.innerHTML = '<div class="empty-state">Running live pre-deployment safety checks...</div>';
    if (histEl) histEl.innerHTML = '<div class="empty-state">Loading deployment history...</div>';
    if (failEl) failEl.innerHTML = '<div class="empty-state">Loading failed deployments &amp; audit log...</div>';
    if (deployBtn) {
      deployBtn.hidden = false;
      deployBtn.disabled = true;
    }
    try {
      const res = await api('/api/admin/deploy', { timeoutMs: 15000 });
      const d = res?.data || {};
      state.deployReport = d;
      const pf = d.preflight || {};
      const lp = d.latestProduction;
      const cfOk = Boolean(pf.cloudflareConfigured);
      const reasons = Array.isArray(pf.blockingReasons) ? pf.blockingReasons : [];
      const rs = pf.repoSync || {};
      const prim = rs.primary || {};
      const back = rs.backup || {};
      const cfPerms = pf.cloudflarePermissions || {};
      const tokenInfo = pf.cloudflareToken || {};

      if (deployBtn) {
        deployBtn.hidden = false;
        deployBtn.disabled = Boolean(state.deployInFlight || !d.canDeploy || !pf.readyToDeploy);
        deployBtn.title = d.canDeploy
          ? (pf.readyToDeploy ? 'Trigger production deployment on Cloudflare Pages' : (reasons[0] || 'Pre-deployment checks blocked'))
          : 'Owner access required to trigger production deployments';
      }

      if (banner) {
        if (!cfOk) {
          banner.innerHTML = `<div class="alert-banner is-warning"><strong>Cloudflare Pages (${escapeHtml(pf.cloudflareStatus || 'Not configured')}):</strong> ${escapeHtml(pf.cloudflareError || 'Configure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.')}</div>`;
        } else if (!pf.repositoriesSynchronized) {
          banner.innerHTML = `<div class="alert-banner is-error"><strong>Deployment Blocked &mdash; Repository Synchronization Check:</strong> ${escapeHtml(rs.error || 'Primary and backup main branches do not match.')}</div>`;
        } else if (!d.canDeploy) {
          banner.innerHTML = `<div class="alert-banner is-info"><strong>View-Only Access:</strong> Connected to Cloudflare Pages <code>${escapeHtml(d.project?.name || 'prepwise-7ij')}</code> (${escapeHtml(d.project?.productionBranch || 'main')}). Only the verified Owner can trigger production deployments.</div>`;
        } else if (!pf.readyToDeploy) {
          banner.innerHTML = `<div class="alert-banner is-warning"><strong>Deployment Blocked:</strong> One or more mandatory preflight checks did not pass. Review the blocked reasons below before deploying.</div>`;
        } else {
          banner.innerHTML = `<div class="alert-banner is-success"><strong>Ready for Production Release Review:</strong> Project <code>${escapeHtml(d.project?.name || 'prepwise-7ij')}</code> (${escapeHtml(d.project?.productionBranch || 'main')}), primary &amp; backup GitHub <code>main</code> synced at <code>${escapeHtml(prim.shortSha || '—')}</code>.</div>`;
        }
      }

      if (blockEl) {
        if (pf.readyToDeploy) {
          blockEl.hidden = true;
          blockEl.innerHTML = '';
        } else if (reasons.length) {
          blockEl.hidden = false;
          blockEl.className = 'deploy-block-reason alert-banner is-warning';
          blockEl.innerHTML = `<strong>Deploy button disabled because:</strong><ul style="margin:6px 0 0 18px; padding:0;">${reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`;
        }
      }

      const currentShort = pf.currentCommitShortSha || lp?.commitHash || 'Unavailable';
      const expectedShort = pf.expectedCommitShortSha || prim.shortSha || 'Unavailable';
      renderStatCards('deploySummaryCards', [
        ['Project Name', d.project?.name || pf.projectName || 'prepwise-7ij', cfOk ? 'Cloudflare Pages' : (pf.cloudflareStatus || 'Unverified')],
        ['Production Branch', d.project?.productionBranch || pf.productionBranch || 'Unavailable', pf.branchVerified ? 'Verified: main' : 'Unverified / Mismatch'],
        ['Latest Prod Deploy', lp ? `${lp.id} (${lp.status})` : 'Unavailable', cfOk ? 'Cloudflare API' : 'Not connected', lp?.createdOn ? new Date(lp.createdOn).toLocaleString() : ''],
        ['Current vs Expected SHA', `${currentShort} → ${expectedShort}`, currentShort === expectedShort && currentShort !== 'Unavailable' ? 'In Sync' : 'Pending / Diff', lp?.commitMessage || prim.message || ''],
        ['Failed Deploys (last 10)', cfOk ? (d.failedCount ?? 0) : 'Unavailable', cfOk ? 'Cloudflare API' : 'Not connected']
      ]);

      if (preflightEl) {
        const permDetail = `Pages Read: ${cfPerms.pagesRead?.ok ? 'OK' : (cfPerms.pagesRead?.status || 'Failed')} · Pages Edit: ${cfPerms.pagesEdit?.status || 'unknown'} · Zone Analytics: ${cfPerms.zoneAnalyticsRead?.status || 'unknown'}`;
        const cfAuthPass = Boolean(cfOk && cfPerms.pagesRead?.ok && (tokenInfo.checked ? tokenInfo.active : true));
        const eligibilityPass = Boolean(pf.readyToDeploy);
        const checks = [
          ['GitHub Primary (RayyanShajahan/prepwise)', Boolean(prim.ok), prim.ok ? `main @ ${prim.shortSha} (${prim.message})` : (prim.error || 'Unreachable')],
          ['GitHub Backup (Sreesidh-git/prepwise)', Boolean(back.ok), back.ok ? `main @ ${back.shortSha} (${back.message})` : (back.error || 'Unreachable')],
          ['Main Branch Synchronization', Boolean(pf.repositoriesSynchronized), pf.repositoriesSynchronized ? `Synced (${prim.shortSha || ''} == ${back.shortSha || ''})` : (rs.error || 'Not synchronized')],
          ['Commit SHA Alignment (Current vs Expected)', Boolean(pf.expectedCommitSha), `Live: ${currentShort} | Expected: ${expectedShort}`],
          ['Cloudflare Pages Project Detection', Boolean(pf.projectVerified && pf.branchVerified), pf.projectVerified ? `${pf.projectName || 'prepwise-7ij'} (branch: ${pf.productionBranch || 'unknown'})` : (pf.cloudflareError || 'Project or branch unverified')],
          ['Cloudflare Authorization & Permissions', cfAuthPass, permDetail],
          ['Owner Auth & Deployment Eligibility', Boolean(pf.ownerAuthorized && eligibilityPass), pf.ownerAuthorized ? (eligibilityPass ? 'Verified Owner · Eligible to deploy' : 'Owner verified · Blocked by preflight') : 'Non-Owner Admin (Deployments blocked)'],
          ['Clean Working Tree Confirm', null, 'Explicit checkbox confirmation required before trigger']
        ];
        preflightEl.innerHTML = checks.map(([label, pass, detail]) => {
          const pillCls = pass === true ? 'status-connected' : (pass === false ? 'status-error' : 'status-unavailable');
          const pillTxt = pass === true ? 'Pass' : (pass === false ? 'Blocked' : 'Manual Confirm');
          return `<div class="deploy-check-item"><div><strong>${escapeHtml(label)}</strong><br><span class="muted" style="font-size:12px;">${escapeHtml(detail || '')}</span></div><span class="status-pill ${pillCls}">${escapeHtml(pillTxt)}</span></div>`;
        }).join('');
      }

      const deps = d.deployments || [];
      if (histEl) {
        histEl.innerHTML = deps.length
          ? `<table><thead><tr><th>Deploy ID</th><th>Commit SHA</th><th>Branch</th><th>Status</th><th>Created / Completed</th><th>Production URL</th></tr></thead><tbody>${deps.map((dp) => {
              const created = dp.createdOn ? new Date(dp.createdOn).toLocaleString() : '—';
              const completed = dp.completedOn ? new Date(dp.completedOn).toLocaleString() : 'In progress';
              const urlCell = dp.url ? `<a href="${escapeHtml(dp.url)}" target="_blank" rel="noopener">${escapeHtml(dp.url.replace(/^https?:\/\//i, ''))}</a>` : '—';
              return `<tr><td><code>${escapeHtml(dp.id || '—')}</code><br><span class="muted" style="font-size:11px;">${escapeHtml(dp.environment || '—')}</span></td><td><code>${escapeHtml(dp.commitHash || '—')}</code><br><span class="muted" style="font-size:11px;">${escapeHtml(dp.commitMessage || '—')}</span></td><td><code>${escapeHtml(dp.branch || 'main')}</code></td><td><span class="status-pill ${dp.status === 'success' ? 'status-connected' : (dp.status === 'failure' || dp.status === 'failed' ? 'status-error' : 'status-unavailable')}">${escapeHtml(dp.status || 'unknown')}</span></td><td>${escapeHtml(created)}<br><span class="muted" style="font-size:11px;">Done: ${escapeHtml(completed)}</span></td><td>${urlCell}</td></tr>`;
            }).join('')}</tbody></table>`
          : `<div class="empty-state">${cfOk ? 'No Cloudflare Pages deployments returned yet.' : escapeHtml(pf.cloudflareError || 'Cloudflare deployment history unavailable — check CLOUDFLARE_API_TOKEN permissions.')}</div>`;
      }

      const failed = d.failedDeployments || [];
      const audit = d.auditLogs || [];
      if (failEl) {
        const failedHtml = failed.length
          ? `<table style="margin-bottom:14px;"><thead><tr><th>Failed Deploy</th><th>Commit SHA</th><th>Failure Reason</th><th>Timestamp</th></tr></thead><tbody>${failed.map((dp) => `<tr><td><code>${escapeHtml(dp.id || '—')}</code></td><td><code>${escapeHtml(dp.commitHash || '—')}</code></td><td>${escapeHtml(dp.failureReason || dp.stage || 'Build failed')}</td><td>${escapeHtml(dp.completedOn || dp.createdOn ? new Date(dp.completedOn || dp.createdOn).toLocaleString() : '—')}</td></tr>`).join('')}</tbody></table>`
          : '<div class="empty-state" style="margin-bottom:14px;">0 failed deployments in recent history.</div>';
        const auditErrHtml = d.auditLogsError
          ? `<div class="alert-banner is-warning" style="margin-bottom:10px;"><strong>Audit Log Warning:</strong> ${escapeHtml(d.auditLogsError)}</div>`
          : '';
        const auditHtml = audit.length
          ? `<table><thead><tr><th>Deploy Action</th><th>Commit / Target</th><th>Details / Failure Reason</th><th>Initiating Admin</th><th>Timestamp</th></tr></thead><tbody>${audit.map((a) => {
              const m = a.metadata || {};
              const detail = m.error || m.reason || (m.success === false ? 'Blocked or failed' : `Triggered (${m.branch || 'main'})`);
              const adminName = m.administrator?.displayName || m.administrator?.email || a.admin_user_id || 'Owner';
              return `<tr><td><strong>${escapeHtml(a.action)}</strong><br><span class="status-pill ${m.success === false ? 'status-error' : 'status-connected'}">${m.success === false ? 'Failed / Denied' : 'Triggered'}</span></td><td><code>${escapeHtml(String(m.commitSha || '').slice(0, 7) || m.project || '—')}</code></td><td>${escapeHtml(detail)}</td><td>${escapeHtml(adminName)}</td><td>${escapeHtml(new Date(a.created_at).toLocaleString())}</td></tr>`;
            }).join('')}</tbody></table>`
          : '<div class="empty-state">No deployment center audit events recorded yet.</div>';
        failEl.innerHTML = failedHtml + auditErrHtml + auditHtml;
      }
    } catch (error) {
      if (deployBtn) {
        deployBtn.hidden = false;
        deployBtn.disabled = true;
      }
      if (banner) banner.innerHTML = `<div class="alert-banner is-error"><strong>Deployment Center Error:</strong> ${escapeHtml(error.message)}</div>`;
      if (blockEl) {
        blockEl.hidden = false;
        blockEl.className = 'deploy-block-reason alert-banner is-error';
        blockEl.innerHTML = `<strong>Deploy unavailable:</strong> ${escapeHtml(error.message)}`;
      }
      if (preflightEl) preflightEl.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      if (histEl) histEl.innerHTML = `<div class="empty-state">Unable to load deployment history: ${escapeHtml(error.message)}</div>`;
      if (failEl) failEl.innerHTML = `<div class="empty-state">Unable to load failed deployments or audit log: ${escapeHtml(error.message)}</div>`;
    }
  }

  function openDeployConfirmModal() {
    if (state.deployInFlight) return;
    const d = state.deployReport;
    const pf = d?.preflight;
    if (!d?.canDeploy || !pf?.readyToDeploy) return;
    const modal = document.getElementById('deployConfirmModal');
    const summary = document.getElementById('deployModalSummary');
    const cb = document.getElementById('deployCleanTreeCheckbox');
    const btn = document.getElementById('confirmDeployBtn');
    if (cb) cb.checked = false;
    if (btn) btn.disabled = true;
    if (summary) {
      summary.innerHTML = `
        <div class="alert-banner is-warning">
          <strong>Target:</strong> Cloudflare Pages <code>${escapeHtml(pf.projectName)}</code> &bull; Branch: <code>${escapeHtml(pf.productionBranch)}</code><br>
          <strong>Commit SHA:</strong> <code>${escapeHtml(pf.repoSync?.primary?.sha || '—')}</code><br>
          <strong>Message:</strong> ${escapeHtml(pf.repoSync?.primary?.message || '—')}<br>
          <strong>Primary &amp; Backup Repos:</strong> Synchronized (${escapeHtml(pf.repoSync?.primary?.shortSha || '')} == ${escapeHtml(pf.repoSync?.backup?.shortSha || '')})
        </div>
      `;
    }
    if (modal) modal.hidden = false;
  }

  async function pollDeploymentProgress(deploymentFullId) {
    const box = document.getElementById('deployProgressBox');
    if (!box) return;
    if (state.deployPollTimer) {
      clearTimeout(state.deployPollTimer);
      state.deployPollTimer = null;
    }

    let attempts = 0;
    const step = async () => {
      attempts += 1;
      try {
        const res = await api(`/api/admin/deploy?deploymentId=${encodeURIComponent(deploymentFullId)}&verifySite=true`);
        const dep = res?.data?.deployment;
        const siteHealth = res?.data?.siteHealth;
        const stages = dep?.stages || [];
        const stageChips = stages.map((s) => `<span class="status-pill ${s.status === 'success' ? 'status-connected' : (s.status === 'failure' ? 'status-error' : 'status-unavailable')}">${escapeHtml(s.name)}: ${escapeHtml(s.status)}</span>`).join('');
        const healthHtml = siteHealth?.data
          ? `<div style="margin-top:10px; font-size:13px;"><strong>Post-Deploy Live Site Verification:</strong> ${siteHealth.data.healthyCount}/${siteHealth.data.totalCount} endpoints healthy (avg ${siteHealth.data.avgLatencyMs} ms).</div>`
          : '';

        box.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <strong>Cloudflare Deployment <code>${escapeHtml(dep?.id || deploymentFullId)}</code>: ${escapeHtml(dep?.status || 'running')} (stage: ${escapeHtml(dep?.stage || 'queued')})</strong>
            <span class="muted" style="font-size:12px;">Poll #${attempts}</span>
          </div>
          <div class="deploy-stage-list">${stageChips}</div>
          ${healthHtml}
        `;

        if (dep?.status === 'success' || dep?.status === 'failure' || dep?.status === 'failed' || attempts >= 24) {
          state.deployInFlight = false;
          await loadDeploymentCenter();
          return;
        }
        state.deployPollTimer = setTimeout(step, 5000);
      } catch (err) {
        state.deployInFlight = false;
        box.innerHTML = `<div class="alert-banner is-error">Progress polling stopped: ${escapeHtml(err.message)}</div>`;
        await loadDeploymentCenter();
      }
    };
    await step();
  }

  async function triggerProductionDeploy() {
    if (state.deployInFlight) return;
    state.deployInFlight = true;
    const deployBtn = document.getElementById('deployToProductionBtn');
    if (deployBtn) deployBtn.disabled = true;
    const modal = document.getElementById('deployConfirmModal');
    const box = document.getElementById('deployProgressBox');
    const expectedCommitSha = state.deployReport?.preflight?.repoSync?.primary?.sha || '';
    const confirmBtn = document.getElementById('confirmDeployBtn');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Triggering...';
    }
    try {
      const res = await api('/api/admin/deploy', {
        method: 'POST',
        body: JSON.stringify({
          confirm: true,
          localCleanConfirmed: true,
          expectedCommitSha
        })
      });
      if (modal) modal.hidden = true;
      const dep = res?.data?.deployment;
      if (box) {
        box.hidden = false;
        box.innerHTML = `<div class="alert-banner is-info">Triggered Cloudflare Pages deployment <code>${escapeHtml(dep?.id || 'pending')}</code> for commit <code>${escapeHtml((res?.data?.commitSha || '').slice(0, 7))}</code>. Tracking build stages...</div>`;
      }
      if (dep?.fullId || dep?.id) {
        await pollDeploymentProgress(dep.fullId || dep.id);
      } else {
        state.deployInFlight = false;
        await loadDeploymentCenter();
      }
    } catch (err) {
      state.deployInFlight = false;
      if (modal) modal.hidden = true;
      if (box) {
        box.hidden = false;
        box.innerHTML = `<div class="alert-banner is-error"><strong>Deployment failed to start:</strong> ${escapeHtml(err.message)}</div>`;
      }
      await loadDeploymentCenter();
    } finally {
      if (confirmBtn) {
        confirmBtn.textContent = 'Trigger Production Deployment';
      }
    }
  }

  async function loadContentSummary() {
    const container = document.getElementById('contentSummaryCards');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Loading content summary...</div>';
    try {
      const result = await api('/api/admin/content-summary');
      const d = result.data || {};
      const integrity = d.contentIntegrity || {};
      const cards = [
        ['Total Companies', d.totalCompanies ?? 22],
        ['Total Questions', d.totalQuestions ?? 1100],
        ['Approved Content', integrity.verifiedValid ?? 1086],
        ['Needs Editorial Review', integrity.needsEditorialReview ?? 14],
        ['Missing / Malformed', integrity.missingOrMalformed ?? 0]
      ];
      container.innerHTML = cards.map(([label, value]) => {
        const isReviewCard = label === 'Needs Editorial Review';
        return `<article class="stat-card" style="${isReviewCard ? 'border-color: #fca5a5; background: #fff5f5;' : ''}">
          <span class="muted">${escapeHtml(label)}</span>
          <span class="number" style="${isReviewCard ? 'color: var(--danger);' : ''}">${Number.isFinite(value) ? value.toLocaleString() : escapeHtml(String(value))}</span>
          ${isReviewCard ? '<button class="card-action-btn" id="jumpToReviewQuestions">View 14 Flagged</button>' : ''}
        </article>`;
      }).join('');

      document.getElementById('jumpToReviewQuestions')?.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.remove('active'));
        document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
        const contentNav = document.querySelector('.nav-item[data-section="content"]');
        contentNav?.classList.add('active');
        document.getElementById('section-content')?.classList.add('active');

        state.resource = 'interview_questions';
        renderResourceTabs();
        loadResource().then(() => {
          const statusFilter = document.getElementById('questionStatusFilter');
          if (statusFilter) {
            statusFilter.value = 'under_review';
            filterQuestions();
          }
        });
      });
    } catch (error) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  const FLAGGED_QUESTION_KEYS = new Set([
    'accenture-16', 'accenture-26',
    'amazon-10', 'amazon-33',
    'cognizant-19', 'cognizant-25',
    'google-32',
    'hcl-30',
    'infosys-14', 'infosys-25', 'infosys-49',
    'microsoft-34',
    'wipro-8', 'wipro-32'
  ]);

  function isQuestionFlagged(q) {
    const company = (q.company_slug || q.companies?.slug || q.company_id || '').toLowerCase();
    const idNum = q.legacy_id ? String(q.legacy_id).replace(/^[a-z]+-?/i, '') : String(q.id || '');
    const key = `${company}-${idNum}`;
    return FLAGGED_QUESTION_KEYS.has(key) || FLAGGED_QUESTION_KEYS.has(String(q.legacy_id));
  }

  function renderResourceTabs() {
    const tabs = document.getElementById('resourceTabs');
    tabs.innerHTML = resources.map(resource => `<button class="${resource === state.resource ? 'active' : 'secondary'}" data-resource="${resource}">${resource.replace(/_/g, ' ')}</button>`).join('');
    tabs.querySelectorAll('[data-resource]').forEach((button) => button.addEventListener('click', () => {
      state.resource = button.dataset.resource;
      renderResourceTabs();
      loadResource();
    }));

    const isQuestions = state.resource === 'interview_questions';
    const isCompanies = state.resource === 'companies';
    const questionToolbar = document.getElementById('questionToolbar');
    const companyToolbar = document.getElementById('companyToolbar');
    const genericToolbar = document.getElementById('genericToolbar');

    if (questionToolbar) questionToolbar.hidden = !isQuestions;
    if (companyToolbar) companyToolbar.hidden = !isCompanies;
    if (genericToolbar) genericToolbar.hidden = isQuestions || isCompanies;

    const qForm = document.getElementById('questionEditorForm');
    if (qForm) qForm.hidden = true;
    const cForm = document.getElementById('companyEditorForm');
    if (cForm) cForm.hidden = true;
    const qModal = document.getElementById('questionImportModal');
    if (qModal) qModal.hidden = true;
    const rForm = document.getElementById('recordForm');
    if (rForm) rForm.hidden = true;
  }

  function renderTable(container, records) {
    if (state.resource === 'feedback') {
      renderFeedbackTable(container, records);
      return;
    }

    if (state.resource === 'website_settings') {
      renderSettingsTable(container, records);
      return;
    }

    if (state.resource === 'admin_activity_logs') {
      renderActivityLogsTable(container, records);
      return;
    }

    if (!records.length) {
      container.innerHTML = '<div class="empty-state">No records returned from the protected API.</div>';
      return;
    }

    if (state.resource === 'interview_questions') {
      renderQuestionsTable(container, records);
      return;
    }

    if (state.resource === 'companies') {
      renderCompaniesTable(container, records);
      return;
    }

    const columns = Object.keys(records[0]).filter((key) => !['options', 'explanation', 'job_roles', 'test_pattern', 'description', 'history', 'interview_process'].includes(key)).slice(0, 8);
    container.innerHTML = `<table><thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${records.map((record) => `<tr data-id="${record.id || ''}">${columns.map((column) => `<td>${String(record[column] ?? '').slice(0, 180)}</td>`).join('')}<td class="actions"><button class="secondary edit-record">Edit</button><button class="danger delete-record">Delete</button></td></tr>`).join('')}</tbody></table>`;
    container.querySelectorAll('.edit-record').forEach((button) => button.addEventListener('click', () => openRecord(button.closest('tr').dataset.id)));
    container.querySelectorAll('.delete-record').forEach((button) => button.addEventListener('click', () => deleteRecord(button.closest('tr').dataset.id)));
  }

  function renderFeedbackTable(container, records) {
    if (!records.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No feedback submissions yet</h3>
          <p class="muted">Reports from visitors, question corrections, and contact messages submitted through the website will appear here for review.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Page / Subject</th>
            <th>Message</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((item) => {
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : '—';
            const kindLabel = (item.kind || 'general').replace(/_/g, ' ');
            const statusClass = item.status === 'resolved' ? 'badge-approved' : (item.status === 'in_review' ? 'badge-draft' : 'badge-danger');
            return `
              <tr data-id="${escapeHtml(item.id)}">
                <td style="white-space:nowrap;">${escapeHtml(dateStr)}</td>
                <td><span class="badge ${escapeHtml(statusClass)}">${escapeHtml(kindLabel)}</span></td>
                <td><code style="font-size:12px;">${escapeHtml(item.page_path || '—')}</code></td>
                <td style="max-width: 320px; word-break: break-word;">${escapeHtml(item.message || '—')}</td>
                <td><span class="badge ${escapeHtml(statusClass)}">${escapeHtml(item.status || 'open')}</span></td>
                <td class="actions">
                  ${item.status !== 'resolved' ? '<button class="secondary btn-sm resolve-feedback-btn">Mark Resolved</button>' : '<span class="muted" style="font-size:12px;">Resolved</span>'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.resolve-feedback-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const tr = button.closest('tr');
        const id = tr?.dataset?.id;
        if (!id) return;
        try {
          await api(`/api/admin/feedback?id=${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'resolved', resolved_at: new Date().toISOString() })
          });
          await loadResource();
        } catch (err) {
          window.alert(err.message);
        }
      });
    });
  }

  function renderSettingsTable(container, records) {
    if (!records.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No custom website settings configured</h3>
          <p class="muted">PrepWise is operating using standard application defaults. You can define custom configuration keys below.</p>
          <button class="primary" id="emptyNewSettingBtn" type="button" style="margin-top: 14px;">+ Add Website Setting</button>
        </div>
      `;
      document.getElementById('emptyNewSettingBtn')?.addEventListener('click', () => {
        openSettingEditor();
      });
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Setting Key</th>
            <th>Value</th>
            <th>Visibility</th>
            <th>Last Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((s) => {
            const valStr = typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value ?? '');
            const updatedStr = s.updated_at ? new Date(s.updated_at).toLocaleString() : '—';
            const visBadge = s.is_public
              ? '<span class="status-pill status-active">Public</span>'
              : '<span class="status-pill status-inactive">Internal</span>';
            return `
              <tr data-key="${escapeHtml(s.key)}">
                <td><strong><code>${escapeHtml(s.key)}</code></strong></td>
                <td style="max-width: 340px; font-family: monospace; font-size: 12px; word-break: break-all;">${escapeHtml(valStr)}</td>
                <td>${visBadge}</td>
                <td style="white-space:nowrap;">${escapeHtml(updatedStr)}</td>
                <td class="actions">
                  <button class="secondary btn-sm edit-setting-btn">Edit</button>
                  <button class="danger btn-sm delete-setting-btn">Delete</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.edit-setting-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.closest('tr')?.dataset?.key;
        if (key) openSettingEditor(key);
      });
    });

    container.querySelectorAll('.delete-setting-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.closest('tr')?.dataset?.key;
        if (!key || !window.confirm(`Delete setting "${key}"?`)) return;
        try {
          await api(`/api/admin/website_settings?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
          await loadResource();
        } catch (err) {
          window.alert(err.message);
        }
      });
    });
  }

  function openSettingEditor(key = '') {
    const s = state.records.find((item) => item.key === key) || {};
    const formPanel = document.getElementById('settingEditorForm');
    if (!formPanel) return;
    formPanel.hidden = false;
    document.getElementById('settingFormTitle').textContent = key ? `Edit setting "${key}"` : 'Add website setting';
    const keyInput = document.getElementById('settingKeyInput');
    keyInput.value = key || '';
    keyInput.disabled = Boolean(key);
    const valInput = document.getElementById('settingValueInput');
    valInput.value = s.value !== undefined ? (typeof s.value === 'object' ? JSON.stringify(s.value, null, 2) : String(s.value)) : '';
    document.getElementById('settingIsPublicInput').checked = Boolean(s.is_public);
    setStatus(document.getElementById('settingFormStatus'), '');
    formPanel.scrollIntoView({ behavior: 'smooth' });
    if (!key) keyInput.focus();
    else valInput.focus();
  }

  function setupSettingsManagement() {
    if (setupSettingsManagement.initialized) return;
    setupSettingsManagement.initialized = true;

    document.getElementById('newSettingButton')?.addEventListener('click', () => {
      openSettingEditor();
    });

    document.getElementById('cancelSettingButton')?.addEventListener('click', () => {
      const formPanel = document.getElementById('settingEditorForm');
      if (formPanel) formPanel.hidden = true;
    });

    document.getElementById('settingForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('settingFormStatus');
      const keyInput = document.getElementById('settingKeyInput');
      const key = (keyInput.value || '').trim();
      const valRaw = (document.getElementById('settingValueInput')?.value || '').trim();
      const isPublic = Boolean(document.getElementById('settingIsPublicInput')?.checked);

      if (!key) {
        setStatus(status, 'Setting key is required.');
        return;
      }

      let parsedValue;
      try {
        parsedValue = JSON.parse(valRaw);
      } catch {
        parsedValue = { value: valRaw };
      }

      try {
        setStatus(status, 'Saving setting...', false);
        const payload = {
          key,
          value: parsedValue,
          is_public: isPublic
        };
        const method = keyInput.disabled ? 'PATCH' : 'POST';
        const url = `/api/admin/website_settings?key=${encodeURIComponent(key)}`;
        await api(url, {
          method,
          body: JSON.stringify(payload)
        });
        setStatus(status, '');
        document.getElementById('settingForm').reset();
        document.getElementById('settingEditorForm').hidden = true;
        await loadResource();
      } catch (err) {
        setStatus(status, err.message);
      }
    });
  }

  function renderActivityLogsTable(container, records) {
    if (!records.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No administrative activity logged yet</h3>
          <p class="muted">Security events and administrative actions (such as managing administrator profiles, modifying questions, updating companies, or changing settings) will be automatically audited and recorded here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Resource Type</th>
            <th>Entity ID / Key</th>
            <th>Admin User</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((log) => {
            const dateStr = log.created_at ? new Date(log.created_at).toLocaleString() : '—';
            const actionLabel = (log.action || 'activity').replace(/_/g, ' ');
            const target = log.entity_id ? log.entity_id.slice(0, 8) + '...' : (log.metadata?.setting_key || log.metadata?.target_id || '—');
            const userStr = log.admin_user_id ? log.admin_user_id.slice(0, 8) + '...' : 'System';
            const metaStr = log.metadata ? JSON.stringify(log.metadata) : '—';
            return `
              <tr>
                <td style="white-space:nowrap;">${escapeHtml(dateStr)}</td>
                <td><code style="font-size:12px; font-weight:700;">${escapeHtml(actionLabel)}</code></td>
                <td>${escapeHtml(log.entity_type || '—')}</td>
                <td><code style="font-size:12px;">${escapeHtml(target)}</code></td>
                <td><code style="font-size:12px;">${escapeHtml(userStr)}</code></td>
                <td style="max-width:280px; font-family:monospace; font-size:11px; word-break:break-all;">${escapeHtml(metaStr)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function renderCompaniesTable(container, records) {
    if (!records.length) {
      container.innerHTML = '<div class="empty-state">No companies found. Click "New Company" to create one.</div>';
      return;
    }
    container.innerHTML = `<table>
      <thead>
        <tr>
          <th>Company</th>
          <th>Short Name</th>
          <th>Slug</th>
          <th>Industry / Category</th>
          <th>Founded</th>
          <th>Headquarters</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${records.map((c) => {
          const id = c.id || c.legacy_id || c.slug || '';
          const logo = c.logo || '🏢';
          const isPub = c.is_published !== false;
          return `<tr data-id="${escapeHtml(id)}">
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-grid; place-items:center; width:28px; height:28px; border-radius:6px; background:${escapeHtml(c.logo_background || '#eff6ff')}; color:${escapeHtml(c.logo_color || '#2563eb')}; font-size:16px;">${escapeHtml(logo)}</span>
                <strong>${escapeHtml(c.name || '—')}</strong>
              </div>
            </td>
            <td>${escapeHtml(c.short_name || c.shortName || '—')}</td>
            <td><code style="font-size:12px;">${escapeHtml(c.slug || '—')}</code></td>
            <td>${escapeHtml(c.industry || c.category || c.company_categories?.name || '—')}</td>
            <td>${c.founded ? escapeHtml(String(c.founded)) : '—'}</td>
            <td>${escapeHtml(c.headquarters || '—')}</td>
            <td><span class="badge ${isPub ? 'badge-published' : 'badge-draft'}">${isPub ? 'Published' : 'Draft'}</span></td>
            <td class="actions">
              <button class="secondary edit-company-btn">Edit</button>
              <button class="danger delete-company-btn">Delete</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

    container.querySelectorAll('.edit-company-btn').forEach((button) => {
      button.addEventListener('click', () => openCompanyEditor(button.closest('tr').dataset.id));
    });
    container.querySelectorAll('.delete-company-btn').forEach((button) => {
      button.addEventListener('click', () => deleteCompany(button.closest('tr').dataset.id));
    });
  }

  function openCompanyEditor(id = '') {
    const c = state.records.find((item) => String(item.id || item.legacy_id || item.slug) === String(id)) || {};
    const form = document.getElementById('companyEditorForm');
    form.hidden = false;
    document.getElementById('recordForm').hidden = true;
    document.getElementById('questionEditorForm').hidden = true;
    document.getElementById('questionImportModal').hidden = true;
    document.getElementById('companyEditorTitle').textContent = id ? 'Edit Company' : 'New Company';
    form.dataset.id = id;

    document.getElementById('cName').value = c.name || '';
    document.getElementById('cShortName').value = c.short_name || c.shortName || '';
    document.getElementById('cSlug').value = c.slug || '';
    document.getElementById('cLogo').value = c.logo || '🏢';
    document.getElementById('cLogoColor').value = c.logo_color || c.logoColor || '#2563eb';
    document.getElementById('cLogoBg').value = c.logo_background || c.logoBg || '#eff6ff';
    document.getElementById('cIndustry').value = c.industry || c.category || '';
    document.getElementById('cFounded').value = c.founded || '';
    document.getElementById('cHeadquarters').value = c.headquarters || '';
    document.getElementById('cCeo').value = c.ceo || '';
    document.getElementById('cEmployees').value = c.employees || '';
    document.getElementById('cWebsite').value = c.website || '';
    document.getElementById('cDescription').value = c.description || '';
    document.getElementById('cInterviewProcess').value = c.interview_process || c.interviewProcess || '';

    updateCompanyValidation();
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function updateCompanyValidation() {
    const name = document.getElementById('cName').value.trim();
    const shortName = document.getElementById('cShortName').value.trim();
    const slug = document.getElementById('cSlug').value.trim().toLowerCase();
    const founded = document.getElementById('cFounded').value.trim();
    const logo = document.getElementById('cLogo').value.trim() || '🏢';
    const logoColor = document.getElementById('cLogoColor').value;
    const logoBg = document.getElementById('cLogoBg').value;
    const industry = document.getElementById('cIndustry').value.trim();
    const description = document.getElementById('cDescription').value.trim();

    const banner = document.getElementById('companyValidationBanner');
    const preview = document.getElementById('companyPreviewCard');

    const errors = [];
    if (!name) errors.push('Company name is required.');
    if (!shortName) errors.push('Short name is required.');
    if (!slug) {
      errors.push('Slug is required.');
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      errors.push('Slug must be lowercase alphanumeric with optional single hyphens (e.g. "tcs" or "tata-consultancy").');
    }
    if (founded) {
      const yr = Number(founded);
      if (!Number.isInteger(yr) || yr < 1800 || yr > 2200) {
        errors.push('Founded year must be between 1800 and 2200.');
      }
    }

    if (errors.length > 0) {
      banner.hidden = false;
      banner.className = 'validation-banner has-errors';
      banner.innerHTML = `<strong>Validation Issues:</strong><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
    } else {
      banner.hidden = false;
      banner.className = 'validation-banner is-valid';
      banner.textContent = 'Company details are valid and meet database schema requirements.';
    }

    preview.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
        <div style="width:40px; height:40px; border-radius:8px; display:grid; place-items:center; font-size:22px; background:${escapeHtml(logoBg)}; color:${escapeHtml(logoColor)};">${escapeHtml(logo)}</div>
        <div>
          <h4 style="margin:0; font-size:16px;">${escapeHtml(name || 'Company Name')} (${escapeHtml(shortName || 'CODE')})</h4>
          <span style="font-size:12px; color:var(--muted); font-family:monospace;">/companies/${escapeHtml(slug || 'company-slug')}</span>
        </div>
      </div>
      <div style="font-size:12px; color:var(--muted); margin-bottom:6px;">${escapeHtml(industry || 'Industry')} &bull; Founded ${escapeHtml(founded || '—')}</div>
      <p style="margin:0; font-size:13px; line-height:1.4;">${escapeHtml(description || 'No description provided yet.')}</p>
    `;
  }

  async function deleteCompany(id) {
    if (!id || !window.confirm('Delete this company? This action cannot be undone. Single deletion only.')) return;
    try {
      await api(`/api/admin/companies?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadResource();
    } catch (error) {
      window.alert(error.message);
    }
  }

  function filterCompanies() {
    if (state.resource !== 'companies') return;
    const search = (document.getElementById('companySearchInput')?.value || '').toLowerCase();
    const category = (document.getElementById('companyCategoryFilter')?.value || '').toLowerCase();

    const filtered = state.records.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const shortName = (c.short_name || c.shortName || '').toLowerCase();
      const slug = (c.slug || '').toLowerCase();
      const ind = (c.industry || c.category || c.company_categories?.name || '').toLowerCase();

      if (category && !ind.includes(category)) return false;
      if (search && !name.includes(search) && !shortName.includes(search) && !slug.includes(search) && !ind.includes(search)) return false;
      return true;
    });

    renderCompaniesTable(document.getElementById('resourceTable'), filtered);
  }

  function renderQuestionsTable(container, records) {
    if (!records.length) {
      container.innerHTML = '<div class="empty-state">No questions found matching your filters.</div>';
      return;
    }
    container.innerHTML = `<table><thead><tr><th>ID</th><th>Question</th><th>Options</th><th>Category</th><th>Difficulty</th><th>Status</th><th>Actions</th></tr></thead><tbody>${records.map((q) => {
      const opts = Array.isArray(q.options) ? q.options : [];
      const ansIdx = typeof q.correct_answer === 'number' ? q.correct_answer : (q.correctAnswer ?? 0);
      const diff = q.difficulty || q.level || 'Intermediate';
      const badgeClass = diff === 'Beginner' ? 'badge-beginner' : diff === 'Advanced' ? 'badge-advanced' : diff === 'Legend' ? 'badge-legend' : 'badge-intermediate';
      const flagged = isQuestionFlagged(q);
      const statusBadge = flagged
        ? `<span class="badge badge-review">Under Review</span>`
        : `<span class="badge badge-approved">Approved</span>`;

      return `<tr data-id="${q.id || q.legacy_id || ''}">
        <td style="font-family:monospace; font-size:11px;">${escapeHtml(String(q.legacy_id || q.id || '—'))}</td>
        <td><strong>${escapeHtml((q.question_text || q.question || '').slice(0, 120))}</strong></td>
        <td style="font-size:12px;">${opts.map((opt, i) => `<span style="${i === ansIdx ? 'font-weight:bold; color:var(--primary);' : 'color:var(--muted);'}">${['A','B','C','D'][i] || i}: ${escapeHtml(String(opt).slice(0, 30))}</span>`).join('<br>')}</td>
        <td><span class="badge" style="background:var(--surface-alt);">${escapeHtml(q.category || q.question_categories?.name || 'General')}</span></td>
        <td><span class="badge ${badgeClass}">${escapeHtml(diff)}</span></td>
        <td>${statusBadge}</td>
        <td class="actions">
          <button class="secondary edit-question-btn">Edit</button>
          <button class="danger delete-question-btn">Delete</button>
        </td>
      </tr>`;
    }).join('')}</tbody></table>`;

    container.querySelectorAll('.edit-question-btn').forEach((button) => button.addEventListener('click', () => openQuestionEditor(button.closest('tr').dataset.id)));
    container.querySelectorAll('.delete-question-btn').forEach((button) => button.addEventListener('click', () => deleteRecord(button.closest('tr').dataset.id)));
  }

  function openQuestionEditor(id = '') {
    const q = state.records.find((item) => String(item.id || item.legacy_id) === String(id)) || {};
    const form = document.getElementById('questionEditorForm');
    form.hidden = false;
    document.getElementById('recordForm').hidden = true;
    document.getElementById('companyEditorForm').hidden = true;
    document.getElementById('questionImportModal').hidden = true;
    document.getElementById('questionEditorTitle').textContent = id ? 'Edit Question' : 'New Question';
    form.dataset.id = id;

    document.getElementById('qCompany').value = q.company_slug || q.companies?.slug || q.company_id || '';
    document.getElementById('qCategory').value = q.category || q.question_categories?.name || 'Quantitative Aptitude';
    document.getElementById('qDifficulty').value = q.difficulty || q.level || 'Intermediate';
    document.getElementById('qQuestionText').value = q.question_text || q.question || '';

    const opts = Array.isArray(q.options) ? q.options : ['', '', '', ''];
    for (let i = 0; i < 4; i++) {
      document.getElementById(`qOption${i}`).value = opts[i] || '';
    }

    const ansIdx = typeof q.correct_answer === 'number' ? q.correct_answer : (q.correctAnswer ?? 0);
    const radio = document.getElementById(`radioOpt${ansIdx}`);
    if (radio) radio.checked = true;

    document.getElementById('qExplanation').value = q.explanation || '';
    updateQuestionValidation();
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function updateQuestionValidation() {
    const banner = document.getElementById('questionValidationBanner');
    const preview = document.getElementById('qExplanationPreview');
    const text = document.getElementById('qQuestionText').value.trim();
    const opts = [0, 1, 2, 3].map((i) => document.getElementById(`qOption${i}`).value.trim());
    const explanation = document.getElementById('qExplanation').value.trim();

    const errors = [];
    if (!text) errors.push('Question text cannot be blank.');
    opts.forEach((opt, idx) => {
      if (!opt) errors.push(`Option ${['A','B','C','D'][idx]} is empty.`);
    });
    const uniqueOpts = new Set(opts.map((o) => o.toLowerCase()));
    if (uniqueOpts.size < 4 && !opts.some((o) => !o)) {
      errors.push('All four options must be unique (no duplicates).');
    }

    const monologueMatch = /let\s+me\s+(reconsider|recalculate|recheck|re-read|re-examine|just fix)|change the question|i will change|none of the available options|answer should be|i marked|i selected|i'll set the correct answer|actually the answer/i.test(explanation);
    if (monologueMatch) {
      errors.push('Explanation contains conversational monologue or recalculation artifacts.');
    }

    if (errors.length > 0) {
      banner.hidden = false;
      banner.className = 'validation-banner has-errors';
      banner.innerHTML = `<strong>Validation Issues:</strong><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
    } else {
      banner.hidden = false;
      banner.className = 'validation-banner is-valid';
      banner.textContent = 'Question is valid and structurally sound.';
    }

    preview.textContent = explanation || 'Enter an explanation to preview formatted output.';
  }

  async function loadResource() {
    renderResourceTabs();
    const targetId = state.resource === 'feedback' ? 'feedbackTable' : state.resource === 'website_settings' ? 'settingsTable' : state.resource === 'admin_activity_logs' ? 'activityTable' : 'resourceTable';
    const container = document.getElementById(targetId);
    container.innerHTML = '<div class="empty-state">Loading protected records...</div>';
    try {
      let endpoint = `/api/admin/${state.resource}`;
      if (state.resource === 'interview_questions') endpoint = '/api/admin/questions';
      if (state.resource === 'companies') endpoint = '/api/admin/companies';

      const result = await api(endpoint);
      state.records = result.data || [];
      renderTable(container, state.records);
    } catch (error) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  function openRecord(id = '') {
    const record = state.records.find((item) => item.id === id) || {};
    document.getElementById('recordForm').hidden = false;
    document.getElementById('recordFormTitle').textContent = id ? `Edit ${state.resource}` : `New ${state.resource}`;
    document.getElementById('recordJson').value = JSON.stringify(record, null, 2);
    document.getElementById('recordForm').dataset.id = id;
  }

  async function deleteRecord(id) {
    if (!id || !window.confirm('Delete this record? This action cannot be undone.')) return;
    try {
      let endpoint = `/api/admin/${state.resource}`;
      if (state.resource === 'interview_questions') endpoint = '/api/admin/questions';
      if (state.resource === 'companies') endpoint = '/api/admin/companies';
      await api(`${endpoint}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadResource();
    } catch (error) {
      window.alert(error.message);
    }
  }

  function setupQuestionImport() {
    if (setupQuestionImport.initialized) return;
    setupQuestionImport.initialized = true;

    const modal = document.getElementById('questionImportModal');
    const importBtn = document.getElementById('importQuestionsButton');
    const cancelBtn = document.getElementById('cancelImportBtn');
    const validateBtn = document.getElementById('validateImportBtn');
    const confirmBtn = document.getElementById('confirmImportBtn');
    const fileInput = document.getElementById('importFileInput');
    const textarea = document.getElementById('importJsonTextarea');
    const banner = document.getElementById('importValidationBanner');
    const preview = document.getElementById('importPreviewSummary');
    const status = document.getElementById('importStatus');

    let parsedQuestions = [];

    importBtn?.addEventListener('click', () => {
      modal.hidden = false;
      document.getElementById('questionEditorForm').hidden = true;
      modal.scrollIntoView({ behavior: 'smooth' });
    });

    cancelBtn?.addEventListener('click', () => {
      modal.hidden = true;
      banner.hidden = true;
      preview.hidden = true;
      textarea.value = '';
      if (fileInput) fileInput.value = '';
      parsedQuestions = [];
      confirmBtn.disabled = true;
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        textarea.value = evt.target.result;
        validateBatch();
      };
      reader.readAsText(file);
    });

    function validateBatch() {
      banner.hidden = true;
      preview.hidden = true;
      confirmBtn.disabled = true;
      status.textContent = '';

      const text = textarea.value.trim();
      if (!text) {
        banner.hidden = false;
        banner.className = 'validation-banner has-errors';
        banner.textContent = 'Please paste JSON data or select a JSON file.';
        return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        banner.hidden = false;
        banner.className = 'validation-banner has-errors';
        banner.textContent = `Invalid JSON syntax: ${err.message}`;
        return;
      }

      const items = Array.isArray(data) ? data : (Array.isArray(data.questions) ? data.questions : null);
      if (!items || !items.length) {
        banner.hidden = false;
        banner.className = 'validation-banner has-errors';
        banner.textContent = 'JSON must be an array of questions or an object with a "questions" array.';
        return;
      }

      if (items.length > 500) {
        banner.hidden = false;
        banner.className = 'validation-banner has-errors';
        banner.textContent = `Batch contains ${items.length} questions. Maximum allowed per import is 500.`;
        return;
      }

      let validCount = 0;
      const issues = [];
      const seenTexts = new Set();

      items.forEach((q, idx) => {
        const qText = (q.question_text || q.question || '').trim();
        const opts = Array.isArray(q.options) ? q.options : [];
        const ans = typeof q.correct_answer === 'number' ? q.correct_answer : q.correctAnswer;
        const exp = (q.explanation || '').trim();

        if (!qText) {
          issues.push(`Q#${idx + 1}: Blank question text.`);
        } else if (seenTexts.has(qText.toLowerCase())) {
          issues.push(`Q#${idx + 1}: Duplicate question text in import batch.`);
        }
        seenTexts.add(qText.toLowerCase());

        if (opts.length !== 4) {
          issues.push(`Q#${idx + 1}: Must have exactly 4 options.`);
        } else if (opts.some((o) => !String(o).trim())) {
          issues.push(`Q#${idx + 1}: Contains empty options.`);
        } else if (new Set(opts.map((o) => String(o).trim().toLowerCase())).size !== 4) {
          issues.push(`Q#${idx + 1}: Duplicate options detected.`);
        }

        if (typeof ans !== 'number' || ans < 0 || ans > 3) {
          issues.push(`Q#${idx + 1}: Correct answer must be index 0, 1, 2, or 3.`);
        }

        if (!exp) {
          issues.push(`Q#${idx + 1}: Missing explanation.`);
        }

        if (issues.length === 0) validCount++;
      });

      if (issues.length > 0) {
        banner.hidden = false;
        banner.className = 'validation-banner has-errors';
        banner.innerHTML = `<strong>Batch has ${issues.length} validation issues:</strong><ul>${issues.slice(0, 8).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}${issues.length > 8 ? `<li>...and ${issues.length - 8} more</li>` : ''}</ul>`;
        confirmBtn.disabled = true;
      } else {
        banner.hidden = false;
        banner.className = 'validation-banner is-valid';
        banner.textContent = `Validation successful! All ${items.length} questions are structurally valid with unique options and correct answers.`;
        preview.hidden = false;
        preview.innerHTML = `<strong>Ready to Import ${items.length} Questions</strong><br>Sample Question 1: "${escapeHtml((items[0].question_text || items[0].question || '').slice(0, 100))}..."<br>Options: ${escapeHtml(items[0].options.join(' | '))}`;
        parsedQuestions = items;
        confirmBtn.disabled = false;
      }
    }

    validateBtn?.addEventListener('click', validateBatch);

    confirmBtn?.addEventListener('click', async () => {
      if (!parsedQuestions.length) return;
      setStatus(status, 'Importing questions to database...', false);
      try {
        const payload = { questions: parsedQuestions };
        await api('/api/admin/questions', { method: 'POST', body: JSON.stringify(payload) });
        setStatus(status, `Successfully imported ${parsedQuestions.length} questions!`, false);
        setTimeout(() => {
          modal.hidden = true;
          loadResource();
        }, 1200);
      } catch (err) {
        setStatus(status, err.message);
      }
    });
  }

  function filterQuestions() {
    if (state.resource !== 'interview_questions') return;
    const company = (document.getElementById('questionCompanyFilter')?.value || '').toLowerCase();
    const category = document.getElementById('questionCategoryFilter')?.value || '';
    const difficulty = document.getElementById('questionDifficultyFilter')?.value || '';
    const status = document.getElementById('questionStatusFilter')?.value || '';
    const search = (document.getElementById('questionSearchInput')?.value || '').toLowerCase();

    const filtered = state.records.filter((q) => {
      const qCompany = (q.company_slug || q.companies?.slug || q.company_id || '').toLowerCase();
      const qCategory = q.category || q.question_categories?.name || '';
      const qDifficulty = q.difficulty || q.level || '';
      const qText = (q.question_text || q.question || '').toLowerCase();
      const qOpts = (Array.isArray(q.options) ? q.options.join(' ') : '').toLowerCase();
      const flagged = isQuestionFlagged(q);

      if (company && !qCompany.includes(company)) return false;
      if (category && qCategory !== category) return false;
      if (difficulty && qDifficulty !== difficulty) return false;
      if (status === 'approved' && flagged) return false;
      if (status === 'under_review' && !flagged) return false;
      if (search && !qText.includes(search) && !qOpts.includes(search)) return false;
      return true;
    });

    renderQuestionsTable(document.getElementById('resourceTable'), filtered);
  }

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!configured()) return setStatus(loginStatus, 'Owner configuration is not installed. Copy admin/config.example.js to admin/config.js and add the Supabase URL and publishable key.');
    setStatus(loginStatus, 'Signing in...', false);
    try {
      const session = await supabaseAuth('token?grant_type=password', { email: document.getElementById('email').value, password: document.getElementById('password').value });
      localStorage.setItem('prepwise_admin_session', JSON.stringify(session));
      showDashboard(session);
    } catch (error) { setStatus(loginStatus, error.message); }
  });

  document.getElementById('recoveryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!configured()) return setStatus(loginStatus, 'Install admin/config.js before using password recovery.');
    try {
      await supabaseAuth('recover', { email: document.getElementById('recoveryEmail').value, redirect_to: `${window.location.origin}/admin/` });
      setStatus(loginStatus, 'Recovery email requested.', false);
    } catch (error) { setStatus(loginStatus, error.message); }
  });

  document.getElementById('logoutButton').addEventListener('click', async () => {
    try { if (state.session) await supabaseAuth('logout', {}, state.session.access_token); } finally { localStorage.removeItem('prepwise_admin_session'); showLogin(); }
  });
  document.getElementById('newRecordButton').addEventListener('click', () => openRecord());
  document.getElementById('cancelRecordButton').addEventListener('click', () => { document.getElementById('recordForm').hidden = true; });
  document.getElementById('newQuestionButton')?.addEventListener('click', () => openQuestionEditor());
  document.getElementById('cancelQuestionEditor')?.addEventListener('click', () => { document.getElementById('questionEditorForm').hidden = true; });

  const questionForm = document.getElementById('questionEditorForm');
  if (questionForm) {
    questionForm.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', updateQuestionValidation);
      el.addEventListener('change', updateQuestionValidation);
    });

    questionForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = document.getElementById('questionEditorStatus');
      const id = event.currentTarget.dataset.id;
      const text = document.getElementById('qQuestionText').value.trim();
      const opts = [0, 1, 2, 3].map((i) => document.getElementById(`qOption${i}`).value.trim());
      const checkedRadio = document.querySelector('input[name="correctOptionRadio"]:checked');
      const ansIdx = checkedRadio ? parseInt(checkedRadio.value, 10) : 0;
      const explanation = document.getElementById('qExplanation').value.trim();
      const difficulty = document.getElementById('qDifficulty').value;
      const company = document.getElementById('qCompany').value.trim();
      const category = document.getElementById('qCategory').value;

      if (!text) return setStatus(status, 'Question text cannot be blank.');
      if (opts.some((o) => !o)) return setStatus(status, 'All 4 options must be filled.');
      if (new Set(opts.map((o) => o.toLowerCase())).size < 4) return setStatus(status, 'All 4 options must be unique.');
      if (!explanation) return setStatus(status, 'Explanation cannot be blank.');

      setStatus(status, 'Saving question...', false);
      try {
        const payload = {
          question_text: text,
          options: opts,
          correct_answer: ansIdx,
          explanation,
          difficulty,
          level: difficulty,
          category,
          company_slug: company
        };
        if (id) {
          await api(`/api/admin/questions?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
        } else {
          await api('/api/admin/questions', { method: 'POST', body: JSON.stringify(payload) });
        }
        event.currentTarget.hidden = true;
        await loadResource();
      } catch (error) {
        setStatus(status, error.message);
      }
    });
  }

  const companyForm = document.getElementById('companyEditorForm');
  if (companyForm) {
    companyForm.querySelectorAll('input, textarea').forEach((el) => {
      el.addEventListener('input', updateCompanyValidation);
      el.addEventListener('change', updateCompanyValidation);
    });

    companyForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = document.getElementById('companyEditorStatus');
      const id = event.currentTarget.dataset.id;
      const name = document.getElementById('cName').value.trim();
      const shortName = document.getElementById('cShortName').value.trim();
      const slug = document.getElementById('cSlug').value.trim().toLowerCase();
      const logo = document.getElementById('cLogo').value.trim() || '🏢';
      const logoColor = document.getElementById('cLogoColor').value;
      const logoBg = document.getElementById('cLogoBg').value;
      const industry = document.getElementById('cIndustry').value.trim();
      const founded = document.getElementById('cFounded').value.trim();
      const headquarters = document.getElementById('cHeadquarters').value.trim();
      const ceo = document.getElementById('cCeo').value.trim();
      const employees = document.getElementById('cEmployees').value.trim();
      const website = document.getElementById('cWebsite').value.trim();
      const description = document.getElementById('cDescription').value.trim();
      const interviewProcess = document.getElementById('cInterviewProcess').value.trim();

      if (!name) return setStatus(status, 'Company name is required.');
      if (!shortName) return setStatus(status, 'Company short name is required.');
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return setStatus(status, 'Slug must be lowercase alphanumeric with optional single hyphens.');
      }
      if (founded && (Number(founded) < 1800 || Number(founded) > 2200)) {
        return setStatus(status, 'Founded year must be between 1800 and 2200.');
      }

      setStatus(status, 'Saving company...', false);
      try {
        const payload = {
          name,
          short_name: shortName,
          slug,
          logo,
          logo_color: logoColor,
          logo_background: logoBg,
          industry: industry || null,
          founded: founded ? Number(founded) : null,
          headquarters: headquarters || null,
          ceo: ceo || null,
          employees: employees || null,
          website: website || null,
          description: description || null,
          interview_process: interviewProcess || null,
          is_published: true
        };
        if (id) {
          await api(`/api/admin/companies?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
        } else {
          await api('/api/admin/companies', { method: 'POST', body: JSON.stringify(payload) });
        }
        event.currentTarget.hidden = true;
        await loadResource();
      } catch (error) {
        setStatus(status, error.message);
      }
    });
  }

  document.getElementById('newCompanyButton')?.addEventListener('click', () => openCompanyEditor());
  document.getElementById('cancelCompanyEditor')?.addEventListener('click', () => {
    document.getElementById('companyEditorForm').hidden = true;
  });
  document.getElementById('companySearchInput')?.addEventListener('input', filterCompanies);
  document.getElementById('companyCategoryFilter')?.addEventListener('change', filterCompanies);
  document.getElementById('exportCompaniesButton')?.addEventListener('click', () => {
    const exportedCompanies = state.records.map((c) => ({
      id: c.legacy_id || c.slug || c.id,
      name: c.name,
      shortName: c.short_name || c.shortName || c.name,
      slug: c.slug,
      logo: c.logo || '🏢',
      logoColor: c.logo_color || c.logoColor || '#4f46e5',
      logoBg: c.logo_background || c.logoBg || '#eef2ff',
      region: c.region || ['India', 'Global'],
      category: c.industry || c.category || 'IT Services',
      degrees: c.degrees || ['Engineering', 'MCA'],
      industry: c.industry || '',
      founded: c.founded || null,
      headquarters: c.headquarters || '',
      ceo: c.ceo || '',
      employees: c.employees || '',
      revenue: c.revenue || '',
      website: c.website || '',
      careersUrl: c.careers_url || c.careersUrl || '',
      countries: c.countries || ['India'],
      description: c.description || '',
      history: c.history || '',
      milestones: c.milestones || [],
      interviewProcess: c.interview_process || c.interviewProcess || '',
      testPattern: c.test_pattern || c.testPattern || {},
      tips: c.tips || [],
      jobRoles: c.job_roles || c.jobRoles || []
    }));
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportedCompanies, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `prepwise-companies-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  });

  ['questionCompanyFilter', 'questionCategoryFilter', 'questionDifficultyFilter', 'questionStatusFilter'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', filterQuestions);
  });
  document.getElementById('questionSearchInput')?.addEventListener('input', filterQuestions);

  document.getElementById('exportQuestionsButton')?.addEventListener('click', () => {
    const exportedQuestions = state.records.map((q, idx) => ({
      id: q.legacy_id || (idx + 1),
      question: q.question_text || q.question || '',
      options: q.options || [],
      correctAnswer: q.correct_answer !== undefined ? q.correct_answer : (q.correctAnswer !== undefined ? q.correctAnswer : 0),
      explanation: q.explanation || '',
      category: q.category_name || q.category || 'Quantitative',
      difficulty: q.difficulty || q.level || 'Intermediate',
      level: q.level || q.difficulty || 'Intermediate',
      targetRoles: q.target_roles || q.targetRoles || [],
      reviewStatus: q.review_status || q.reviewStatus || 'approved'
    }));
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ questions: exportedQuestions }, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `prepwise-questions-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  });

  document.getElementById('validateDatasetButton')?.addEventListener('click', () => {
    let valid = 0;
    let issues = 0;
    const warnings = [];
    state.records.forEach((q, idx) => {
      const qid = q.legacy_id || q.id || (idx + 1);
      const text = q.question_text || q.question || '';
      const opts = Array.isArray(q.options) ? q.options : [];
      const explanation = q.explanation || '';
      if (!text || opts.length !== 4 || opts.some(o => !String(o).trim()) || new Set(opts.map(o => String(o).trim().toLowerCase())).size !== 4) {
        issues++;
        warnings.push(`Q${qid}: Options or text structural issue.`);
      } else if (/let\s+me\s+(reconsider|recalculate|recheck|re-read|re-examine|just fix)|actually the answer/i.test(explanation)) {
        issues++;
        warnings.push(`Q${qid}: Explanation contains monologue/review artifact.`);
      } else {
        valid++;
      }
    });
    window.alert(`Validation completed:\n• ${valid} questions valid\n• ${issues} questions have issues\n\n${warnings.slice(0, 5).join('\n')}${warnings.length > 5 ? '\n...and ' + (warnings.length - 5) + ' more' : ''}`);
  });

  document.getElementById('recordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;
    try {
      const body = JSON.parse(document.getElementById('recordJson').value);
      if (id) await api(`/api/admin/${state.resource}?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api(`/api/admin/${state.resource}`, { method: 'POST', body: JSON.stringify(body) });
      event.currentTarget.hidden = true;
      await loadResource();
    } catch (error) { setStatus(document.getElementById('recordStatus'), error.message); }
  });

  document.getElementById('overviewPeriod')?.addEventListener('change', (event) => {
    document.getElementById('overviewFilters').classList.toggle('is-custom', event.target.value === 'custom');
  });
  document.getElementById('overviewFilters')?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadOverview();
  });

  document.getElementById('quizPeriod')?.addEventListener('change', (event) => {
    document.getElementById('quizFilters').classList.toggle('is-custom', event.target.value === 'custom');
  });
  document.getElementById('quizFilters')?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadQuiz();
  });

  document.getElementById('advertisingPeriod')?.addEventListener('change', (event) => {
    state.advertisingFilterCustomized = true;
    document.getElementById('advertisingFilters')?.classList.toggle('is-custom', event.target.value === 'custom');
    if (event.target.value !== 'custom') loadAdvertising();
  });
  document.getElementById('advertisingFilters')?.addEventListener('submit', (event) => {
    event.preventDefault();
    state.advertisingFilterCustomized = true;
    loadAdvertising();
  });

  function activateSection(section) {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.section === section));
    document.querySelectorAll('.panel').forEach((panel) => {
      const isActive = panel.id === `section-${section}`;
      panel.classList.toggle('active', isActive);
      if (isActive) panel.removeAttribute('hidden');
    });
    if (section === 'overview') loadOverview();
    else if (section === 'integrations') loadIntegrations('all');
    else if (section === 'feedback') { state.resource = 'feedback'; loadResource(); }
    else if (section === 'settings') { state.resource = 'website_settings'; loadResource(); }
    else if (section === 'activity') { state.resource = 'admin_activity_logs'; loadResource(); }
    else if (section === 'content') { state.resource = 'companies'; loadContentSummary(); loadResource(); }
    else if (section === 'advertising') loadAdvertising();
    else if (section === 'seo') loadSeo();
    else if (section === 'database') loadDatabaseMonitoring();
    else if (section === 'infrastructure') loadInfrastructureMonitoring();
    else if (section === 'deployment') loadDeploymentCenter();
    else if (section === 'analytics' || section === 'companies') loadAnalytics();
    else if (section === 'quiz') loadQuiz();
    else if (section === 'visitors') loadActivity();
    else if (section === 'system') loadHealth();
    else if (section === 'security') renderSecurityStatus();
    else if (section === 'administrators') loadAdministrators();
  }

  document.getElementById('overviewGranularity')?.addEventListener('change', loadOverview);
  document.getElementById('refreshContentSummary')?.addEventListener('click', loadContentSummary);
  document.getElementById('testAllIntegrationsBtn')?.addEventListener('click', () => loadIntegrations('all'));
  document.getElementById('refreshAdvertising')?.addEventListener('click', loadAdvertising);
  document.getElementById('refreshSeo')?.addEventListener('click', loadSeo);
  document.getElementById('refreshDatabase')?.addEventListener('click', loadDatabaseMonitoring);
  document.getElementById('refreshInfrastructure')?.addEventListener('click', loadInfrastructureMonitoring);
  document.getElementById('refreshDeploymentCenter')?.addEventListener('click', loadDeploymentCenter);
  document.getElementById('deployToProductionBtn')?.addEventListener('click', openDeployConfirmModal);

  document.getElementById('adMasterSwitch')?.addEventListener('change', (event) => {
    submitAdControlMutation({ action: 'master_toggle', enabled: event.currentTarget.checked });
  });
  document.getElementById('adEnableEligibleBtn')?.addEventListener('click', () => {
    submitAdControlMutation({ action: 'enable_all_eligible' });
  });
  document.getElementById('adDisableAllBtn')?.addEventListener('click', () => {
    submitAdControlMutation({ action: 'disable_all' });
  });

  document.getElementById('popunderAckCheckbox')?.addEventListener('change', (event) => {
    const btn = document.getElementById('confirmPopunderBtn');
    if (btn) btn.disabled = !event.currentTarget.checked;
  });
  const closePopModal = () => {
    const modal = document.getElementById('popunderConfirmModal');
    if (modal) modal.hidden = true;
    renderAdvertisingPlacements();
  };
  document.getElementById('closePopunderModal')?.addEventListener('click', closePopModal);
  document.getElementById('cancelPopunderBtn')?.addEventListener('click', closePopModal);
  document.getElementById('confirmPopunderBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('popunderConfirmModal');
    if (modal) modal.hidden = true;
    await submitAdControlMutation({
      action: 'toggle_unit',
      unitId: '32172757',
      enabled: true,
      popunderConfirmed: true
    });
  });

  document.getElementById('deployCleanTreeCheckbox')?.addEventListener('change', (event) => {
    const btn = document.getElementById('confirmDeployBtn');
    if (btn) btn.disabled = !event.currentTarget.checked;
  });
  const closeDepModal = () => {
    const modal = document.getElementById('deployConfirmModal');
    if (modal) modal.hidden = true;
  };
  document.getElementById('closeDeployModal')?.addEventListener('click', closeDepModal);
  document.getElementById('cancelDeployBtn')?.addEventListener('click', closeDepModal);
  document.getElementById('confirmDeployBtn')?.addEventListener('click', triggerProductionDeploy);

  document.getElementById('closeSetupModal')?.addEventListener('click', () => {
    document.getElementById('integrationSetupModal').hidden = true;
  });
  document.getElementById('setupModalDoneBtn')?.addEventListener('click', () => {
    document.getElementById('integrationSetupModal').hidden = true;
  });
  document.getElementById('setupModalTestBtn')?.addEventListener('click', async () => {
    if (!state.activeSetupService) return;
    await loadIntegrations(state.activeSetupService);
    openIntegrationSetupModal(state.activeSetupService);
  });

  document.getElementById('exportOverviewCsv')?.addEventListener('click', () => {
    const daily = state.overviewReport?.data?.dailyActivity || [];
    const adMap = new Map((state.integrationsReport?.integrations?.adsterra?.data?.daily || []).map((r) => [r.date, r]));
    const rows = daily.map((d) => ({
      date: d.date,
      pageViews: d.pageViews,
      quizStarts: d.quizStarts,
      quizCompletions: d.quizCompletions,
      totalEvents: d.totalEvents,
      adImpressions: adMap.get(d.date)?.impressions ?? '',
      adRevenueUsd: adMap.get(d.date)?.revenue ?? ''
    }));
    downloadCsv('prepwise-overview-report.csv', rows, ['date', 'pageViews', 'quizStarts', 'quizCompletions', 'totalEvents', 'adImpressions', 'adRevenueUsd']);
  });

  document.getElementById('exportAnalyticsCsv')?.addEventListener('click', () => {
    const res = state.lastAnalyticsResult?.data;
    if (!res) return;
    const rows = (res.popularPages || []).map((p) => ({ page: p.label, views: p.count }));
    downloadCsv('prepwise-popular-pages.csv', rows, ['page', 'views']);
  });

  document.getElementById('exportAdRevenueCsv')?.addEventListener('click', () => {
    const daily = state.lastAdReport?.data?.daily || state.integrationsReport?.integrations?.adsterra?.data?.daily || [];
    downloadCsv('prepwise-adsterra-revenue.csv', daily, ['date', 'impressions', 'clicks', 'ctr', 'cpm', 'revenue']);
  });

  document.getElementById('exportSeoCsv')?.addEventListener('click', () => {
    const qs = state.lastSeoReport?.data?.topQueries || state.integrationsReport?.integrations?.gsc?.data?.topQueries || [];
    downloadCsv('prepwise-seo-queries.csv', qs, ['query', 'clicks', 'impressions', 'ctr', 'position']);
  });

  document.querySelectorAll('[data-refresh]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.refresh === 'overview') loadOverview();
    else if (button.dataset.refresh === 'analytics') loadAnalytics();
    else if (button.dataset.refresh === 'quiz') loadQuiz();
    else if (button.dataset.refresh === 'feedback') { state.resource = 'feedback'; loadResource(); }
    else if (button.dataset.refresh === 'settings') { state.resource = 'website_settings'; loadResource(); }
    else if (button.dataset.refresh === 'activity') { state.resource = 'admin_activity_logs'; loadResource(); }
    else loadResource();
  }));

  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
    activateSection(button.dataset.section);
  }));

  document.querySelectorAll('[data-jump]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.jump === 'advertising') {
      state.advertisingFilterCustomized = false;
    }
    activateSection(button.dataset.jump);
  }));

  document.getElementById('resourceSearch').addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    renderTable(document.getElementById('resourceTable'), state.records.filter((record) => JSON.stringify(record).toLowerCase().includes(query)));
  });

  document.getElementById('analyticsPeriod').addEventListener('change', (event) => document.getElementById('analyticsFilters').classList.toggle('is-custom', event.target.value === 'custom'));
  document.getElementById('activityPeriod').addEventListener('change', (event) => document.getElementById('activityFilters').classList.toggle('is-custom', event.target.value === 'custom'));
  document.getElementById('analyticsFilters').addEventListener('submit', (event) => { event.preventDefault(); loadAnalytics(); });
  document.getElementById('activityFilters').addEventListener('submit', (event) => { event.preventDefault(); state.analytics.page = 1; loadActivity(); });
  document.getElementById('refreshAnalytics').addEventListener('click', loadAnalytics);
  document.getElementById('refreshQuiz')?.addEventListener('click', loadQuiz);
  document.getElementById('refreshHealth').addEventListener('click', loadHealth);
  document.getElementById('activityPrevious').addEventListener('click', () => { state.analytics.page -= 1; loadActivity(); });
  document.getElementById('activityNext').addEventListener('click', () => { state.analytics.page += 1; loadActivity(); });
  document.getElementById('exportActivity').addEventListener('click', async () => {
    const params = analyticsQuery(document.getElementById('activityPeriod').value, 'activityFrom', 'activityTo');
    params.set('view', 'activity');
    params.set('format', 'csv');
    params.set('sort', document.getElementById('activitySort').value);
    const eventType = document.getElementById('activityEvent').value;
    if (eventType) params.set('eventType', eventType);
    const response = await fetch('/api/admin/analytics?' + params.toString(), { headers: { Authorization: 'Bearer ' + state.session.access_token, Accept: 'text/csv' } });
    if (!response.ok) return;
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'prepwise-activity.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  async function loadRuntimeConfig() {
    try {
      const response = await fetch('/api/config', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const runtimeConfig = await response.json();
      Object.assign(config, runtimeConfig);
      config.supabaseAnonKey = config.supabasePublishableKey;
    } catch (error) {
      // Static local hosting intentionally has no runtime configuration endpoint.
    }
  }

  setupQuestionImport();
  setupAdministratorManagement();
  setupSettingsManagement();

  (async () => {
    await loadRuntimeConfig();
    let savedSession = null;
    try { savedSession = JSON.parse(localStorage.getItem('prepwise_admin_session') || 'null'); } catch { savedSession = null; }
    if (savedSession?.access_token && configured()) showDashboard(savedSession);
    else showLogin();
  })();
})();
