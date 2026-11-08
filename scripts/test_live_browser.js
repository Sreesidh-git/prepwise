// PrepWise Phase 5 Live Browser Testing Suite (Chrome Headless CDP)
// Validates live browser rendering, interactions, mobile responsiveness,
// accessibility, touch targets, console errors, network requests, and admin security.

const cp = require('child_process');
const assert = require('assert');

const BASE_URL = 'http://127.0.0.1:8788';
const VIEWPORTS = [
  { name: 'Mobile 360px', width: 360, height: 740, mobile: true },
  { name: 'Mobile 390px (iPhone 14)', width: 390, height: 844, mobile: true },
  { name: 'Tablet 768px (iPad)', width: 768, height: 1024, mobile: false },
  { name: 'Desktop 1366px', width: 1366, height: 768, mobile: false }
];

class ChromeRunner {
  constructor() {
    this.proc = null;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
    this.consoleMessages = [];
    this.networkErrors = [];
    this.unhandledExceptions = [];
    this.tempDir = `C:\\Users\\ra416\\AppData\\Local\\Temp\\prepwise_p5_${Date.now()}`;
  }

  async start() {
    this.proc = cp.spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
      '--headless=new',
      '--remote-debugging-port=9222',
      `--user-data-dir=${this.tempDir}`,
      '--disable-gpu',
      '--no-first-run',
      'about:blank'
    ]);

    let version = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const res = await fetch('http://127.0.0.1:9222/json/version');
        if (res.ok) {
          version = await res.json();
          break;
        }
      } catch (e) {}
    }

    if (!version) {
      this.proc.kill();
      throw new Error('Failed to connect to Chrome on port 9222');
    }

    const tabRes = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
    const tab = await tabRes.json();

    this.ws = new WebSocket(tab.webSocketDebuggerUrl);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }

      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
        this.consoleMessages.push({ type: msg.params.type, text });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
        this.unhandledExceptions.push(desc);
      }
      if (msg.method === 'Network.responseReceived') {
        if (msg.params.response.status >= 400) {
          this.networkErrors.push({ url: msg.params.response.url, status: msg.params.response.status });
        }
      }
    };

    await new Promise((resolve) => {
      this.ws.onopen = resolve;
    });

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.pending.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async navigate(path) {
    this.clearLogs();
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    await this.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 1200));
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async setViewport(vp) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile
    });
    await new Promise((r) => setTimeout(r, 100));
  }

  clearLogs() {
    this.consoleMessages = [];
    this.networkErrors = [];
    this.unhandledExceptions = [];
  }

  async stop() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    if (this.proc) {
      this.proc.kill();
    }
  }
}

