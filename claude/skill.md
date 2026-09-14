# Skills

---
name: wp-travel-engine-qa
description: QA testing, bug investigation, regression testing, and Playwright automation for WP Travel Engine and its add-ons.
---

# WP Travel Engine QA Engineer

You are an experienced QA Engineer specializing in **WP Travel Engine** and its add-ons.
Plugin repo: `https://github.com/Codewing-Solutions/wptravelengine.git` (private)
Test site: `https://silent-flowers-190203.1wp.site`

---

## The one rule that matters most

**Never guess a selector, a URL, or a piece of plugin behavior.** Developer docs
and CLAUDE.md files provided for an add-on describe *intent*, not necessarily
what's actually live right now — this site's content, configuration, and even
entire UI sections drift between sessions (an admin URL that worked before can
403 later; a feature enabled globally may not be configured on either test
trip; a documented UI element can simply not exist). Before writing a single
locator: hit the REST API for ground truth, write a disposable Node script to
dump the real DOM/network traffic, then build the test from what you actually
found. See "Live-verification workflow" below for the exact steps.

**The anti-pattern that caused most of this repo's "passing" tests to test
nothing, for years, without anyone noticing:**
```js
const el = page.locator('[class*="guessed-selector"]').first();
if (await el.count() === 0) { return; }      // "graceful" early exit
expect(await el.count()).toBeGreaterThan(0); // ALWAYS true here — tautology
```
By the time the assertion runs, the guard above it has already guaranteed
`count > 0` (otherwise it returned). This passes unconditionally regardless of
what the page contains. It was found and removed across every addon spec file
and all three admin spec files. If you see this shape anywhere else in the
repo, it needs the same treatment: replace with a real assertion, or — if the
feature genuinely isn't configured on the current test data — use
`test.info().annotations.push({ type: 'skip-reason', description: '...' })` to
document *why*, which is honest about not testing rather than silently faking
a pass.

---

## Live-verification workflow

1. **REST first.** `GET /wp-json/wptravelengine/v2/trips/{id}` for trip-level
   add-on config (public); `GET /wp-json/wptravelengine/v2/settings` for global
   add-on config (requires an authenticated `X-WP-Nonce` header even for GET —
   log in, then `page.evaluate(() => window.wpApiSettings?.nonce)`). This is
   ground truth for what a feature is *supposed* to do.
2. **Disposable Node scripts, not test files**, to see what's *actually*
   rendered: log in via `AdminPage`/`LoginPage`, navigate, and
   `page.evaluate()` a DOM dump, or `page.on('request'/'response')` to see real
   AJAX payloads. Run with `node script.js`, read the output, delete the
   script — never leave these in the repo.
3. **Build locators from what you found**, preferring stable anchors: real
   `name`/`id` attributes, a unique `<th>`/`<label>` text, `data-*` attributes
   — over guessed class names. This app mixes real, stable CSS classes with
   unstable CSS-in-JS hashes (`css-xxxxx`); never key off the latter.
4. **Run the spec, iterate on genuine failures.** Distinguish a test-code bug
   (fix silently) from real, reproducible site behavior (document it precisely
   in the spec file's header comment with evidence, and assert the real
   invariant rather than an assumed one — see `partial-payment.spec.js` and
   `pickup-point.spec.js` for two cases where the "obvious" assumption about a
   pricing formula was wrong and the live-verified reality was documented
   instead).
5. **Before calling anything done: diff the shared page objects** (`pages/*.js`)
   to confirm changes are additive only, then run every OTHER spec file that
   consumes the page object(s) you touched. This has caught real regressions
   more than once — see "Known fixes" below.

---

## Acceptance Criteria

> Populated when plugin ZIPs, feature requirements, or (this repo's actual
> pattern) per-add-on `developer-docs.md` + `CLAUDE.md` + public plugin doc URL
> are provided.
> Format: feature name · source · criteria list · test file.

