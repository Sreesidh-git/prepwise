/**
 * PrepWise — Company Detail Logic (company.html)
 * Handles company profile, milestones, test patterns, 
 * Job Roles & Salary Benchmarks, Difficulty Levels (Beginner to Legend), and related companies.
 */

(function () {
  'use strict';

  // ---------- Parse URL params ----------
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get('id') || 'tcs';
  let selectedLevel = '';

  // ---------- DOM Elements ----------
  const companyHeader = document.getElementById('companyHeader');
  const tabsContainer = document.getElementById('tabsContainer');
  const overviewContent = document.getElementById('overviewContent');
  const overviewSidebar = document.getElementById('overviewSidebar');
  const rolesGrid = document.getElementById('rolesGrid');
  const testPatternContent = document.getElementById('testPatternContent');
  const categoryGrid = document.getElementById('categoryGrid');
  const startAllBtn = document.getElementById('startAllBtn');
  const breadcrumbCompany = document.getElementById('breadcrumbCompany');
  const nextSteps = document.getElementById('nextSteps');
  const relatedCompanies = document.getElementById('relatedCompanies');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');

  // ---------- Category Metadata ----------
  const categoryIcons = {
    'Quantitative Aptitude': '📊',
    'Logical Reasoning': '🧩',
    'Verbal Ability': '📚',
    'Technical': '💻'
  };

  let cachedCompany = null;
  let cachedQuestionStats = null;

  // ---------- Initialize ----------
  async function init() {
    setupMobileMenu();
    setupTabs();

    try {
      const [companiesRes, questionsRes] = await Promise.all([
        fetch('data/companies.json'),
        fetch(`data/questions/${companyId}.json`).catch(() => null)
      ]);

      if (!companiesRes.ok) throw new Error('Failed to load companies data');
      const rawCompanies = await companiesRes.json();
      const companies = Array.isArray(rawCompanies) ? rawCompanies : (rawCompanies.companies || []);
      const company = companies.find(c => (c.id && c.id.toLowerCase() === companyId.toLowerCase()) || (c.slug && c.slug.toLowerCase() === companyId.toLowerCase()));

      if (!company) {
        showError('Company not found');
        return;
      }
      cachedCompany = company;

      let questionStats = {
        'Quantitative Aptitude': 15,
        'Logical Reasoning': 12,
        'Verbal Ability': 10,
        'Technical': 13,
        total: 50
      };

      if (questionsRes && questionsRes.ok) {
        const qData = await questionsRes.json();
        if (qData.questions) {
          questionStats = {
            'Quantitative Aptitude': qData.questions.filter(q => q.category === 'Quantitative Aptitude').length,
            'Logical Reasoning': qData.questions.filter(q => q.category === 'Logical Reasoning').length,
            'Verbal Ability': qData.questions.filter(q => q.category === 'Verbal Ability').length,
            'Technical': qData.questions.filter(q => q.category === 'Technical').length,
            total: qData.questions.length
          };
        }
      }
      cachedQuestionStats = questionStats;

      document.title = `${company.name} Interview Prep, Roles & Salaries — PrepWise`;
      breadcrumbCompany.textContent = company.shortName || company.name;

      renderHeader(company);
      renderOverview(company);
      renderRoles(company);
      renderTestPattern(company);
      renderPracticeCategories(company, questionStats);
      setupPracticeLevelSelector();
      renderRelatedCompanies(companies, company);

      tabsContainer.style.display = 'block';
      nextSteps.style.display = 'block';
    } catch (err) {
      console.error(err);
      showError('Could not load company details. Please try again.');
    }
  }

  // ---------- Render Header ----------
  function renderHeader(company) {
    const countriesList = (company.countries || ['Global']).slice(0, 5).join(', ');

    companyHeader.innerHTML = `
      <div class="company-header-top">
        <div class="company-logo-lg" style="background:${company.logoBg}; color:${company.logoColor}; font-size: 2.2rem;">
          ${company.logo}
        </div>
        <div>
          <h1>${company.name} (${company.shortName})</h1>
          <div class="company-subtitle">
            ${company.industry} · Headquarters: ${company.headquarters}
          </div>
          <div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
            <span style="font-size:0.75rem; font-weight:700; color:var(--color-text-secondary);">🌍 Major Operations:</span>
            ${(company.countries || []).slice(0, 4).map(c => `<span class="country-badge">${c}</span>`).join('')}
            ${(company.countries && company.countries.length > 4) ? `<span class="country-badge">+${company.countries.length - 4} countries</span>` : ''}
          </div>
        </div>
      </div>
      <div class="company-quick-stats">
        <div class="quick-stat">
          <div class="stat-value">${company.founded}</div>
          <div class="stat-label">Founded</div>
        </div>
        <div class="quick-stat">
          <div class="stat-value">${company.employees}</div>
          <div class="stat-label">Employees</div>
        </div>
        <div class="quick-stat">
          <div class="stat-value">${company.revenue}</div>
          <div class="stat-label">Revenue</div>
        </div>
        <div class="quick-stat">
          <div class="stat-value">${(company.jobRoles || []).length} Roles</div>
          <div class="stat-label">Hiring Tracks</div>
        </div>
      </div>
    `;
  }

  // ---------- Render Overview ----------
  function renderOverview(company) {
    const milestonesHtml = (company.milestones || []).map(m => `
      <div class="milestone-item">
        <div class="milestone-year">${m.year}</div>
        <div class="milestone-text">${m.text}</div>
      </div>
    `).join('');

    overviewContent.innerHTML = `
      <h2>About ${company.shortName}</h2>
      <p>${company.description}</p>
      
      <h3>History & Evolution</h3>
      <p>${company.history}</p>

      <h3>Hiring & Interview Process Overview</h3>
      <p>${company.interviewProcess}</p>

      <!-- Reserved for a future responsive ad integration. Kept empty until enabled. -->
      <div class="ad-slot ad-slot-inline" id="ad-company-inline" data-ad-slot="company-inline" data-ad-trigger="overview-render" aria-label="Advertisement"></div>

      <h3>Key Milestones</h3>
      <div class="milestone-list">
        ${milestonesHtml}
      </div>
    `;

    overviewSidebar.innerHTML = `
      <div class="sidebar-card">
        <h3>Company Factsheet</h3>
        <ul class="sidebar-list">
          <li><span class="label">CEO / Leadership</span><span class="value">${company.ceo}</span></li>
          <li><span class="label">Headquarters</span><span class="value">${company.headquarters}</span></li>
          <li><span class="label">Founded</span><span class="value">${company.founded}</span></li>
          <li><span class="label">Global Workforce</span><span class="value">${company.employees}</span></li>
          <li><span class="label">Annual Revenue</span><span class="value">${company.revenue}</span></li>
          <li><span class="label">Target Degrees</span><span class="value">${(company.degrees || []).join(', ')}</span></li>
          <li><span class="label">Official Portal</span><span class="value"><a href="${company.website}" target="_blank" rel="noopener">Visit Site ↗</a></span></li>
        </ul>
      </div>

      <div class="sidebar-card" style="background: linear-gradient(135deg, var(--color-primary-light), var(--color-secondary-light));">
        <h3>💼 Explore Job Roles & Salaries</h3>
        <p style="font-size:0.875rem; color:var(--color-text); margin-bottom:var(--space-md);">
          Review compensation packages for ${(company.jobRoles || []).length} positions and launch role-specific mock tests.
        </p>
        <button class="quiz-btn quiz-btn-primary" style="width:100%; justify-content:center;" onclick="document.querySelector('[data-tab=roles]').click()">
          View Roles & Salaries →
        </button>
      </div>

      <!-- Reserved for a future responsive ad integration. Kept empty until enabled. -->
      <div class="ad-slot ad-slot-sidebar" id="ad-company-sidebar" data-ad-slot="company-sidebar" data-ad-trigger="overview-render" aria-label="Advertisement"></div>

    `;
  }

  // ---------- Render Roles & Salaries ----------
  function renderRoles(company) {
    if (!rolesGrid) return;
    const roles = company.jobRoles || [];

    if (roles.length === 0) {
      rolesGrid.innerHTML = '<p class="text-muted">No specific roles listed for this company.</p>';
      return;
    }

    rolesGrid.innerHTML = roles.map(role => {
      const skillsHtml = (role.keySkills || []).map(s => `<span class="skill-chip">${s}</span>`).join('');
      const roadmapHtml = (role.prepRoadmap || []).map(p => `<li>${p}</li>`).join('');
      const roundsHtml = (role.interviewRounds || []).map(r => `<li>${r}</li>`).join('');

      // Fresher badge & eligibility
      const isFresher = role.isFresherFocus || (role.experience && role.experience.includes('0'));
      const fresherPill = isFresher ? `
        <span class="fresher-badge-pill">🎓 FRESHERS BATCH 2025/2026</span>
      ` : '';

      // Detailed Job Description & Day-to-Day Duties
      const jdHtml = role.jobDescription ? `
        <div style="font-size:0.85rem; color:var(--color-text-secondary); line-height:1.6; margin-bottom:var(--space-md);">
          ${role.jobDescription}
        </div>
      ` : '';

      const dutiesHtml = (role.dayToDayDuties && role.dayToDayDuties.length > 0) ? `
        <div class="role-prep-box" style="background:#fff; border:1px solid #e2e8f0;">
          <strong style="color:#000;">💼 Day-to-Day Responsibilities for Freshers:</strong>
          <ul>
            ${role.dayToDayDuties.map(d => `<li>${d}</li>`).join('')}
          </ul>
        </div>
      ` : '';

      // Eligibility & Cutoff criteria
      const eligibilityHtml = role.fresherEligibility ? `
        <div style="background:#fefce8; border:1px dashed #facc15; border-radius:var(--radius-md); padding:8px 12px; margin-bottom:var(--space-md); font-size:0.75rem; color:#713f12;">
          <strong>📋 Fresher Eligibility:</strong> ${role.fresherEligibility}
        </div>
      ` : '';

      // In-Hand CTC breakdown
      let ctcBreakdownHtml = '';
      if (role.ctcBreakdown) {
        const rows = Object.entries(role.ctcBreakdown).map(([k, v]) => `
          <div class="ctc-row">
            <span class="ctc-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span>
            <span class="ctc-value">${v}</span>
          </div>
        `).join('');
        ctcBreakdownHtml = `
          <div class="ctc-box">
            <strong style="font-size:0.75rem; text-transform:uppercase; color:#0f172a; display:block; margin-bottom:4px;">💰 Detailed Fresher CTC & Salary Structure:</strong>
            ${rows}
          </div>
        `;
      }

      const encodedRole = encodeURIComponent(role.title);
      const targetCat = encodeURIComponent(role.targetCategory || 'Technical');
      const targetLevel = encodeURIComponent(role.targetLevel || 'Intermediate');

      return `
        <div class="role-card">
          <div class="role-card-top">
            <div>
              <div style="margin-bottom:4px;">${fresherPill}</div>
              <h4>${role.title}</h4>
            </div>
            <span class="salary-tag">${role.avgSalary}</span>
          </div>

          <div class="role-experience">
            🕒 Experience: ${role.experience} · Level: <span class="tag level-${(role.targetLevel || 'intermediate').toLowerCase()}">${role.level}</span>
          </div>

          ${eligibilityHtml}
          ${jdHtml}
          ${ctcBreakdownHtml}
          ${dutiesHtml}

          <div style="margin-bottom: var(--space-sm);">
            <strong style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); letter-spacing:0.04em;">Required Skills & Tools:</strong>
            <div class="skills-chips" style="margin-top:4px;">
              ${skillsHtml}
            </div>
          </div>

          <div class="role-prep-box">
            <strong>🎯 4-Phase Fresher Placement Roadmap:</strong>
            <ul>
              ${roadmapHtml}
            </ul>
          </div>

          <div class="role-prep-box" style="background:#fff; border:1px dashed var(--color-border);">
            <strong>📋 Fresher Interview Selection Rounds:</strong>
            <ul>
              ${roundsHtml}
            </ul>
          </div>

          <a href="quiz.html?company=${company.id}&category=${targetCat}&role=${encodedRole}&level=${targetLevel}" class="prepare-role-btn">
            🚀 Prepare Specifically for This Fresher Role →
          </a>
        </div>
      `;
    }).join('');

    // Dedicated Student Internship Card with Direct Official Application Link
    const careerUrl = company.careersUrl || company.website || 'https://careers.google.com/';
    const isTech = company.category === 'Big Tech';
    const stipendStr = isTech ? '$7,500 - $9,000 / month · ₹85,000 - ₹1,25,000 / mo' : '₹35,000 - ₹60,000 / month';

    const internshipCard = `
      <div class="role-card" style="border: 2px solid #000000; background: linear-gradient(180deg, #ffffff 0%, #fefce8 100%);">
        <div class="role-card-top">
          <div>
            <span class="fresher-badge-pill" style="background:#000000; color:#facc15; border-color:#facc15;">⭐ STUDENT INTERNSHIP & PPO TRACK</span>
            <h4 style="margin-top:6px; color:#000000;">${company.shortName} Software Engineering Summer & 6-Month Intern</h4>
          </div>
          <span class="salary-tag" style="background:linear-gradient(135deg, #000000, #1f2937); border:1.5px solid #facc15; color:#facc15;">💰 ${stipendStr}</span>
        </div>

        <div class="role-experience">
          🕒 Duration: 2 to 6 Months · Batches: <strong>2026, 2027 & 2028 Passing Out</strong>
        </div>

        <div style="background:#fff; border:1px solid #facc15; border-radius:var(--radius-md); padding:8px 12px; margin-bottom:var(--space-md); font-size:0.78rem; color:#854d0e;">
          🎯 <strong>Direct PPO Conversion:</strong> Interns demonstrating strong execution receive Pre-Placement Offers (PPO) for full-time employment prior to final college semester.
        </div>

        <div class="role-prep-box" style="background:#fff; border:1px solid #e2e8f0;">
          <strong style="color:#000000;">📋 Internship Application Requirements:</strong>
          <ul>
            <li>Currently enrolled in an accredited B.E / B.Tech / M.Tech / MCA degree</li>
            <li>Proficiency in at least one core language (Java, C++, Python, or Go)</li>
            <li>Basic knowledge of Data Structures, Git, and web technologies</li>
            <li>No active academic backlogs at the start of internship term</li>
          </ul>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; margin-top:auto;">
          <a href="${careerUrl}" target="_blank" rel="noopener" class="prepare-role-btn" style="background:#000000; color:#facc15; border:1.5px solid #facc15; font-weight:800;">
            🔗 Apply on Official ${company.shortName} Career Portal ↗
          </a>
          <a href="quiz.html?company=${company.id}&category=Technical&level=Intermediate" class="prepare-role-btn" style="background:var(--color-surface); color:var(--color-text); border:1.5px solid var(--color-border);">
            📝 Practice ${company.shortName} Internship Test Questions →
          </a>
        </div>
      </div>
    `;

    rolesGrid.innerHTML += internshipCard;
  }

  // ---------- Render Test Pattern ----------
  function renderTestPattern(company) {
    const pattern = company.testPattern;
    if (!pattern) {
      testPatternContent.innerHTML = '<p class="text-muted">Test pattern information coming soon.</p>';
      return;
    }

    const sectionsRows = (pattern.sections || []).map(sec => `
      <tr>
        <td><strong>${sec.name}</strong></td>
        <td>${sec.questions} Questions</td>
        <td>${sec.duration}</td>
        <td>${sec.description}</td>
      </tr>
    `).join('');

    const tipsHtml = (company.tips || []).map(tip => `
      <li>
        <span class="tip-icon">✓</span>
        <div>${tip}</div>
      </li>
    `).join('');

    testPatternContent.innerHTML = `
      <div class="test-pattern-card">
        <h3>${pattern.name} — Exam Structure</h3>
        <p class="text-muted mb-md"><strong>Total Duration:</strong> ${pattern.totalDuration}</p>
        <div style="overflow-x:auto;">
          <table class="pattern-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Questions</th>
                <th>Time Allowed</th>
                <th>Topics Covered</th>
              </tr>
            </thead>
            <tbody>
              ${sectionsRows}
            </tbody>
          </table>
        </div>
      </div>

      <div class="test-pattern-card">
        <h3>Preparation Strategy & Expert Tips</h3>
        <ul class="tips-list">
          ${tipsHtml}
        </ul>
      </div>
    `;
  }

  // ---------- Setup Practice Level Selector ----------
  function setupPracticeLevelSelector() {
    const buttons = document.querySelectorAll('#practiceLevelSelector .level-pill');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedLevel = btn.dataset.practiceLevel || '';
        renderPracticeCategories(cachedCompany, cachedQuestionStats);
      });
    });
  }

  // ---------- Render Practice Categories ----------
  function renderPracticeCategories(company, stats) {
    const categories = [
      { name: 'Quantitative Aptitude', desc: 'Arithmetic, Algebra, Percentages & P&C' },
      { name: 'Logical Reasoning', desc: 'Puzzles, Coding-Decoding & Arrangements' },
      { name: 'Verbal Ability', desc: 'Grammar, Comprehension & Sentence Correction' },
      { name: 'Technical', desc: 'DSA, DBMS, OOP & Core Programming' }
    ];

    const levelQuery = selectedLevel ? `&level=${encodeURIComponent(selectedLevel)}` : '';

    categoryGrid.innerHTML = categories.map(cat => {
      const count = stats[cat.name] || 0;
      const icon = categoryIcons[cat.name] || '📝';
      const encodedCategory = encodeURIComponent(cat.name);
      return `
        <a href="quiz.html?company=${company.id}&category=${encodedCategory}${levelQuery}" class="category-card">
          <div class="category-icon">${icon}</div>
          <h4>${cat.name}</h4>
          <p class="text-xs text-muted" style="margin-bottom:var(--space-sm);">${cat.desc}</p>
          <span class="category-count">${count} Questions Available</span>
          ${selectedLevel ? `<div style="margin-top:6px;"><span class="tag level-${selectedLevel.toLowerCase()}">Level: ${selectedLevel}</span></div>` : ''}
        </a>
      `;
    }).join('');

    startAllBtn.href = `quiz.html?company=${company.id}&category=all${levelQuery}`;
    startAllBtn.textContent = `🚀 Start Full Assessment (${stats.total || 50} Questions)${selectedLevel ? ' — ' + selectedLevel + ' Level' : ''}`;
  }

  // ---------- Render Related Companies ----------
  function renderRelatedCompanies(companies, currentCompany) {
    const others = companies
      .filter(c => c.id !== currentCompany.id)
      .slice(0, 4);

    relatedCompanies.innerHTML = others.map(c => `
      <a href="company.html?id=${c.id}" class="next-step-link">
        <span class="step-emoji">${c.logo}</span>
        <div>
          <div>${c.shortName}</div>
          <div class="text-xs text-muted">${c.industry}</div>
        </div>
      </a>
    `).join('');
  }

  // ---------- Tab Switching ----------
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePanel = document.getElementById(`tab-${target}`);
        if (activePanel) activePanel.classList.add('active');
      });
    });
  }

  function setupMobileMenu() {
    if (mobileMenuBtn && navMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        navMenu.classList.toggle('open');
      });
    }
  }

  function showError(msg) {
    companyHeader.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>${msg}</h3>
        <p><a href="index.html">← Back to Company List</a></p>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