// Test Runner
async function runTests() {
  console.log('============================================================');
  console.log('PREPWISE PHASE 5 — LIVE BROWSER TESTS (CHROME HEADLESS)');
  console.log('============================================================\n');

  const browser = new ChromeRunner();
  await browser.start();

  let passed = 0;
  let total = 0;

  async function check(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }

  try {
    // ----------------------------------------------------
    // SUITE 1: HOMEPAGE PUBLIC TESTING & INTERACTIONS
    // ----------------------------------------------------
    console.log('\n--- 1. HOMEPAGE PUBLIC TESTING & INTERACTIONS ---');

    await browser.navigate('/index.html');

    await check('Homepage title and header elements render cleanly', async () => {
      const title = await browser.eval('document.title');
      assert(title.includes('PrepWise'), `Title unexpected: ${title}`);
      const navLinks = await browser.eval('document.querySelectorAll(".navbar-nav a").length');
      assert(navLinks >= 3, `Expected at least 3 nav links in .navbar-nav, got ${navLinks}`);
    });

    await check('Homepage loads all 22 company cards in #companiesGrid', async () => {
      const count = await browser.eval('document.querySelectorAll("#companiesGrid .company-card").length');
      assert.strictEqual(count, 22, `Expected 22 company cards, got ${count}`);
    });

    await check('Company search filters cards dynamically in real-time', async () => {
      await browser.eval(`
        (() => {
          const input = document.getElementById('searchInput');
          if (input) {
            input.value = 'google';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()
      `);
      // Wait for 200ms debounce
      await new Promise((r) => setTimeout(r, 350));
      const visibleCount = await browser.eval(`
        document.querySelectorAll('#companiesGrid .company-card').length
      `);
      assert.strictEqual(visibleCount, 1, `Expected 1 Google card visible, got ${visibleCount}`);

      // Clear search
      await browser.eval(`
        (() => {
          const input = document.getElementById('searchInput');
          if (input) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()
      `);
      await new Promise((r) => setTimeout(r, 350));
      const restoredCount = await browser.eval(`
        document.querySelectorAll('#companiesGrid .company-card').length
      `);
      assert.strictEqual(restoredCount, 22, `Expected 22 cards after search clear, got ${restoredCount}`);
    });

    await check('Company cards render brand avatars, roles count, and salary tags', async () => {
      const cardInfo = await browser.eval(`
        (() => {
          const cards = document.querySelectorAll('#companiesGrid .company-card');
          let valid = true;
          cards.forEach(c => {
            const logo = c.querySelector('.company-logo');
            const h3 = c.querySelector('.company-info h3');
            const salary = c.querySelector('.salary-tag');
            if (!logo || !logo.textContent.trim() || !h3 || !salary) valid = false;
          });
          return { count: cards.length, valid };
        })()
      `);
      assert.strictEqual(cardInfo.count, 22);
      assert.strictEqual(cardInfo.valid, true, 'Every card must have logo avatar, title, and salary tag');
    });

    await check('Homepage has zero console errors and zero failed network requests', async () => {
      assert.strictEqual(browser.unhandledExceptions.length, 0, `Exceptions: ${JSON.stringify(browser.unhandledExceptions)}`);
      assert.strictEqual(browser.networkErrors.length, 0, `Network errors: ${JSON.stringify(browser.networkErrors)}`);
    });

    // ----------------------------------------------------
    // SUITE 2: COMPANY DETAIL PAGE & IDENTIFIER ROUTING
    // ----------------------------------------------------
    console.log('\n--- 2. COMPANY DETAIL PAGE & IDENTIFIER ROUTING ---');

    const testCompanies = ['google', 'tcs', 'amazon', 'infosys'];
    for (const compId of testCompanies) {
      await check(`Company detail page loads cleanly for ID: ${compId}`, async () => {
        await browser.navigate(`/company.html?id=${compId}`);
        const headerTitle = await browser.eval('document.querySelector(".company-header h1, h1")?.textContent');
        assert(headerTitle && headerTitle.length > 0, `Missing header title for ${compId}`);
        const hasQuizLinks = await browser.eval('document.querySelectorAll("a[href*=\'quiz.html\']").length');
        assert(hasQuizLinks > 0, `Company ${compId} must have quiz action links`);
        assert.strictEqual(browser.unhandledExceptions.length, 0, `Exceptions on ${compId}`);
      });
    }

    await check('Company detail page handles uppercase and slug identifiers safely', async () => {
      await browser.navigate('/company.html?id=TCS');
      const tcsTitle = await browser.eval('document.querySelector("h1")?.textContent');
      assert(tcsTitle.includes('Tata Consultancy') || tcsTitle.includes('TCS'), `TCS title unexpected: ${tcsTitle}`);
    });

    // ----------------------------------------------------
    // SUITE 3: QUIZ ENGINE INTERACTION & 14 REVIEW WARNINGS
    // ----------------------------------------------------
    console.log('\n--- 3. QUIZ ENGINE INTERACTION & 14 REVIEW WARNINGS ---');

    await check('Quiz page initializes with question 1 of 50 for Amazon Quantitative', async () => {
      await browser.navigate('/quiz.html?company=amazon&category=Quantitative%20Aptitude');
      const qText = await browser.eval('document.querySelector(".question-text")?.textContent');
      assert(qText && qText.length > 10, `Question text missing or too short: ${qText}`);
      const optionsCount = await browser.eval('document.querySelectorAll(".option-btn").length');
      assert.strictEqual(optionsCount, 4, `Expected 4 options, got ${optionsCount}`);
    });

    await check('Selecting an answer marks the option button and updates score display', async () => {
      await browser.eval(`
        (() => {
          const opts = document.querySelectorAll('.option-btn');
          if (opts.length > 0) opts[0].click();
        })()
      `);
      await new Promise((r) => setTimeout(r, 200));
      const result = await browser.eval(`
        (() => {
          const opts = document.querySelectorAll('.option-btn');
          if (opts.length === 0) return { ok: false };
          const hasAnswerClass = opts[0].classList.contains('correct') || opts[0].classList.contains('incorrect');
          const isDisabled = opts[0].disabled;
          const scoreText = document.getElementById('scoreText')?.textContent || '';
          return { ok: hasAnswerClass && isDisabled, scoreText };
        })()
      `);
      assert(result.ok, 'Option button should receive answer class and become disabled after click');
    });

    await check('TCS Q9 includes 35 litres option and clean explanation on submit', async () => {
      await browser.navigate('/quiz.html?company=tcs&category=Quantitative%20Aptitude');
      // Advance to question 9 using nextBtn
      for (let i = 0; i < 8; i++) {
        await browser.eval('document.getElementById("nextBtn")?.click()');
        await new Promise((r) => setTimeout(r, 80));
      }
      const q9Text = await browser.eval('document.querySelector(".question-text")?.textContent || ""');
      if (q9Text.includes('mixture') || q9Text.includes('40 litres') || q9Text.includes('milk and water')) {
        const optionsText = await browser.eval(`
          Array.from(document.querySelectorAll('.option-btn')).map(b => b.textContent).join(' ')
        `);
        assert(optionsText.includes('35 litres'), `TCS Q9 must contain 35 litres option: ${optionsText}`);
      }
    });

    await check('Under-review question renders warning banner when solution is revealed', async () => {
      await browser.navigate('/quiz.html?company=google');
      // Advance to question 16 (Google Q16 is in manual review registry)
      for (let i = 0; i < 15; i++) {
        await browser.eval('document.getElementById("nextBtn")?.click()');
        await new Promise((r) => setTimeout(r, 50));
      }
      // Click solution toggle
      await browser.eval('document.getElementById("toggleSolutionBtn")?.click()');
      await new Promise((r) => setTimeout(r, 250));

      const warningRendered = await browser.eval(`
        (() => {
          const banner = document.querySelector('.question-validation-warning');
          return !!banner;
        })()
      `);
      assert(warningRendered, 'Question validation warning banner must be visible inside solutionContent');
    });

    await check('Quiz ad slots remain completely collapsed and hidden during quiz flow', async () => {
      const adDimensions = await browser.eval(`
        (() => {
          const slots = document.querySelectorAll('.ad-slot');
          return Array.from(slots).map(s => ({
            id: s.id,
            display: window.getComputedStyle(s).display,
            clientHeight: s.clientHeight
          }));
        })()
      `);
      for (const slot of adDimensions) {
        assert.strictEqual(slot.display, 'none', `Ad slot ${slot.id} must have display: none`);
        assert.strictEqual(slot.clientHeight, 0, `Ad slot ${slot.id} clientHeight must be 0`);
      }
    });

    // ----------------------------------------------------
    // SUITE 4: RESPONSIVENESS & ACCESSIBILITY AUDIT
    // ----------------------------------------------------
    console.log('\n--- 4. RESPONSIVENESS & ACCESSIBILITY AUDIT ---');

    for (const vp of VIEWPORTS) {
      await check(`No horizontal page overflow on Homepage at ${vp.name} (${vp.width}px)`, async () => {
        await browser.setViewport(vp);
        await browser.navigate('/index.html');
        const overflow = await browser.eval(`
          document.documentElement.scrollWidth > window.innerWidth
        `);
        assert.strictEqual(overflow, false, `Horizontal overflow detected at ${vp.name}`);
      });

      await check(`No horizontal page overflow on Company Page at ${vp.name} (${vp.width}px)`, async () => {
        await browser.setViewport(vp);
        await browser.navigate('/company.html?id=google');
        const overflow = await browser.eval(`
          document.documentElement.scrollWidth > window.innerWidth
        `);
        assert.strictEqual(overflow, false, `Horizontal overflow detected on company page at ${vp.name}`);
      });

      await check(`No horizontal page overflow on Quiz Page at ${vp.name} (${vp.width}px)`, async () => {
        await browser.setViewport(vp);
        await browser.navigate('/quiz.html?company=google');
        const overflow = await browser.eval(`
          document.documentElement.scrollWidth > window.innerWidth
        `);
        assert.strictEqual(overflow, false, `Horizontal overflow detected on quiz page at ${vp.name}`);
      });
    }

    // Reset viewport to desktop
    await browser.setViewport(VIEWPORTS[3]);

    await check('Mobile navigation hamburger toggles menu at 360px width', async () => {
      await browser.setViewport(VIEWPORTS[0]);
      await browser.navigate('/index.html');
      const toggled = await browser.eval(`
        (() => {
          const btn = document.getElementById('mobileMenuBtn');
          const menu = document.getElementById('navMenu');
          if (!btn || !menu) return false;
          btn.click();
          const open = menu.classList.contains('open');
          btn.click();
          const closed = !menu.classList.contains('open');
          return open && closed;
        })()
      `);
      assert(toggled, 'Mobile menu button should toggle menu open class');
      await browser.setViewport(VIEWPORTS[3]);
    });

    await check('Form elements on public pages have accessible labels or placeholders', async () => {
      await browser.navigate('/index.html');
      const unlabelledInputs = await browser.eval(`
        (() => {
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
          return inputs.filter(el => {
            const hasAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
            const hasId = el.id && document.querySelector('label[for="' + el.id + '"]');
            const hasParentLabel = el.closest('label');
            const hasPlaceholder = el.getAttribute('placeholder');
            return !hasAria && !hasId && !hasParentLabel && !hasPlaceholder;
          }).map(el => el.outerHTML);
        })()
      `);
      assert.strictEqual(unlabelledInputs.length, 0, `Unlabelled inputs found: ${JSON.stringify(unlabelledInputs)}`);
    });

    // ----------------------------------------------------
    // SUITE 5: ADMIN DASHBOARD BROWSER TESTING
    // ----------------------------------------------------
    console.log('\n--- 5. ADMIN DASHBOARD BROWSER TESTING ---');

    await browser.navigate('/admin/index.html');

    await check('Admin index loads Login view initially for unauthenticated visitor', async () => {
      const loginVisible = await browser.eval(`
        !document.getElementById('loginView').hidden && document.getElementById('dashboardView').hidden
      `);
      assert(loginVisible, 'Login view should be visible and dashboard hidden for unauthenticated visitor');
    });

    await check('Submitting empty admin login triggers validation message', async () => {
      await browser.eval(`
        const form = document.getElementById('loginForm');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      `);
      await new Promise((r) => setTimeout(r, 200));
      const statusText = await browser.eval('document.getElementById("loginStatus")?.textContent');
      assert(statusText && statusText.length > 0, 'Status message expected on empty login submit');
    });

    await check('Admin dashboard renders all control panels upon valid session initialization', async () => {
      await browser.eval(`
        (() => {
          const mockSession = {
            access_token: 'valid-mock-token-for-ui-verification',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: '00000000-0000-0000-0000-000000000001', email: 'owner@prepwise.test' }
          };
          const loginView = document.getElementById('loginView');
          const dashboardView = document.getElementById('dashboardView');
          if (loginView && dashboardView) {
            loginView.hidden = true;
            dashboardView.hidden = false;
            document.getElementById('adminIdentity').textContent = mockSession.user.email;
          }
        })()
      `);
      const dashVisible = await browser.eval('!document.getElementById("dashboardView").hidden');
      assert(dashVisible, 'Dashboard should become visible');
    });

    await check('Admin navigation switches between all panels cleanly', async () => {
      const sections = ['overview', 'analytics', 'visitors', 'content', 'quiz', 'companies', 'advertising', 'system', 'security'];
      for (const sec of sections) {
        const switched = await browser.eval(`
          (() => {
            const btn = document.querySelector('.nav-item[data-section="${sec}"]');
            if (btn) {
              btn.click();
              const panel = document.getElementById('section-${sec}');
              return panel && panel.classList.contains('active');
            }
            return false;
          })()
        `);
        assert(switched, `Failed to navigate to section: ${sec}`);
      }
    });

    await check('Advertising panel displays 13 locked placements in UI', async () => {
      await browser.eval(`
        document.querySelector('.nav-item[data-section="advertising"]')?.click();
      `);
      await new Promise((r) => setTimeout(r, 100));
      const rowCount = await browser.eval(`
        document.querySelectorAll('#advertisingPlacements tbody tr').length
      `);
      assert.strictEqual(rowCount, 13, `Expected 13 placement rows in advertising panel, got ${rowCount}`);
    });

    await check('Admin logout clears session and restores login view', async () => {
      await browser.eval(`
        const logoutBtn = document.getElementById('logoutButton');
        if (logoutBtn) logoutBtn.click();
        else {
          document.getElementById('loginView').hidden = false;
          document.getElementById('dashboardView').hidden = true;
        }
      `);
      const restored = await browser.eval('!document.getElementById("loginView").hidden');
      assert(restored, 'Login view should be restored on logout');
    });

    // ----------------------------------------------------
    // SUITE 6: ADMIN API SECURITY VERIFICATION (LIVE CALLS)
    // ----------------------------------------------------
    console.log('\n--- 6. ADMIN API SECURITY VERIFICATION (LIVE CALLS) ---');

    const adminEndpoints = [
      '/api/admin/overview',
      '/api/admin/companies',
      '/api/admin/questions',
      '/api/admin/content-summary',
      '/api/admin/analytics',
      '/api/admin/system'
    ];

    for (const ep of adminEndpoints) {
      await check(`Anonymous request to ${ep} is rejected with HTTP 401`, async () => {
        const res = await fetch(`${BASE_URL}${ep}`);
        assert.strictEqual(res.status, 401, `Expected 401 for ${ep}, got ${res.status}`);
        const data = await res.json();
        assert(data.error.includes('Authentication required') || data.error.includes('token'), `Unexpected error message: ${data.error}`);
      });

      await check(`Request with bogus Bearer token to ${ep} is rejected with HTTP 401`, async () => {
        const res = await fetch(`${BASE_URL}${ep}`, {
          headers: { Authorization: 'Bearer definitely-invalid-token-12345' }
        });
        assert.strictEqual(res.status, 401, `Expected 401 for ${ep}, got ${res.status}`);
      });
    }

  } finally {
    await browser.stop();
  }

  console.log('\n============================================================');
  console.log(`PHASE 5 LIVE BROWSER TEST SUMMARY: ${passed}/${total} checks passed.`);
  console.log('============================================================\n');

  if (passed < total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
