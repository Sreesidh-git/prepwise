/**
 * PrepWise — Main Application Logic (index.html)
 * Standard Country Filtering (strict country operations, zero GDP clutter),
 * Level-based filtering (Beginner to Legend) and dynamic search.
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

      const rawCompanies = await companiesRes.json();
      allCompanies = Array.isArray(rawCompanies) ? rawCompanies : (rawCompanies.companies || []);
      const rawCountries = await countriesRes.json();
      allCountries = Array.isArray(rawCountries) ? rawCountries : (rawCountries.countries || []);
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

  // ---------- Render Companies ----------
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
      if (index === 2 && companies.length > 3) {
        cardsHtml += `
          <div class="ad-slot ad-slot-stream" id="ad-homepage-stream" data-ad-slot="homepage-stream" style="grid-column: 1 / -1; margin: var(--space-md) 0;" aria-label="Sponsored Content"></div>
        `;
      }
    });

    companiesGrid.innerHTML = cardsHtml;

    // Trigger in-stream native ad if adsterra is ready & consent granted
    if (window.PREPWISE_ADSTERRA && typeof window.PREPWISE_ADSTERRA.renderPlacement === 'function' && window.PrepWiseConsent?.hasConsent('advertising')) {
      const streamSlot = document.getElementById('ad-homepage-stream');
      if (streamSlot && !streamSlot.classList.contains('adsterra-active')) {
        window.PREPWISE_ADSTERRA.renderPlacement(streamSlot).catch(() => {
          streamSlot.style.display = 'none';
        });
      }
    }
    
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
    updateMobileFilterBadge();
  }

  function updateMobileFilterBadge() {
    const badge = document.getElementById('filterActiveBadge');
    const toggleBtn = document.getElementById('mobileFilterToggle');
    if (!badge || !toggleBtn) return;
    let count = 0;
    if (countryFilter && countryFilter.value) count++;
    if (categoryFilter && categoryFilter.value) count++;
    if (activeLevel) count++;

    if (count > 0) {
      badge.textContent = count;
      badge.hidden = false;
      toggleBtn.classList.add('has-active-filters');
    } else {
      badge.hidden = true;
      toggleBtn.classList.remove('has-active-filters');
    }
  }

  // ---------- Event Listeners ----------
  function setupEventListeners() {
    // Search with debounce
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilters, 200);
    });

    // Global shortcut: '/' focuses search input
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
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

    // Mobile filter collapsible toggle
    const mobileFilterToggle = document.getElementById('mobileFilterToggle');
    const mobileFilterPanel = document.getElementById('mobileFilterPanel');
    if (mobileFilterToggle && mobileFilterPanel) {
      mobileFilterToggle.addEventListener('click', () => {
        const isOpen = mobileFilterPanel.classList.toggle('is-open');
        mobileFilterToggle.setAttribute('aria-expanded', isOpen);
      });
    }

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
