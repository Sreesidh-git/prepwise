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

  function renderAdvertisingPlacements() {
    const container = document.getElementById('advertisingPlacements');
    if (!container) return;
    const placements = window.PREPWISE_AD_REGISTRY?.placements || [];
    const cfg = window.PREPWISE_ADSTERRA_CONFIG;
    const adApi = state.integrationsReport?.integrations?.adsterra;
    const apiStatsMap = new Map();
    if (adApi?.status === 'Connected' && Array.isArray(adApi.data?.byPlacement)) {
      adApi.data.byPlacement.forEach((p) => apiStatsMap.set(String(p.placementId), p));
    }

    const unitsRows = getAdsterraConfigUnits().map((u) => {
      const apiRow = apiStatsMap.get(String(u.unitId));
      const isPopunder = u.unitId === '32172757';
      const statusPill = isPopunder
        ? '<span class="status-pill status-inactive">Permanently Disabled</span>'
        : (u.enabled ? '<span class="status-pill status-connected">Active</span>' : '<span class="status-pill status-unavailable">Disabled</span>');
      return `
        <tr>
          <td><strong>Unit ${escapeHtml(u.unitId)}</strong><br><span class="muted" style="font-size:11px;">${escapeHtml(u.name || u.format)}</span></td>
          <td>${escapeHtml(u.format)}</td>
          <td>${statusPill}</td>
          <td>${apiRow ? apiRow.impressions.toLocaleString() : '—'}</td>
          <td>${apiRow ? apiRow.clicks.toLocaleString() : '—'}</td>
          <td>${apiRow ? `$${Number(apiRow.cpm).toFixed(2)}` : '—'}</td>
          <td>${apiRow ? `$${Number(apiRow.revenue).toFixed(3)}` : '—'}</td>
        </tr>
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
      <table style="margin-bottom: 18px;">
        <thead><tr><th>Adsterra Unit</th><th>Format</th><th>Policy Status</th><th>Impressions</th><th>Clicks</th><th>CPM</th><th>Est. Revenue</th></tr></thead>
        <tbody>${unitsRows || '<tr><td colspan="7" class="muted">No Adsterra units found in config.</td></tr>'}</tbody>
      </table>
      <table>
        <thead><tr><th>DOM Placement Slot</th><th>Page</th><th>Format</th><th>Devices</th><th>Mapped Unit</th><th>Slot Status</th></tr></thead>
        <tbody>${placementRows}</tbody>
      </table>
    `;
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
    activeSetupService: null
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
    const request = () => fetch(path, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: 'Bearer ' + state.session.access_token, 'Content-Type': 'application/json' }
    });
    let response = await request();
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
      params.set('from', today.toISOString().slice(0, 10));
    } else if (period === 'custom') {
      params.set('from', document.getElementById(fromId).value);
      params.set('to', `${document.getElementById(toId).value}T23:59:59.999Z`);
    } else {
      const days = Number(period) || 7;
      params.set('from', new Date(Date.now() - (days - 1) * 86400000).toISOString());
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
    const cards = [
      ['Visitors', totals.visitors],
      ['Unique visitors', totals.uniqueVisitors],
      ['Page views', totals.pageViews],
      ['Quiz starts', totals.quizStarts],
      ['Quiz completions', totals.quizCompletions],
      ['Completion rate', formatValue(totals.completionRate, '%')],
      ['Quiz attempts', totals.quizAttempts],
      ['Completed attempts', totals.completedAttempts],
      ['Average score', totals.averageScore]
    ];
    document.getElementById('analyticsCards').innerHTML = cards.map(([label, value]) => `<article class="stat-card"><span class="muted">${label}</span><span class="number">${typeof value === 'string' ? value : formatValue(value)}</span></article>`).join('');
    renderChart('daily', 'dailyActivityChart', 'line', result.data.dailyActivity.map((item) => item.label), result.data.dailyActivity.map((item) => item.count), 'Events');
    renderChart('quiz', 'quizActivityChart', 'bar', result.data.eventTypes.filter((item) => item.label.startsWith('quiz_')).map((item) => item.label), result.data.eventTypes.filter((item) => item.label.startsWith('quiz_')).map((item) => item.count), 'Quiz events');
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
          ga4Wrap.innerHTML = `
            <div class="cc-block" style="margin-bottom:16px;">
              <div class="cc-block-header">
                <div class="cc-block-title"><h3>Google Analytics 4 Live Reporting (Property connected)</h3>${renderStatusPill(ga4.status)}</div>
                <span class="muted" style="font-size:12px;">Measurement ID: ${escapeHtml(ga4.measurementId)} &bull; GTM: ${escapeHtml(ga4.gtmContainerId)}</span>
              </div>
              <div class="cards">
                <article class="stat-card"><span class="stat-meta">GA4 Active Users</span><span class="number">${Number(t.activeUsers || 0).toLocaleString()}</span></article>
                <article class="stat-card"><span class="stat-meta">GA4 New Users</span><span class="number">${Number(t.newUsers || 0).toLocaleString()}</span></article>
                <article class="stat-card"><span class="stat-meta">GA4 Views</span><span class="number">${Number(t.views || 0).toLocaleString()}</span></article>
                <article class="stat-card"><span class="stat-meta">GA4 Sessions</span><span class="number">${Number(t.sessions || 0).toLocaleString()}</span></article>
                <article class="stat-card"><span class="stat-meta">Avg Engagement Time</span><span class="number">${formatDurationSeconds(t.avgEngagementSeconds)}</span></article>
              </div>
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
    const cards = [
      ['Total attempts', totals.quizAttempts ?? 'Unavailable'],
      ['Completed attempts', totals.completedAttempts ?? 'Unavailable'],
      ['Completion rate', totals.completionRate != null ? `${totals.completionRate}%` : 'Unavailable'],
      ['Quiz starts', totals.quizStarts ?? 'Unavailable'],
      ['Quiz completions', totals.quizCompletions ?? 'Unavailable'],
      ['Average score', totals.averageScore != null ? totals.averageScore : 'Unavailable']
    ];
    document.getElementById('quizCards').innerHTML = cards.map(([label, value]) => `<article class="stat-card"><span class="muted">${escapeHtml(label)}</span><span class="number">${typeof value === 'string' ? escapeHtml(value) : formatValue(value)}</span></article>`).join('');

    const scores = result.data?.scoreDistribution || [];
    renderChart('quizScore', 'quizScoreChart', 'bar', scores.map((item) => item.label), scores.map((item) => item.count), 'Score distribution');

    const dailyTrends = (result.data?.dailyActivity || []).map((item) => ({ label: item.label, count: item.count }));
    renderChart('quizDaily', 'quizDailyChart', 'line', dailyTrends.map((item) => item.label), dailyTrends.map((item) => item.count), 'Daily activity');

    const quizEvents = (result.data?.eventTypes || []).filter((item) => item.label.startsWith('quiz_'));
    renderChart('quizEvents', 'quizEventsChart', 'bar', quizEvents.map((item) => item.label), quizEvents.map((item) => item.count), 'Quiz events');

    renderSimpleTable('quizCategoriesTable', result.data?.popularCategories || [], 'No quiz category data available for this period.');
    renderSimpleTable('quizCompaniesTable', result.data?.popularQuizCompanies || [], 'No quiz company data available for this period.');
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
      const h = healthRes?.data?.integrations?.health;
      const hd = h?.data || {};
      if (cards) {
        renderStatCards('healthCards', [
          ['Endpoint Availability', `${hd.healthyCount ?? 0} / ${hd.totalCount ?? 0} OK`, 'Live Probe', hd.allHealthy ? 'All routes passing' : 'Degraded route detected'],
          ['Avg Response Time', hd.avgLatencyMs != null ? `${hd.avgLatencyMs} ms` : 'Unavailable', 'HTTP Check', `Checked ${new Date(h?.lastSyncedAt || Date.now()).toLocaleTimeString()}`],
          ['Database Reachability', d.databaseAvailability || 'standby', 'Supabase', `Query ${d.responseMs || 0} ms`],
          ['Content Records', `${d.contentRecords ?? 0} Co / ${d.questionRecords ?? 0} Qs`, 'Supabase', 'Live count'],
          ['Ad Policy Status', '5 Active + Popunder OFF', 'Policy', 'Unit 32172757 disabled']
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

    if (notice) {
      if (isConnected) {
        notice.innerHTML = '<div class="alert-banner is-success"><strong>Connected to Adsterra Publisher API:</strong> Displaying live authenticated impressions, clicks, CPM, and estimated earnings. Popunder unit <code>32172757</code> remains permanently disabled.</div>';
      } else {
        notice.innerHTML = `<div class="alert-banner is-warning"><strong>Adsterra Publisher API (${escapeHtml(adsterra?.status || 'Not configured')}):</strong> ${escapeHtml(adsterra?.error || 'Provide ADSTERRA_API_TOKEN in Cloudflare Pages Secrets to retrieve live revenue and impressions.')} Active client units: 32172758, 32172759, 32172760, 32172761, 32172762 (Popunder 32172757 permanently disabled).</div>`;
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
        const isPop = u.unitId === '32172757';
        return `<tr><td><strong>${escapeHtml(u.unitId)}</strong> (${escapeHtml(u.name)})</td><td>${escapeHtml(u.format)}</td><td><span class="status-pill ${isPop ? 'status-inactive' : 'status-connected'}">${isPop ? 'Permanently Disabled' : 'Active'}</span></td><td>${row ? row.impressions.toLocaleString() : '—'}</td><td>${row ? row.clicks.toLocaleString() : '—'}</td><td>${row ? `$${Number(row.cpm).toFixed(2)}` : '—'}</td><td>${row ? `$${Number(row.revenue).toFixed(3)}` : '—'}</td></tr>`;
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
    if (notice) {
      notice.innerHTML = ok
        ? `<div class="alert-banner is-success"><strong>Connected:</strong> Search Console property <code>${escapeHtml(gsc.data.siteUrl)}</code> verified.</div>`
        : `<div class="alert-banner is-warning"><strong>Google Search Console (${escapeHtml(gsc?.status || 'Not configured')}):</strong> ${escapeHtml(gsc?.error || 'Missing server-side Search Console OAuth/Service Account credentials.')}</div>`;
    }
    renderStatCards('overviewSeoCards', [
      ['Search Clicks', ok ? t.clicks : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
      ['Search Impressions', ok ? t.impressions : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
      ['CTR', ok ? `${t.ctr}%` : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
      ['Avg Position', ok && t.avgPosition != null ? t.avgPosition : 'Unavailable', ok ? 'GSC API' : 'Not configured']
    ]);

    const qEl = document.getElementById('overviewSeoQueries');
    const pEl = document.getElementById('overviewSeoPages');
    if (qEl) {
      const qs = gsc?.data?.topQueries || [];
      qEl.innerHTML = qs.length
        ? `<table><thead><tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>Pos</th></tr></thead><tbody>${qs.slice(0, 8).map((r) => `<tr><td>${escapeHtml(r.query)}</td><td>${r.clicks}</td><td>${r.impressions}</td><td>${r.position}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty-state">Connect Google Search Console to view top search queries.</div>';
    }
    if (pEl) {
      const pgs = gsc?.data?.topPages || [];
      const maps = gsc?.data?.sitemaps || [];
      if (pgs.length || maps.length) {
        pEl.innerHTML = `<table><thead><tr><th>Landing Page / Sitemap</th><th>Clicks</th><th>Impressions / Status</th></tr></thead><tbody>${pgs.slice(0, 6).map((r) => `<tr><td>${escapeHtml(r.page)}</td><td>${r.clicks}</td><td>${r.impressions}</td></tr>`).join('')}${maps.map((m) => `<tr><td><strong>Sitemap:</strong> ${escapeHtml(m.path)}</td><td>—</td><td>Errors: ${m.errors}, Warnings: ${m.warnings}</td></tr>`).join('')}</tbody></table>`;
      } else {
        pEl.innerHTML = '<div class="empty-state">Connect Google Search Console to view landing pages &amp; sitemap indexing.</div>';
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
    if (notice) {
      notice.innerHTML = ok
        ? `<div class="alert-banner is-success"><strong>Connected to Cloudflare Pages (${escapeHtml(cf.projectName)}):</strong> Latest production deployment <code>${escapeHtml(lp?.id || '—')}</code> (${escapeHtml(lp?.status || '—')}).</div>`
        : `<div class="alert-banner is-warning"><strong>Cloudflare API (${escapeHtml(cf?.status || 'Not configured')}${cf?.projectName ? ` · ${escapeHtml(cf.projectName)}` : ''}):</strong> ${escapeHtml(cf?.error || 'Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in Cloudflare Pages Secrets.')}</div>`;
    }
    const tr = d.traffic?.totals;
    renderStatCards('overviewInfraCards', [
      ['Latest Prod Status', ok && lp ? lp.status : 'Unavailable', ok ? 'Cloudflare API' : 'Not configured', ok && lp ? `Commit ${lp.commitHash}` : ''],
      ['Failed Deploys (last 10)', ok ? d.failedDeployments : 'Unavailable', ok ? 'Cloudflare API' : 'Not configured'],
      ['Edge Requests', tr ? tr.requests : 'Unavailable', tr ? 'CF GraphQL' : 'Optional Zone ID'],
      ['Bandwidth', tr ? formatBytes(tr.bytes) : 'Unavailable', tr ? 'CF GraphQL' : 'Optional Zone ID']
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

      const [result, intRes] = await Promise.all([
        api(`/api/admin/overview?${params}`),
        api(`/api/admin/integrations?service=all&${params}`).catch(() => null)
      ]);

      state.overviewReport = result;
      if (intRes?.data) state.integrationsReport = intRes.data;

      const d = result.data || {};
      if (d.currentUser) {
        state.currentUser = d.currentUser;
        state.isOwner = Boolean(d.currentUser.isOwner);
        updateUserIdentity();
      }

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

      // Section A: Website Overview Cards
      renderStatCards('overviewCards', [
        ['Total Visitors', ga4Ok ? gt.activeUsers : (m.uniqueVisitors ?? 0), ga4Ok ? 'GA4' : 'First-party'],
        ['Active Users', ga4Ok ? gt.activeUsers : (m.uniqueVisitors ?? 0), ga4Ok ? 'GA4' : 'First-party'],
        ['Page Views', ga4Ok ? gt.views : (m.pageViews ?? 0), ga4Ok ? 'GA4' : 'First-party'],
        ['Sessions', ga4Ok ? gt.sessions : (m.visitorSessions ?? 0), ga4Ok ? 'GA4' : 'First-party'],
        ['Avg Engagement Time', ga4Ok ? formatDurationSeconds(gt.avgEngagementSeconds) : 'GA4 Required', ga4Ok ? 'GA4' : 'Pending GA4 API'],
        ['Quiz Starts', m.quizStarts ?? m.quizAttempts ?? 0, 'Supabase'],
        ['Quiz Completions', m.quizCompletions ?? m.completedAttempts ?? 0, 'Supabase'],
        ['Quiz Completion Rate', m.completionRate != null ? `${m.completionRate}%` : 'Unavailable', 'Supabase']
      ]);

      document.getElementById('overviewNote').textContent = `Period: ${new Date(result.range.from).toLocaleDateString()} – ${new Date(result.range.to).toLocaleDateString()} | Granularity: ${granularity}`;
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

  async function loadAdvertising() {
    const banner = document.getElementById('advertisingApiBanner');
    try {
      const res = await api('/api/admin/integrations?service=adsterra');
      const ad = res?.data?.integrations?.adsterra;
      if (!state.integrationsReport) state.integrationsReport = { integrations: {} };
      state.integrationsReport.integrations.adsterra = ad;
      state.lastAdReport = ad;
      const ok = ad?.status === 'Connected' && ad?.data;
      const t = ad?.data?.totals || {};
      if (banner) {
        banner.innerHTML = ok
          ? '<div class="alert-banner is-success"><strong>Connected:</strong> Authenticated Adsterra Publisher API telemetry loaded. Popunder Unit <code>32172757</code> remains permanently disabled.</div>'
          : `<div class="alert-banner is-warning"><strong>Adsterra Publisher API (${escapeHtml(ad?.status || 'Not configured')}):</strong> ${escapeHtml(ad?.error || 'Set ADSTERRA_API_TOKEN to view live earnings & impressions.')}</div>`;
      }
      renderStatCards('advertisingSummaryCards', [
        ['Impressions', ok ? t.impressions : 'Unavailable', ok ? 'Adsterra API' : 'Not configured'],
        ['Clicks & CTR', ok ? `${t.clicks} (${t.ctr}%)` : 'Unavailable', ok ? 'Adsterra API' : 'Not configured'],
        ['CPM', ok ? `$${Number(t.cpm || 0).toFixed(2)}` : 'Unavailable', ok ? 'Adsterra API' : 'Not configured'],
        ['Est. Revenue', ok ? `$${Number(t.revenue || 0).toFixed(3)}` : 'Unavailable', ok ? 'Adsterra API' : 'Not configured'],
        ['Popunder (32172757)', 'DISABLED', 'Safety Rule', 'Permanently turned off']
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
      const res = await api('/api/admin/integrations?service=gsc');
      const gsc = res?.data?.integrations?.gsc;
      state.lastSeoReport = gsc;
      const ok = gsc?.status === 'Connected' && gsc?.data;
      const t = gsc?.data?.totals || {};
      if (banner) {
        banner.innerHTML = ok
          ? `<div class="alert-banner is-success"><strong>Connected:</strong> Search Console metrics for <code>${escapeHtml(gsc.data.siteUrl)}</code>.</div>`
          : `<div class="alert-banner is-warning"><strong>Google Search Console (${escapeHtml(gsc?.status || 'Not configured')}):</strong> ${escapeHtml(gsc?.error || 'Missing Search Console credentials.')}</div>`;
      }
      renderStatCards('seoCards', [
        ['Clicks', ok ? t.clicks : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
        ['Impressions', ok ? t.impressions : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
        ['Average CTR', ok ? `${t.ctr}%` : 'Unavailable', ok ? 'GSC API' : 'Not configured'],
        ['Average Position', ok && t.avgPosition != null ? t.avgPosition : 'Unavailable', ok ? 'GSC API' : 'Not configured']
      ]);
      const daily = gsc?.data?.daily || [];
      renderMultiChart('seoDet', 'seoDetailChart', 'line', daily.map((d) => d.date), [
        { label: 'Clicks', data: daily.map((d) => d.clicks), borderColor: '#2563eb', tension: 0.2 },
        { label: 'Impressions', data: daily.map((d) => d.impressions), borderColor: '#facc15', tension: 0.2 }
      ]);
      const qEl = document.getElementById('seoQueriesTable');
      const pEl = document.getElementById('seoPagesTable');
      const sEl = document.getElementById('seoSitemapsTable');
      if (qEl) qEl.innerHTML = ok && gsc.data.topQueries.length ? `<table><thead><tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>${gsc.data.topQueries.map((r) => `<tr><td>${escapeHtml(r.query)}</td><td>${r.clicks}</td><td>${r.impressions}</td><td>${r.ctr}%</td><td>${r.position}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">No Search Console query data available.</div>';
      if (pEl) pEl.innerHTML = ok && gsc.data.topPages.length ? `<table><thead><tr><th>Page</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>${gsc.data.topPages.map((r) => `<tr><td>${escapeHtml(r.page)}</td><td>${r.clicks}</td><td>${r.impressions}</td><td>${r.ctr}%</td><td>${r.position}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">No Search Console landing page data available.</div>';
      if (sEl) sEl.innerHTML = ok && gsc.data.sitemaps.length ? `<table><thead><tr><th>Sitemap</th><th>Last Submitted</th><th>Pending</th><th>Warnings</th><th>Errors</th></tr></thead><tbody>${gsc.data.sitemaps.map((m) => `<tr><td><code>${escapeHtml(m.path)}</code></td><td>${m.lastSubmitted ? escapeHtml(new Date(m.lastSubmitted).toLocaleString()) : '—'}</td><td>${m.isPending ? 'Yes' : 'No'}</td><td>${m.warnings}</td><td>${m.errors}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">No sitemap index telemetry available.</div>';
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
      const res = await api('/api/admin/integrations?service=cloudflare');
      const cf = res?.data?.integrations?.cloudflare;
      const ok = cf?.status === 'Connected' && cf?.data;
      const d = cf?.data || {};
      const tr = d.traffic?.totals;
      if (banner) {
        banner.innerHTML = ok
          ? `<div class="alert-banner is-success"><strong>Connected:</strong> Cloudflare Pages project <code>${escapeHtml(cf.projectName)}</code>.</div>`
          : `<div class="alert-banner is-warning"><strong>Cloudflare API (${escapeHtml(cf?.status || 'Not configured')}${cf?.projectName ? ` · ${escapeHtml(cf.projectName)}` : ''}):</strong> ${escapeHtml(cf?.error || 'Missing Cloudflare credentials.')}</div>`;
      }
      renderStatCards('infrastructureCards', [
        ['Latest Prod Deploy', ok && d.latestProduction ? d.latestProduction.status : 'Unavailable', ok ? 'Cloudflare' : 'Not configured'],
        ['Failed Deploys (10)', ok ? d.failedDeployments : 'Unavailable', ok ? 'Cloudflare' : 'Not configured'],
        ['Edge Requests', tr ? tr.requests : 'Unavailable', tr ? 'CF GraphQL' : 'Zone ID needed'],
        ['Total Bandwidth', tr ? formatBytes(tr.bytes) : 'Unavailable', tr ? 'CF GraphQL' : 'Zone ID needed']
      ]);
      const daily = d.traffic?.daily || [];
      renderMultiChart('infraTraf', 'infraTrafficChart', 'line', daily.map((r) => r.date), [{ label: 'Requests', data: daily.map((r) => r.requests), borderColor: '#2563eb', tension: 0.2 }]);
      const depEl = document.getElementById('infrastructureDeploymentsTable');
      if (depEl) depEl.innerHTML = ok && (d.deployments || []).length ? `<table><thead><tr><th>Deploy</th><th>Env</th><th>Commit</th><th>Message</th><th>Status</th><th>Date</th></tr></thead><tbody>${d.deployments.map((dp) => `<tr><td><code>${escapeHtml(dp.id)}</code></td><td>${escapeHtml(dp.environment)}</td><td><code>${escapeHtml(dp.commitHash)}</code></td><td>${escapeHtml(dp.commitMessage)}</td><td><span class="status-pill ${dp.status === 'success' ? 'status-connected' : 'status-error'}">${escapeHtml(dp.status)}</span></td><td>${escapeHtml(new Date(dp.createdOn).toLocaleString())}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Connect Cloudflare API token to inspect deployments.</div>';
    } catch (error) {
      if (banner) banner.innerHTML = `<div class="alert-banner is-error">${escapeHtml(error.message)}</div>`;
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
