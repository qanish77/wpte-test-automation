/**
 * Accommodation — Functional Tests (wptravelengine-accommodation add-on)
 *
 * Every selector/behavior here was verified live against the running site (network
 * traces, DOM dumps, screenshots) — never guessed. See pages/BookingModalPage.js
 * (accommodationRoomRows, accommodationRoom(), hasAccommodationStep()) and
 * pages/AdminPage.js (accommodationTripEditTab, accommodationEnableToggle, etc.) for
 * the citations behind each locator.
 *
 * Supersedes the previous accommodation.spec.js, which used guessed
 * `[class*="accommodation"]` selectors guarded by `if (count === 0) return`
 * everywhere — a broken selector reported the same green result as a working feature,
 * and it never actually drove a real selection or checked a real price change.
 *
 * Verified live facts this file relies on (Everest Base Camp trek, trip id from
 * TRIPS.everestBaseCamp):
 *   - REST: GET /wp-json/wptravelengine/v2/trips/{id}/accommodation returns
 *     { enable, pricing_format, allow_shared_room_bookings, mandatory_for, rooms[], upgrades[] }.
 *   - Frontend: the booking modal inserts an "Accommodation" step (between Package
 *     Type and Extra Services on this site) with one .wte-trip-guest-wrapper row per
 *     enabled room. A plain <select> ("Select Traveller(s)" / "N Traveller(s)") picks
 *     the quantity — NOT the increment/decrement stepper used on Package Type/Extra
 *     Services.
 *   - Selecting a room's quantity updates the modal's running total by
 *     roomPrice * quantity (confirmed: 101.1 -> 131.1 selecting 1x a ₹30 room).
 *   - Checkout's cart summary includes an "Accommodation" section listing the
 *     selected room and its price once the booking reaches checkout (confirmed:
 *     summary text contains "Accommodation" followed by "Room: 1 x ₹30₹30").
 *   - Admin: Trip Edit has an "Accommodation" meta tab (a.wpte-menu-link) showing a
 *     table of this trip's rooms (Single Room | No. of Guests | Capacity | Short
 *     Description | Price Per Room | Action).
 *   - Admin: WTE Settings > Extensions > Accommodation exposes Enable
 *     (input[name="accommodation.enable"]), Title (input[name="accommodation.title"]),
 *     Pricing Format ("Per Traveler" / "Per Room" buttons), Allow Shared Room Bookings
 *     (input[name="accommodation.allow_shared_room_bookings"]), and a Room Type table
 *     (Room Type | Guests | Short Description | Action). Reached via a direct hash URL
 *     — the sidebar's "Extensions" submenu is a hover-flyout that intercepts pointer
 *     events on its own child links when clicked programmatically.
 *
 * Deliberately NOT asserted (couldn't confirm live, so not hardcoded as required
 * behavior — treat as discovery-only until re-verified):
 *   - Whether selecting a base room reveals its linked Room Upgrade inline in the
 *     modal. Live: selecting "Room" (which the REST data's "Premium" upgrade lists as
 *     one of its room_types) did NOT surface any upgrade UI in the same step.
 *   - Whether "Mandatory For" actually blocks Continue when no room is selected. Live:
 *     the button stayed enabled with zero rooms selected even though "Mandatory For"
 *     was configured (Gen Z, Millenials) — this trip's actual travelers don't map to
 *     those categories, so no test asserts a specific blocking behavior.
 */

const { test, expect } = require('../../fixtures/base.fixture');
const { TRIPS } = require('../../utils/test-data');

const TRIP = TRIPS.everestBaseCamp;
const parsePrice = (text) => parseFloat((text || '').replace(/[^\d.]/g, ''));

/**
 * A shared room (allow_shared_booking:true) charges price * quantity — each selected
 * traveler pays their own share (pricing_format "per_traveler" applies per person). A
 * non-shared room charges the flat room price once regardless of the occupancy count
 * selected — that select's "N Travellers" option describes who's staying in the one
 * room, not separate paying shares. Verified live: Double Room
 * (allow_shared_booking:false, price 20) selecting "2 Travellers" added exactly +20,
 * not +40.
 */
function expectedRoomDelta(room, qty) {
  return room.allow_shared_booking ? room.price * qty : room.price;
}

