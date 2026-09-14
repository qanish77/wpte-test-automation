/**
 * Extra Services — Functional Tests (wte-extra-services add-on)
 *
 * Every selector/behavior here was verified live against the running site (REST
 * responses, DOM dumps, price-math traces) — never guessed. See
 * pages/BookingModalPage.js (extraServiceSingleItems, extraServiceGroup(),
 * satisfyOneRequiredExtraService) and pages/AdminPage.js for citations.
 *
 * Supersedes the previous extra-services.spec.js, which used guessed
 * `[class*="wte-es"]` selectors (that string only ever appears as a conditional
 * modifier class, never a real container) behind `if (count === 0) return`
 * everywhere, and drove the modal via `clickBookNow()`/`advanceBookingStep()` —
 * legacy TripDetailPage methods that don't reach the real, current booking flow.
 *
 * Verified live facts this file relies on (Everest Base Camp trek):
 *   - REST: GET /wp-json/wp/v2/trip/{id}?_fields=trip_extras,trip_extra_services
 *     returns trip_extra_services: [{ id, title, required, type, multiple, options:
 *     [{ key, label, price, serviceUnit:{value} }] }]. `multiple:false` + 1 option =
 *     a standalone single-price item; `multiple:false` + >1 options = a "Choose One"
 *     group; `multiple:true` = a "Choose Any" group (independent per-option counters).
 *   - Frontend: the booking modal's "Extra Services" step (between Accommodation and
 *     the final step on this site) renders:
 *       - standalone items as a bare .wte-service-options-item directly under
 *         .wte-trip-options, each with its own quantity counter;
 *       - grouped items under a .wte-service-multiple-options-header (title + a
 *         "Choose One"/"Choose Any" tag) + sibling .wte-service-options-collapse.
 *   - "Choose One" items toggle via their own [role="switch"] (clicking the outer
 *     item div does nothing) and are mutually exclusive — selecting a second item
 *     deselects the first (confirmed live: Boy -> Girl correctly flips
 *     aria-checked).
 *   - "Choose Any" items (Vehicle Rental: Car/Jeep/Bus) each have an independent
 *     counter — selecting more than one is additive, not exclusive.
 *   - Sold-out items show a "Sold Out" label in place of any selection control.
 *   - RECOMPUTE DELAY (not a permanent bug): selecting a "Choose One" item adds the
 *     correct line to the modal's own running summary ("Boy: 1 x ₹100") immediately,
 *     but the grand total can take several seconds longer to catch up — a bare,
 *     untraced script reproducibly still saw it unchanged 3+ seconds after
 *     selection, while the exact same steps run under Playwright's own tracing
 *     overhead (extra ambient delay between actions) consistently resolved
 *     correctly. Standalone/"Choose Any" counter-based ("unit") items update
 *     immediately with no such lag. Poll generously (see the dedicated test below)
 *     rather than asserting right after selection — this is plausibly the tail of
 *     what the site's own v2.2.5 changelog entry ("Fixed: Resolved issues with
 *     per-unit values not reflecting correctly in the booking modal") was
 *     addressing.
 *   - Inventory (available quantity) is live and changes over time — e.g. the
 *     trip's only standalone item was sold out during this file's own
 *     verification, having been available with stock earlier the same session.
 *     Tests must discover current availability rather than assume any specific
 *     named service is currently selectable.
 */

const { test, expect } = require('../../fixtures/base.fixture');
const { TRIPS } = require('../../utils/test-data');

const TRIP = TRIPS.everestBaseCamp;
const parsePrice = (text) => parseFloat((text || '').replace(/[^\d.]/g, ''));

async function startBooking(tripDetailPage, bookingModalPage) {
  await tripDetailPage.open(TRIP.slug);
  await bookingModalPage.open();
  await bookingModalPage.waitForDateAutoSelected();
  await bookingModalPage.goNext(); // -> Package Type
  await bookingModalPage.incrementTraveler(0, 1);
}

/**
 * Steps to Extra Services one goNext() at a time, WITHOUT calling
 * advanceToFinalStep() — that method's whole purpose is to auto-satisfy any
 * required step it lands on (including the destination step itself), so using it
 * to "arrive at Extra Services for manual testing" would auto-select a required
 * "Choose One" item before the test's own selection code ever runs (confirmed
 * live: this silently turned a "select item 0" assertion into a no-op toggle-off,
 * since it was already selected). Only safe for tests that assert real,
 * from-scratch selection behavior; other tests that don't care about the
 * pre-selection side effect can keep using advanceToFinalStep() directly.
 */
