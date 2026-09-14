/**
 * Trip Settings — Admin Functional Tests
 *
 * Tests that an admin can configure all key settings on a trip edit page:
 * - Basic info: title, duration
 * - Fixed Starting Dates / package pricing
 * - Add-on settings (extra services, insurance, accommodation)
 * - Trip list management
 *
 * Every selector here was verified live against the running site — see
 * pages/AdminPage.js (tripMetaBox, tripDurationField, tripEditMetaTab(),
 * tripDatesTab, editPricingDatesBtns) for citations.
 *
 * Supersedes the previous trip-settings.spec.js, whose tests all shared one
 * structural bug: `if (count === 0) { return; }` immediately followed by
 * `expect(count).toBeGreaterThan(0)`. That's a tautology — by the time the
 * assertion runs, count is already known to be > 0 (the guard above it already
 * returned otherwise), so the assertion can never fail regardless of what the
 * page actually contains. Several of the guessed selectors it protected (trip
 * price/cost as a flat field, `min_age`/`group_size` inputs) don't correspond to
 * any real field on this site at all — see the file's own notes below for what's
 * real instead.
 *
 * CONFIRMED LIVE FACTS (Everest Base Camp trek, TRIPS.everestBaseCamp):
 *   - Trip edit meta tabs (real, confirmed via a.wpte-menu-link): General,
 *     Overview & Info, Itinerary, Date & Price, Includes/Excludes, Map & Gallery,
 *     FAQs, Extra Services, Accommodation, Travel Insurance, Pickup Points,
 *     Advanced Settings.
 *   - The whole WTE trip-edit app mounts inside a real `#wptravelengine-edit-trip`
 *     container (found by walking up from a live tab link) — NOT
 *     `#wp-travel-engine-settings` / `.wp-travel-engine-metabox`, guessed names
 *     that never existed on this install.
 *   - General tab has a real Duration field: `input[name="duration.period"]`,
 *     live value "7" (days).
 *   - There is NO single flat "trip price" input anywhere on this page. Price is
 *     configured per price category (Adult/Child/etc.) inside a package's own
 *     pricing editor, opened via the Date & Price tab's "Edit Pricing & Dates"
 *     button (AdminPage.editPricingDatesBtns) — confirmed live.
 *   - There is likewise no `min_age`/`group_size`-named input. The closest real,
 *     analogous control is the Date & Price tab's package-capacity feature ("Set
 *     capacity per pricing category?", "maximum available seats") — confirmed
 *     live text.
 */

const { test, expect } = require('../../fixtures/base.fixture');
const { TRIPS } = require('../../utils/test-data');

const hasAdminCreds = !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);

test.describe('Admin — Trip List Management', () => {
  test.skip(!hasAdminCreds, 'ADMIN_EMAIL / ADMIN_PASSWORD not set in .env');

  test('trip list page loads and shows existing trips', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await loggedInAdmin.goToTripList();
    expect(loggedInAdmin.page.url()).toContain('post_type=trip');
  });

  test('at least one trip is listed in the admin trip table', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await loggedInAdmin.goToTripList();
    // Live-confirmed this site always has real trips (Everest Base Camp, Tiger
    // Nest, and others) — a genuine assertion, not guarded by a vacuous
    // "return if zero" that would mask an actually-empty trip list.
    expect(await loggedInAdmin.tripRows.count()).toBeGreaterThan(0);
  });

  test('Everest Base Camp trek is in the trip list', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await loggedInAdmin.goToTripList();
    const row = loggedInAdmin.page.locator('#the-list td.title a, #the-list .row-title').filter({ hasText: /everest/i }).first();
    await expect(row).toBeVisible();
  });

  test('Tiger Nest trip is in the trip list', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await loggedInAdmin.goToTripList();
    const row = loggedInAdmin.page.locator('#the-list td.title a, #the-list .row-title').filter({ hasText: /tiger/i }).first();
    await expect(row).toBeVisible();
  });

  test('"Add New Trip" button is available so admin can create trips', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await loggedInAdmin.goToTripList();
    // Standard WordPress admin UI, always present for a user who can edit this
    // post type — no guard needed.
    await expect(loggedInAdmin.addNewTripBtn).toBeVisible();
  });
});

