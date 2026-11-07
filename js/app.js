/**
 * PrepWise — Main Application Logic (index.html)
 * Standard Country Filtering (strict country operations, zero GDP clutter),
 * Level-based filtering (Beginner to Legend), stealth native in-feed ads, and dynamic search.
 */

(function () {
  'use strict';

  // ---------- State ----------
  let allCompanies = [];
  let allCountries = [];
  let filteredCompanies = [];
  let activeLevel = '';
  let activeCountry = '';

  // ---------- DOM Elements ----------
  const companiesGrid = document.getElementById('companiesGrid');
  const searchInput = document.getElementById('searchInput');
  const countryFilter = document.getElementById('countryFilter');
  const categoryFilter = document.getElementById('categoryFilter');
  const filterCount = document.getElementById('filterCount');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');
  const levelPills = document.querySelectorAll('.level-pill');

  // ---------- Initialize ----------
  async function init() {
    try {
      const [companiesRes, countriesRes] = await Promise.all([
        fetch('data/companies.json'),
        fetch('data/countries.json')
      ]);

      if (!companiesRes.ok || !countriesRes.ok) {
        throw new Error('Failed to load companies or countries data');
      }

      allCompanies = await companiesRes.json();
      allCountries = await countriesRes.json();
      filteredCompanies = [...allCompanies];

      populateCountryDropdown(allCountries);
      renderCompanies(filteredCompanies);
      setupEventListeners();
    } catch (error) {
      console.error('Error loading data:', error);
      companiesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">😕</div>
          <h3>Failed to load companies database</h3>
          <p>Please refresh the page or check your connection.</p>
        </div>
      `;
    }
  }

  // ---------- Populate 50 Countries Dropdown (Clean, Normal Filter - No GDP Clutter) ----------
  function populateCountryDropdown(countries) {
    if (!countryFilter) return;

    // Sort alphabetically by country name
    const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name));
    
    countryFilter.innerHTML = `
      <option value="">🌍 All Countries</option>
      ${sorted.map(c => `
        <option value="${c.name}">${c.flag} ${c.name}</option>
      `).join('')}
    `;
  }

  // ---------- Render Companies (With Stealth Native Sponsored Cards In-Feed) ----------
  function renderCompanies(companies) {
    if (companies.length === 0) {
      companiesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>No companies operating in selected criteria</h3>
          <p>Try switching to "All Countries" or adjusting your search keywords.</p>
        </div>
      `;
      filterCount.textContent = '0 results found';
      return;
    }

    let cardsHtml = '';
    companies.forEach((company, index) => {
      cardsHtml += createCompanyCard(company);

    });

    companiesGrid.innerHTML = cardsHtml;
    
    const countryText = activeCountry ? ` operating in ${activeCountry}` : '';
    filterCount.textContent = `Showing ${companies.length} ${companies.length === 1 ? 'company' : 'companies'}${countryText}`;
  }

  function createCompanyCard(company) {
    const roles = company.jobRoles || [];
    const topRole = roles[0] || null;
    const salaryDisplay = topRole ? topRole.avgSalary : 'Competitive';

    const countryBadges = (company.countries || [company.headquarters]).slice(0, 3).map(c => 
      `<span class="country-badge">${c}</span>`
    ).join('');

    const levelBadge = activeLevel ? 
      `<span class="tag level-${activeLevel.toLowerCase()}">Level: ${activeLevel}</span>` : 
      `<span class="tag tag-region">4 Levels (Beginner → Legend)</span>`;

    return `
      <a href="company.html?id=${company.id}" class="company-card" data-company="${company.id}">
        <div class="company-card-header">
          <div class="company-logo" style="background:${company.logoBg};color:${company.logoColor};font-size:1.8rem;">
            ${company.logo}
          </div>
          <div class="company-info">
            <h3>${company.name}</h3>
            <span class="company-industry">${company.industry}</span>
          </div>
        </div>

        <div class="company-card-body">
          <p>${company.description}</p>
          
          <!-- Salary & Roles Highlight -->
          <div style="margin-bottom:var(--space-md); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px;">
            <span class="salary-tag">💰 ${salaryDisplay}</span>
            <span style="font-size:0.75rem; font-weight:700; color:var(--color-primary);">${roles.length} Hiring Roles ↗</span>
          </div>

          <div class="company-tags" style="margin-bottom: var(--space-sm);">
            ${levelBadge}
            <span class="tag tag-degree">${company.category}</span>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
            ${countryBadges}
            ${(company.countries && company.countries.length > 3) ? `<span class="country-badge">+${company.countries.length - 3} more</span>` : ''}
          </div>
        </div>

        <div class="company-card-footer">
          <span class="question-count">📝 50 Verified Questions</span>
          <span class="arrow">→</span>
        </div>
      </a>
    `;
  }

  // Stealth Native Sponsor Card 1 (Disguised as an elite accelerator / hiring company)
  function createStealthSponsorCard1() {
    return `
      <div class="company-card" style="border: 1.5px solid rgba(37, 99, 235, 0.4); background: linear-gradient(180deg, #ffffff 0%, #f0f7ff 100%);">
        <div class="company-card-header">
          <div class="company-logo" style="background:#dbeafe; color:#1d4ed8; font-size:1.8rem;">
            🚀
          </div>
          <div class="company-info">
            <div style="display:flex; align-items:center; gap:6px;">
              <h3 style="color:#1d4ed8;">TechAccelerate Fellowship</h3>
              <span class="ad-badge" style="margin:0;">Sponsored</span>
            </div>
            <span class="company-industry">Global Remote Hiring Partner</span>
          </div>
        </div>

        <div class="company-card-body">
          <p>Accelerated placement pipeline for engineering graduates. Direct interviews with top US, European, and Asian tech unicorns with 1-on-1 mentorship.</p>
          
          <div style="margin-bottom:var(--space-md); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px;">
            <span class="salary-tag" style="background:linear-gradient(135deg, #2563eb, #7c3aed);">💰 Avg: $115,000 / yr</span>
            <span style="font-size:0.75rem; font-weight:700; color:var(--color-primary);">Guaranteed Referrals ↗</span>
          </div>

          <div class="company-tags" style="margin-bottom: var(--space-sm);">
            <span class="tag tag-region">100% Remote / Global</span>
            <span class="tag level-advanced">Level: All Welcome</span>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
            <span class="country-badge">🇺🇸 United States</span>
            <span class="country-badge">🇮🇳 India</span>
            <span class="country-badge">🇪🇺 Europe</span>
          </div>
        </div>

        <div class="company-card-footer" style="background:rgba(37,99,235,0.06); margin:-16px; margin-top:auto; padding:12px 16px; border-radius:0 0 var(--radius-xl) var(--radius-xl);">
          <span class="question-count" style="color:var(--color-primary); font-weight:700;">⭐ Free Placement Application</span>
          <span class="arrow" style="background:var(--color-primary); color:white;">↗</span>
        </div>
      </div>
    `;
  }

  // Stealth Native Sponsor Card 2 (Disguised as high-demand cloud certification partner)
  function createStealthSponsorCard2() {
    return `
      <div class="company-card" style="border: 1.5px solid rgba(124, 58, 237, 0.4); background: linear-gradient(180deg, #ffffff 0%, #faf5ff 100%);">
        <div class="company-card-header">
          <div class="company-logo" style="background:#ede9fe; color:#7c3aed; font-size:1.8rem;">
            ☁️
          </div>
          <div class="company-info">
            <div style="display:flex; align-items:center; gap:6px;">
              <h3 style="color:#7c3aed;">Cloud Architect Academy</h3>
              <span class="ad-badge" style="margin:0;">Sponsored</span>
            </div>
            <span class="company-industry">AWS & Azure Certification Partner</span>
          </div>
        </div>

        <div class="company-card-body">
          <p>Get certified in AWS Solutions Architect & Kubernetes. Highest-paying technical skills for 2026 campus placements with interactive sandboxes.</p>
          
          <div style="margin-bottom:var(--space-md); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px;">
            <span class="salary-tag" style="background:linear-gradient(135deg, #7c3aed, #db2777);">💰 Avg: $142,000 / yr</span>
            <span style="font-size:0.75rem; font-weight:700; color:var(--color-secondary);">Official Voucher ↗</span>
          </div>

          <div class="company-tags" style="margin-bottom: var(--space-sm);">
            <span class="tag tag-degree">Cloud & DevOps</span>
            <span class="tag level-intermediate">Student Discount Available</span>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
            <span class="country-badge">Global Access</span>
            <span class="country-badge">Self-Paced Labs</span>
          </div>
        </div>

        <div class="company-card-footer" style="background:rgba(124,58,237,0.06); margin:-16px; margin-top:auto; padding:12px 16px; border-radius:0 0 var(--radius-xl) var(--radius-xl);">
          <span class="question-count" style="color:var(--color-secondary); font-weight:700;">🎁 Claim 50% Student Pass</span>
          <span class="arrow" style="background:var(--color-secondary); color:white;">↗</span>
        </div>
      </div>
    `;
  }

  // ---------- Filtering Logic (Normal Strict Country Filter) ----------
  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedCategory = categoryFilter.value;
    activeCountry = countryFilter.value;

    filteredCompanies = allCompanies.filter(company => {
      // 1. Search Query
      const matchesSearch = !searchTerm ||
        company.name.toLowerCase().includes(searchTerm) ||
        company.shortName.toLowerCase().includes(searchTerm) ||
        company.industry.toLowerCase().includes(searchTerm) ||
        company.description.toLowerCase().includes(searchTerm) ||
        (company.jobRoles && company.jobRoles.some(r => 
          r.title.toLowerCase().includes(searchTerm) || 
          r.keySkills.some(s => s.toLowerCase().includes(searchTerm))
        ));

      // 2. Strict Country Filter (Normal Filter behavior)
      let matchesCountry = true;
      if (activeCountry) {
        matchesCountry = Array.isArray(company.countries) && company.countries.includes(activeCountry);
      }

      // 3. Category / Sector Filter
      const matchesCategory = !selectedCategory || company.category === selectedCategory;

      return matchesSearch && matchesCountry && matchesCategory;
    });

    renderCompanies(filteredCompanies);
  }

  // ---------- Event Listeners ----------
  function setupEventListeners() {
    // Search with debounce
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilters, 200);
    });

    // Country filter (strict match)
    countryFilter.addEventListener('change', applyFilters);

    // Category filter
    categoryFilter.addEventListener('change', applyFilters);

    // Level selector pills
    levelPills.forEach(pill => {
      pill.addEventListener('click', () => {
        levelPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeLevel = pill.dataset.level || '';
        applyFilters();
      });
    });

    // Mobile menu toggle
    if (mobileMenuBtn && navMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        navMenu.classList.toggle('open');
      });
    }

    // Close mobile menu on link click
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }

  // ---------- Start ----------
  document.addEventListener('DOMContentLoaded', init);
})();
