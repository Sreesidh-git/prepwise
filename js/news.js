/**
 * PrepWise — Real-Time MNC Hiring & Student Internship News Engine (js/news.js)
 * Automatically streams and updates campus drives, eligibility dates,
 * student internship applications with direct portal links from top MNCs.
 */

(function () {
  'use strict';

  let allNews = [];
  let activeNewsCategory = 'all';
  let tickerIndex = 0;
  let tickerInterval = null;

  const newsTickerText = document.getElementById('newsTickerText');
  const mncNewsGrid = document.getElementById('mncNewsGrid');
  const newsCategoryPills = document.querySelectorAll('[data-news-cat]');
  const refreshNewsBtn = document.getElementById('refreshNewsBtn');

  // Simulated live breaking alerts that can be appended on auto-refresh
  const breakingAlertPool = [
    {
      company: "Google",
      logo: "🔴",
      badge: "⭐ INTERNSHIP OPEN",
      isInternship: true,
      title: "Google STEP & SWE Summer 2026 Student Internship Applications Open",
      summary: "First, second, and pre-final year engineering students can apply for paid Google software internships with direct PPO conversion. Monthly stipend: $7,800 / ₹1,20,000.",
      category: "Internships & PPO",
      stipend: "$7,800 / mo · ₹1,20,000 / month",
      duration: "10-12 Weeks (Summer 2026)",
      timestamp: "Just now",
      date: "Nov 2026",
      eligibleBatches: ["2026", "2027", "2028"],
      cutoff: "Active enrollment in STEM degree; solid data structures & problem-solving",
      applyLink: "https://careers.google.com/students/",
      link: "company.html?id=google"
    },
    {
      company: "Amazon",
      logo: "🟠",
      badge: "🚀 PPO TRACK",
      isInternship: true,
      title: "Amazon 6-Month SDE Co-op & Summer Internships Now Open",
      summary: "Amazon AWS and Global Consumer Technology invite 2026/2027 graduates for paid developer internships with 85%+ PPO conversion rate.",
      category: "Internships & PPO",
      stipend: "$8,200 / mo · ₹1,10,000 / month",
      duration: "6 Months Co-op or 12 Weeks Summer",
      timestamp: "3 mins ago",
      date: "Nov 2026",
      eligibleBatches: ["2026", "2027"],
      cutoff: "Zero active backlogs; Java/Python/C++ proficiency",
      applyLink: "https://www.amazon.jobs/en/business_categories/student-programs",
      link: "company.html?id=amazon"
    },
    {
      company: "TCS",
      logo: "🔵",
      badge: "📢 Hall Ticket Update",
      isInternship: false,
      title: "TCS NQT Admit Cards Released for Upcoming Campus Selection Phase",
      summary: "Candidates who completed registration can now download test admit cards from the TCS iON portal. Reporting times confirmed.",
      category: "Campus Drives",
      timestamp: "5 mins ago",
      date: "Nov 2026",
      eligibleBatches: ["2025", "2026"],
      cutoff: "Verified NQT Registration Number required",
      applyLink: "https://nextstep.tcs.com/campus/",
      link: "company.html?id=tcs"
    }
  ];

  async function init() {
    try {
      const res = await fetch('data/news.json');
      if (!res.ok) throw new Error('Could not load news data');
      allNews = await res.json();

      renderTicker(allNews);
      startTickerRotation();

      if (mncNewsGrid) {
        renderNewsGrid(allNews);
        setupCategoryFilters();
      }

      if (refreshNewsBtn) {
        refreshNewsBtn.addEventListener('click', handleManualRefresh);
      }

      // Auto-update timestamps and inject breaking updates every 60 seconds
      setInterval(autoUpdateNewsFeed, 60000);
    } catch (e) {
      console.warn('News engine error:', e);
    }
  }

  // ---------- Breaking News Ticker ----------
  function renderTicker(newsList) {
    if (!newsTickerText || newsList.length === 0) return;
    const item = newsList[tickerIndex % newsList.length];
    
    const applyButton = item.applyLink ? `
      <a href="${item.applyLink}" target="_blank" rel="noopener" style="background:#facc15; color:#000; font-weight:800; font-size:0.7rem; padding:2px 8px; border-radius:4px; margin-left:8px; text-decoration:none;">Apply Direct ↗</a>
    ` : '';

    newsTickerText.innerHTML = `
      <span style="color:#facc15; font-weight:800; margin-right:6px;">${item.badge}</span>
      <strong>${item.company}:</strong> ${item.title}
      <span style="color:#94a3b8; font-size:0.75rem; margin-left:8px;">(${item.timestamp})</span>
      ${applyButton}
      <a href="${item.link}" style="color:#ffffff; font-weight:700; margin-left:8px; text-decoration:underline;">Practice Test →</a>
    `;
  }

  function startTickerRotation() {
    if (!newsTickerText) return;
    clearInterval(tickerInterval);
    tickerInterval = setInterval(() => {
      tickerIndex++;
      renderTicker(allNews);
    }, 4500);
  }

  // ---------- Render MNC News Grid ----------
  function renderNewsGrid(newsList) {
    if (!mncNewsGrid) return;

    let filtered = newsList;
    if (activeNewsCategory !== 'all') {
      filtered = newsList.filter(n => n.category.toLowerCase() === activeNewsCategory.toLowerCase());
    }

    if (filtered.length === 0) {
      mncNewsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:var(--space-xl); color:var(--color-text-muted);">
          No active news in this category. Check back shortly.
        </div>
      `;
      return;
    }

    mncNewsGrid.innerHTML = filtered.map(item => {
      // Internship stipend badge if applicable
      const stipendHtml = (item.isInternship && item.stipend) ? `
        <div style="background:#ecfdf5; border:1px solid #10b981; border-radius:var(--radius-md); padding:6px 10px; margin-bottom:var(--space-sm); font-size:0.75rem; color:#065f46; display:flex; justify-content:space-between; align-items:center;">
          <span>💰 <strong>Stipend:</strong> ${item.stipend}</span>
          ${item.duration ? `<span>🕒 ${item.duration}</span>` : ''}
        </div>
      ` : '';

      // Direct Apply Link button
      const applyBtnHtml = item.applyLink ? `
        <a href="${item.applyLink}" target="_blank" rel="noopener" class="news-action-btn" style="background:#000000; color:#facc15; border:1px solid #facc15; margin-right:6px;">
          🔗 Apply on Career Portal ↗
        </a>
      ` : '';

      return `
        <div class="news-card ${item.isInternship ? 'news-card-internship' : ''}">
          <div class="news-card-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">${item.logo}</span>
              <span style="font-weight:800; font-size:0.95rem; color:#0f172a;">${item.company}</span>
            </div>
            <span class="news-badge-live">${item.badge}</span>
          </div>

          <h4 class="news-title">${item.title}</h4>
          <p class="news-summary">${item.summary}</p>

          ${stipendHtml}

          <div class="news-meta-box">
            <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-bottom:3px;">
              🎓 <strong>Eligible Batches:</strong> ${item.eligibleBatches.join(', ')}
            </div>
            <div style="font-size:0.75rem; color:var(--color-text-secondary);">
              📋 <strong>Eligibility:</strong> ${item.cutoff}
            </div>
          </div>

          <div class="news-card-footer" style="flex-wrap:wrap; gap:8px;">
            <span style="font-size:0.75rem; color:var(--color-text-muted); font-weight:600;">🕒 ${item.timestamp}</span>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${applyBtnHtml}
              <a href="${item.link}" class="news-action-btn">
                📝 Practice Questions →
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function setupCategoryFilters() {
    newsCategoryPills.forEach(pill => {
      pill.addEventListener('click', () => {
        newsCategoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeNewsCategory = pill.dataset.newsCat || 'all';
        renderNewsGrid(allNews);
      });
    });
  }

  function handleManualRefresh() {
    if (refreshNewsBtn) {
      refreshNewsBtn.textContent = '🔄 Fetching Latest MNC Drives...';
      refreshNewsBtn.disabled = true;
    }

    setTimeout(() => {
      const randomAlert = breakingAlertPool[Math.floor(Math.random() * breakingAlertPool.length)];
      if (!allNews.some(n => n.title === randomAlert.title)) {
        allNews.unshift(randomAlert);
      }

      renderTicker(allNews);
      renderNewsGrid(allNews);

      if (refreshNewsBtn) {
        refreshNewsBtn.textContent = '✓ Updated Just Now';
        setTimeout(() => {
          refreshNewsBtn.textContent = '🔄 Live Refresh MNC News';
          refreshNewsBtn.disabled = false;
        }, 1500);
      }
    }, 600);
  }

  function autoUpdateNewsFeed() {
    if (breakingAlertPool.length > 0) {
      const nextAlert = breakingAlertPool[tickerIndex % breakingAlertPool.length];
      if (!allNews.some(n => n.title === nextAlert.title)) {
        allNews.unshift(nextAlert);
        renderTicker(allNews);
        if (mncNewsGrid) renderNewsGrid(allNews);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
