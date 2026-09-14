# WPTE Automation — Project Context

## What this is
Playwright end-to-end test suite for a WordPress site running the **WP Travel Engine (WTE)** plugin and its add-ons.

**Site URL:** `https://silent-flowers-190203.1wp.site`
**Stack:** Node.js · Playwright · Page Object Model pattern
**All docs:** `claude/` folder — see `claude/skill.md` (full session history + methodology), `claude/README.md`, `claude/RELEASE.md`, `claude/test-log.md`

---

## Running tests

```bash
npm test                    # all tests (Desktop Chrome only)
npm run test:smoke          # quick pre-deploy check (~2 min)
npm run test:release        # full suite incl. admin (~15 min)
npx playwright test tests/booking/booking-flow.spec.js   # single file
npm run report              # open HTML report
```

**Prerequisites:** `.env` in project root with:
```
BASE_URL=https://silent-flowers-190203.1wp.site
TEST_USER_EMAIL=...
TEST_USER_PASSWORD=...
ADMIN_EMAIL=...       # WP username or email — either works with wp-login.php
ADMIN_PASSWORD=...
```

---

## Project structure

```
tests/
  auth/           login.spec.js · register.spec.js
  account/        my-account.spec.js
  trips/          trip-listing · trip-detail · trip-search-filter
  booking/        booking-flow.spec.js · booking-to-checkout.spec.js
  addons/         fsd · group-discount · extra-services · partial-payment
                  travel-insurance · pickup-point · accommodation
  admin/          global-settings · wte-settings · trip-settings

pages/            BasePage · HomePage · LoginPage · TripListPage
                  TripDetailPage · BookingPage · BookingModalPage · CheckoutPage
                  MyAccountPage · AdminPage

fixtures/         base.fixture.js — all fixtures incl. loggedInAdmin
utils/            test-data.js · helpers.js · global-setup.js · update-skill.js
claude/           All .md documentation files
```

`tests/edge-cases.spec.js` was removed (2026) — it was a large batch of generic
smoke checks (page loads, no JS errors, etc.) that duplicated coverage the
per-area spec files already provide more precisely. Not tracked anywhere else;
don't re-add without a specific reason.

---

## Methodology — read this before touching any spec file

Every addon and admin spec file in this repo has been rebuilt at least once under
one hard rule: **never guess a selector**. Every locator in every spec file below
was confirmed against the live site — via REST API calls, DOM dumps, or
screenshots — before being written into a test. Developer docs and CLAUDE.md
files provided for each add-on describe *intent*, not necessarily the live
site's *current* markup — content, config, and even entire UI sections drift
between sessions on this install, so re-verify rather than trust old notes
(including this file) at face value when something looks off.

**The anti-pattern to never write, and to remove on sight:**
```js
const el = page.locator('[class*="guessed-selector"]').first();
if (await el.count() === 0) { return; }      // "graceful" early exit
expect(await el.count()).toBeGreaterThan(0); // ALWAYS true at this point — tautology
```
This shape passes unconditionally regardless of what the page actually contains
— it was the root cause of most of the "passing" tests in this repo actually
testing nothing. If a feature is genuinely optional/not-configured, assert on a
real signal that distinguishes "not configured" from "configured but broken"
(see the addon spec files' "discovery-only" tests for the pattern), or use
`test.info().annotations.push({ type: 'skip-reason', ... })` to document *why*
you're not asserting, rather than silently returning.

**Live-verification workflow used throughout:**
1. Read the add-on's REST response (`/wp-json/wptravelengine/v2/trips/{id}`,
   `/wp-json/wptravelengine/v2/settings` — the latter needs an authenticated
   `X-WP-Nonce` header even for GET, see any `fetchGlobalSettings()` helper in
   `tests/addons/`) as ground truth.
2. Write a disposable Node script (not a test file) that logs in, navigates, and
   dumps the real DOM/`data-*` attributes/network requests. Run it, read the
   output, delete the script.
3. Build the locator from what was actually found — prefer stable anchors
   (real `name`/`id` attributes, unique header text, `data-*` attributes) over
   guessed class names, since this app mixes real CSS classes with unstable
   CSS-in-JS hashes (`css-xxxxx`).
4. Run the actual spec file and iterate on genuine failures.
5. Run the FULL affected shared-page-object's other consumers afterward (see
   below) before calling anything done.

**Read-only by default.** All addon test suites are read-only against the live
site — no Save/write/admin-mutation tests — unless explicitly asked otherwise.

**Shared page objects (`pages/*.js`) must only be extended additively.** Several
addons' checkout/admin flows share `CheckoutPage.js`, `AdminPage.js`, and
`BookingModalPage.js`. Before calling any addon work done, diff the shared page
object files to confirm changes are additive (new properties/methods, doc
comments), then run the other consumers' test files to confirm nothing
regressed — this has caught real accidental breakage multiple times.

---

## Key site facts (re-verify before trusting — see Methodology above)

### Trip detail page
- Booking modal (React) opens via `button.wte-book-now` / `#open-booking-modal`,
  real overlay `.wpte-modal__screen-overlay`, chrome `.wpte-modal` — see
  `pages/BookingModalPage.js` for the full, heavily-verified step-by-step API
  (date selection, traveler counts, extra services, accommodation, checkout).