| Feature | Source | Criteria | Test File |
|---------|--------|----------|-----------|
| Accommodation | developer-docs.md + CLAUDE.md + public docs | Real room pricing math (shared vs. non-shared), checkout summary, admin trip/global config match REST | `addons/accommodation.spec.js` |
| Extra Services | developer-docs.md + CLAUDE.md + public docs | Single-item and grouped ("Choose One"/"Choose Any") pricing math, admin table, global service library | `addons/extra-services.spec.js` |
| Fixed Starting Dates | developer-docs.md + CLAUDE.md + public docs | Calendar auto-select, past-day disabling, real date switching | `addons/fsd.spec.js` |
| Group Discount | developer-docs.md + CLAUDE.md + public docs | Admin config fields, sale-badge math; tiered pricing is discovery-only (not configured on either test trip right now) | `addons/group-discount.spec.js` |
| Partial Payment | developer-docs.md + CLAUDE.md + public docs | Admin settings match REST, `cart_totals` percent-based math verified live (no UI toggle exists — computed automatically) | `addons/partial-payment.spec.js` |
| Pickup Point | developer-docs.md + CLAUDE.md + public docs | REST-configured points render as a real per-traveler checkout `<select>`; paid/zero-cost pricing deltas verified live | `addons/pickup-point.spec.js` |
| Travel Insurance | developer-docs.md + CLAUDE.md + public docs | Plan data mirrors REST; both pricing formulas (per-person, percentage-of-tour) verified via a real plan-switch replay | `addons/travel-insurance.spec.js` |
| Admin settings suite | internal (bug report) | Every admin settings/trip-edit test asserts real content via the correct accordion nav, not a stale URL or guessed selector | `admin/global-settings.spec.js`, `admin/wte-settings.spec.js`, `admin/trip-settings.spec.js` |
| Booking flow | internal (bug report) | Modal/traveler-count tests use the real, verified `BookingModalPage` locators | `booking/booking-flow.spec.js` |

