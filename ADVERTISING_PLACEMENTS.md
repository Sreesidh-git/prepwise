# PrepWise Advertising Placements & Monetization Architecture

PrepWise has transitioned to **Adsterra** as its prospective sole advertising provider.

All 13 registered ad units in this codebase are currently **disabled** (`enabled: false`).
Zero mock ad keys, simulated impressions, or placeholder scripts run on this platform.

Monetization will launch only after the Adsterra publisher account and domain (`prepwises.online`) are approved and genuine provider ad tags are installed.

---

## 1. Initial Launch Placement Strategy (3 Placements)

To protect the educational student experience and prevent layout clutter or accidental clicks, PrepWise initially selects only three placements:

| ID | Location | Format & Sizing | Intended Trigger | Launch Role |
| :--- | :--- | :--- | :--- | :--- |
| `ad-homepage-inline-secondary` | Below the homepage company cards grid | Banner: 728×90 (desktop) / 320×50 (mobile) | Natural content break after grid render | **Launch Candidate 1** (Homepage in-content) |
| `ad-company-roles-inline` | Between company syllabus and hiring roles | Native banner / 300×250 rectangle | After roles grid render | **Launch Candidate 2** (Company profile native) |
| `ad-quiz-results` | Strictly below quiz completion score & answers | Responsive Banner: 728×90 (desktop) / 300×250 (mobile) | After test completion and results render | **Launch Candidate 3** (Quiz completion screen) |

---

## 2. Placements Kept Disabled (10 Placements)

The remaining 10 placements remain explicitly disabled in `js/ad-registry.js` and `js/adsterra-config.js`:

| ID | Reason for Disabling |
| :--- | :--- |
| `ad-homepage-leaderboard` | Reserved; limited to 1 in-content banner on homepage initially. |
| `ad-homepage-inline-tertiary` | Reserved; secondary in-content slot sufficient for long-scroll flow. |
| `ad-company-inline` | Reserved; company overview kept distraction-free. |
| `ad-company-sidebar` | Reserved; company sidebar kept focused on official metadata. |
| `ad-quiz-before-results` | Reserved; must never delay or obstruct quiz scoring. |
| `ad-sticky-bottom-desktop` | Reserved; sticky banners restricted to avoid obstructing student navigation. |
| `ad-sticky-bottom-mobile` | Reserved; preserves mobile viewport height. |
| `ad-quiz-between-questions` | **PROHIBITED:** High policy risk. Zero ads permitted during active quizzes or near answer buttons. |
| `ad-interstitial` | **PROHIBITED:** Full-screen overlays violate educational UX standards. |
| `ad-exit-intent` | **PROHIBITED:** Exit popups degrade user trust. |

---

## 3. Adsterra Quality & Safety Invariants

In the Adsterra Publisher Dashboard, the following formats and categories MUST be excluded:
- **No Adult / NSFW Content**
- **No Gambling or Casino Promotions**
- **No Software / Deceptive Download Alerts** (e.g. fake "virus detected" or "browser update" warnings)
- **No Forced Redirects or Browser Abuse**
- **No Popunders (Onclick)**
- **No Smartlinks** (Smartlinks are strictly prohibited on quiz buttons, navigation links, or question options)

---

## 4. Technical Architecture & File Inventory

- [`js/adsterra-config.js`](./js/adsterra-config.js): Central source of truth for Adsterra settings, publisher ID, unit types, dimensions, and per-placement enable/disable switches.
- [`js/adsterra-provider.js`](./js/adsterra-provider.js): Provider implementation implementing the `request({ placement, element })` contract for `window.PREPWISE_ADS`. Enforces consent verification, deduplication, responsive layout reservation, and emergency kill-switches (`PREPWISE_ADSTERRA.killPlacement` and `PREPWISE_ADSTERRA.killAll`).
- [`js/ad-registry.js`](./js/ad-registry.js): Browser-safe catalog of all 13 placements. All set to `enabled: false`.
- [`js/ad-loader.js`](./js/ad-loader.js): Provider-agnostic lifecycle engine (device targeting, IntersectionObserver lazy loading, frequency-capping, Escape dismissal).
- [`js/consent.js`](./js/consent.js): First-party cookie and preference manager. Ads will NEVER load without explicit `advertising: true` consent.
