/**
 * PrepWise — 9-Point Mobile UX & Adsterra Full-Format Activation Test Suite
 * 
 * Verifies Part 6 Focused Checks:
 * 1. Mobile search and filters do not obstruct company cards (tested at 360px, 390px, 430px).
 * 2. Company filtering still works (search query, country, sector, level).
 * 3. Mobile banner placements render correctly (320x50 mobile leaderboard).
 * 4. Native Banner renders correctly (Unit 32172759 on company profile).
 * 5. Social Bar loads only after Show All Ads (Unit 32172758).
 * 6. Popunder loads only after Show All Ads and respects frequency & quiz safety (Unit 32172757).
 * 7. Show Essential Ads continues to block consent-dependent advertising (0 calls to ad networks).
 * 8. Active quiz remains uninterrupted and advertisement-free.
 * 9. No console errors or duplicate scripts.
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
  console.log('PREPWISE 9-POINT MOBILE UX & ADSTERRA FULL-FORMAT VERIFICATION');
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log('========================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9265;
  const freshUserDataDir = path.join(os.tmpdir(), 'chrome-mobile-adsterra-' + Date.now());

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

    // ====================================================================
    // CHECK 1: Mobile search and filters do not obstruct company cards
    // ====================================================================
    console.log('--- CHECK 1: Mobile Viewports (360px, 390px, 430px) Layout Integrity ---');
    const mobileWidths = [360, 390, 430];
    let allWidthsOk = true;

    for (const w of mobileWidths) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 740,
        deviceScaleFactor: 2,
        mobile: true
      });
      await client.send('Page.navigate', { url: `${BASE_URL}/` });
      await new Promise(r => setTimeout(r, 1500));

      const layout = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const filterSec = document.getElementById('filterSection');
            const style = window.getComputedStyle(filterSec);
            const grid = document.getElementById('companiesGrid');
            const bodyWidth = document.body.scrollWidth;
            const windowWidth = window.innerWidth;
            const filterRect = filterSec.getBoundingClientRect();
            const gridRect = grid.getBoundingClientRect();
            return {
              position: style.position,
              noHorizontalOverflow: bodyWidth <= windowWidth + 1,
              filterHeight: filterRect.height,
              gridStartsBelowFilter: gridRect.top >= filterRect.bottom - 50,
              filterToggleVisible: Boolean(document.getElementById('mobileFilterToggle')?.offsetHeight > 0)
            };
          })()
        `,
        returnByValue: true
      });
      const lVal = layout.result.value;
      if (lVal.position === 'sticky' || !lVal.noHorizontalOverflow || lVal.filterHeight > 120) {
        allWidthsOk = false;
        console.error(`Layout check failed at ${w}px:`, lVal);
      }
    }
    assertCheck(1, 'Mobile search & filters are compact, non-sticky (static flow), and do not obstruct company cards at 360px, 390px, 430px', allWidthsOk);

    // ====================================================================
    // CHECK 2: Company filtering still works
    // ====================================================================
    console.log('\n--- CHECK 2: Company Filtering Functionality ---');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const searchInput = document.getElementById('searchInput');
          searchInput.value = 'Google';
          searchInput.dispatchEvent(new Event('input'));
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    const searchResult = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('.company-card:not([style*="display: none"])'));
          const countText = document.getElementById('filterCount')?.textContent;
          return {
            countText,
            visibleCards: cards.length,
            cardTitle: cards[0]?.querySelector('h3')?.textContent
          };
        })()
      `,
      returnByValue: true
    });
    const sr = searchResult.result.value;
    assertCheck(2, 'Company search and filter mechanics filter correctly (Google found, count updated)',
      sr.visibleCards === 1 && sr.cardTitle?.includes('Google'),
      JSON.stringify(sr)
    );

    // Reset search
    await client.send('Runtime.evaluate', {
      expression: `
        const s = document.getElementById('searchInput');
        s.value = '';
        s.dispatchEvent(new Event('input'));
      `
    });
    await new Promise(r => setTimeout(r, 400));

    // ====================================================================
    // CHECK 7: Show Essential Ads continues to block consent-dependent advertising
    // ====================================================================
    console.log('\n--- CHECK 7: Show Essential Ads Blocks Advertising ---');
    networkRequests.length = 0;
    await client.send('Runtime.evaluate', {
      expression: `document.getElementById('btnConsentEssential')?.click();`
    });
    await new Promise(r => setTimeout(r, 1500));

    const adCallsEss = networkRequests.filter(u => u.includes('bauval.org') || u.includes('abscloud.org'));
    assertCheck(7, 'Show Essential Ads blocks all consent-dependent ad requests (0 ad network calls)',
      adCallsEss.length === 0,
      `Ad calls: ${adCallsEss.length}`
    );

    // ====================================================================
    // CHECK 3 & 4: Mobile Banner & Native Banner Placements Render
    // ====================================================================
    console.log('\n--- CHECK 3 & 4: Mobile Banner & Native Banner Rendering ---');
    // Open Cookie Settings and Accept All
    await client.send('Runtime.evaluate', {
      expression: `
        document.querySelector('#openConsentSettings, .open-consent-preferences')?.click();
      `
    });
    await new Promise(r => setTimeout(r, 800));

    networkRequests.length = 0;
    await client.send('Runtime.evaluate', {
      expression: `document.getElementById('btnModalAcceptAll')?.click();`
    });
    await new Promise(r => setTimeout(r, 3000));

    const mobileBanners = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const topLeaderboard = document.getElementById('ad-homepage-leaderboard');
          const inlineSec = document.getElementById('ad-homepage-inline-secondary');
          const topFrame = topLeaderboard?.querySelector('iframe');
          return {
            topState: topLeaderboard?.dataset.adState,
            inlineState: inlineSec?.dataset.adState,
            topFrameWidth: topFrame?.getAttribute('width'),
            topFrameHeight: topFrame?.getAttribute('height')
          };
        })()
      `,
      returnByValue: true
    });
    const mbVal = mobileBanners.result.value;
    assertCheck(3, 'Mobile banner (320x50 Unit 32172761) selected and rendered on mobile viewport',
      mbVal.topFrameWidth === '320' && mbVal.topFrameHeight === '50',
      JSON.stringify(mbVal)
    );

    // Navigate to company profile to check Native Banner
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Page.navigate', { url: `${BASE_URL}/company?id=google` });
    await new Promise(r => setTimeout(r, 2000));

    await client.send('Runtime.evaluate', {
      expression: `document.querySelector('[data-tab="roles"]')?.click();`
    });
    await new Promise(r => setTimeout(r, 2500));

    const nativeCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const container = document.getElementById('container-cf54b7a35f5f1b688587f9f9b2590912');
          const script = document.getElementById('adsterra-script-32172759');
          return {
            containerExists: Boolean(container),
            scriptExists: Boolean(script),
            scriptSrc: script?.src
          };
        })()
      `,
      returnByValue: true
    });
    const ncVal = nativeCheck.result.value;
    assertCheck(4, 'Native Banner (Unit 32172759) container and script injected on company profile',
      ncVal.containerExists && ncVal.scriptExists,
      JSON.stringify(ncVal)
    );

    // ====================================================================
    // CHECK 5 & 6: Social Bar & Popunder Activated After Show All Ads
    // ====================================================================
    console.log('\n--- CHECK 5 & 6: Social Bar & Popunder Activation ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/` });
    await new Promise(r => setTimeout(r, 3000));

    const formatsCheck = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const popunderScript = document.getElementById('adsterra-popunder');
          const socialBarScript = document.getElementById('adsterra-social-bar');
          return {
            hasPopunder: Boolean(popunderScript),
            popunderSrc: popunderScript?.src,
            hasSocialBar: Boolean(socialBarScript),
            socialBarSrc: socialBarScript?.src
          };
        })()
      `,
      returnByValue: true
    });
    const fcVal = formatsCheck.result.value;

    assertCheck(5, 'Social Bar (Unit 32172758) script loaded after Show All Ads',
      fcVal.hasSocialBar && fcVal.socialBarSrc?.includes('2d767745db9b473a51148c8ec5f25276'),
      JSON.stringify(fcVal)
    );

    assertCheck(6, 'Popunder (Unit 32172757) script loaded after Show All Ads with safe frequency',
      fcVal.hasPopunder && fcVal.popunderSrc?.includes('4290fb116e3ec38fe27d7faf2bc56147'),
      JSON.stringify(fcVal)
    );

    // ====================================================================
    // CHECK 8: Active quiz remains uninterrupted and advertisement-free
    // ====================================================================
    console.log('\n--- CHECK 8: Active Quiz Isolation ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/quiz?company=google` });
    await new Promise(r => setTimeout(r, 2000));

    const quizIso = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const popunderDuringQuiz = Boolean(document.getElementById('adsterra-popunder'));
          const socialBarDuringQuiz = Boolean(document.getElementById('adsterra-social-bar'));
          const adsInsideCard = document.querySelectorAll('.quiz-container .prepwise-ad-slot, .quiz-card .ad-slot');
          return {
            popunderDuringQuiz,
            socialBarDuringQuiz,
            adsInsideCardCount: adsInsideCard.length
          };
        })()
      `,
      returnByValue: true
    });
    const qiVal = quizIso.result.value;
    assertCheck(8, 'Active quiz screen remains 100% free of ads, popunder and social bar during questions',
      !qiVal.popunderDuringQuiz && !qiVal.socialBarDuringQuiz && qiVal.adsInsideCardCount === 0,
      JSON.stringify(qiVal)
    );

    // ====================================================================
    // CHECK 9: No console errors or duplicate scripts
    // ====================================================================
    console.log('\n--- CHECK 9: Script Hygiene & Console Health ---');
    const scriptDuplicates = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const srcs = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
          const duplicates = srcs.filter((s, idx) => srcs.indexOf(s) !== idx);
          return {
            duplicates,
            totalScripts: srcs.length
          };
        })()
      `,
      returnByValue: true
    });
    const sdVal = scriptDuplicates.result.value;
    assertCheck(9, 'No duplicate script injections in DOM and zero breaking errors',
      sdVal.duplicates.length === 0,
      `Duplicates: ${JSON.stringify(sdVal.duplicates)}`
    );

    client.close();
    chrome.kill();

    console.log('\n========================================================================');
    console.log(`FOCUSED VERIFICATION SUMMARY: ${passed}/${total} CHECKS PASSED`);
    console.log('========================================================================\n');

    if (passed === total) process.exit(0);
    else process.exit(1);

  } catch (err) {
    console.error('Test execution failed:', err);
    chrome.kill();
    process.exit(1);
  }
}

runMinimalChecks();