✅ All of the above covered and passing (with only ordinary shared-hosting
timing flakiness — self-heals on Playwright's built-in retry).

---

## What Has Been Built (full history)

### Session 1 — Initial setup + bug fixes
- Fixed `booking-flow.spec.js` Test 4 (FSD was skipping due to wrong selector + hidden tab)
- Fixed `booking-flow.spec.js` Test 6 (Checkout was skipping — `/booking/` redirects, no `.wpte-checkout` without session)
- Result: 7/7 booking-flow tests passing, 0 skipped

### Session 2 — Add-on tests fixed (wte-addons.spec.js)
- Fixed Group Discount, Extra Services, Partial Payment selectors; replaced `test.skip()` with graceful `return` for inactive add-ons
- Result: 11/11 addon tests passing, 0 skipped

### Session 3 — Restructure + new add-ons + admin tests
- Split monolithic `wte-addons.spec.js` into one file per add-on
- Added `tests/admin/`, `pages/AdminPage.js`, `loggedInAdmin` fixture
- Result: 79/79 tests passing

### Session 4 — Documentation consolidated to `claude/`
- Moved all docs into `claude/`, kept `CLAUDE.md` at root for auto-load

### Session 5 — Full functional test overhaul + multi-browser
- Rewrote addon specs as customer-journey tests; added multi-browser/mobile config

### Session 6 — Edge Cases & Enhanced Infrastructure
- Added `tests/edge-cases.spec.js` (100+ generic smoke tests) and 30+ helper functions
- **Superseded — see Session 7: this file and its `npm run test:edge-cases*`
  scripts were removed entirely.** Its coverage (page-load/404/JS-error/mobile
  smoke checks) duplicated what the per-area spec files test more precisely,
  and it added significant run time without a distinguishing purpose.

### Session 7 — Full addon rebuild + admin bug fix + cleanup (this is the big one)

**Rebuilt all 7 addon spec files from scratch**, given each add-on's own
`developer-docs.md` + `CLAUDE.md` + public wptravelengine.com plugin page,
following the Live-verification workflow above. Every one supersedes an older
version that wrapped guessed `[class*="..."]` selectors in the vacuous
`if (count === 0) return` pattern:

- `addons/accommodation.spec.js` — real room-pricing math distinguishes shared
  vs. non-shared bookings (flat price vs. price × quantity) — a wrong uniform
  assumption was caught and fixed by live testing.
- `addons/extra-services.spec.js` — real structure discovered
  (`.wte-trip-options > .wte-service-options-item` for single items,
  header+collapse pairs for "Choose One"/"Choose Any" groups); a real timing
  bug was investigated (a "Choose One" total's recompute can take several
  seconds server-side) and handled with `expect.poll` instead of a fixed wait.
- `addons/fsd.spec.js` — calendar auto-select, and a corrected assertion
  (not all disabled days are in the past — a genuine future sold-out date was
  found, so the test only asserts the one direction that must always hold).
- `addons/group-discount.spec.js` — confirmed live that the add-on is enabled
  globally but not configured on either test trip right now; the sale-price
  badge (a *different*, unrelated feature) is verified with real math instead.
- `addons/partial-payment.spec.js` — confirmed live that the old
  `#wp_travel_engine_payment_mode-full/-partial` radio UI no longer exists;
  the split is computed automatically and exposed via
  `window.wptravelengineCart.cart_totals`, verified against the live
  `payment_percent` admin setting.
- `addons/pickup-point.spec.js` — confirmed live the real UI is a per-traveler
  `<select>` on the CHECKOUT page (not a Yes/No radio + text field on the
  booking form, which doesn't exist). A genuine pricing anomaly was found and
  documented (a configured ₹12 pickup point reproducibly charges ₹13.34) —
  asserted as the invariant that actually holds (paid > 0, zero-cost options
  identical, deterministic) rather than a guessed formula.
- `addons/travel-insurance.spec.js` — confirmed live the real UI is on
  checkout (not the trip page). Both pricing formulas (per-person and
  percentage-of-tour-cost, with the latter excluding existing insurance from
  its base to avoid circularity, per the plugin's own docs) were verified via
  a real plan-switch replay reading the plugin's own `data-price` attributes.

**Fixed a real, reported admin bug** (`tests/admin/global-settings.spec.js`,
`wte-settings.spec.js`, `trip-settings.spec.js` were failing/vacuously
passing):
- Root cause: `AdminPage.goToSettings()` used a stale URL
  (`admin.php?page=wp-travel-engine-settings`) that now 403s for a full
  Administrator account — not a credentials issue (confirmed: every other
  admin page loads fine in the same session). Fixed to the real URL
  (`edit.php?post_type=booking&page=class-wp-travel-engine-admin.php`).
- Mapped the settings app's entire left-hand accordion nav live (General,
  Emails, Display, Currency, Payments, Dashboard, Extensions, Performance,
  each with real sub-items) and added dedicated navigators
  (`goToCurrencySettings()`, `goToPaymentsGeneralSettings()`,
  `goToNotificationsSettings()`). First attempt drove these by clicking through
  the accordion (an `openSettingsSubItem()` helper), which surfaced two more
  real bugs before being abandoned in favor of direct hash-URL navigation:
  (1) matching a section header by `hasText` is ambiguous — `hasText:
  'Currency'` also matches "Currency Converter" (an Extensions sub-item,
  present in the DOM even collapsed), a genuine strict-mode collision, not
  flakiness; (2) even after fixing that, a failure screenshot showed the
  sidebar highlighting the correct sub-item as "active" while the main content
  panel silently kept showing the previous tab's content — a real client-side
  routing bug in this app that no amount of waiting fixes. `openSettingsSubItem()`
  was removed; every sub-item has its own real, stable hash (e.g.
  `#currency-general`, `#emails_notification`, `#payment-general`, found via
  each link's actual `href`), matching the pattern already used by every
  per-add-on settings navigator in this file — direct hash navigation sidesteps
  the routing bug entirely.
- Fixed every other vacuous test the URL bug had been masking: Payment
  Currency and Checkout/Thank-You/Confirmation Page fields are custom
  dropdowns (not native `<select>`s) scoped by their own `<label>` text; the
  Save button is `button[type="submit"]` with real text (and is legitimately
  `disabled` until a field changes — not a bug); payment gateway checkboxes
  and notification triggers are real, `<label>`-wrapped, unnamed controls.
- Fixed `trip-settings.spec.js`'s trip-title test: this install's post editor
  renders the title as a contenteditable block inside the editor's own iframe
  (`iframe[name="editor-canvas"]`), not a plain `#title` input — `AdminPage
  .tripTitleInput` now uses `page.frameLocator(...)`.

**Fixed `booking-flow.spec.js`** (2 of its 14 tests had the same vacuous
pattern, guessing `.wpte-bf-outer`/`input[name*="pax"]`): both now use the
already-verified `BookingModalPage` locators (`.wpte-modal`, `.wte-process
-layout`, `row(0).countInput` after advancing to the Package Type step).

**Removed `tests/edge-cases.spec.js` entirely**, along with its `package.json`
scripts (`test:edge-cases`, `test:edge-cases:all`) and its entry in
`test:release`.

**Confirmed, by actually running the suites (not by inspection alone), that
none of the above hampered anything else:** `tests/trips/`, `tests/auth/`,
`tests/account/` don't reference any page object touched this session at all;
`tests/booking/` runs clean. All shared page-object edits
(`CheckoutPage.js`, `AdminPage.js`) were additive-only — verified by diff
before every "done" declaration.

---

## Project Structure (current)

```
WPTE Automation/
├── playwright.config.js
├── .env / .env.example
├── CLAUDE.md                     ← auto-loaded by Claude Code (must stay at root)
│
├── pages/
│   ├── BasePage.js
│   ├── HomePage.js
│   ├── LoginPage.js
│   ├── TripListPage.js
│   ├── TripDetailPage.js
│   ├── BookingPage.js
│   ├── BookingModalPage.js       ← the React booking-modal API (heavily verified)
│   ├── CheckoutPage.js           ← per-add-on checkout fields + triggerCartUpdate()
│   ├── MyAccountPage.js
│   └── AdminPage.js              ← settings-app accordion nav + per-add-on admin tabs
│
├── fixtures/base.fixture.js
├── utils/test-data.js · global-setup.js · helpers.js
│
├── tests/
│   ├── auth/login.spec.js · register.spec.js
│   ├── account/my-account.spec.js
│   ├── trips/trip-listing · trip-detail · trip-search-filter
│   ├── booking/booking-flow.spec.js · booking-to-checkout.spec.js
│   ├── addons/
│   │   ├── accommodation.spec.js
│   │   ├── extra-services.spec.js
│   │   ├── fsd.spec.js
│   │   ├── group-discount.spec.js
│   │   ├── partial-payment.spec.js
│   │   ├── pickup-point.spec.js
│   │   └── travel-insurance.spec.js
│   └── admin/
│       ├── global-settings.spec.js
│       ├── wte-settings.spec.js
│       └── trip-settings.spec.js
│
└── claude/
    ├── skill.md      ← YOU ARE HERE — skill + acceptance criteria + history
    ├── README.md     ← human docs + quick start
    ├── RELEASE.md    ← pre-release checklist
    └── test-log.md   ← auto-generated after every npm test
```

---

## Key Selectors (verified live — re-verify anything not touched this session before trusting it further)

| Area | Selector | Notes |
|------|----------|-------|
| Login wrapper | `.wpte-lrf-wrap.wpte-login` | |
| Dashboard wrapper | `.wpte-lrf-wrap.wpte-dashboard` | |
| Book Now btn | `button.wte-book-now`, `#open-booking-modal` | |
| Booking modal | `.wpte-modal` (overlay: `.wpte-modal__screen-overlay`) | React SPA; a legacy hidden Underscore.js template also exists in the DOM and shares some class names — always scope descendant locators to `.wpte-modal`, never query globally (see `BookingModalPage.js` header) |
| Traveler count input | `.wte-qty-number input` (via `BookingModalPage.row(i).countInput`) | only present on the modal's "Package Type" step — one `goNext()` past the opening Date & Time step |
| Price wrapper | `.wpte-trip-price-wrapper` | |
| Checkout page | `/checkout/` (never `/booking/`, which redirects home) | detect via `h1.entry-title:has-text("Checkout")` |
| Admin WTE settings | `/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php` | NOT `admin.php?page=wp-travel-engine-settings` — that 403s now |
| Admin settings field | `.wpte-form-control` scoped by its own `<label>` text | most fields are custom dropdowns, not native `<select>`s |
| Admin trip title | inside `iframe[name="editor-canvas"]`, `.editor-post-title__input` (contenteditable, not a form input) | |
| Pickup Point select | `#travellers_{i}_pickup_point` on the CHECKOUT page | not a booking-form Yes/No radio |
| Travel Insurance | `#wpte-checkout__travel-insurance-plans-list` (has a `data-plans` JSON attribute — ground truth without a REST call) on the CHECKOUT page | not the trip page |
| Partial Payment | `window.wptravelengineCart.cart_totals` (via `CheckoutPage.getCartTotals()`/`triggerCartUpdate()`) | no full-vs-partial UI toggle exists |
| WP Admin bar | `#wpadminbar` | presence = logged in |

---

## Critical Rules

1. **Never guess a selector or URL — verify live first.** See "Live-verification workflow" above.
2. **Never write `if (count === 0) { return; } expect(count).toBeGreaterThan(0)`** — it's a tautology. Use a real assertion, or a documented `skip-reason` annotation.
3. **Booking modal locators must be scoped under `.wpte-modal`** — a legacy hidden template shares class names and causes strict-mode violations otherwise.
4. **`/booking/` redirects to homepage** — always use `/checkout/`.
5. **Admin tests** → always guard with `if (!loggedIn) { return; }` before URL/title assertions (credentials vary per environment).
6. **Shared page objects are additive-only.** Diff `pages/*.js` before calling any change done, then run every other consumer spec file.
7. **`window.wptravelengineCart.cart_totals` is a one-time page-load snapshot** — never updates after an AJAX cart refresh. Use `CheckoutPage.triggerCartUpdate()` for anything read after an in-page interaction.
8. **This app mixes real CSS classes with unstable CSS-in-JS hashes** (`css-xxxxx`) — never key a locator off the hashed ones; prefer real `name`/`id`/label-text anchors.
9. **Site content and even URLs drift between sessions** — a working selector or admin URL from a prior session is a hypothesis to re-check, not a guarantee.

---

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm test` | All tests on Desktop Chrome + update `claude/test-log.md` |
| `npm run test:all-browsers` | All tests on all 5 browser/device configs |
| `npm run test:smoke` | Login + trip + booking on Chrome (~2 min) |
| `npm run test:release` | Chrome + Safari full suite, excl. edge cases (removed) (~15 min) |
| `npm run test:cross-browser` | Booking + trips on all 4 browsers |
| `npm run test:chrome` / `test:safari` / `test:mobile` / `test:mobile-chrome` / `test:mobile-safari` / `test:ipad` | Per-browser/device runs |
| `npm run test:headed` | Visible browser (Chrome) |
| `npm run test:auth` / `test:trips` / `test:booking` / `test:account` | Per-area runs |
| `npm run test:addons` | All add-on tests |
| `npm run test:addons:fsd` / `:group-discount` / `:extra-services` / `:partial-payment` / `:travel-insurance` / `:pickup` / `:accommodation` | One add-on at a time |
| `npm run test:admin` | All three admin spec files |
| `npm run test:admin:global` | `global-settings.spec.js` only |
| `npm run test:admin:trip-settings` | `trip-settings.spec.js` only |
| `npm run report` | Open HTML report |

---

## Adding New Tests (checklist)

1. Read the add-on's `developer-docs.md` + `CLAUDE.md` + public plugin doc page for intent — treat as a hypothesis, not fact.
2. Do live reconnaissance (REST + disposable Node scripts) per the Live-verification workflow above.
3. Add real, verified locators/methods to the relevant page object in `pages/` — additive only if the file is shared.
4. Create/update `tests/{area}/{feature}.spec.js`, importing `const { test, expect } = require('../../fixtures/base.fixture')`.
5. Never write the `if (count===0) return` + `toBeGreaterThan(0)` tautology. If a feature isn't configured on the current test data, use a `skip-reason` annotation and explain why in the file's own header comment.
6. Admin tests → guard with `if (!loggedIn) { return; }`.
7. Run the new/changed spec file until green, then run every other consumer of any shared page object you touched.
8. Run `npm test` — auto-updates `claude/test-log.md`.
9. Add/update an entry in the **Acceptance Criteria** section above.
