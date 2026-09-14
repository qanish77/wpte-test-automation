# WP Travel Engine — Playwright E2E Automation

End-to-end test suite for [WP Travel Engine](https://wptravelengine.com/) v6.8.0+, built with [Playwright](https://playwright.dev/).

**Test site:** `https://silent-flowers-190203.1wp.site`

---

## Quick Start

```bash
npm install
npx playwright install chromium
cp .env.example .env   # fill in credentials
npm test               # run all tests
```

`.env` must define:
```
BASE_URL=https://silent-flowers-190203.1wp.site
TEST_USER_EMAIL=...
TEST_USER_PASSWORD=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

---

## Project Structure

```
WPTE Automation/
├── playwright.config.js
├── .env / .env.example
│
├── pages/
│   ├── BasePage.js
│   ├── HomePage.js
│   ├── LoginPage.js
│   ├── TripListPage.js
│   ├── TripDetailPage.js
│   ├── BookingPage.js
│   ├── MyAccountPage.js
│   └── AdminPage.js              ← wp-admin login, WTE settings, trip list/edit
│
├── fixtures/
│   └── base.fixture.js           ← all fixtures incl. loggedInAdmin
│
├── utils/
│   ├── test-data.js              ← BASE_URL, URLS, ADMIN_URLS, USERS, TRIPS
│   ├── global-setup.js
│   └── helpers.js
│
├── tests/
│   ├── auth/login.spec.js
│   ├── account/my-account.spec.js
│   ├── trips/
│   │   ├── trip-listing.spec.js
│   │   ├── trip-detail.spec.js
│   │   └── trip-search-filter.spec.js
│   ├── booking/booking-flow.spec.js
│   ├── addons/                   ← one file per add-on
│   │   ├── fsd.spec.js
│   │   ├── group-discount.spec.js
│   │   ├── extra-services.spec.js
│   │   ├── partial-payment.spec.js
│   │   ├── travel-insurance.spec.js
│   │   ├── pickup-point.spec.js
│   │   └── accommodation.spec.js
│   └── admin/
│       ├── wte-settings.spec.js
│       └── trip-management.spec.js
│
└── claude/                       ← all documentation lives here
    ├── skill.md                  ← Claude Code skill + acceptance criteria
    ├── README.md                 ← this file
    ├── RELEASE.md                ← pre-release checklist
    └── SKILL.md                  ← auto-generated test run log
```

---

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm test` | All tests + update `claude/SKILL.md` |
| `npm run test:smoke` | Login + trip detail + booking (~2 min) |
| `npm run test:release` | Full suite incl. admin + addons (~15 min) |
| `npm run test:headed` | Visible browser |
| `npm run test:ui` | Playwright interactive UI |
| `npm run test:auth` | Auth tests only |
| `npm run test:trips` | Trip tests only |
| `npm run test:booking` | Booking tests only |
| `npm run test:account` | Account tests only |
| `npm run test:addons` | All add-on tests |
| `npm run test:addons:fsd` | FSD only |
| `npm run test:addons:group-discount` | Group Discount only |
| `npm run test:addons:extra-services` | Extra Services only |
| `npm run test:addons:partial-payment` | Partial Payment only |
| `npm run test:addons:travel-insurance` | Travel Insurance only |
| `npm run test:addons:pickup` | Pick Up Point only |
| `npm run test:addons:accommodation` | Accommodation only |
| `npm run test:admin` | Both admin spec files |
| `npm run test:admin:settings` | WTE settings only |
| `npm run test:admin:trips` | Trip management only |
| `npm run test:debug` | Debug mode |
| `npm run report` | Open HTML report |

---

## Trip Slugs

| Constant | Slug | ID |
|----------|------|-----|
| `TRIPS.everestBaseCamp` | `everest-base-camp-trek` | 2951 |
| `TRIPS.tigerNest` | `tiger-nest-monastery-tour-in-bhutan` | — |

---

## Add-ons Active on This Site

| Add-on | Active | Spec File |
|--------|--------|-----------|
| Fixed Starting Dates | ✅ | `addons/fsd.spec.js` |
| Group Discount | ✅ | `addons/group-discount.spec.js` |
| Extra Services | ✅ | `addons/extra-services.spec.js` |
| Partial Payment (Installment) | ✅ | `addons/partial-payment.spec.js` |
| Travel Insurance | ✅ | `addons/travel-insurance.spec.js` |
| Pick Up Point | ✅ | `addons/pickup-point.spec.js` |
| Accommodation | ✅ | `addons/accommodation.spec.js` |
| FSD Countdown | ❌ | covered in `fsd.spec.js` (graceful pass) |
| PDF Downloader | ❌ | covered in `fsd.spec.js` (graceful pass) |
| Social Proof | ❌ | covered in `fsd.spec.js` (graceful pass) |

---

## Viewing Results

```bash
npm run report        # opens playwright-report/index.html
```

Screenshots and traces are saved automatically on failure.