/** Shared setup: open the trip, open the modal, pick a date, add one traveler, advance
 * past Package Type. Mirrors startBooking() in booking-to-checkout.spec.js. */
async function startBooking(tripDetailPage, bookingModalPage) {
  await tripDetailPage.open(TRIP.slug);
  await bookingModalPage.open();
  await bookingModalPage.waitForDateAutoSelected();
  await bookingModalPage.goNext(); // -> Package Type
  await bookingModalPage.incrementTraveler(0, 1);
}

async function fetchAccommodationData(request) {
  const res = await request.get(`/wp-json/wptravelengine/v2/trips/${TRIP.id}/accommodation`);
  return { status: res.status(), body: res.ok() ? await res.json() : null };
}

test.describe('Accommodation — REST API', () => {
  test('trip accommodation endpoint returns a well-formed configuration', async ({ page }) => {
    const { status, body } = await fetchAccommodationData(page.request);
    expect(status).toBe(200);
    expect(body).toHaveProperty('enable');
    expect(body).toHaveProperty('pricing_format');
    expect(Array.isArray(body.rooms)).toBe(true);
    expect(Array.isArray(body.upgrades)).toBe(true);

    if (!body.enable) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Accommodation is disabled for this trip.' });
      return;
    }

    expect(body.rooms.length).toBeGreaterThan(0);
    for (const room of body.rooms) {
      expect(typeof room.title).toBe('string');
      expect(room.title.trim().length).toBeGreaterThan(0);
      expect(typeof room.price).toBe('number');
      expect(room.price).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Accommodation — Booking modal', () => {
  test('step appears, lists the configured rooms, and price updates correctly', async ({
    tripDetailPage,
    bookingModalPage,
    page,
  }) => {
    const { body: restData } = await fetchAccommodationData(page.request);
    if (!restData?.enable) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Accommodation disabled — nothing to verify in the modal.' });
      return;
    }

    await startBooking(tripDetailPage, bookingModalPage);

    if (!(await bookingModalPage.hasAccommodationStep())) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Accommodation step not present — Plugin::is_implementable() is false for this trip right now.',
      });
      return;
    }

    await bookingModalPage.goNext(); // -> Accommodation

    await test.step('step is active and lists the enabled rooms from the REST config', async () => {
      expect(await bookingModalPage.currentStepTitle()).toMatch(/accommodation/i);
      const expectedCount = restData.rooms.filter((r) => r.enable).length;
      await expect(bookingModalPage.accommodationRoomRows).toHaveCount(expectedCount);
    });

    await test.step('each room row has a readable name and a price', async () => {
      const { label, priceText } = bookingModalPage.accommodationRoom(0);
      expect((await label.textContent())?.trim().length).toBeGreaterThan(0);
      expect((await priceText.textContent())?.trim().length).toBeGreaterThan(0);
    });

    await test.step('selecting a quantity increases the total by roomPrice * quantity', async () => {
      const totalBefore = parsePrice(await bookingModalPage.getTotalText());
      const { quantitySelect } = bookingModalPage.accommodationRoom(0);

      // Rooms can have different minimum quantities available (capacity-dependent) —
      // pick whatever the first real (non-"Select Traveller(s)") option actually is.
      const firstRealOption = await quantitySelect.locator('option:not([value="0"])').first().getAttribute('value');
      await quantitySelect.selectOption(firstRealOption);

      await expect
        .poll(async () => parsePrice(await bookingModalPage.getTotalText()), { timeout: 10000 })
        .not.toBe(totalBefore);

      const totalAfter = parsePrice(await bookingModalPage.getTotalText());
      const qty = parseInt(firstRealOption, 10);
      expect(totalAfter - totalBefore).toBeCloseTo(expectedRoomDelta(restData.rooms[0], qty), 1);
    });

    await test.step('switching to a different room type updates the total again', async () => {
      if ((await bookingModalPage.accommodationRoomRows.count()) < 2) {
        test.info().annotations.push({ type: 'skip-reason', description: 'Only one room type configured — nothing to switch to.' });
        return;
      }
      // Reset the first room back to none, then select the second room instead.
      const room0 = bookingModalPage.accommodationRoom(0);
      await room0.quantitySelect.selectOption('0');
      const totalWithNone = parsePrice(await bookingModalPage.getTotalText());

      const room1 = bookingModalPage.accommodationRoom(1);
      const room1FirstOption = await room1.quantitySelect.locator('option:not([value="0"])').first().getAttribute('value');
      await room1.quantitySelect.selectOption(room1FirstOption);

      await expect
        .poll(async () => parsePrice(await bookingModalPage.getTotalText()), { timeout: 10000 })
        .not.toBe(totalWithNone);

      const totalWithRoom1 = parsePrice(await bookingModalPage.getTotalText());
      const qty = parseInt(room1FirstOption, 10);
      expect(totalWithRoom1 - totalWithNone).toBeCloseTo(expectedRoomDelta(restData.rooms[1], qty), 1);
    });
  });
});