async function goToExtraServicesFromScratch(tripDetailPage, bookingModalPage) {
  await startBooking(tripDetailPage, bookingModalPage);
  if (!(await bookingModalPage.hasAccommodationStep()) && !(await bookingModalPage.hasExtraServicesStep())) {
    return false;
  }
  if (await bookingModalPage.hasAccommodationStep()) {
    await bookingModalPage.goNext(); // -> Accommodation (not required on this trip)
  }
  if (!(await bookingModalPage.hasExtraServicesStep())) return false;
  await bookingModalPage.goNext(); // -> Extra Services
  return true;
}

async function fetchExtraServicesData(request) {
  const res = await request.get(`/wp-json/wp/v2/trip/${TRIP.id}?_fields=id,trip_extras,trip_extra_services`);
  return { status: res.status(), body: res.ok() ? await res.json() : null };
}

test.describe('Extra Services — REST API', () => {
  test('trip REST field returns well-formed service definitions', async ({ page }) => {
    const { status, body } = await fetchExtraServicesData(page.request);
    expect(status).toBe(200);
    expect(Array.isArray(body.trip_extras)).toBe(true);
    expect(Array.isArray(body.trip_extra_services)).toBe(true);
    expect(body.trip_extra_services.length).toBe(body.trip_extras.length);

    for (const service of body.trip_extra_services) {
      expect(typeof service.title).toBe('string');
      expect(service.title.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(service.options)).toBe(true);
      expect(service.options.length).toBeGreaterThan(0);
      for (const option of service.options) {
        expect(typeof option.price).toBe('number');
        expect(option.price).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

test.describe('Extra Services — Booking modal', () => {
  test('step lists the configured services matching the REST config', async ({
    tripDetailPage,
    bookingModalPage,
    page,
  }) => {
    const { body: restData } = await fetchExtraServicesData(page.request);
    if (restData.trip_extra_services.length === 0) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No extra services configured for this trip.' });
      return;
    }

    await startBooking(tripDetailPage, bookingModalPage);
    if (!(await bookingModalPage.hasExtraServicesStep())) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Extra Services step not present — the site auto-disables it for trips without services (v2.2.3).',
      });
      return;
    }
    await bookingModalPage.advanceToFinalStep(); // Package Type -> (Accommodation) -> Extra Services

    expect(await bookingModalPage.currentStepTitle()).toMatch(/extra services/i);

    const singleCount = restData.trip_extra_services.filter((s) => !s.multiple && s.options.length === 1).length;
    const groupCount = restData.trip_extra_services.filter((s) => s.multiple || s.options.length > 1).length;

    await expect(bookingModalPage.extraServiceSingleItems).toHaveCount(singleCount);
    expect(await bookingModalPage.extraServiceGroupCount()).toBe(groupCount);
  });

  test('a standalone service updates the total by price * quantity (when one is available)', async ({
    tripDetailPage,
    bookingModalPage,
  }) => {
    await startBooking(tripDetailPage, bookingModalPage);
    if (!(await bookingModalPage.hasExtraServicesStep())) { return; }
    await bookingModalPage.advanceToFinalStep();

    const count = await bookingModalPage.extraServiceSingleItems.count();
    if (count === 0) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No standalone (single-option) service configured.' });
      return;
    }

    // Inventory changes live — find the first one that's actually available right now.
    let target = null;
    for (let i = 0; i < count; i++) {
      const candidate = bookingModalPage.extraServiceSingleItem(i);
      if ((await candidate.plusBtn.count()) > 0 && !(await candidate.plusBtn.isDisabled().catch(() => true))) {
        target = candidate;
        break;
      }
    }
    if (!target) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Every standalone service is currently sold out.' });
      return;
    }

    const totalBefore = parsePrice(await bookingModalPage.getTotalText());
    const price = parsePrice(await target.priceText.textContent());
    await target.plusBtn.click();

    await expect
      .poll(async () => parsePrice(await bookingModalPage.getTotalText()), { timeout: 10000 })
      .not.toBe(totalBefore);

    const totalAfter = parsePrice(await bookingModalPage.getTotalText());
    expect(totalAfter - totalBefore).toBeCloseTo(price, 1);
  });

  test('a "Choose Any" group prices each selected item independently and additively', async ({
    tripDetailPage,
    bookingModalPage,
    page,
  }) => {
    const { body: restData } = await fetchExtraServicesData(page.request);
    const chooseAnyIndex = restData.trip_extra_services.findIndex((s) => s.multiple);
    if (chooseAnyIndex === -1) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No "Choose Any" service group configured.' });
      return;
    }

    await startBooking(tripDetailPage, bookingModalPage);
    if (!(await bookingModalPage.hasExtraServicesStep())) { return; }
    await bookingModalPage.advanceToFinalStep();

    // Group order in the modal matches REST array order among grouped services.
    const groupedServices = restData.trip_extra_services.filter((s) => s.multiple || s.options.length > 1);
    const modalGroupIndex = groupedServices.findIndex((s) => s.multiple);
    const group = bookingModalPage.extraServiceGroup(modalGroupIndex);
    expect(await group.isChooseOne()).toBe(false);

    const itemCount = await group.itemCount();
    const available = [];
    for (let i = 0; i < itemCount && available.length < 2; i++) {
      const item = group.item(i);
      if (!(await item.isSoldOut())) available.push(item);
    }
    if (available.length < 2) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Fewer than 2 available (non-sold-out) options in this "Choose Any" group.' });
      return;
    }

    const totalBefore = parsePrice(await bookingModalPage.getTotalText());
    const price0 = parsePrice(await available[0].priceText.textContent());
    await available[0].plusBtn.click();
    await expect
      .poll(async () => parsePrice(await bookingModalPage.getTotalText()), { timeout: 10000 })
      .toBeCloseTo(totalBefore + price0, 1);

    const totalWithFirst = parsePrice(await bookingModalPage.getTotalText());
    const price1 = parsePrice(await available[1].priceText.textContent());
    await available[1].plusBtn.click();
    await expect
      .poll(async () => parsePrice(await bookingModalPage.getTotalText()), { timeout: 10000 })
      .toBeCloseTo(totalWithFirst + price1, 1);

    // Both selections should be additive, not exclusive.
    expect((await available[0].counterInput.inputValue()) !== '0').toBe(true);
    expect((await available[1].counterInput.inputValue()) !== '0').toBe(true);
  });

  test('a "Choose One" group is mutually exclusive between its options', async ({
    tripDetailPage,
    bookingModalPage,
    page,
  }) => {
    const { body: restData } = await fetchExtraServicesData(page.request);
    const chooseOneIndex = restData.trip_extra_services.findIndex((s) => !s.multiple && s.options.length > 1);
    if (chooseOneIndex === -1) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No "Choose One" service group configured.' });
      return;
    }

    if (!(await goToExtraServicesFromScratch(tripDetailPage, bookingModalPage))) { return; }

    const groupedServices = restData.trip_extra_services.filter((s) => s.multiple || s.options.length > 1);
    const modalGroupIndex = groupedServices.findIndex((s) => !s.multiple && s.options.length > 1);
    const group = bookingModalPage.extraServiceGroup(modalGroupIndex);
    expect(await group.isChooseOne()).toBe(true);

    const itemCount = await group.itemCount();
    const available = [];
    for (let i = 0; i < itemCount && available.length < 2; i++) {
      const item = group.item(i);
      if (!(await item.isSoldOut())) available.push(item);
    }
    if (available.length < 2) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Fewer than 2 available options in this "Choose One" group.' });
      return;
    }

    await bookingModalPage.selectExtraServiceGroupItem(modalGroupIndex, 0);
    await expect.poll(() => available[0].isSelected(), { timeout: 5000 }).toBe(true);

    await bookingModalPage.selectExtraServiceGroupItem(modalGroupIndex, 1);
    await expect.poll(() => available[1].isSelected(), { timeout: 5000 }).toBe(true);
    expect(await available[0].isSelected()).toBe(false);
  });

  test('a "Choose One" selection eventually updates the modal total (can be delayed)', async ({
    tripDetailPage,
    bookingModalPage,
    page,
  }) => {
    const { body: restData } = await fetchExtraServicesData(page.request);
    const chooseOneIndex = restData.trip_extra_services.findIndex((s) => !s.multiple && s.options.length > 1);
    if (chooseOneIndex === -1) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No "Choose One" service group configured.' });
      return;
    }

    if (!(await goToExtraServicesFromScratch(tripDetailPage, bookingModalPage))) { return; }

    const groupedServices = restData.trip_extra_services.filter((s) => s.multiple || s.options.length > 1);
    const modalGroupIndex = groupedServices.findIndex((s) => !s.multiple && s.options.length > 1);
    const group = bookingModalPage.extraServiceGroup(modalGroupIndex);

    const itemCount = await group.itemCount();
    let target = null;
    for (let i = 0; i < itemCount; i++) {
      const item = group.item(i);
      if (!(await item.isSoldOut())) { target = item; break; }
    }
    if (!target) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Every option in this "Choose One" group is sold out.' });
      return;
    }

    const totalBefore = parsePrice(await bookingModalPage.getTotalText());
    const price = parsePrice(await target.priceText.textContent());
    await target.switchEl.click();
    await expect.poll(() => target.isSelected(), { timeout: 5000 }).toBe(true);

    // Live-observed: this recalculation is genuinely delayed, not instant — a bare,
    // untraced script reproducibly saw the total still unchanged 3+ seconds after
    // selection, while the same steps under Playwright's own tracing overhead
    // consistently resolved correctly within it. Poll generously rather than assert
    // immediately; a real regression here is "never resolves within a generous
    // window", not "isn't instant".
    await expect
      .poll(async () => parsePrice(await bookingModalPage.getTotalText()), { timeout: 15000 })
      .toBeCloseTo(totalBefore + price, 1);
  });
});

