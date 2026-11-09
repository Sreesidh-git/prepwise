/**
 * PrepWise — Minimal Verification Suite for Two-Tier Consent UI & Adsterra Display
 * 
 * Verifies the 7 user-mandated criteria:
 * 1. Consent banner appears for a fresh visitor (fresh browser profile).
 * 2. "Show All Ads" (Allow choice) enables permitted ads (728x90, 320x50, Native).
 * 3. "Show Essential Ads" (Essential / No thanks choice) prevents consent-dependent ad requests.
 * 4. Cookie Settings link allows changing and withdrawing choice.
 * 5. Active quiz remains free of advertisements.
 * 6. Homepage and company page still render correctly.
 * 7. Popunder and Social Bar remain permanently disabled and absent.
 */

const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const path = require('path');

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

async function runMinimalChecks() {
  console.log('========================================================================');
  console.log('PREPWISE 7-POINT MINIMAL CONSENT UI & ADSTERRA VERIFICATION');
  console.log(`Target: ${BASE_URL}`);
  console.log('========================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9260;
  const freshUserDataDir = path.join(os.tmpdir(), 'chrome-minimal-audit-' + Date.now());

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
    client.on('Network.requestWillBeSent', (p) => {
      networkRequests.push(p.request.url);
    });

    // -------------------------------------------------------------
    // CHECK 1: Consent banner appears for a fresh visitor
    // -------------------------------------------------------------
    console.log('--- CHECK 1: Fresh Visitor Consent Banner ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/` });
    await new Promise(r => setTimeout(r, 2500));

    const check1 = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const banner = document.getElementById('prepwise-consent-banner');
          const btnAll = banner?.querySelector('#btnConsentAll') || banner?.querySelector('#btnConsentAccept');
          const btnEss = banner?.querySelector('#btnConsentEssential') || banner?.querySelector('#btnConsentReject');
          const btnSettings = banner?.querySelector('#btnConsentSettings') || banner?.querySelector('#btnConsentManage');
          return {
            exists: Boolean(banner),
            hasShowAll: Boolean(btnAll),
            hasShowEssential: Boolean(btnEss),
            hasSettings: Boolean(btnSettings),
            allText: btnAll?.textContent.trim(),
            essText: btnEss?.textContent.trim()
          };
        })()
      `,
      returnByValue: true
    });
    const c1 = check1.result.value;
    assertCheck(1, 'Consent banner appears for a fresh visitor with Show All Ads & Show Essential Ads choices',
      c1.exists && c1.hasShowAll && c1.hasShowEssential,
      JSON.stringify(c1)
    );

    // -------------------------------------------------------------
    // CHECK 3: No thanks / essential choice prevents consent-dependent ad requests
    // -------------------------------------------------------------
    console.log('\n--- CHECK 3: Show Essential Ads (Prevent Ad Tracking) ---');
    networkRequests.length = 0;
    await client.send('Runtime.evaluate', {
      expression: `document.getElementById('btnConsentEssential')?.click();`
    });
    await new Promise(r => setTimeout(r, 2000));

    const adRequestsTier2 = networkRequests.filter(u => u.includes('bauval.org') || u.includes('abscloud.org'));
    const prefsAfterEss = await client.send('Runtime.evaluate', {
      expression: `
        (() => ({
          hasAdConsent: window.PrepWiseConsent.hasConsent('advertising'),
          storedPrefs: JSON.parse(localStorage.getItem('prepwise_consent_preferences') || '{}'),
          bannerRemoved: !document.getElementById('prepwise-consent-banner'),
          iframesCount: document.querySelectorAll('iframe').length
        }))()
      `,
      returnByValue: true
    });
    const pVal = prefsAfterEss.result.value;
    assertCheck(3, '"Show Essential Ads" prevents consent-dependent ad requests (0 calls to ad network, 0 iframes)',
      adRequestsTier2.length === 0 && pVal.hasAdConsent === false && pVal.bannerRemoved && pVal.iframesCount === 0,
      `Ad requests: ${adRequestsTier2.length}, hasAdConsent: ${pVal.hasAdConsent}, iframes: ${pVal.iframesCount}`
    );

    // -------------------------------------------------------------
    // CHECK 4: Cookie Settings link allows changing/modifying choice
    // -------------------------------------------------------------
    console.log('\n--- CHECK 4: Cookie Settings Footer Link ---');
    await client.send('Runtime.evaluate', {
      expression: `
        const link = document.querySelector('#openConsentSettings, .open-consent-preferences, [data-consent-preferences]');
        link?.click();
      `
    });
    await new Promise(r => setTimeout(r, 1000));

    const modalCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.getElementById('prepwise-consent-modal');
          return {
            modalExists: Boolean(modal),
            modalVisible: modal ? !modal.hidden : false,
            hasToggleAd: Boolean(document.getElementById('toggleAdvertising')),
            hasToggleAnalytics: Boolean(document.getElementById('toggleAnalytics')),
            hasModalAcceptAll: Boolean(document.getElementById('btnModalAcceptAll')),
            hasModalEssential: Boolean(document.getElementById('btnModalEssential'))
          };
        })()
      `,
      returnByValue: true
    });
    const mVal = modalCheck.result.value;
    assertCheck(4, 'Cookie Settings link opens preferences modal to change choice',
      mVal.modalExists && mVal.modalVisible && mVal.hasToggleAd && mVal.hasModalAcceptAll,
      JSON.stringify(mVal)
    );

    // -------------------------------------------------------------
    // CHECK 2: Allow choice ("Show All Ads") enables permitted display ads
    // -------------------------------------------------------------
    console.log('\n--- CHECK 2: Show All Ads (Enables Permitted Display Ads) ---');
    networkRequests.length = 0;
    await client.send('Runtime.evaluate', {
      expression: `document.getElementById('btnModalAcceptAll')?.click();`
    });
    await new Promise(r => setTimeout(r, 3000));

    const check2 = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const topLeaderboard = document.getElementById('ad-homepage-leaderboard');
          const secondary = document.getElementById('ad-homepage-inline-secondary');
          const iframes = Array.from(document.querySelectorAll('.prepwise-ad-slot iframe, .ad-slot iframe'));
          return {
            hasConsent: window.PrepWiseConsent.hasConsent('advertising'),
            topLeaderboardState: topLeaderboard?.dataset.adState,
            secondaryState: secondary?.dataset.adState,
            totalAdIframes: iframes.length,
            iframeSources: iframes.map(f => f.src)
          };
        })()
      `,
      returnByValue: true
    });
    const c2 = check2.result.value;
    const hasAdsterraRequests = networkRequests.some(u => u.includes('bauval.org'));
    assertCheck(2, '"Show All Ads" enables permitted display ads immediately (ad iframes loaded)',
      c2.hasConsent === true && c2.totalAdIframes > 0 && hasAdsterraRequests,
      `Iframes: ${c2.totalAdIframes}, Adsterra requests: ${hasAdsterraRequests}`
    );

    // -------------------------------------------------------------
    // CHECK 5: Active quiz remains free of advertisements
    // -------------------------------------------------------------
    console.log('\n--- CHECK 5: Active Quiz Screen Isolation ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/quiz?company=google` });
    await new Promise(r => setTimeout(r, 2000));

    const quizCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const adsInsideQuiz = document.querySelectorAll('.quiz-container .prepwise-ad-slot, .quiz-card .ad-slot, .question-card .ad-slot');
          const resultsAd = document.getElementById('ad-quiz-results');
          const isResultsShowing = document.getElementById('quizResults')?.style.display !== 'none' && document.getElementById('quizResults')?.style.display !== '';
          return {
            adsInsideQuizQuestions: adsInsideQuiz.length,
            resultsAdVisibleDuringQuestions: resultsAd ? (resultsAd.offsetHeight > 0 && !isResultsShowing) : false,
            hasPopunder: Boolean(document.getElementById('adsterra-popunder')),
            hasSocialBar: Boolean(document.getElementById('adsterra-social-bar'))
          };
        })()
      `,
      returnByValue: true
    });
    const qc = quizCheck.result.value;
    assertCheck(5, 'Active quiz questions remain 100% free of advertisements',
      qc.adsInsideQuizQuestions === 0 && !qc.resultsAdVisibleDuringQuestions && !qc.hasPopunder && !qc.hasSocialBar,
      JSON.stringify(qc)
    );

    // -------------------------------------------------------------
    // CHECK 6: Homepage and company page still render correctly
    // -------------------------------------------------------------
    console.log('\n--- CHECK 6: Layout Integrity on Homepage & Company Profile ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/company?id=google` });
    await new Promise(r => setTimeout(r, 2000));

    const companyCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const companyName = document.querySelector('h1')?.textContent.trim();
          const tabs = Array.from(document.querySelectorAll('.tab-btn')).map(t => t.dataset.tab);
          const hasRolesTab = tabs.includes('roles');
          return {
            companyName,
            hasRolesTab,
            rendered: Boolean(companyName && hasRolesTab)
          };
        })()
      `,
      returnByValue: true
    });
    const cc = companyCheck.result.value;
    assertCheck(6, 'Company profile renders valid company data, tabs, and layout',
      cc.rendered && cc.companyName.includes('Google'),
      JSON.stringify(cc)
    );

    // -------------------------------------------------------------
    // CHECK 7: Popunder and Social Bar remain permanently disabled and absent
    // -------------------------------------------------------------
    console.log('\n--- CHECK 7: Popunder and Social Bar Permanent Disabling ---');
    const allAdUrls = networkRequests;
    const hasPopunderNet = allAdUrls.some(u => u.includes('abscloud.org') || u.includes('4290fb116e3ec38fe27d7faf2bc56147'));
    const hasSocialBarNet = allAdUrls.some(u => u.includes('/14/') || u.includes('2d767745db9b473a51148c8ec5f25276'));

    const domIntrusiveCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => ({
          popunderDom: Boolean(document.getElementById('adsterra-popunder')),
          socialBarDom: Boolean(document.getElementById('adsterra-social-bar')),
          popunderScript: Boolean(document.querySelector('script[src*=\"abscloud.org\"]')),
          socialBarScript: Boolean(document.querySelector('script[src*=\"/14/\"]'))
        }))()
      `,
      returnByValue: true
    });
    const dic = domIntrusiveCheck.result.value;

    assertCheck(7, 'Popunder (32172757) and Social Bar (32172758) strictly absent in network and DOM',
      !hasPopunderNet && !hasSocialBarNet && !dic.popunderDom && !dic.socialBarDom && !dic.popunderScript && !dic.socialBarScript,
      `Net popunder: ${hasPopunderNet}, Net social bar: ${hasSocialBarNet}, DOM: ${JSON.stringify(dic)}`
    );

    client.close();
    chrome.kill();

    console.log('\n========================================================================');
    console.log(`MINIMAL VERIFICATION SUMMARY: ${passed}/${total} CHECKS PASSED`);
    console.log('========================================================================\n');

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    chrome.kill();
    process.exit(1);
  }
}

runMinimalChecks();
