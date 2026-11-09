/**
 * Browser Canonical Verification Script
 * Uses real headless Chrome to render each page, execute JavaScript,
 * and verify the rendered DOM's canonical link and content.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_LOCAL = 'http://localhost:8788';
const CANONICAL_BASE = 'https://prepwises.online';

async function fetchRenderedDom(url) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--virtual-time-budget=2500',
    '--dump-dom',
    url
  ];
  const { stdout } = await execFileAsync(CHROME_PATH, args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

function extractCanonical(html) {
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return match ? match[1] : null;
}

function extractTitle(html) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractH1(html) {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
}

async function verifyAll() {
  console.log('========================================================================');
  console.log('PREPWISE CANONICAL URL BROWSER VERIFICATION (REAL HEADLESS CHROME)');
  console.log('========================================================================\n');

  const companies = JSON.parse(fs.readFileSync('data/companies.json', 'utf8'));
  console.log(`Loaded ${companies.length} companies from data/companies.json.\n`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const results = [];

  console.log('--- PART 1: VERIFYING 22 COMPANY PROFILES ---');
  for (const comp of companies) {
    const slug = comp.id;
    const expectedCanonical = `${CANONICAL_BASE}/company?id=${encodeURIComponent(slug)}`;
    const pageUrl = `${BASE_LOCAL}/company?id=${encodeURIComponent(slug)}`;

    try {
      const html = await fetchRenderedDom(pageUrl);
      const canonical = extractCanonical(html);
      const title = extractTitle(html);
      const h1 = extractH1(html);

      const checks = {
        exactCanonicalMatch: canonical === expectedCanonical,
        notGenericCompany: canonical !== `${CANONICAL_BASE}/company` && canonical !== `${CANONICAL_BASE}/company.html`,
        notPagesDev: canonical && !canonical.includes('pages.dev'),
        contentMatchesCompany: (
          title.toLowerCase().includes(comp.shortName.toLowerCase()) ||
          title.toLowerCase().includes(comp.name.toLowerCase()) ||
          h1.toLowerCase().includes(comp.shortName.toLowerCase()) ||
          h1.toLowerCase().includes(comp.name.toLowerCase())
        )
      };

      const allOk = Object.values(checks).every(Boolean);
      totalTests++;
      if (allOk) {
        passedTests++;
        console.log(`  ✓ [COMPANY OK] ${slug.padEnd(14)} -> ${canonical}`);
        console.log(`      Content check: h1="${h1}"`);
      } else {
        failedTests++;
        console.error(`  ✗ [FAIL] ${slug}`);
        console.error(`      Expected canonical: ${expectedCanonical}`);
        console.error(`      Actual canonical:   ${canonical}`);
        console.error(`      Checks:`, checks);
      }

      results.push({
        type: 'company',
        slug,
        expectedCanonical,
        actualCanonical: canonical,
        title,
        h1,
        checks,
        passed: allOk
      });
    } catch (err) {
      failedTests++;
      totalTests++;
      console.error(`  ✗ [ERROR] ${slug}: ${err.message}`);
      results.push({
        type: 'company',
        slug,
        error: err.message,
        passed: false
      });
    }
  }

  console.log('\n--- PART 2: VERIFYING STATIC PUBLIC PAGES ---');
  const staticPages = [
    { route: '/', expected: `${CANONICAL_BASE}/`, name: 'Homepage' },
    { route: '/quiz', expected: `${CANONICAL_BASE}/quiz`, name: 'Quiz' },
    { route: '/about', expected: `${CANONICAL_BASE}/about`, name: 'About' },
    { route: '/contact', expected: `${CANONICAL_BASE}/contact`, name: 'Contact' },
    { route: '/privacy', expected: `${CANONICAL_BASE}/privacy`, name: 'Privacy Policy' },
    { route: '/terms', expected: `${CANONICAL_BASE}/terms`, name: 'Terms of Use' },
    { route: '/disclaimer', expected: `${CANONICAL_BASE}/disclaimer`, name: 'Disclaimer' }
  ];

  for (const page of staticPages) {
    const pageUrl = `${BASE_LOCAL}${page.route}`;
    try {
      const html = await fetchRenderedDom(pageUrl);
      const canonical = extractCanonical(html);
      const title = extractTitle(html);

      const checks = {
        exactCanonicalMatch: canonical === page.expected,
        notPagesDev: canonical && !canonical.includes('pages.dev'),
        hasTitle: title.length > 0
      };

      const allOk = Object.values(checks).every(Boolean);
      totalTests++;
      if (allOk) {
        passedTests++;
        console.log(`  ✓ [STATIC OK]  ${page.name.padEnd(15)} -> ${canonical}`);
      } else {
        failedTests++;
        console.error(`  ✗ [FAIL] ${page.name}`);
        console.error(`      Expected canonical: ${page.expected}`);
        console.error(`      Actual canonical:   ${canonical}`);
        console.error(`      Checks:`, checks);
      }

      results.push({
        type: 'static',
        name: page.name,
        route: page.route,
        expectedCanonical: page.expected,
        actualCanonical: canonical,
        title,
        checks,
        passed: allOk
      });
    } catch (err) {
      failedTests++;
      totalTests++;
      console.error(`  ✗ [ERROR] ${page.name}: ${err.message}`);
      results.push({
        type: 'static',
        name: page.name,
        error: err.message,
        passed: false
      });
    }
  }

  console.log('\n========================================================================');
  console.log(`FINAL RESULTS: ${passedTests} / ${totalTests} PASSED (Failed: ${failedTests})`);
  console.log('========================================================================\n');

  fs.writeFileSync('scripts/canonical_browser_results.json', JSON.stringify(results, null, 2), 'utf8');

  if (failedTests > 0) {
    process.exit(1);
  }
}

verifyAll().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