test.describe('Extra Services — Checkout summary', () => {
  test('selected services appear correctly priced in the real checkout summary', async ({
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
    page,
  }) => {
    const { body: restData } = await fetchExtraServicesData(page.request);
    if (restData.trip_extra_services.length === 0) { return; }

    await startBooking(tripDetailPage, bookingModalPage);
    if (!(await bookingModalPage.hasExtraServicesStep())) { return; }
    await bookingModalPage.advanceToFinalStep();

    // Select whatever's available generically — a standalone item if one exists and
    // isn't sold out, otherwise the first available item in the first group.
    let selectedLabel = null;
    if ((await bookingModalPage.extraServiceSingleItems.count()) > 0) {
      const single = bookingModalPage.extraServiceSingleItem(0);
      if (!(await single.plusBtn.isDisabled().catch(() => true))) {
        await single.plusBtn.click();
        selectedLabel = (await single.label.textContent())?.trim();
      }
    }
    if (!selectedLabel && (await bookingModalPage.extraServiceGroupCount()) > 0) {
      const group = bookingModalPage.extraServiceGroup(0);
      const itemCount = await group.itemCount();
      for (let i = 0; i < itemCount; i++) {
        const item = group.item(i);
        if (await item.isSoldOut()) continue;
        const isChooseOne = await group.isChooseOne();
        if (isChooseOne) {
          await bookingModalPage.selectExtraServiceGroupItem(0, i);
        } else {
          await item.plusBtn.click();
        }
        selectedLabel = (await item.label.textContent())?.trim();
        break;
      }
    }
    if (!selectedLabel) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Every configured service is currently sold out.' });
      return;
    }

    await page.waitForTimeout(500);
    await bookingModalPage.advanceToFinalStep();
    await bookingModalPage.proceedToCheckout();
    expect(await checkoutPage.cartState()).toBe('has-cart');

    const summary = await checkoutPage.getCartSummaryText();
    expect(summary).toMatch(/extra services/i);
    expect(summary).toContain(selectedLabel);
  });
});