test.describe('Admin — Trip Edit: Basic Settings', () => {
  test.skip(!hasAdminCreds, 'ADMIN_EMAIL / ADMIN_PASSWORD not set in .env');

  test.beforeEach(async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await loggedInAdmin.goToTripEdit(TRIPS.everestBaseCamp.id);
    await loggedInAdmin.page.waitForLoadState('domcontentloaded');
  });

  test('trip edit page loads for the correct trip (URL contains trip post ID)', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    expect(loggedInAdmin.page.url()).toContain(`post=${TRIPS.everestBaseCamp.id}`);
  });

  test('trip title field is visible and contains the trip name', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    // Contenteditable rich-text block inside the editor's iframe, not a real form
    // input — see tripTitleInput's own doc in AdminPage.js — so read it with
    // textContent(), not inputValue().
    await expect(loggedInAdmin.tripTitleInput).toBeVisible();
    const value = await loggedInAdmin.tripTitleInput.textContent();
    expect(value.toLowerCase()).toContain('everest');
  });

  test('trip duration field exists, is editable, and shows a real configured value', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    // Real field lives on the General tab (the default landing tab) — see file
    // header for why the old `input[name*="price"]`-style guesses never matched
    // anything real.
    await expect(loggedInAdmin.tripDurationField).toBeVisible();
    await expect(loggedInAdmin.tripDurationField).toBeEditable();
    const value = await loggedInAdmin.tripDurationField.inputValue();
    expect(parseInt(value, 10)).toBeGreaterThan(0);
  });

  test('package pricing is configured via Date & Price\'s "Edit Pricing & Dates" editor', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    // See file header: there is no flat "trip price" input — pricing lives per
    // package, opened via this real button.
    await loggedInAdmin.tripDatesTab.click();
    await expect(loggedInAdmin.editPricingDatesBtns.first()).toBeVisible();
  });

  test('publish / update button is available to save trip changes', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await expect(loggedInAdmin.publishBtn).toBeVisible();
  });

  test('trip edit page does not return a 404 error', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    const title = await loggedInAdmin.page.title();
    expect(title).not.toMatch(/404|not found/i);
  });
});

test.describe('Admin — Trip Edit: WTE Meta / Settings Panel', () => {
  test.skip(!hasAdminCreds, 'ADMIN_EMAIL / ADMIN_PASSWORD not set in .env');

  test.beforeEach(async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await loggedInAdmin.goToTripEdit(TRIPS.everestBaseCamp.id);
    await loggedInAdmin.page.waitForLoadState('domcontentloaded');
  });

  test('WTE trip-edit app (meta tabs container) is present on the trip edit page', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await expect(loggedInAdmin.tripMetaBox).toBeAttached();
  });

  test('trip edit page has an overview / description editor', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    const editor = loggedInAdmin.page.locator(
      '#content, .wp-editor-area, .editor-styles-wrapper, [aria-label*="Block editor"], [aria-label*="Content"]'
    ).first();
    // Standard WordPress editor UI — always present on a post-type edit screen.
    await expect(editor).toBeAttached();
  });

  test('Date & Price (Fixed Starting Dates) tab is accessible and shows package rows', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await loggedInAdmin.tripDatesTab.click();
    await expect(loggedInAdmin.editPricingDatesBtns.first()).toBeVisible();
  });

  test('package capacity ("maximum available seats") controls are present in the package editor', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    // Real, live-confirmed equivalent of the old (nonexistent) "min_age"/
    // "group_size" guess — see file header.
    await loggedInAdmin.tripDatesTab.click();
    await loggedInAdmin.editPricingDatesBtns.first().click();
    const body = await loggedInAdmin.page.locator('body').innerText();
    expect(body).toMatch(/capacity per pricing category|maximum available seats/i);
  });
});

test.describe('Admin — Trip Edit: Add-on Settings per Trip', () => {
  test.skip(!hasAdminCreds, 'ADMIN_EMAIL / ADMIN_PASSWORD not set in .env');

  test.beforeEach(async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await loggedInAdmin.goToTripEdit(TRIPS.everestBaseCamp.id);
    await loggedInAdmin.page.waitForLoadState('domcontentloaded');
  });

  test('extra services can be configured per trip in the trip edit page', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    const tab = loggedInAdmin.tripEditMetaTab('Extra Services');
    await expect(tab).toBeVisible();
    await tab.click();
    const table = loggedInAdmin.page.locator('table').filter({ has: loggedInAdmin.page.locator('th', { hasText: 'Service Name' }) }).first();
    await expect(table).toBeVisible();
  });

  test('accommodation options can be configured per trip', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    await expect(loggedInAdmin.accommodationTripEditTab).toBeVisible();
    await loggedInAdmin.accommodationTripEditTab.click();
    await expect(loggedInAdmin.accommodationTripEditRoomTable).toBeVisible();
  });

  test('insurance settings can be configured per trip', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }
    const tab = loggedInAdmin.tripEditMetaTab('Travel Insurance');
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(loggedInAdmin.tripTravelInsuranceMandatoryToggle).toBeAttached();
  });
});
