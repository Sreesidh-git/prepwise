(function () {
  'use strict';

  const config = window.PREPWISE_CONFIG;
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginStatus = document.getElementById('loginStatus');
  const state = { session: null, resource: 'companies', records: [], chart: null };
  const resources = ['companies', 'interview_questions', 'hiring_news', 'feedback', 'website_settings', 'admin_activity_logs'];

  function setStatus(element, message, isError = true) {
    element.textContent = message || '';
    element.style.color = isError ? 'var(--danger)' : 'var(--primary)';
  }

  function configured() {
    return config && config.supabaseUrl && config.supabaseAnonKey &&
      !config.supabaseUrl.includes('your-project-ref') &&
      !config.supabaseAnonKey.includes('your-supabase');
  }

  async function supabaseAuth(path, body, token) {
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token || config.supabaseAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || 'Authentication request failed');
    return payload;
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${state.session.access_token}`, 'Content-Type': 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Admin request failed');
    return payload;
  }

  function showDashboard(session) {
    state.session = session;
    loginView.hidden = true;
    dashboardView.hidden = false;
    document.getElementById('adminIdentity').textContent = session.user?.email || 'Authenticated owner';
    loadOverview();
    loadResource();
  }

  function showLogin(message = '') {
    state.session = null;
    loginView.hidden = false;
    dashboardView.hidden = true;
    setStatus(loginStatus, message);
  }

  function renderCards(container, entries) {
    container.innerHTML = entries.map(([label, value]) => `<article class="stat-card"><span class="muted">${label}</span><span class="number">${Number.isFinite(value) ? value.toLocaleString() : '—'}</span></article>`).join('');
  }

  async function loadOverview() {
    const cards = document.getElementById('overviewCards');
    cards.innerHTML = '<div class="empty-state">Loading verified counts…</div>';
    try {
      const result = await api('/api/admin/overview');
      renderCards(cards, Object.entries(result.data || {}).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase()), value]));
      document.getElementById('overviewNote').textContent = `Generated from Supabase at ${new Date(result.generatedAt).toLocaleString()}.`;
      if (state.chart) state.chart.destroy();
      const canvas = document.getElementById('overviewChart');
      if (window.Chart) {
        state.chart = new Chart(canvas, { type: 'bar', data: { labels: ['Companies', 'Questions', 'News', 'Page views', 'Quiz attempts'], datasets: [{ label: 'Database records', data: [result.data.companies, result.data.questions, result.data.news, result.data.pageViews, result.data.quizAttempts], backgroundColor: '#2563eb' }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
      }
    } catch (error) {
      cards.innerHTML = `<div class="empty-state">${error.message}</div>`;
    }
  }

  function renderResourceTabs() {
    const tabs = document.getElementById('resourceTabs');
    tabs.innerHTML = resources.map(resource => `<button class="${resource === state.resource ? 'active' : 'secondary'}" data-resource="${resource}">${resource.replace(/_/g, ' ')}</button>`).join('');
    tabs.querySelectorAll('[data-resource]').forEach((button) => button.addEventListener('click', () => {
      state.resource = button.dataset.resource;
      renderResourceTabs();
      loadResource();
    }));
  }

  function renderTable(container, records) {
    if (!records.length) {
      container.innerHTML = '<div class="empty-state">No records returned from the protected API.</div>';
      return;
    }
    const columns = Object.keys(records[0]).filter((key) => !['options', 'explanation', 'job_roles', 'test_pattern'].includes(key)).slice(0, 8);
    container.innerHTML = `<table><thead><tr>${columns.map((column) => `<th>${column}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${records.map((record) => `<tr data-id="${record.id || ''}">${columns.map((column) => `<td>${String(record[column] ?? '').slice(0, 180)}</td>`).join('')}<td class="actions"><button class="secondary edit-record">Edit</button><button class="danger delete-record">Delete</button></td></tr>`).join('')}</tbody></table>`;
    container.querySelectorAll('.edit-record').forEach((button) => button.addEventListener('click', () => openRecord(button.closest('tr').dataset.id)));
    container.querySelectorAll('.delete-record').forEach((button) => button.addEventListener('click', () => deleteRecord(button.closest('tr').dataset.id)));
  }

  async function loadResource() {
    renderResourceTabs();
    const targetId = state.resource === 'feedback' ? 'feedbackTable' : state.resource === 'website_settings' ? 'settingsTable' : state.resource === 'admin_activity_logs' ? 'activityTable' : 'resourceTable';
    const container = document.getElementById(targetId);
    container.innerHTML = '<div class="empty-state">Loading protected records…</div>';
    try {
      const result = await api(`/api/admin/${state.resource}`);
      state.records = result.data || [];
      renderTable(container, state.records);
    } catch (error) {
      container.innerHTML = `<div class="empty-state">${error.message}</div>`;
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
      await api(`/api/admin/${state.resource}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadResource();
    } catch (error) {
      window.alert(error.message);
    }
  }

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!configured()) return setStatus(loginStatus, 'Admin configuration is not installed. Copy admin/config.example.js to admin/config.js and add the Supabase URL and anon key.');
    setStatus(loginStatus, 'Signing in…', false);
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
  document.querySelectorAll('[data-refresh]').forEach((button) => button.addEventListener('click', () => button.dataset.refresh === 'overview' ? loadOverview() : loadResource()));
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === `section-${button.dataset.section}`));
    if (button.dataset.section === 'feedback') state.resource = 'feedback';
    else if (button.dataset.section === 'settings') state.resource = 'website_settings';
    else if (button.dataset.section === 'activity') state.resource = 'admin_activity_logs';
    else if (button.dataset.section === 'content') state.resource = 'companies';
    if (['feedback', 'settings', 'activity', 'content'].includes(button.dataset.section)) loadResource();
  }));
  document.getElementById('resourceSearch').addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    renderTable(document.getElementById('resourceTable'), state.records.filter((record) => JSON.stringify(record).toLowerCase().includes(query)));
  });

  let savedSession = null;
  try { savedSession = JSON.parse(localStorage.getItem('prepwise_admin_session') || 'null'); } catch { savedSession = null; }
  if (savedSession?.access_token && configured()) showDashboard(savedSession);
  else showLogin();
})();
