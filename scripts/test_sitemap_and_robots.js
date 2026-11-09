/**
 * Test Suite: Sitemap and Robots.txt Verification
 */
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log('\n--- 1. Testing robots.txt ---');
  const robotsTxt = fs.readFileSync('robots.txt', 'utf8');
  assert(!robotsTxt.includes('YOUR-DOMAIN.example'), 'robots.txt does not contain YOUR-DOMAIN.example');
  assert(robotsTxt.includes('Sitemap: https://prepwises.online/sitemap.xml'), 'robots.txt has production sitemap URL');
  assert(robotsTxt.includes('Allow: /'), 'robots.txt allows root public crawling');
  assert(robotsTxt.includes('Disallow: /admin/'), 'robots.txt blocks /admin/');
  assert(robotsTxt.includes('Disallow: /api/'), 'robots.txt blocks /api/');
  assert(robotsTxt.includes('Disallow: /functions/'), 'robots.txt blocks /functions/');

  console.log('\n--- 2. Testing sitemap.xml structure and validity ---');
  const sitemapXml = fs.readFileSync('sitemap.xml', 'utf8');
  assert(!sitemapXml.includes('YOUR-DOMAIN.example'), 'sitemap.xml does not contain YOUR-DOMAIN.example');
  assert(sitemapXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'sitemap.xml starts with XML declaration');
  assert(sitemapXml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'sitemap.xml has valid schema namespace');

  // Extract all <loc> URLs
  const locMatches = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  assert(locMatches.length === 29, `sitemap.xml contains exactly 29 URLs (found ${locMatches.length})`);

  // Check all URLs start with canonical hostname
  const allCanonical = locMatches.every(url => url.startsWith('https://prepwises.online/'));
  assert(allCanonical, 'All URLs use canonical https://prepwises.online/ prefix');

  // Extract all <lastmod> dates and verify YYYY-MM-DD
  const lastmodMatches = [...sitemapXml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map(m => m[1]);
  assert(lastmodMatches.length === locMatches.length, 'Every URL entry has a <lastmod> tag');
  const validDates = lastmodMatches.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d)));
  assert(validDates, 'All <lastmod> dates are valid YYYY-MM-DD format');

  console.log('\n--- 3. Verifying 22 company slugs match data/companies.json ---');
  const companiesData = JSON.parse(fs.readFileSync('data/companies.json', 'utf8'));
  const validSlugs = new Set(companiesData.map(c => c.id));
  assert(validSlugs.size === 22, `22 companies exist in data/companies.json (found ${validSlugs.size})`);

  const companyUrls = locMatches.filter(url => url.includes('/company?id='));
  assert(companyUrls.length === 22, `sitemap.xml contains exactly 22 company URLs (found ${companyUrls.length})`);

  companyUrls.forEach(url => {
    const id = new URL(url).searchParams.get('id');
    assert(validSlugs.has(id), `Company slug "${id}" is in data/companies.json`);
  });

  console.log('\n--- 4. Verifying Google Search Console Verification File ---');
  assert(fs.existsSync('google38aad5fbd742b3b6.html'), 'google38aad5fbd742b3b6.html exists in root');
  const gscContent = fs.readFileSync('google38aad5fbd742b3b6.html', 'utf8').trim();
  assert(gscContent === 'google-site-verification: google38aad5fbd742b3b6.html', 'google38aad5fbd742b3b6.html has exact verification body');

  console.log('\n--- 5. Testing URL HTTP responses against local server (http://localhost:8788) ---');
  for (const url of locMatches) {
    const localUrl = url.replace('https://prepwises.online', 'http://localhost:8788');
    try {
      const res = await fetch(localUrl, { method: 'HEAD', redirect: 'follow' });
      assert(res.status === 200, `${url} resolves to HTTP 200 (status: ${res.status})`);
    } catch (err) {
      assert(false, `${url} failed to fetch: ${err.message}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