- Price wrapper: `.wpte-trip-price-wrapper`

### Checkout page
- Checkout is at **`/checkout/`** — `/booking/` redirects to homepage,
  `/travel-booking/` → 404.
- Without an active booking session, `/checkout/` shows a WTE validation error.
- `pages/CheckoutPage.js` has the verified per-add-on checkout fields (pickup
  point select, travel insurance opt-in/plans, payment gateway radios) and
  `triggerCartUpdate()` — the reliable way to read post-interaction cart totals
  (NOT `window.wptravelengineCart.cart_totals`, which is a one-time page-load
  snapshot that never updates after an AJAX cart refresh — a real, confirmed
  finding, not a guess).

### My account / login
- Login page: `/my-account/`
- Login form: `.wpte-lrf-wrap.wpte-login`
- Dashboard: `.wpte-lrf-wrap.wpte-dashboard`

### Admin — WTE global settings
- **Correct URL:** `/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php`
  — NOT `/wp-admin/admin.php?page=wp-travel-engine-settings` (that URL now
  returns HTTP 403 "Sorry, you are not allowed to access this page" even for a
  full Administrator account — a real, confirmed site regression, not a
  credentials issue). See `AdminPage.goToSettings()`.
- The settings page is a React app with a left-hand **accordion nav**: General
  (Pages, Trip Settings), Emails (Notifications, Settings), Display, Currency
  (General), Payments (General, Tax Settings, Booking Fee, one per gateway),
  Dashboard, Extensions (one per add-on), Performance. Default landing view is
  General > Pages.
- **Navigate by direct hash URL, never by clicking through the accordion.**
  Every sub-item has its own real, stable hash (found via each link's actual
  `href` — e.g. `#currency-general`, `#emails_notification`, `#payment-general`).
  A click-based approach (an earlier `openSettingsSubItem()` helper, since
  removed) was live-confirmed genuinely unreliable: a failure screenshot showed
  the sidebar highlighting the correct sub-item as "active" while the main
  content panel silently kept showing the previous tab's content — a real
  client-side routing bug in this app, not a timing issue. See
  `AdminPage.goToCurrencySettings()` / `goToPaymentsGeneralSettings()` /
  `goToNotificationsSettings()` for the pattern (same one every per-add-on
  settings navigator in this file already used).
- Most fields are custom dropdowns, not native `<select>`s — scope by the
  field's own `<label>` text via a `.wpte-form-control` wrapper (see
  `AdminPage.js`'s `settingsField()` helper), not by name/id guesses.
- Trip edit page's title is a contenteditable block inside the editor's own
  iframe (`iframe[name="editor-canvas"]`), not a plain `#title` input — see
  `AdminPage.tripTitleInput`.
- All admin tests guard every assertion with `if (!loggedIn) { return; }` —
  credentials may vary per environment.

---

## Test data

| Constant | Value |
|---|---|
| `TRIPS.everestBaseCamp.slug` | `everest-base-camp-trek` |
| `TRIPS.everestBaseCamp.id` | `2951` |
| `TRIPS.tigerNest.slug` | `tiger-nest-monastery-tour-in-bhutan` |
| `URLS.checkout` | `/checkout/` |
| `URLS.login` | `/my-account/` |
| `ADMIN_URLS.settings` | `/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php` |
| `ADMIN_URLS.tripList` | `/wp-admin/edit.php?post_type=trip` |

---

## Add-ons — all rebuilt with live-verified real tests

| Add-on | Spec file | Notes |
|---|---|---|
| Fixed Starting Dates | `addons/fsd.spec.js` | |
| Group Discount | `addons/group-discount.spec.js` | Currently enabled globally but not configured per-trip on either test trip — tests are discovery-based, not guesses |
| Extra Services | `addons/extra-services.spec.js` | |
| Partial Payment | `addons/partial-payment.spec.js` | No full-vs-partial UI toggle exists anymore — split is computed automatically, verified via `cart_totals` math |
| Travel Insurance | `addons/travel-insurance.spec.js` | Real UI is on the checkout page, not the trip page/booking modal |
| Pick Up Point | `addons/pickup-point.spec.js` | Real UI is a per-traveler `<select>` on checkout, not a Yes/No radio on the booking form |
| Accommodation | `addons/accommodation.spec.js` | |

Each spec file's own header comment documents exactly what was verified live and
how — read that before modifying, not just this summary table.

---

## Known fixes applied (see `claude/skill.md` for full session-by-session history)

- **Admin settings URL** was stale (`wp-travel-engine-settings` → 403). Fixed to
  the real `class-wp-travel-engine-admin.php` URL across `AdminPage.js`,
  `utils/test-data.js`, and both admin settings spec files.
- **Admin trip title field** matched nothing (`#title` doesn't exist on this
  install's editor) — fixed to the real iframe-scoped contenteditable element.
- **`booking-flow.spec.js`**: two tests used guessed booking-form/traveler-count
  selectors behind the vacuous-pass pattern — fixed using the already-verified
  `BookingModalPage` locators.
- **`tests/edge-cases.spec.js`** removed entirely — see Methodology section.
