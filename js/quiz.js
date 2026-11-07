/**
 * PrepWise — Interactive Quiz Engine (quiz.html)
 * Zero friction, instant feedback, step-by-step solution toggles,
 * Job Role preparation mode & 4 Difficulty Levels (Beginner to Legend).
 */

(function () {
  'use strict';

  // ---------- Parse URL params ----------
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get('company') || 'tcs';
  const categoryParam = params.get('category') || 'all';
  let levelParam = params.get('level') || '';
  const roleParam = params.get('role') || '';

  // ---------- State ----------
  let companyData = null;
  let allQuestions = [];
  let categoryFilteredQuestions = [];
  let quizQuestions = [];
  let currentIndex = 0;
  let userAnswers = {}; // { questionIndex: { selectedOptionIndex, isCorrect, skipped } }
  let solutionVisibility = {}; // { questionIndex: boolean }

  // ---------- DOM Elements ----------
  const quizLoading = document.getElementById('quizLoading');
  const quizRoleBanner = document.getElementById('quizRoleBanner');
  const quizRoleTitle = document.getElementById('quizRoleTitle');
  const quizRoleSalary = document.getElementById('quizRoleSalary');
  const quizHeader = document.getElementById('quizHeader');
  const quizTitle = document.getElementById('quizTitle');
  const quizCategoryBadge = document.getElementById('quizCategoryBadge');
  const quizLevelBadge = document.getElementById('quizLevelBadge');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const scoreText = document.getElementById('scoreText');
  const questionArea = document.getElementById('questionArea');
  const quizNav = document.getElementById('quizNav');
  const prevBtn = document.getElementById('prevBtn');
  const skipBtn = document.getElementById('skipBtn');
  const nextBtn = document.getElementById('nextBtn');
  const quizResults = document.getElementById('quizResults');
  const breadcrumbCompany = document.getElementById('breadcrumbCompany');
  const breadcrumbCategory = document.getElementById('breadcrumbCategory');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');
  const levelButtons = document.querySelectorAll('[data-quiz-level]');

  // Level config map
  const levelMetadata = {
    'Beginner': { label: '🌱 Beginner (Level 1)', class: 'level-beginner' },
    'Intermediate': { label: '⚡ Intermediate (Level 2)', class: 'level-intermediate' },
    'Advanced': { label: '⚔️ Advanced (Level 3)', class: 'level-advanced' },
    'Legend': { label: '👑 Legend (Level 4)', class: 'level-legend' }
  };

  // ---------- Initialize ----------
  async function init() {
    setupMobileMenu();
    setupNavControls();
    setupLevelSwitcher();

    try {
      const [companiesRes, questionsRes] = await Promise.all([
        fetch('data/companies.json'),
        fetch(`data/questions/${companyId}.json`)
      ]);

      if (!companiesRes.ok || !questionsRes.ok) {
        throw new Error('Data file not accessible');
      }

      const companies = await companiesRes.json();
      companyData = companies.find(c => c.id.toLowerCase() === companyId.toLowerCase()) || {
        id: companyId,
        name: companyId.toUpperCase(),
        shortName: companyId.toUpperCase(),
        jobRoles: []
      };

      const qData = await questionsRes.json();
      allQuestions = qData.questions || [];

      // 1. Role Preparation Track Check
      if (roleParam && quizRoleBanner) {
        const decodedRole = decodeURIComponent(roleParam);
        const matchedRole = (companyData.jobRoles || []).find(r => r.title.toLowerCase() === decodedRole.toLowerCase()) || {
          title: decodedRole,
          avgSalary: 'Competitive Placement Benchmark'
        };
        quizRoleTitle.textContent = matchedRole.title;
        quizRoleSalary.textContent = matchedRole.avgSalary;
        quizRoleBanner.style.display = 'flex';
      }

      // 2. Category Filtering
      if (categoryParam !== 'all') {
        const decodedCat = decodeURIComponent(categoryParam);
        categoryFilteredQuestions = allQuestions.filter(q => q.category.toLowerCase() === decodedCat.toLowerCase());
        if (categoryFilteredQuestions.length === 0) categoryFilteredQuestions = allQuestions;
      } else {
        categoryFilteredQuestions = allQuestions;
      }

      // 3. Level Filtering
      applyLevelFilter(levelParam, false);

      // Breadcrumb setup
      breadcrumbCompany.textContent = companyData.shortName || companyData.name;
      breadcrumbCompany.href = `company.html?id=${companyData.id}`;
      breadcrumbCategory.textContent = categoryParam === 'all' ? 'Full Test' : decodeURIComponent(categoryParam);
      document.title = `${companyData.shortName} Practice Quiz (${breadcrumbCategory.textContent}) — PrepWise`;

      quizTitle.textContent = `${companyData.shortName} Placement Test`;
      quizCategoryBadge.textContent = categoryParam === 'all' ? 'All 4 Categories' : decodeURIComponent(categoryParam);

      // Reveal UI
      quizLoading.style.display = 'none';
      quizHeader.style.display = 'block';
      questionArea.style.display = 'block';
      quizNav.style.display = 'flex';

      renderQuestion(0);
    } catch (err) {
      console.error(err);
      showEmpty('Could not load quiz questions. Please return to the company overview.');
    }
  }

  // ---------- Level Filtering Logic ----------
  function applyLevelFilter(level, rerender = true) {
    levelParam = level;

    // Update active level pill
    levelButtons.forEach(btn => {
      const bLevel = btn.dataset.quizLevel;
      btn.classList.toggle('active', (bLevel === level) || (!level && !bLevel));
    });

    if (level && levelMetadata[level]) {
      quizQuestions = categoryFilteredQuestions.filter(q => (q.level || q.difficulty || '').toLowerCase() === level.toLowerCase());
      if (quizQuestions.length === 0) {
        quizQuestions = categoryFilteredQuestions; // fallback if none match
      }
      quizLevelBadge.textContent = levelMetadata[level].label;
      quizLevelBadge.className = `tag ${levelMetadata[level].class}`;
      quizLevelBadge.style.display = 'inline-block';
    } else {
      quizQuestions = categoryFilteredQuestions;
      quizLevelBadge.style.display = 'none';
    }

    userAnswers = {};
    solutionVisibility = {};

    if (rerender && quizQuestions.length > 0) {
      renderQuestion(0);
    }
  }

  function setupLevelSwitcher() {
    levelButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const lvl = btn.dataset.quizLevel || '';
        applyLevelFilter(lvl, true);
      });
    });
  }

  // ---------- Render Current Question ----------
  function renderQuestion(index) {
    currentIndex = index;
    const q = quizQuestions[index];
    const total = quizQuestions.length;

    // Progress updates
    const answeredCount = Object.keys(userAnswers).length;
    const progressPercent = Math.round(((index + 1) / total) * 100);
    progressFill.style.width = `${progressPercent}%`;
    progressText.textContent = `Question ${index + 1} of ${total}`;

    // Score compute
    let currentScore = 0;
    Object.values(userAnswers).forEach(ans => {
      if (ans.isCorrect) currentScore += 1;
    });
    scoreText.textContent = `Score: ${currentScore}/${answeredCount}`;

    // Button states
    prevBtn.disabled = index === 0;
    if (index === total - 1) {
      nextBtn.textContent = 'Finish Test 🏁';
    } else {
      nextBtn.textContent = 'Next →';
    }

    const state = userAnswers[index];
    const isAnswered = state !== undefined;
    const isSolutionOpen = !!solutionVisibility[index];

    // Difficulty styling
    const qLevel = q.level || q.difficulty || 'Intermediate';
    const levelMeta = levelMetadata[qLevel] || { label: qLevel, class: 'level-intermediate' };

    // Render options
    const optionLabels = ['A', 'B', 'C', 'D'];
    const optionsHtml = q.options.map((opt, i) => {
      let optClass = 'option-btn';
      if (isAnswered) {
        optClass += ' disabled';
        if (i === q.correctAnswer) {
          optClass += ' correct';
        } else if (state.selectedOptionIndex === i) {
          optClass += ' incorrect';
        }
      }

      return `
        <button class="${optClass}" data-option-index="${i}" ${isAnswered ? 'disabled' : ''}>
          <span class="option-label">${optionLabels[i]}</span>
          <span>${escapeHtml(opt)}</span>
        </button>
      `;
    }).join('');

    // Format explanation
    const formattedExplanation = formatExplanation(q.explanation || 'No step-by-step explanation provided.');

    // In-content native question ad banner (rotates every 2 questions for high density)
    const showNativeAd = (index % 2 === 1);
    const nativeAdHtml = showNativeAd ? `
      <div class="ad-slot ad-slot-inline" style="margin-top: var(--space-md); text-align: left; background: #fff; border: 1.5px solid var(--color-border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <span class="ad-badge">Sponsored Placement</span>
          <span style="font-size:0.65rem; color:var(--color-text-muted);">AdChoices ↗</span>
        </div>
        <div class="ad-creative-mock" style="justify-content: flex-start; padding: 10px;">
          <span style="font-size:1.6rem; margin-right: 8px;">💼</span>
          <div>
            <div style="font-weight:700; font-size:0.875rem; color:var(--color-text);">Direct Campus Placement Referral Network</div>
            <div style="font-size:0.75rem; color:var(--color-text-secondary);">Get referred directly to hiring managers at top tech firms with a pre-screened resume.</div>
          </div>
          <button style="margin-left:auto; background:var(--color-primary); color:white; padding:6px 14px; border-radius:6px; font-size:0.75rem; font-weight:700; white-space:nowrap;">
            Apply Free ↗
          </button>
        </div>
      </div>
    ` : '';

    questionArea.innerHTML = `
      <div class="question-card">
        <div class="question-meta" style="align-items:center; justify-content:space-between;">
          <div style="display:flex; gap:8px; align-items:center;">
            <span class="tag ${levelMeta.class}">${levelMeta.label}</span>
            <span class="text-xs text-muted">${q.category}</span>
          </div>
          <span style="font-size:0.75rem; color:var(--color-text-muted); font-weight:600;">#Q${index + 1}</span>
        </div>

        <div class="question-text">
          <span class="question-number">Q${index + 1}.</span> ${escapeHtml(q.question)}
        </div>

        <div class="options-list" id="optionsList">
          ${optionsHtml}
        </div>

        <div class="solution-section">
          <button class="solution-toggle ${isSolutionOpen ? 'open' : ''}" id="toggleSolutionBtn">
            <span>${isSolutionOpen ? 'Hide Solution' : '💡 Show Step-by-Step Solution'}</span>
            <span class="toggle-icon">▼</span>
          </button>
          <div class="solution-content ${isSolutionOpen ? 'visible' : ''}" id="solutionContent">
            <h4>Detailed Step-by-Step Solution:</h4>
            <div>${formattedExplanation}</div>
            
            <!-- Stealth Sponsored Study Unit -->
            <div style="margin-top:14px; padding:8px 12px; background:rgba(37,99,235,0.05); border:1px dashed var(--color-primary); border-radius:var(--radius-md); font-size:0.75rem; display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <span>💡 <strong>Sponsored Preparation Tool:</strong> Practice live 1-on-1 mock interviews for this question with ex-FAANG engineers.</span>
              <a href="#" style="font-weight:700; color:var(--color-primary); white-space:nowrap;">Claim Free Session ↗</a>
            </div>
          </div>
        </div>
      </div>
      ${nativeAdHtml}
    `;

    // Bind option click listeners if not answered yet
    if (!isAnswered) {
      const optionButtons = questionArea.querySelectorAll('.option-btn');
      optionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const optIdx = parseInt(btn.dataset.optionIndex, 10);
          handleAnswerSelect(optIdx);
        });
      });
    }

    // Bind solution toggle
    const toggleBtn = document.getElementById('toggleSolutionBtn');
    const solContent = document.getElementById('solutionContent');
    toggleBtn.addEventListener('click', () => {
      const open = !solContent.classList.contains('visible');
      solutionVisibility[currentIndex] = open;
      solContent.classList.toggle('visible', open);
      toggleBtn.classList.toggle('open', open);
      toggleBtn.querySelector('span:first-child').textContent = open ? 'Hide Solution' : '💡 Show Step-by-Step Solution';
    });
  }

  // ---------- Handle Option Selection ----------
  function handleAnswerSelect(selectedOptionIndex) {
    const q = quizQuestions[currentIndex];
    const isCorrect = selectedOptionIndex === q.correctAnswer;

    userAnswers[currentIndex] = {
      selectedOptionIndex,
      isCorrect,
      skipped: false
    };

    // Auto-reveal the solution for maximum learning
    solutionVisibility[currentIndex] = true;

    // Trigger stealth background ad refresh
    if (window.triggerStealthAdRefresh) {
      window.triggerStealthAdRefresh();
    }

    // Re-render this question to lock choices and reveal explanation
    renderQuestion(currentIndex);
  }

  // ---------- Handle Skip ----------
  function handleSkip() {
    if (!userAnswers[currentIndex]) {
      userAnswers[currentIndex] = {
        selectedOptionIndex: -1,
        isCorrect: false,
        skipped: true
      };
    }
    goNext();
  }

  // ---------- Nav Controls ----------
  function setupNavControls() {
    prevBtn.addEventListener('click', () => {
      if (currentIndex > 0) {
        renderQuestion(currentIndex - 1);
        window.scrollTo({ top: quizHeader.offsetTop - 70, behavior: 'smooth' });
      }
    });

    skipBtn.addEventListener('click', () => {
      handleSkip();
    });

    nextBtn.addEventListener('click', () => {
      goNext();
    });
  }

  function goNext() {
    if (window.triggerStealthAdRefresh) {
      window.triggerStealthAdRefresh();
    }
    if (currentIndex < quizQuestions.length - 1) {
      renderQuestion(currentIndex + 1);
      window.scrollTo({ top: quizHeader.offsetTop - 70, behavior: 'smooth' });
    } else {
      showResults();
    }
  }

  // ---------- Results View & Retention Loops ----------
  function showResults() {
    quizHeader.style.display = 'none';
    if (quizRoleBanner) quizRoleBanner.style.display = 'none';
    questionArea.style.display = 'none';
    quizNav.style.display = 'none';

    const total = quizQuestions.length;
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    for (let i = 0; i < total; i++) {
      const ans = userAnswers[i];
      if (!ans || ans.skipped) {
        skipped++;
      } else if (ans.isCorrect) {
        correct++;
      } else {
        incorrect++;
      }
    }

    const percentage = Math.round((correct / total) * 100);

    let feedbackTitle = 'Great Effort!';
    let feedbackDesc = 'Review your mistakes and take on the next difficulty tier to level up your placement score.';
    if (percentage >= 80) {
      feedbackTitle = '👑 Legend-Tier Performance! Placement Ready';
      feedbackDesc = `You demonstrated elite competency surpassing standard recruitment benchmarks for ${companyData.shortName}!`;
    } else if (percentage >= 50) {
      feedbackTitle = 'Good Progress! 📈';
      feedbackDesc = 'Solid foundation demonstrated. Advance through harder levels to secure a top-bracket job offer.';
    }

    quizResults.style.display = 'block';
    quizResults.innerHTML = `
      <div class="results-score">${percentage}%</div>
      <h2>${feedbackTitle}</h2>
      <p class="results-label">${feedbackDesc}</p>

      <div class="results-breakdown">
        <div class="breakdown-item breakdown-correct">
          <div class="breakdown-number">${correct}</div>
          <div class="breakdown-label">Correct</div>
        </div>
        <div class="breakdown-item breakdown-incorrect">
          <div class="breakdown-number">${incorrect}</div>
          <div class="breakdown-label">Incorrect</div>
        </div>
        <div class="breakdown-item breakdown-skipped">
          <div class="breakdown-number">${skipped}</div>
          <div class="breakdown-label">Skipped</div>
        </div>
      </div>

      <div class="results-actions">
        <button class="quiz-btn quiz-btn-secondary" id="retakeBtn">
          🔄 Retake Quiz
        </button>
        <a href="company.html?id=${companyData.id}" class="quiz-btn quiz-btn-primary">
          💼 View All Roles & Salaries for ${companyData.shortName}
        </a>
      </div>

      <!-- High-eCPM Results Banner Ad -->
      <div class="ad-slot ad-slot-inline" style="margin-top: var(--space-xl); background: #fff; border: 1.5px solid var(--color-border); text-align: left;">
        <span class="ad-badge">Results Banner Ad (728×90 / Responsive)</span>
        <div class="ad-creative-mock" style="padding: 12px;">
          <span style="font-size:2rem; margin-right: 12px;">🏆</span>
          <div>
            <div style="font-weight:700; font-size:0.95rem; color:var(--color-text);">Full-Stack Engineering Career Accelerator</div>
            <div style="font-size:0.8rem; color:var(--color-text-secondary);">Guaranteed placement assistance + 1-on-1 mock interviews with senior FAANG engineers.</div>
          </div>
          <button style="margin-left:auto; background:var(--color-secondary); color:white; padding:8px 18px; border-radius:6px; font-weight:700; font-size:0.8rem; white-space:nowrap;">
            Claim 40% Off ↗
          </button>
        </div>
      </div>

      <!-- Next Steps & Retention Engine -->
      <div class="next-steps" style="margin-top: var(--space-2xl); text-align: left;">
        <h3>🚀 Level-Up Your Preparation:</h3>
        <div class="next-steps-grid">
          <a href="quiz.html?company=${companyData.id}&level=Legend" class="next-step-link">
            <span class="step-emoji">👑</span>
            <div>
              <div>Try Legend-Tier Questions</div>
              <div class="text-xs text-muted">Solve the hardest FAANG-level problems</div>
            </div>
          </a>
          <a href="company.html?id=${companyData.id}" class="next-step-link">
            <span class="step-emoji">💼</span>
            <div>
              <div>Switch Job Role Track</div>
              <div class="text-xs text-muted">Prepare for SDE, DevOps, Data Science</div>
            </div>
          </a>
          <a href="index.html" class="next-step-link">
            <span class="step-emoji">🌍</span>
            <div>
              <div>Explore Top 50 GDP Countries</div>
              <div class="text-xs text-muted">Browse 22+ top global tech employers</div>
            </div>
          </a>
        </div>
      </div>
    `;

    document.getElementById('retakeBtn').addEventListener('click', () => {
      userAnswers = {};
      solutionVisibility = {};
      quizResults.style.display = 'none';
      quizHeader.style.display = 'block';
      if (quizRoleBanner && roleParam) quizRoleBanner.style.display = 'flex';
      questionArea.style.display = 'block';
      quizNav.style.display = 'flex';
      renderQuestion(0);
    });

    window.scrollTo({ top: quizResults.offsetTop - 50, behavior: 'smooth' });
  }

  // ---------- Helpers ----------
  function formatExplanation(text) {
    if (!text) return '';
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showEmpty(msg) {
    quizLoading.style.display = 'none';
    quizResults.style.display = 'block';
    quizResults.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>${msg}</h3>
        <p><a href="index.html">← Explore All Companies</a></p>
      </div>
    `;
  }

  function setupMobileMenu() {
    if (mobileMenuBtn && navMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        navMenu.classList.toggle('open');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
