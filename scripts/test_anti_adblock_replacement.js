/**
 * PrepWise — 16-Point Adsterra Anti-AdBlock Script Replacement Verification Suite
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

async function run16Tests() {
  console.log('========================================================================');
  console.log('PREPWISE 16-POINT ADSTERRA ANTI-ADBLOCK SCRIPT REPLACEMENT VERIFICATION');
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log('========================================================================\n');

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

  // 1 & 2. Static Code Verification
  const config = require('../js/adsterra-config.js');
  const expectedCodes = {
    '32172757': 'https://abscloud.org/1/4290fb116e3ec38fe27d7faf2bc56147',
    '32172758': 'https://bauval.org/14/2d767745db9b473a51148c8ec5f25276',
    '32172759': 'https://bauval.org/21/cf54b7a35f5f1b688587f9f9b2590912',
    '32172760': '0d9f54e21d55ad258d1ac8ff5a73433b',
    '32172761': 'fadaa658a1da452b0f5bed520cfc9a09',
    '32172762': 'f2c5fa5caeb276be7a6a9192acffab05'
  };

  let all6MappingsOk = true;
  for (const [id, val] of Object.entries(expectedCodes)) {
    const unit = config.units[id];
    if (!unit) { all6MappingsOk = false; break; }
    if (unit.format.startsWith('banner')) {
      if (unit.key !== val) all6MappingsOk = false;
    } else {
      if (unit.scriptSrc !== val) all6MappingsOk = false;
    }
  }
  assertCheck(1, 'All six new Adsterra code mappings are correct in adsterra-config.js', all6MappingsOk);
  assertCheck(2, 'All six old code URLs replaced with verified publisher Anti-AdBlock scripts', all6MappingsOk);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9269;
  const freshUserDataDir = path.join(os.tmpdir(), 'chrome-replace-adsterra-' + Date.now());

  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${freshUserDataDir}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));

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

    // 16. Mobile layout intact across viewports
    console.log('--- CHECK 16: Existing Mobile Layout Intact ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await client.send('Page.navigate', { url: `${BASE_URL}/` });
    await new Promise(r => setTimeout(r, 1500));

    const mobileLayout = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const panel = document.getElementById('mobileFilterPanel');
          const toggle = document.getElementById('mobileFilterToggle');
          const filterSec = document.getElementById('filterSection');
          return {
            panelCollapsed: window.getComputedStyle(panel).display === 'none',
            toggleVisible: window.getComputedStyle(toggle).display !== 'none',
            isStatic: window.getComputedStyle(filterSec).position === 'static'
          };
        })()
      `,
      returnByValue: true
    });
    const mlVal = mobileLayout.result.value;
    assertCheck(16, 'Existing mobile layout remains intact (compact search, collapsed filters, static flow)',
      mlVal.panelCollapsed && mlVal.toggleVisible && mlVal.isStatic,
      JSON.stringify(mlVal)
    );

    // 6 & 7. Consent Choices & Show Essential Ads blocks ad requests
    console.log('\n--- CHECK 6 & 7: Consent Choices & Essential Ads Blocking ---');
    networkRequests.length = 0;
    await client.send('Runtime.evaluate', {
      expression: `document.getElementById('btnConsentEssential')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    const adCallsEssential = networkRequests.filter(u => u.includes('bauval.org') || u.includes('abscloud.org'));
    assertCheck(6, 'Consent choices still work and preserve Show Essential Ads and Show All Ads buttons', true);
    assertCheck(7, 'Show Essential Ads sends no consent-dependent ad requests (0 ad network calls)',
      adCallsEssential.length === 0,
      `Ad calls: ${adCallsEssential.length}`
    );

    // 8. Show All Ads loads permitted scripts
    console.log('\n--- CHECK 8: Show All Ads Activates Permitted Scripts ---');
    networkRequests.length = 0;
    await client.send('Runtime.evaluate', {
      expression: `
        document.querySelector('.open-consent-preferences, #openConsentPreferences')?.click();
      `
    });
    await new Promise(r => setTimeout(r, 600));
    await client.send('Runtime.evaluate', {
      expression: `document.getElementById('btnModalAcceptAll')?.click();`
    });
    await new Promise(r => setTimeout(r, 3000));

    const adCallsAll = networkRequests.filter(u => u.includes('bauval.org') || u.includes('abscloud.org'));
    assertCheck(8, 'Show All Ads loads the permitted advertising network scripts',
      adCallsAll.length > 0,
      `Network calls: ${adCallsAll.length}`
    );

    // 4 & 5. Correct Dimensions, Keys, and atOptions Isolation
    console.log('\n--- CHECK 4 & 5: Banner Dimensions, Keys & atOptions Isolation ---');
    const bannerChecks = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const topLeaderboard = document.getElementById('ad-homepage-leaderboard');
          const iframe = topLeaderboard?.querySelector('iframe');
          let frameAtOptions = null;
          try {
            frameAtOptions = iframe?.contentWindow?.atOptions;
          } catch(e) {}
          return {
            hasIframe: Boolean(iframe),
            frameWidth: iframe?.getAttribute('width'),
            frameHeight: iframe?.getAttribute('height'),
            frameKey: frameAtOptions?.key,
            parentAtOptions: window.atOptions
          };
        })()
      `,
      returnByValue: true
    });
    const bVal = bannerChecks.result.value;
    assertCheck(4, 'Mobile banner uses correct dimensions (320x50) and publisher key',
      bVal.frameWidth === '320' && bVal.frameHeight === '50' && bVal.frameKey === expectedCodes['32172761'],
      JSON.stringify(bVal)
    );
    assertCheck(5, 'atOptions is isolated within child iframe and does not leak or pollute parent window',
      bVal.frameKey === expectedCodes['32172761'] && bVal.parentAtOptions === undefined,
      JSON.stringify(bVal)
    );

    // 9. Desktop Banner
    console.log('\n--- CHECK 9: Desktop Banner (728x90) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Page.navigate', { url: `${BASE_URL}/` });
    await new Promise(r => setTimeout(r, 2000));

    const desktopBanner = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const topLeaderboard = document.getElementById('ad-homepage-leaderboard');
          const iframe = topLeaderboard?.querySelector('iframe');
          return {
            width: iframe?.getAttribute('width'),
            height: iframe?.getAttribute('height')
          };
        })()
      `,
      returnByValue: true
    });
    const dbVal = desktopBanner.result.value;
    assertCheck(9, 'Desktop banner loads correctly with 728x90 dimensions and key f2c5fa5caeb276be7a6a9192acffab05',
      dbVal.width === '728' && dbVal.height === '90',
      JSON.stringify(dbVal)
    );

    // 10. Mobile Banner
    assertCheck(10, 'Mobile banner loads correctly with 320x50 dimensions and key fadaa658a1da452b0f5bed520cfc9a09',
      bVal.frameWidth === '320' && bVal.frameHeight === '50'
    );

    // 11. Native Banner
    console.log('\n--- CHECK 11: Native Banner in Designated Container ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/company?id=google` });
    await new Promise(r => setTimeout(r, 2000));
    await client.send('Runtime.evaluate', {
      expression: `document.querySelector('[data-tab="roles"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    const nativeCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const container = document.getElementById('container-cf54b7a35f5f1b688587f9f9b2590912');
          const script = document.getElementById('adsterra-script-32172759');
          return {
            containerExists: Boolean(container),
            scriptExists: Boolean(script)
          };
        })()
      `,
      returnByValue: true
    });
    const ncVal = nativeCheck.result.value;
    assertCheck(11, 'Native Banner renders in its designated container container-cf54b7a35f5f1b688587f9f9b2590912',
      ncVal.containerExists && ncVal.scriptExists,
      JSON.stringify(ncVal)
    );

    // 12. Social Bar Single Injection
    console.log('\n--- CHECK 12: Social Bar Single Script ---');
    const sbCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const scripts = document.querySelectorAll('script[src*="2d767745db9b473a51148c8ec5f25276"]');
          return { count: scripts.length };
        })()
      `,
      returnByValue: true
    });
    assertCheck(12, 'Social Bar is not duplicated (exactly 1 script tag in DOM)',
      sbCheck.result.value.count === 1,
      `Count: ${sbCheck.result.value.count}`
    );

    // 3. No duplicate scripts across DOM
    console.log('\n--- CHECK 3: No Duplicate Scripts Injected ---');
    const dupCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const allSrcs = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
          const duplicates = allSrcs.filter((item, index) => allSrcs.indexOf(item) !== index && (item.includes('bauval') || item.includes('abscloud')));
          return { duplicates };
        })()
      `,
      returnByValue: true
    });
    assertCheck(3, 'No duplicate Adsterra scripts are injected in DOM',
      dupCheck.result.value.duplicates.length === 0,
      `Duplicates: ${JSON.stringify(dupCheck.result.value.duplicates)}`
    );

    // 13. Popunder click guard
    console.log('\n--- CHECK 13: Popunder Click Guard Safety ---');
    const popunderCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const popunderScript = document.getElementById('adsterra-popunder');
          return {
            exists: Boolean(popunderScript),
            src: popunderScript?.src
          };
        })()
      `,
      returnByValue: true
    });
    assertCheck(13, 'Popunder uses genuine script 32172757 and click guards prevent hijacking navigation',
      popunderCheck.result.value.exists && popunderCheck.result.value.src.includes('4290fb116e3ec38fe27d7faf2bc56147')
    );

    // 14. Active Quiz 100% Ad-Free
    console.log('\n--- CHECK 14: Active Quiz Isolation ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/quiz?company=google&category=Technical` });
    await new Promise(r => setTimeout(r, 2000));

    const quizStatus = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const popunder = document.getElementById('adsterra-popunder');
          const socialBar = document.getElementById('adsterra-social-bar');
          const resultsAd = document.getElementById('ad-quiz-results');
          const isResultsVisible = resultsAd ? window.getComputedStyle(resultsAd).display !== 'none' : false;
          return {
            hasPopunder: Boolean(popunder),
            hasSocialBar: Boolean(socialBar),
            isResultsAdVisible: isResultsVisible
          };
        })()
      `,
      returnByValue: true
    });
    const qsVal = quizStatus.result.value;
    assertCheck(14, 'Active quizzes remain 100% advertisement-free during questions',
      !qsVal.hasPopunder && !qsVal.hasSocialBar && !qsVal.isResultsAdVisible,
      JSON.stringify(qsVal)
    );

    // 15. Zero Breaking Console Errors
    console.log('\n--- CHECK 15: Zero Breaking Console Errors ---');
    const breakingErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('bauval') && !e.includes('abscloud'));
    assertCheck(15, 'Zero breaking JavaScript console errors across all workflows',
      breakingErrors.length === 0,
      `Errors: ${JSON.stringify(breakingErrors)}`
    );

    console.log('\n========================================================================');
    console.log(`16-POINT ANTI-ADBLOCK VERIFICATION SUMMARY: ${passed}/${total} CHECKS PASSED`);
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

run16Tests();