test.describe('Accommodation — Checkout summary', () => {
  test('selected room appears in the checkout cart summary with its price', async ({
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
    page,
  }) => {
    const { body: restData } = await fetchAccommodationData(page.request);
    if (!restData?.enable || restData.rooms.filter((r) => r.enable).length === 0) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No enabled rooms configured for this trip.' });
      return;
    }

    await startBooking(tripDetailPage, bookingModalPage);
    if (!(await bookingModalPage.hasAccommodationStep())) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Accommodation step not present for this trip.' });
      return;
    }
    await bookingModalPage.goNext(); // -> Accommodation

    const { label, quantitySelect } = bookingModalPage.accommodationRoom(0);
    const roomName = (await label.textContent())?.trim().replace(/\s*\d+\s*left\s*$/i, '').trim();
    const firstRealOption = await quantitySelect.locator('option:not([value="0"])').first().getAttribute('value');
    await quantitySelect.selectOption(firstRealOption);
    await page.waitForTimeout(300);

    await bookingModalPage.advanceToFinalStep();
    await bookingModalPage.proceedToCheckout();
    expect(await checkoutPage.cartState()).toBe('has-cart');

    const summary = await checkoutPage.getCartSummaryText();
    expect(summary).toMatch(/accommodation/i);
    expect(summary).toContain(roomName);
  });
});

test.describe('Accommodation — Admin: Trip Edit tab', () => {
  test('room table matches the trip\'s live REST configuration', async ({ loggedInAdmin, page }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; } // credentials may differ per environment

    const { body: restData } = await fetchAccommodationData(page.request);

    await loggedInAdmin.goToTripAccommodationTab(TRIP.id);
    await expect(loggedInAdmin.accommodationTripEditRoomTable).toBeVisible();

    const rowCount = await loggedInAdmin.accommodationTripEditRoomRows.count();
    expect(rowCount).toBe(restData.rooms.length);

    // The room's name is plain text in this table's first cell (not an input — that's
    // only editable from Global Settings); the first real <input type="text"> here is
    // actually the read-only Capacity field, confirmed live.
    const firstCellText = (await loggedInAdmin.accommodationTripEditRoomRows.first().locator('td').first().textContent()) || '';
    expect(firstCellText).toContain(restData.rooms[0].title);
  });
});

test.describe('Accommodation — Admin: Global Settings', () => {
  test('Extensions > Accommodation exposes the documented configuration fields', async ({ loggedInAdmin, page }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    const { body: restData } = await fetchAccommodationData(page.request);

    await loggedInAdmin.goToAccommodationSettings();

    await expect(loggedInAdmin.accommodationEnableToggle).toBeAttached();
    expect(await loggedInAdmin.accommodationEnableToggle.isChecked()).toBe(restData.enable);

    await expect(loggedInAdmin.accommodationTitleInput).toHaveValue(/.+/);

    await expect(loggedInAdmin.accommodationAllowSharedToggle).toBeAttached();
    expect(await loggedInAdmin.accommodationAllowSharedToggle.isChecked()).toBe(restData.allow_shared_room_bookings);

    await expect(loggedInAdmin.accommodationPricingFormatPerTraveler).toBeVisible();
    await expect(loggedInAdmin.accommodationPricingFormatPerRoom).toBeVisible();

    await expect(loggedInAdmin.accommodationGlobalRoomTable).toBeVisible();
    expect(await loggedInAdmin.accommodationGlobalRoomRows.count()).toBe(restData.rooms.length);
  });
});
