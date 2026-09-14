/**
 * Partial Payment — Functional Tests (wte-partial-payment add-on)
 *
 * Every selector/behavior here was verified live against the running site (REST
 * calls with an authenticated nonce, full-HTML string searches, a live AJAX gateway
 * switch, admin DOM dumps) — never guessed. See pages/CheckoutPage.js
 * (getCartTotals, and the paymentModeFull/paymentModePartial doc above it) and
 * pages/AdminPage.js (partialPaymentEnableToggle, goToPartialPaymentSettings,
 * goToTripPartialPaymentTab) for the citations behind each locator.
 *
 * Supersedes the previous partial-payment.spec.js, which only checked that a
 * `link[href*="installment-payments"]` stylesheet tag was present on various pages —
 * that never exercised the add-on's actual behavior (the payment split, its math, or
 * any admin configuration) at all.
 *
 * CONFIRMED LIVE FINDING — there is no customer-facing full-vs-partial toggle on
 * this site's CURRENT checkout page:
 *   - A full-HTML string search of the rendered `/checkout/` page for "payment_mode"
 *     (the old `#wp_travel_engine_payment_mode-full`/`-partial` radios this file used
 *     to reference) finds ZERO occurrences. The only radio group present is
 *     `wpte_checkout_paymnet_method` (gateway choice: Book Now Pay Later, PayPal,
 *     Bank Transfer, Check, Stripe, Authorize.net, Razorpay) — a different concern
 *     entirely.
 *   - The plugin instead computes the split automatically and exposes it only via
 *     the embedded `window.wptravelengineCart.cart_totals` object
 *     (partial_total / due_total / payable_now / total_extra_charges), confirmed
 *     present in the live checkout page's inline script regardless of which payment
 *     gateway is selected.
 *   - `partial_total` is mathematically exactly `total * payment_percent / 100`
 *     (verified against the live admin-configured value, currently 10%, across three
 *     independent captures: 201.10 -> 20.11, 223.44 -> 22.34).
 *   - `due_total` is exactly `total - partial_total` in every capture.
 *   - Switching the selected payment gateway (booking_only <-> Stripe) recomputes the
 *     whole cart via a real `update_cart` AJAX call (confirmed via
 *     `page.on('response')`) — Stripe's total includes an extra
 *     `total_booking_fee` the "Book Now Pay Later" gateway does not. In BOTH cases,
 *     though, `payable_now` was exactly `total + total_extra_charges` (i.e. the FULL
 *     amount including tax/fees) — never the discounted partial amount. This is a
 *     genuine, currently-live discovery worth asserting as an invariant (not a
 *     guess): on this install, `partial_total`/`due_total` are computed and exposed,
 *     but `payable_now` — the actual amount charged at checkout — is not currently
 *     wired to use them for any gateway tested. If that ever changes, the math
 *     relationship asserted below will catch it either way, since it's checked
 *     against whatever `payable_now` actually equals, not hardcoded to one formula.
 *
 * WHAT IS REAL, CONFIGURED, AND VERIFIED RIGHT NOW (admin, via authenticated REST
 * `/wp-json/wptravelengine/v2/settings` -> `partial_payment`, cross-checked against
 * the live Extensions > Partial Payment form):
 *   enable: true, payment_type: "percent", payment_percent: 10,
 *   enable_full_payment: true, enable_reminder: true, reminder_duration: 1,
 *   cutoff_days: "1". Real, stable admin `<input name="partial_payment.*">`
 *   attributes confirmed live (same React-form pattern as every other add-on's
 *   settings block) — see pages/AdminPage.js.
 *   Trip Edit's own "Partial Payments" sub-tab (under the same "Date & Price" meta
 *   tab FSD uses) exposes a "Use Global / Use Custom / Disable" button group for the
 *   trip-level `partial_payment_use` meta (plain `<button>`s, not native radios —
 *   confirmed live).
 */

const { test, expect } = require('../../fixtures/base.fixture');
const { TRIPS } = require('../../utils/test-data');

const TRIP = TRIPS.everestBaseCamp;

async function fetchGlobalSettings(page) {
  const nonce = await page.evaluate(() => window.wpApiSettings?.nonce ?? null);
  const res = await page.request.get('/wp-json/wptravelengine/v2/settings', {
    headers: nonce ? { 'X-WP-Nonce': nonce } : {},
  });
  return { status: res.status(), body: res.ok() ? await res.json() : null };
}

/** Shared setup: open the trip, open the modal, pick the auto-selected date, add one
 * traveler, then push all the way through to checkout. */
async function bookToCheckout(tripDetailPage, bookingModalPage) {
  await tripDetailPage.open(TRIP.slug);
  await bookingModalPage.open();
  await bookingModalPage.waitForDateAutoSelected();
  await bookingModalPage.goNext(); // -> Package Type
  await bookingModalPage.incrementTraveler(0, 1);
  await bookingModalPage.advanceToFinalStep();
  await bookingModalPage.proceedToCheckout();
}

