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
  let isReviewMode = false;

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
    setupKeyboardNavigation();

    try {
      const [companiesRes, questionsRes] = await Promise.all([
        fetch('data/companies.json'),
        fetch(`data/questions/${companyId}.json`)
      ]);

      if (!companiesRes.ok || !questionsRes.ok) {
        throw new Error('Data file not accessible');
      }

      const rawCompanies = await companiesRes.json();
      const companies = Array.isArray(rawCompanies) ? rawCompanies : (rawCompanies.companies || []);
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
    progressText.textContent = isReviewMode ? `Reviewing Question ${index + 1} of ${total}` : `Question ${index + 1} of ${total}`;

    // Score compute
    let currentScore = 0;
    Object.values(userAnswers).forEach(ans => {
      if (ans.isCorrect) currentScore += 1;
    });
    scoreText.textContent = `Score: ${currentScore}/${answeredCount}`;

    // Button states
    prevBtn.disabled = index === 0;
    if (isReviewMode) {
      nextBtn.textContent = index === total - 1 ? 'Back to Results 🏁' : 'Next Question →';
    } else if (index === total - 1) {
      nextBtn.textContent = 'Finish Test 🏁';
    } else {
      nextBtn.textContent = 'Next →';
    }

    const state = userAnswers[index];
    const isAnswered = state !== undefined;
    const isSolutionOpen = isReviewMode ? true : !!solutionVisibility[index];

    // Difficulty styling
    const qLevel = q.level || q.difficulty || 'Intermediate';
    const levelMeta = levelMetadata[qLevel] || { label: qLevel, class: 'level-intermediate' };

    // Render options
    const optionLabels = ['A', 'B', 'C', 'D'];
    const correctIdx = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct_answer !== undefined ? q.correct_answer : -1);
    const optionsHtml = (q.options || []).map((opt, i) => {
      let optClass = 'option-btn';
      if (isAnswered) {
        optClass += ' disabled';
        if (i === correctIdx) {
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
    const explanationText = q.explanation || '';
    const explanationNeedsReview = Boolean(
      q.reviewRequired ||
      /let me\s+(reconsider|recalculate|recheck|re-read|re-examine|just fix)|change the question|i will change|none of the available options|answer should be|i marked|i selected|i'll set the correct answer|actually the answer/i.test(explanationText)
    );
    const formattedExplanation = formatExplanation(explanationText || 'No step-by-step explanation provided.');

    questionArea.innerHTML = `
      ${isReviewMode ? `
        <div class="review-mode-banner">
          <button type="button" class="quiz-btn quiz-btn-secondary" id="exitReviewBtn" style="padding: 6px 12px; font-size: 0.825rem;">
            ← Back to Results Matrix
          </button>
          <span class="review-status-pill">Reviewing Question ${index + 1} of ${total}</span>
        </div>
      ` : ''}

      <div class="question-card">
        <div class="question-meta" style="align-items:center; justify-content:space-between;">
          <div style="display:flex; gap:8px; align-items:center;">
            <span class="tag ${levelMeta.class}">${levelMeta.label}</span>
            <span class="text-xs text-muted">${q.category || q.category_name || 'General'}</span>
          </div>
          <span style="font-size:0.75rem; color:var(--color-text-muted); font-weight:600;">#Q${index + 1}</span>
        </div>

        <div class="question-text">
          <span class="question-number">Q${index + 1}.</span> ${escapeHtml(q.question || q.question_text || '')}
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
            ${explanationNeedsReview ? '<div class="question-validation-warning" role="alert"><strong>Question validation issue:</strong> This question and explanation have been flagged for manual review due to a mathematical or wording inconsistency. Do not rely on it until corrected.</div>' : ''}
            <h4>Detailed Step-by-Step Solution:</h4>
            <div>${formattedExplanation}</div>
          </div>
        </div>

        <div class="quiz-shortcuts-hint" aria-hidden="true">
          <span class="shortcut-item"><kbd>1</kbd>-<kbd>4</kbd> Select</span>
          <span class="shortcut-item"><kbd>↵ Enter</kbd> Next</span>
          <span class="shortcut-item"><kbd>←</kbd> Prev</span>
          <span class="shortcut-item"><kbd>S</kbd> Solution</span>
        </div>
      </div>
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

    // Bind exit review button if in review mode
    if (isReviewMode) {
      const exitBtn = document.getElementById('exitReviewBtn');
      if (exitBtn) {
        exitBtn.addEventListener('click', () => {
          isReviewMode = false;
          showResults();
        });
      }
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
    const correctIdx = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct_answer !== undefined ? q.correct_answer : -1);
    const isCorrect = selectedOptionIndex === correctIdx;

    userAnswers[currentIndex] = {
      selectedOptionIndex,
      isCorrect,
      skipped: false
    };

    // Auto-reveal the solution for maximum learning
    solutionVisibility[currentIndex] = true;

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
    if (currentIndex < quizQuestions.length - 1) {
      renderQuestion(currentIndex + 1);
      window.scrollTo({ top: quizHeader.offsetTop - 70, behavior: 'smooth' });
    } else {
      isReviewMode = false;
      showResults();
    }
  }

  // ---------- Open Specific Question for Review ----------
  function openReviewQuestion(idx) {
    if (idx < 0 || idx >= quizQuestions.length) return;
    isReviewMode = true;
    quizResults.style.display = 'none';
    const quizAd = document.getElementById('ad-quiz-results');
    if (quizAd) quizAd.style.display = 'none';
    quizHeader.style.display = 'block';
    if (quizRoleBanner && roleParam) quizRoleBanner.style.display = 'flex';
    questionArea.style.display = 'block';
    quizNav.style.display = 'flex';
    solutionVisibility[idx] = true;
    renderQuestion(idx);
    window.scrollTo({ top: quizHeader.offsetTop - 70, behavior: 'smooth' });
  }

  // ---------- Results View & Retention Loops ----------
  function showResults() {
    isReviewMode = false;
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
    if (window.prepwiseTrack) {
      window.prepwiseTrack('quiz_complete', {
        questionCount: total,
        answeredCount: total - skipped,
        score: correct,
        category: categoryParam,
        level: levelParam || 'all'
      });
    }

    let feedbackTitle = 'Great Effort!';
    let feedbackDesc = 'Review your mistakes and take on the next difficulty tier to level up your placement score.';
    if (percentage >= 80) {
      feedbackTitle = '👑 Legend-Tier Performance! Placement Ready';
      feedbackDesc = `You demonstrated elite competency surpassing standard recruitment benchmarks for ${companyData.shortName}!`;
    } else if (percentage >= 50) {
      feedbackTitle = 'Good Progress! 📈';
      feedbackDesc = 'Solid foundation demonstrated. Advance through harder levels to secure a top-bracket job offer.';
    }

    // Category breakdown computation
    const categoryStats = {};
    quizQuestions.forEach((q, idx) => {
      const cat = q.category || 'General';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { total: 0, correct: 0 };
      }
      categoryStats[cat].total++;
      if (userAnswers[idx] && userAnswers[idx].isCorrect) {
        categoryStats[cat].correct++;
      }
    });

    const categoryBreakdownHtml = Object.keys(categoryStats).map(cat => {
      const s = categoryStats[cat];
      const pct = Math.round((s.correct / s.total) * 100);
      return `
        <div class="results-cat-row">
          <div class="results-cat-info">
            <span class="results-cat-name">${escapeHtml(cat)}</span>
            <span class="results-cat-ratio">${s.correct}/${s.total} (${pct}%)</span>
          </div>
          <div class="results-cat-track">
            <div class="results-cat-bar" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    // Review Matrix chips computation
    const matrixChipsHtml = quizQuestions.map((q, idx) => {
      const ans = userAnswers[idx];
      let statusClass = 'skipped';
      let statusLabel = 'Skipped';
      if (ans && !ans.skipped) {
        if (ans.isCorrect) {
          statusClass = 'correct';
          statusLabel = 'Correct';
        } else {
          statusClass = 'incorrect';
          statusLabel = 'Incorrect';
        }
      }
      return `
        <button type="button" class="review-chip ${statusClass}" data-review-idx="${idx}" aria-label="Review Question ${idx + 1}: ${statusLabel}" title="Question ${idx + 1}: ${statusLabel}">
          ${idx + 1}
        </button>
      `;
    }).join('');

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

      <!-- Category Performance Breakdown -->
      <div class="results-categories-section">
        <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: var(--space-md); text-align: left;">Category Performance Breakdown</h3>
        <div class="results-categories-list">
          ${categoryBreakdownHtml}
        </div>
      </div>

      <!-- Interactive Question Review Matrix -->
      <div class="results-review-matrix-section">
        <div class="matrix-header">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 2px;">Question Review Matrix</h3>
            <p class="text-xs text-muted" style="margin: 0;">Click any question number below to review your answer with step-by-step solutions.</p>
          </div>
          <div class="review-matrix-legend">
            <span class="matrix-legend-item"><span class="legend-dot correct"></span> Correct (${correct})</span>
            <span class="matrix-legend-item"><span class="legend-dot incorrect"></span> Incorrect (${incorrect})</span>
            <span class="matrix-legend-item"><span class="legend-dot skipped"></span> Skipped (${skipped})</span>
          </div>
        </div>
        <div class="review-matrix-grid" id="reviewMatrixGrid">
          ${matrixChipsHtml}
        </div>
      </div>

      <div class="results-actions">
        <button type="button" class="quiz-btn quiz-btn-secondary" id="retakeBtn">
          🔄 Retake Quiz
        </button>
        <button type="button" class="quiz-btn quiz-btn-secondary" id="reviewAllBtn">
          📖 Review All Solutions (Q1 - Q${total})
        </button>
        <a href="company.html?id=${companyData.id}" class="quiz-btn quiz-btn-primary">
          💼 View All Roles & Salaries for ${companyData.shortName}
        </a>
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

    // Bind matrix chip click listeners
    const matrixGrid = document.getElementById('reviewMatrixGrid');
    if (matrixGrid) {
      matrixGrid.querySelectorAll('.review-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const qIdx = parseInt(chip.dataset.reviewIdx, 10);
          openReviewQuestion(qIdx);
        });
      });
    }

    // Bind review all button
    const reviewAllBtn = document.getElementById('reviewAllBtn');
    if (reviewAllBtn) {
      reviewAllBtn.addEventListener('click', () => {
        openReviewQuestion(0);
      });
    }

    document.getElementById('retakeBtn').addEventListener('click', () => {
      userAnswers = {};
      solutionVisibility = {};
      isReviewMode = false;
      quizResults.style.display = 'none';
      const quizAd = document.getElementById('ad-quiz-results');
      if (quizAd) quizAd.style.display = 'none';
      quizHeader.style.display = 'block';
      if (quizRoleBanner && roleParam) quizRoleBanner.style.display = 'flex';
      questionArea.style.display = 'block';
      quizNav.style.display = 'flex';
      renderQuestion(0);
    });

    // Trigger quiz results ad slot if consented and enabled
    const quizAd = document.getElementById('ad-quiz-results');
    if (quizAd) quizAd.style.display = '';
    if (typeof window.PREPWISE_ADS !== 'undefined' && typeof window.PREPWISE_ADS.enable === 'function') {
      window.PREPWISE_ADS.enable('ad-quiz-results', { lazy: false });
    }

    window.scrollTo({ top: quizResults.offsetTop - 50, behavior: 'smooth' });
  }

  // ---------- Keyboard Navigation Engine ----------
  function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (questionArea.style.display === 'none' || quizQuestions.length === 0) {
        return;
      }

      const key = e.key;

      const optionMap = {
        '1': 0, 'a': 0, 'A': 0,
        '2': 1, 'b': 1, 'B': 1,
        '3': 2, 'c': 2, 'C': 2,
        '4': 3, 'd': 3, 'D': 3
      };

      if (key in optionMap) {
        const optionIndex = optionMap[key];
        const isAnswered = userAnswers[currentIndex] !== undefined;
        const currentQ = quizQuestions[currentIndex];
        if (!isAnswered && currentQ && currentQ.options && optionIndex < currentQ.options.length) {
          e.preventDefault();
          handleAnswerSelect(optionIndex);
        }
        return;
      }

      if (key === 'Enter' || key === 'ArrowRight') {
        e.preventDefault();
        goNext();
        return;
      }

      if (key === 'ArrowLeft') {
        if (currentIndex > 0) {
          e.preventDefault();
          renderQuestion(currentIndex - 1);
          window.scrollTo({ top: quizHeader.offsetTop - 70, behavior: 'smooth' });
        }
        return;
      }

      if (key === 's' || key === 'S') {
        e.preventDefault();
        const toggleBtn = document.getElementById('toggleSolutionBtn');
        if (toggleBtn) {
          toggleBtn.click();
        }
        return;
      }
    });
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
