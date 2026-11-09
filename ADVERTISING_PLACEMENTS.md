# PrepWise Advertising Placements & Monetization Architecture (Adsterra)

PrepWise uses **Adsterra** as its advertising provider across three strictly non-intrusive container display placements.

All advertising technologies are strictly gated behind first-party user consent (`PrepWiseConsent.hasConsent('advertising')`). Zero ad scripts load without explicit user consent.

---

## 1. The Three Active Display Placements

| Placement Slot ID | Page Context | Desktop Unit | Mobile Unit | Trigger Timing |
| :--- | :--- | :--- | :--- | :--- |
| **`ad-homepage-inline-secondary`** | Homepage content break | **Unit `32172762`** ($728 \times 90$) | **Unit `32172761`** ($320 \times 50$) | Lazy-loaded on scroll below company cards grid |
| **`ad-company-roles-inline`** | Company profile roles | **Unit `32172759`** (Native Banner) | **Unit `32172760`** ($300 \times 250$) | Loaded on user navigation to Roles & Salaries tab |
| **`ad-quiz-results`** | Post-quiz completion screen | **Unit `32172762`** ($728 \times 90$) | **Unit `32172760`** ($300 \times 250$) | Rendered strictly after test scoring & answer review |

---

## 2. Active Units & Format Specifications

| Unit ID | Format | Dimensions | Script Source / Key | Purpose |
| :---: | :--- | :---: | :--- | :--- |
| **`32172757`** | Popunder | Full Window | `https://abscloud.org/1/4290fb116e3ec38fe27d7faf2bc56147` | Global popunder with click guards; disabled on active quiz |
| **`32172758`** | Social Bar | Floating Bar | `https://bauval.org/14/2d767745db9b473a51148c8ec5f25276` | In-page interactive notification bar; disabled on active quiz |
| **`32172759`** | Native Banner | Responsive | `https://bauval.org/21/cf54b7a35f5f1b688587f9f9b2590912`<br>Container: `container-cf54b7a35f5f1b688587f9f9b2590912` | Desktop company role benchmarks content break |
| **`32172760`** | Banner 300x250 | $300 \times 250$ | Key: `0d9f54e21d55ad258d1ac8ff5a73433b`<br>Script: `https://bauval.org/22/0d9f54e21d55ad258d1ac8ff5a73433b` | Mobile company profile & mobile quiz results |
| **`32172761`** | Banner 320x50 | $320 \times 50$ | Key: `fadaa658a1da452b0f5bed520cfc9a09`<br>Script: `https://bauval.org/22/fadaa658a1da452b0f5bed520cfc9a09` | Mobile homepage leaderboard |
| **`32172762`** | Banner 728x90 | $728 \times 90$ | Key: `f2c5fa5caeb276be7a6a9192acffab05`<br>Script: `https://bauval.org/22/f2c5fa5caeb276be7a6a9192acffab05` | Desktop homepage & desktop quiz results |

---

## 3. Placements & Formats Permanently Disabled

Per educational UX policy, prohibited high-risk formats remain permanently disabled:
- **Smartlinks:** Prohibited (no opaque direct forced navigation).
- `ad-quiz-between-questions`: Permanently prohibited (zero ads during question solving).
- `ad-interstitial`: Permanently prohibited (no full-screen interrupts).
- `ad-exit-intent`: Permanently prohibited (no exit popups).

---

## 4. Educational Safeguards & Policy Invariants

1. **Explicit Cookie Consent Gate:**
   No ad script tag or iframe is created until the user explicitly accepts advertising cookies in `PrepWiseConsent`.
2. **Zero In-Quiz Interruptions:**
   No ads appear between questions or within question cards. While the student is actively solving questions, the quiz container is 100% ad-free.
3. **Cumulative Layout Shift (CLS) Prevention:**
   Every active slot reserves explicit min-height matching unit dimensions (`728x90` reserves 114px, `300x250` reserves 274px, `320x50` reserves 74px) with accessible `Advertisement` labels.
4. **Isolated Friendly Iframes:**
   Display banners execute in isolated child frames, preventing `window.atOptions` collision and CSS bleed.
5. **Emergency Kill-Switches:**
   `PREPWISE_ADSTERRA.killPlacement(id)` and `PREPWISE_ADSTERRA.killAll()` allow real-time programmatic shutdown if any ad unit misbehaves.