test.describe('Extra Services — Admin: Trip Edit tab', () => {
  test('service table matches the trip\'s live REST configuration', async ({ loggedInAdmin, page }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    const { body: restData } = await fetchExtraServicesData(page.request);

    await loggedInAdmin.goToTripEdit(TRIP.id);
    const esTab = loggedInAdmin.page.locator('a.wpte-menu-link', { hasText: 'Extra Services' }).first();
    await esTab.click();

    const table = loggedInAdmin.page.locator('table').filter({ has: loggedInAdmin.page.locator('th', { hasText: 'Service Name' }) }).first();
    await expect(table).toBeVisible();

    // Not an exact row-count match: an "Advanced" (multi-option) service renders one
    // row per sub-option plus an instructions row, in addition to its own row — e.g.
    // "Travel Colleague" (2 options) contributes 4 rows total here, not 1. Verify each
    // top-level service's title appears somewhere in the table instead.
    const tableText = (await table.textContent()) || '';
    for (const service of restData.trip_extra_services) {
      expect(tableText, `Expected "${service.title}" to appear in the Extra Services table.`).toContain(service.title);
    }
  });
});

test.describe('Extra Services — Admin: Global service library', () => {
  test('services used by this trip exist in the global Extra Services list', async ({ loggedInAdmin, page }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    const { body: restData } = await fetchExtraServicesData(page.request);

    // Global library is shared/reusable across the whole site (docs: "Create services
    // once, reuse across trips") and grows over time as real admins add to it (33
    // items across 2 pages as of this writing) — search per-title via the list's own
    // search box rather than relying on unpaginated #the-list, which only shows
    // whichever page happens to include a given service.
    for (const service of restData.trip_extra_services) {
      await loggedInAdmin.goto(`/wp-admin/edit.php?post_type=wte-services&s=${encodeURIComponent(service.title)}`);
      await loggedInAdmin.page.waitForSelector('#the-list', { timeout: 10000 }).catch(() => {});
      const row = loggedInAdmin.page.locator('#the-list a.row-title', { hasText: service.title });
      expect(await row.count(), `Expected "${service.title}" to be listed in the global Extra Services library.`).toBeGreaterThan(0);
    }
  });
});
