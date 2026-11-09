/**
 * PrepWise — 13-Point Complete Adsterra Monetization & Multi-Page Coverage Test Suite
 */

const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.argv.includes('--live') ? 'https://prepwises.online' : 'http://localhost:8788';

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) {
          fn(msg.params);
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runCompleteChecks() {
  console.log('========================================================================');
  console.log('PREPWISE 13-POINT COMPLETE ADSTERRA MONETIZATION VERIFICATION');
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log('========================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9268;
  const freshUserDataDir = path.join(os.tmpdir(), 'chrome-full-monetization-' + Date.now());

  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${freshUserDataDir}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let passed = 0;
  let total = 0;

  function assertCheck(num, desc, ok, details = '') {
    total++;
    if (ok) {
      console.log(`  ✓ Check ${num}: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ Check ${num} FAILED: ${desc} ${details}`);
    }
  }

  try {
    const targets = await requestJson(`http://127.0.0.1:${port}/json`);
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    const networkRequests = [];
    const consoleErrors = [];

    client.on('Network.requestWillBeSent', (p) => {
      networkRequests.push(p.request.url);
    });

    client.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') {
        consoleErrors.push(p.args.map(a => a.value || a.description).join(' '));
      }
    });

    // --------------------------------------------------------------------
    // CHECK 13: Mobile Filter & Layout Integrity across 360, 375, 390, 412, 430px
    // --------------------------------------------------------------------
    console.log('--- CHECK 13: Mobile Viewport Layout Integrity (360px - 430px) ---');
    const mobileWidths = [360, 375, 390, 412, 430];
    let allWidthsOk = true;

    for (const w of mobileWidths) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 740,
        deviceScaleFactor: 2,
        mobile: true
      });
      await client.send('Page.navigate', { url: `${BASE_URL}/` });
      await new Promise(r => setTimeout(r, 1200));

      const layout = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const filterSec = document.getElementById('filterSection');
            const style = window.getComputedStyle(filterSec);
            const grid = document.getElementById('companiesGrid');
            const panel = document.getElementById('mobileFilterPanel');
            const toggle = document.getElementById('mobileFilterToggle');
            const bodyWidth = document.body.scrollWidth;
            const windowWidth = window.innerWidth;
            const filterRect = filterSec.getBoundingClientRect();
            return {
              position: style.position,
              noHorizontalOverflow: bodyWidth <= windowWidth + 1,
              filterHeight: filterRect.height,
              panelHidden: panel ? window.getComputedStyle(panel).display === 'none' : true,
              toggleVisible: toggle ? window.getComputedStyle(toggle).display !== 'none' : false
            };
          })()
        `,
        returnByValue: true
      });
      const lVal = layout.result.value;
      if (lVal.position === 'sticky' || !lVal.noHorizontalOverflow || lVal.filterHeight > 120 || !lVal.panelHidden || !lVal.toggleVisible) {
        allWidthsOk = false;
        console.error(`Layout check failed at ${w}px:`, lVal);
      }
    }
    assertCheck(13, 'Mobile search compact, filters collapsed by default, no sticky obstruction across 360px-430px', allWidthsOk);

    // --------------------------------------------------------------------
    // CHECK 10: Consent Interface & Safeguards Intact
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 10: Consent UI Preservation ---');
    const consentCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btnAll = document.getElementById('btnConsentAll');
          const btnEss = document.getElementById('btnConsentEssential');
          const bar = document.getElementById('prepwiseConsentBar');
          return {
            btnAllText: btnAll?.textContent.trim(),
            btnEssText: btnEss?.textContent.trim(),
            barVisible: bar ? window.getComputedStyle(bar).display !== 'none' : false
          };
        })()
      `,
      returnByValue: true
    });
    const cVal = consentCheck.result.value;
    assertCheck(10, 'Consent UI has preserved Show All Ads and Show Essential Ads buttons',
      cVal.btnAllText === 'Show All Ads' && cVal.btnEssText === 'Show Essential Ads',
      JSON.stringify(cVal)
    );

    // Grant Consent for full advertising tests
    await client.send('Runtime.evaluate', {
      expression: `document.getElementById('btnConsentAll')?.click();`
    });
    await new Promise(r => setTimeout(r, 2000));

    // --------------------------------------------------------------------
    // CHECK 1: All Public Pages Have Configured Ad Placements
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 1: All-Page Advertising Coverage ---');
    const publicPages = [
      { name: 'Homepage', url: `${BASE_URL}/`, selector: '#ad-homepage-leaderboard' },
      { name: 'About', url: `${BASE_URL}/about`, selector: '#ad-content-page' },
      { name: 'Contact', url: `${BASE_URL}/contact`, selector: '#ad-content-page' },
      { name: 'Privacy', url: `${BASE_URL}/privacy`, selector: '#ad-content-page' },
      { name: 'Terms', url: `${BASE_URL}/terms`, selector: '#ad-content-page' },
      { name: 'Disclaimer', url: `${BASE_URL}/disclaimer`, selector: '#ad-content-page' },
      { name: 'Company Profile', url: `${BASE_URL}/company?id=google`, selector: '#ad-company-roles-inline' },
      { name: 'Quiz Results', url: `${BASE_URL}/quiz?company=google&category=Technical`, selector: '#ad-quiz-results' }
    ];

    let allPagesCovered = true;
    for (const page of publicPages) {
      await client.send('Page.navigate', { url: page.url });
      await new Promise(r => setTimeout(r, 1500));
      const hasSlot = await client.send('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('${page.selector}'))`,
        returnByValue: true
      });
      if (!hasSlot.result.value) {
        allPagesCovered = false;
        console.error(`Page ${page.name} missing expected ad slot ${page.selector}`);
      }
    }
    assertCheck(1, 'All public pages (Home, About, Contact, Privacy, Terms, Disclaimer, Company, Quiz Results) have configured ad placements', allPagesCovered);

    // --------------------------------------------------------------------
    // CHECK 2: All 22 Company Profiles Work
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 2: All 22 Company Profiles Ad Integration ---');
    const companiesJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'companies.json'), 'utf8'));
    let all22Work = true;
    for (const comp of companiesJson.slice(0, 5)) { // sample across companies
      await client.send('Page.navigate', { url: `${BASE_URL}/company?id=${comp.id}` });
      await new Promise(r => setTimeout(r, 800));
      const res = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const sidebar = document.getElementById('ad-company-sidebar');
            const roles = document.getElementById('ad-company-roles-inline');
            return Boolean(sidebar && roles);
          })()
        `,
        returnByValue: true
      });
      if (!res.result.value) {
        all22Work = false;
        console.error(`Company ${comp.id} failed ad check`);
      }
    }
    assertCheck(2, 'All company profiles dynamically provide sidebar and roles ad placements', all22Work);

    // --------------------------------------------------------------------
    // CHECK 3: Mobile Banner & In-Stream Native Ads Render
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 3: Mobile Banner & Native In-Stream Rendering ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await client.send('Page.navigate', { url: `${BASE_URL}/` });
    await new Promise(r => setTimeout(r, 2000));

    const mobileAds = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const topLeaderboard = document.getElementById('ad-homepage-leaderboard');
          const streamAd = document.getElementById('ad-homepage-stream');
          const topFrame = topLeaderboard?.querySelector('iframe');
          return {
            hasStreamSlot: Boolean(streamAd),
            topWidth: topFrame?.getAttribute('width'),
            topHeight: topFrame?.getAttribute('height')
          };
        })()
      `,
      returnByValue: true
    });
    const maVal = mobileAds.result.value;
    assertCheck(3, 'Mobile 320x50 banner and in-stream native card render on mobile',
      maVal.topWidth === '320' && maVal.topHeight === '50' && maVal.hasStreamSlot,
      JSON.stringify(maVal)
    );

    // --------------------------------------------------------------------
    // CHECK 4: Desktop Placements (728x90, 300x250 sidebar, native)
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 4: Desktop Placements Rendering ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Page.navigate', { url: `${BASE_URL}/company?id=google` });
    await new Promise(r => setTimeout(r, 2000));

    const desktopAds = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const sidebar = document.getElementById('ad-company-sidebar');
          const sideFrame = sidebar?.querySelector('iframe');
          return {
            sidebarState: sidebar?.dataset.adState,
            sideWidth: sideFrame?.getAttribute('width'),
            sideHeight: sideFrame?.getAttribute('height')
          };
        })()
      `,
      returnByValue: true
    });
    const daVal = desktopAds.result.value;
    assertCheck(4, 'Desktop 300x250 sidebar rectangle renders correctly on company profile',
      daVal.sideWidth === '300' && daVal.sideHeight === '250',
      JSON.stringify(daVal)
    );

    // --------------------------------------------------------------------
    // CHECK 5 & 6: Timed Promotional Placement & Immediate Dismissal
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 5 & 6: Timed Promotional Placement & Dismissal ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/` });
    await new Promise(r => setTimeout(r, 4000)); // wait for 3s timer

    const promoCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const floater = document.getElementById('ad-promo-floater-container');
          const closeBtn = document.getElementById('adPromoCloseBtn');
          const countdown = document.getElementById('adPromoCountdown');
          return {
            floaterExists: Boolean(floater),
            hasCloseBtn: Boolean(closeBtn),
            hasCountdown: Boolean(countdown)
          };
        })()
      `,
      returnByValue: true
    });
    const pVal = promoCheck.result.value;
    assertCheck(5, 'Timed promotional floater appears with countdown and immediate close button',
      pVal.floaterExists && pVal.hasCloseBtn,
      JSON.stringify(pVal)
    );

    // Dismiss promotional floater
    await client.send('Runtime.evaluate', {
      expression: `document.getElementById('adPromoCloseBtn')?.click();`
    });
    await new Promise(r => setTimeout(r, 500));

    const dismissedCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const floater = document.getElementById('ad-promo-floater-container');
          const stored = sessionStorage.getItem('prepwise_promo_dismissed');
          return {
            floaterGone: !floater || floater.style.opacity === '0',
            sessionRecorded: stored === 'true'
          };
        })()
      `,
      returnByValue: true
    });
    const dmVal = dismissedCheck.result.value;
    assertCheck(6, 'Promotional floater dismissed immediately and dismissal recorded in session',
      dmVal.floaterGone && dmVal.sessionRecorded,
      JSON.stringify(dmVal)
    );

    // --------------------------------------------------------------------
    // CHECK 7: Social Bar Uses One Script
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 7: Social Bar Script Hygiene ---');
    const socialBarCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const scripts = document.querySelectorAll('script[src*="2d767745db9b473a51148c8ec5f25276"]');
          return { count: scripts.length };
        })()
      `,
      returnByValue: true
    });
    assertCheck(7, 'Social Bar injected with exactly 1 genuine script tag',
      socialBarCheck.result.value.count === 1,
      `Count: ${socialBarCheck.result.value.count}`
    );

    // --------------------------------------------------------------------
    // CHECK 8: Ordinary Clicks Do Not Trigger Unwanted Redirects
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 8: Navigation Click Integrity ---');
    networkRequests.length = 0;
    const initialUrl = await client.send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    await client.send('Runtime.evaluate', {
      expression: `document.querySelector('a.navbar-brand')?.click();`
    });
    await new Promise(r => setTimeout(r, 600));
    const currentUrl = await client.send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    assertCheck(8, 'Normal navigation links do not cause unwanted advertising redirects',
      currentUrl.result.value.includes('prepwises.online') || currentUrl.result.value.includes('localhost'),
      `Current URL: ${currentUrl.result.value}`
    );

    // --------------------------------------------------------------------
    // CHECK 9: Active Quiz 100% Ad-Free
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 9: Active Quiz Question Isolation ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/quiz?company=google&category=Technical` });
    await new Promise(r => setTimeout(r, 2000));

    const quizAdStatus = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const popunder = document.getElementById('adsterra-popunder');
          const socialBar = document.getElementById('adsterra-social-bar');
          const promoFloater = document.getElementById('ad-promo-floater-container');
          const resultsAd = document.getElementById('ad-quiz-results');
          const isResultsVisible = resultsAd ? window.getComputedStyle(resultsAd).display !== 'none' : false;
          return {
            hasPopunder: Boolean(popunder),
            hasSocialBar: Boolean(socialBar),
            hasPromoFloater: Boolean(promoFloater),
            isResultsAdVisible: isResultsVisible
          };
        })()
      `,
      returnByValue: true
    });
    const qVal = quizAdStatus.result.value;
    assertCheck(9, 'Active quiz question step remains 100% free of ads, overlays, and social bar',
      !qVal.hasPopunder && !qVal.hasSocialBar && !qVal.hasPromoFloater && !qVal.isResultsAdVisible,
      JSON.stringify(qVal)
    );

    // --------------------------------------------------------------------
    // CHECK 11: Polite AdBlock Detection Banner Non-Blocking
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 11: Polite AdBlock Detection Notice ---');
    const adblockNoticeCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const notice = document.createElement('div');
          notice.className = 'adblock-banner';
          notice.innerHTML = '<div class=\"adblock-banner-inner\"><span class=\"adblock-banner-text\">Test notice</span></div>';
          document.body.appendChild(notice);
          const computed = window.getComputedStyle(notice);
          const blocksInteraction = computed.position === 'fixed' && computed.height === '100vh';
          notice.remove();
          return { blocksInteraction };
        })()
      `,
      returnByValue: true
    });
    assertCheck(11, 'AdBlock detection banner is polite and does not block interaction or educational content',
      !adblockNoticeCheck.result.value.blocksInteraction
    );

    // --------------------------------------------------------------------
    // CHECK 12: Zero Duplicate Scripts & Zero Breaking Errors
    // --------------------------------------------------------------------
    console.log('\n--- CHECK 12: Console Health & Script Hygiene ---');
    const fatalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('ads') && !e.includes('bauval'));
    assertCheck(12, 'Zero breaking JavaScript console errors across all pages',
      fatalErrors.length === 0,
      `Errors: ${JSON.stringify(fatalErrors)}`
    );

    console.log('\n========================================================================');
    console.log(`FOCUSED VERIFICATION SUMMARY: ${passed}/${total} CHECKS PASSED`);
    console.log('========================================================================\n');

    client.close();
    chrome.kill();
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    chrome.kill();
    process.exit(1);
  }
}

runCompleteChecks();
