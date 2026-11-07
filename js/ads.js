/**
 * PrepWise — Advanced Advertising Engine & Background Ad Controller
 * Supports Wallpaper/Skin Takeovers, Sticky Anchors, Floating Outstream Video,
 * Stealth Native Placements, and High-Velocity Background Impression Refreshes.
 */

(function () {
  'use strict';

  // Default ad configuration
  const defaultAdConfig = {
    wallpaperAds: true,
    anchorAd: true,
    floatingVideo: true,
    inlineAds: true,
    stealthAds: true
  };

  // Stealth rotating creative inventory
  const rotatingCreatives = [
    {
      title: "🎓 Master Data Science & System Design",
      desc: "Free 7-Day Tech Interview Masterclass by ex-Google Staff Engineers",
      cta: "Join Class ↗"
    },
    {
      title: "💼 Top Tech Hiring Referral Network 2026",
      desc: "Get referred directly to engineering managers with a pre-vetted resume",
      cta: "Get Referred ↗"
    },
    {
      title: "🚀 AWS & Kubernetes Certified Developer Pass",
      desc: "Official Exam Prep + Interactive Sandbox Labs (50% Student Off)",
      cta: "Claim Pass ↗"
    },
    {
      title: "⚡ FAANG Coding Mock Interview Challenge",
      desc: "Practice with peer engineers and get evaluated on Big-O optimality",
      cta: "Start Free ↗"
    }
  ];

  let currentCreativeIndex = 0;
  let stealthImpressionCount = 0;

  // Load from localStorage or defaults
  let adConfig = { ...defaultAdConfig };
  try {
    const saved = localStorage.getItem('prepwise_ad_config');
    if (saved) {
      adConfig = Object.assign(adConfig, JSON.parse(saved));
    }
  } catch (e) {
    console.warn('Could not read ad config from localStorage', e);
  }

  function saveConfig() {
    try {
      localStorage.setItem('prepwise_ad_config', JSON.stringify(adConfig));
    } catch (e) {}
  }

  // ---------- Initialize Ad Units ----------
  function initAds() {
    createWallpaperAds();
    createAnchorAd();
    createFloatingVideoAd();
    createAdControlWidget();
    applyAdState();
  }

  // 1. Background Skin / Wallpaper Gutter Ads (Takeover)
  function createWallpaperAds() {
    if (document.getElementById('skinAdLeft')) return;

    const leftSkin = document.createElement('div');
    leftSkin.id = 'skinAdLeft';
    leftSkin.className = 'skin-ad skin-ad-left';
    leftSkin.innerHTML = `
      <span class="ad-badge">Sponsored Takeover</span>
      <div style="font-weight:700;font-size:0.85rem;margin:12px 0 6px;color:var(--color-primary);">AWS Cloud Prep</div>
      <p style="font-size:0.75rem;line-height:1.4;color:var(--color-text-secondary);margin-bottom:12px;">Get AWS Certified with 50% Student Discount</p>
      <div class="ad-slot" style="width:100%;height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;">
        <span style="font-size:1.8rem;margin-bottom:8px;">☁️</span>
        <span style="font-weight:600;font-size:0.75rem;">160 × 600</span>
        <span style="font-size:0.65rem;color:#94a3b8;">Gutter Skyscraper</span>
      </div>
      <span class="ad-badge" style="margin-top:auto;">AdChoices ↗</span>
    `;

    const rightSkin = document.createElement('div');
    rightSkin.id = 'skinAdRight';
    rightSkin.className = 'skin-ad skin-ad-right';
    rightSkin.innerHTML = `
      <span class="ad-badge">Sponsored Takeover</span>
      <div style="font-weight:700;font-size:0.85rem;margin:12px 0 6px;color:var(--color-secondary);">LeetCode Mastery</div>
      <p style="font-size:0.75rem;line-height:1.4;color:var(--color-text-secondary);margin-bottom:12px;">Crack FAANG Coding Rounds with Top Mentors</p>
      <div class="ad-slot" style="width:100%;height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;">
        <span style="font-size:1.8rem;margin-bottom:8px;">🚀</span>
        <span style="font-weight:600;font-size:0.75rem;">160 × 600</span>
        <span style="font-size:0.65rem;color:#94a3b8;">Gutter Skyscraper</span>
      </div>
      <span class="ad-badge" style="margin-top:auto;">AdChoices ↗</span>
    `;

    document.body.appendChild(leftSkin);
    document.body.appendChild(rightSkin);
  }

  // 2. Sticky Bottom Anchor Ad (High eCPM, compliant with AdSense)
  function createAnchorAd() {
    if (document.getElementById('stickyAnchorAd')) return;

    const anchor = document.createElement('div');
    anchor.id = 'stickyAnchorAd';
    anchor.className = 'sticky-anchor-ad';
    anchor.innerHTML = `
      <button class="anchor-toggle-btn" id="anchorToggleBtn">▲ Close Ad</button>
      <div class="sticky-anchor-content" id="anchorContentBox">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="ad-badge">Anchor Ad</span>
          <div style="font-size:0.85rem;font-weight:600;color:var(--color-text);" id="anchorTitle">
            🎓 Master Data Science & System Design — Free 7-Day Tech Interview Masterclass
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <a href="https://www.coursera.org/" target="_blank" rel="noopener" style="font-size:0.75rem;padding:6px 14px;background:var(--color-primary);color:white;border-radius:6px;font-weight:700;white-space:nowrap;" id="anchorCta">Learn More ↗</a>
        </div>
      </div>
    `;

    document.body.appendChild(anchor);

    // Toggle button behavior
    const toggleBtn = anchor.querySelector('#anchorToggleBtn');
    let isMinimized = false;
    toggleBtn.addEventListener('click', () => {
      isMinimized = !isMinimized;
      anchor.classList.toggle('minimized', isMinimized);
      toggleBtn.textContent = isMinimized ? '▲ View Ad' : '▼ Close Ad';
    });
  }

  // 3. Floating Corner Outstream Video Player (Background Video Ad)
  function createFloatingVideoAd() {
    if (document.getElementById('floatingVideoAd')) return;

    const videoAd = document.createElement('div');
    videoAd.id = 'floatingVideoAd';
    videoAd.className = 'floating-video-ad';
    videoAd.innerHTML = `
      <div class="video-ad-header">
        <span>🎬 Video Ad Playing</span>
        <button id="closeVideoAdBtn" style="color:#94a3b8;font-size:0.9rem;cursor:pointer;">✕</button>
      </div>
      <div class="video-ad-body">
        <div class="play-pulse">▶</div>
        <div style="font-size:0.8rem;font-weight:700;margin-bottom:2px;" id="videoAdTitle">Top Tech Master's Program</div>
        <div style="font-size:0.7rem;color:#94a3b8;">Interactive Video Showcase (Audio Muted)</div>
      </div>
      <div class="video-ad-progress">
        <div class="video-ad-progress-bar"></div>
      </div>
    `;

    document.body.appendChild(videoAd);

    videoAd.querySelector('#closeVideoAdBtn').addEventListener('click', () => {
      videoAd.style.display = 'none';
      adConfig.floatingVideo = false;
      saveConfig();
      updateWidgetCheckboxes();
    });
  }

  // 4. Live Ad Control Panel Widget (Floating Toggle for Site Owner / Demo)
  function createAdControlWidget() {
    if (document.getElementById('adControlPill')) return;

    const pill = document.createElement('button');
    pill.id = 'adControlPill';
    pill.className = 'ad-control-pill';
    pill.innerHTML = `<span>⚡</span> Ad Spaces & Background Engine`;

    const modal = document.createElement('div');
    modal.id = 'adModal';
    modal.className = 'ad-modal';
    modal.innerHTML = `
      <h4>
        <span>📢 Ad Placements & Engine</span>
        <button id="closeAdModal" style="cursor:pointer;font-size:1.1rem;color:var(--color-text-muted);">✕</button>
      </h4>
      <p style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:12px;">
        Configure real-time background and display ad spaces for this platform.
      </p>

      <div class="ad-toggle-row">
        <div>
          <strong>Wallpaper / Skin Takeover</strong>
          <div style="font-size:0.7rem;color:var(--color-text-muted);">Background left & right gutter ads</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggleWallpaper" ${adConfig.wallpaperAds ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <div class="ad-toggle-row">
        <div>
          <strong>Sticky Bottom Anchor</strong>
          <div style="font-size:0.7rem;color:var(--color-text-muted);">Persistent 728x90 bottom dock</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggleAnchor" ${adConfig.anchorAd ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <div class="ad-toggle-row">
        <div>
          <strong>Floating Outstream Video</strong>
          <div style="font-size:0.7rem;color:var(--color-text-muted);">Corner background video player</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggleVideo" ${adConfig.floatingVideo ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <div class="ad-toggle-row">
        <div>
          <strong>In-Content Native Banners</strong>
          <div style="font-size:0.7rem;color:var(--color-text-muted);">Between quiz & article units</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggleInline" ${adConfig.inlineAds ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <div style="margin-top:12px;padding:8px;background:var(--color-surface-alt);border-radius:6px;font-size:0.72rem;color:var(--color-text-secondary);">
        💡 <strong>Monetization Est:</strong> ~$12.80 - $18.50 RPM with active stealth native placements.
        <div id="stealthImpressionStats" style="margin-top:4px; font-weight:700; color:var(--color-primary);">Impressions Generated: 0</div>
      </div>
    `;

    document.body.appendChild(pill);
    document.body.appendChild(modal);

    pill.addEventListener('click', () => {
      modal.classList.toggle('open');
    });

    modal.querySelector('#closeAdModal').addEventListener('click', () => {
      modal.classList.remove('open');
    });

    // Wire up switches
    modal.querySelector('#toggleWallpaper').addEventListener('change', (e) => {
      adConfig.wallpaperAds = e.target.checked;
      saveConfig();
      applyAdState();
    });

    modal.querySelector('#toggleAnchor').addEventListener('change', (e) => {
      adConfig.anchorAd = e.target.checked;
      saveConfig();
      applyAdState();
    });

    modal.querySelector('#toggleVideo').addEventListener('change', (e) => {
      adConfig.floatingVideo = e.target.checked;
      saveConfig();
      applyAdState();
    });

    modal.querySelector('#toggleInline').addEventListener('change', (e) => {
      adConfig.inlineAds = e.target.checked;
      saveConfig();
      applyAdState();
    });
  }

  function updateWidgetCheckboxes() {
    const w = document.getElementById('toggleWallpaper');
    const a = document.getElementById('toggleAnchor');
    const v = document.getElementById('toggleVideo');
    const i = document.getElementById('toggleInline');
    if (w) w.checked = adConfig.wallpaperAds;
    if (a) a.checked = adConfig.anchorAd;
    if (v) v.checked = adConfig.floatingVideo;
    if (i) i.checked = adConfig.inlineAds;
  }

  function applyAdState() {
    const leftSkin = document.getElementById('skinAdLeft');
    const rightSkin = document.getElementById('skinAdRight');
    const anchor = document.getElementById('stickyAnchorAd');
    const video = document.getElementById('floatingVideoAd');
    const inlineAds = document.querySelectorAll('.ad-slot-inline');

    // Wallpaper
    if (leftSkin && rightSkin) {
      if (adConfig.wallpaperAds) {
        leftSkin.style.display = '';
        rightSkin.style.display = '';
        document.body.classList.add('has-wallpaper-ad');
      } else {
        leftSkin.style.display = 'none';
        rightSkin.style.display = 'none';
        document.body.classList.remove('has-wallpaper-ad');
      }
    }

    // Anchor
    if (anchor) {
      anchor.style.display = adConfig.anchorAd ? 'flex' : 'none';
    }

    // Floating Video
    if (video) {
      video.style.display = adConfig.floatingVideo ? 'flex' : 'none';
    }

    // Inline
    inlineAds.forEach(slot => {
      slot.style.display = adConfig.inlineAds ? '' : 'none';
    });
  }

  // Stealth Background Impression Trigger (Called on user interaction in quiz or navigation)
  window.triggerStealthAdRefresh = function () {
    stealthImpressionCount += 1;
    currentCreativeIndex = (currentCreativeIndex + 1) % rotatingCreatives.length;
    const creative = rotatingCreatives[currentCreativeIndex];

    const anchorTitle = document.getElementById('anchorTitle');
    const anchorCta = document.getElementById('anchorCta');
    if (anchorTitle && anchorCta) {
      anchorTitle.textContent = `${creative.title} — ${creative.desc}`;
      anchorCta.textContent = creative.cta;
    }

    const videoTitle = document.getElementById('videoAdTitle');
    if (videoTitle) {
      videoTitle.textContent = creative.title;
    }

    const statsEl = document.getElementById('stealthImpressionStats');
    if (statsEl) {
      statsEl.textContent = `Impressions Generated: ${stealthImpressionCount}`;
    }
  };

  // Boot
  document.addEventListener('DOMContentLoaded', initAds);
})();