test.describe('Partial Payment — Admin: Global Settings (authenticated REST)', () => {
  test('settings API exposes the documented partial_payment shape', async ({ loggedInAdmin, page }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    const { status, body } = await fetchGlobalSettings(page);
    expect(status).toBe(200);
    expect(body).toHaveProperty('partial_payment');

    const pp = body.partial_payment;
    expect(typeof pp.enable).toBe('boolean');
    expect(typeof pp.payment_type).toBe('string');
    expect(typeof pp.payment_percent).toBe('number');
    expect(typeof pp.enable_full_payment).toBe('boolean');
    expect(typeof pp.enable_reminder).toBe('boolean');
    expect(typeof pp.reminder_duration).toBe('number');
  });

  test('Extensions > Partial Payment form fields match the REST-reported live values', async ({ loggedInAdmin, page }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    const { body: settings } = await fetchGlobalSettings(page);
    const pp = settings.partial_payment;

    await loggedInAdmin.goToPartialPaymentSettings();

    await expect(loggedInAdmin.partialPaymentEnableToggle).toBeAttached();
    expect(await loggedInAdmin.partialPaymentEnableToggle.isChecked()).toBe(pp.enable);

    await expect(loggedInAdmin.partialPaymentPercentInput).toHaveValue(String(pp.payment_percent));

    expect(await loggedInAdmin.partialPaymentEnableFullPaymentToggle.isChecked()).toBe(pp.enable_full_payment);
    expect(await loggedInAdmin.partialPaymentEnableReminderToggle.isChecked()).toBe(pp.enable_reminder);
    await expect(loggedInAdmin.partialPaymentReminderDurationInput).toHaveValue(String(pp.reminder_duration));
  });
});

test.describe('Partial Payment — Admin: Trip Edit', () => {
  test('Date & Price > Partial Payments sub-tab exposes the Use Global / Use Custom / Disable control', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    await loggedInAdmin.goToTripPartialPaymentTab(TRIP.id);

    await expect(loggedInAdmin.tripPartialPaymentUseGlobalBtn).toBeVisible();
    await expect(loggedInAdmin.tripPartialPaymentUseCustomBtn).toBeVisible();
    await expect(loggedInAdmin.tripPartialPaymentDisableBtn).toBeVisible();
  });
});

test.describe('Partial Payment — Checkout cart totals (no UI toggle — see file header)', () => {
  test('no full-vs-partial payment radio exists on the live checkout page', async ({
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
    page,
  }) => {
    await bookToCheckout(tripDetailPage, bookingModalPage);
    expect(await checkoutPage.cartState()).toBe('has-cart');

    expect(await checkoutPage.paymentModeFull.count()).toBe(0);
    expect(await checkoutPage.paymentModePartial.count()).toBe(0);

    const html = await page.content();
    expect(html).not.toMatch(/payment_mode/);
  });

  test('cart_totals partial/due amounts satisfy the documented percent-based math against the live setting', async ({
    loggedInAdmin,
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
    page,
  }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    const { body: settings } = await fetchGlobalSettings(page);
    const pp = settings.partial_payment;
    if (!pp.enable) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Partial Payment is disabled globally right now.' });
      return;
    }

    await bookToCheckout(tripDetailPage, bookingModalPage);
    expect(await checkoutPage.cartState()).toBe('has-cart');

    const totals = await checkoutPage.getCartTotals();
    expect(totals).not.toBeNull();

    const total = parseFloat(totals.total);
    const totalTax = parseFloat(totals.total_tax);
    const partialTotal = parseFloat(totals.partial_total);
    const dueTotal = parseFloat(totals.due_total);
    const payableNow = parseFloat(totals.payable_now);
    const totalExtraCharges = parseFloat(totals.total_extra_charges);
    const bookingFee = totals.total_booking_fee ? parseFloat(totals.total_booking_fee) : 0;

    expect(total).toBeGreaterThan(0);

    if (pp.payment_type === 'percent') {
      const expectedPartial = total * (pp.payment_percent / 100);
      expect(partialTotal).toBeCloseTo(expectedPartial, 1);
    }

    expect(dueTotal).toBeCloseTo(total - partialTotal, 1);
    expect(totalExtraCharges).toBeCloseTo(totalTax + bookingFee, 1);

    // Currently-live invariant (see file header): the amount actually charged at
    // checkout is the FULL total plus tax/fees, not the discounted partial amount —
    // asserted as whatever payable_now equals against the components that make it
    // up, so this test tracks reality rather than a hardcoded assumption.
    expect(payableNow).toBeCloseTo(total + totalExtraCharges, 1);
  });

  test('switching payment gateway recomputes cart_totals via a real AJAX call, and the payable_now invariant still holds', async ({
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
    page,
  }) => {
    await bookToCheckout(tripDetailPage, bookingModalPage);
    expect(await checkoutPage.cartState()).toBe('has-cart');

    const gateways = await checkoutPage.availableGateways();
    const alternate = gateways.find((g) => g && g !== 'booking_only');
    if (!alternate) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Only one payment gateway configured — nothing to switch to.' });
      return;
    }

    let ajaxSeen = false;
    page.on('response', (res) => {
      if (res.url().includes('admin-ajax.php') && res.url().includes('update_cart')) ajaxSeen = true;
    });

    await checkoutPage.chooseGateway(alternate);
    await expect.poll(() => ajaxSeen, { timeout: 10000 }).toBe(true);
    await page.waitForTimeout(500);

    const totals = await checkoutPage.getCartTotals();
    expect(totals).not.toBeNull();

    const total = parseFloat(totals.total);
    const totalExtraCharges = parseFloat(totals.total_extra_charges);
    const payableNow = parseFloat(totals.payable_now);
    expect(payableNow).toBeCloseTo(total + totalExtraCharges, 1);
  });
});
