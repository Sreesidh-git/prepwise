# PrepWise advertising placements

All placements in this document are empty and disabled. They are reserved for a
future advertising integration and must not be activated with fake content,
simulated impressions, simulated clicks, or simulated revenue.

Before activation, verify the selected ad network's accepted formats,
publisher policies, consent requirements, frequency limits, and rules for
interstitial, exit-intent, sticky, and mobile placements.

## Placement inventory

| ID | Location | Intended trigger | Notes |
| --- | --- | --- | --- |
| `ad-homepage-leaderboard` | Below the homepage ticker/navigation area | Initial page load or eligible viewport | Existing responsive leaderboard slot |
| `ad-homepage-inline-secondary` | Below the homepage company grid | After company grid render | Additional long-page in-content slot |
| `ad-homepage-inline-tertiary` | Before “How It Works” | Scroll/viewport eligibility | Additional long-page in-content slot |
| `ad-company-inline` | Company overview between interview process and milestones | Overview render or viewport eligibility | Existing responsive in-content slot |
| `ad-company-sidebar` | Company overview right sidebar | Overview render or viewport eligibility | Existing desktop sidebar slot; stacks on smaller screens |
| `ad-company-roles-inline` | Below the company roles grid | After role grid render | Additional long-page in-content slot |
| `ad-quiz-between-questions` | Quiz flow below the question area | Between-question lifecycle event | Must never block answer, skip, next, or completion controls |
| `ad-quiz-before-results` | Immediately before quiz results | Before results render | Must not delay or obstruct result rendering |
| `ad-quiz-results` | Immediately below quiz results | Results render | Existing responsive results banner |
| `ad-sticky-bottom-desktop` | Fixed bottom edge on desktop | Eligible page load or controlled frequency | Requires visible dismiss control; must not cover essential controls |
| `ad-sticky-bottom-mobile` | Fixed bottom edge on mobile | Eligible page load or controlled frequency | Requires visible dismiss control and safe-area handling |
| `ad-interstitial` | Full-screen overlay | Future page transition or explicit eligible event | Requires dismiss control, focus management, and policy review |
| `ad-exit-intent` | Full-screen/modal overlay | Future exit-intent event | Desktop-first; must be dismissible and never trap navigation |

## Activation requirements

The base `.ad-slot` class is collapsed. Future integration code must explicitly
add `.is-enabled` only after a real ad response is available. Overlay slots
also require removing the `hidden` attribute, and sticky/overlay slots include
reserved close buttons for the integration to reveal and wire.

Do not activate interstitials, exit-intent units, sticky units, or additional
in-content units until the selected network's publisher policies and applicable
privacy/consent requirements have been reviewed.

## Infrastructure

- [`js/ad-registry.js`](./js/ad-registry.js) is the single browser-safe
  registry for all 13 placements. Every entry is disabled by default and may
  carry future provider-specific configuration without naming a provider.
- [`js/ad-loader.js`](./js/ad-loader.js) provides lazy loading, device
  targeting, provider injection, state tracking, frequency-cap hooks, session
  dismissal, Escape handling, and focus restoration. It makes no ad request
  while a placement is disabled.
- Advertising lifecycle hooks call the existing GA4 path. They are currently
  not sent to the Supabase analytics endpoint because the current database
  constraint accepts only the existing public event names. A future analytics
  migration can add validated advertising event names before server ingestion
  is enabled.
- The private admin dashboard has an informational Advertising section showing
  the registry, page, device, trigger, provider, and disabled status. It does
  not expose public controls or invent revenue metrics.
