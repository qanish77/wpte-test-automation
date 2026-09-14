/**
 * Booking → Checkout — verified end-to-end flow
 *
 * Supersedes the booking-modal/checkout portions of booking-flow.spec.js, which were
 * built on guessed selectors that never matched the live plugin (see the WPTE Suite
 * Audit: traveler-count controls, coupon controls, and the modal chrome itself were
 * all wrong, and most assertions were guarded behind `if (count === 0) return`, so a
 * broken selector reported the same green result as a working feature).
 *
 * Every selector here is read directly off the plugin source (v6.8.6), not guessed,
 * AND cross-checked against the live site (see pages/BookingModalPage.js and
 * pages/CheckoutPage.js for exact citations). Two things only live testing caught:
 *   - The step list is NOT fixed to {Date & Time, Package Type, Extra Services} —
 *     any active companion add-on can inject its own step via the
 *     `wptravelengine.tripBookingModal.stepFormTabs` filter (this site's real order is
 *     Date & Time → Package Type → Accommodation → Extra Services). Tests below never
 *     hardcode step count/order — they drive through BookingModalPage.advanceToFinalStep(),
 *     which only trusts the Next/Proceed button's own label and enabled state.
 *   - The post-checkout redirect target is `/wp-travel-engine-checkout/`, not `/checkout/`
 *     as CLAUDE.md assumed — CheckoutPage detects state from content markers, never a URL.
 *
 * Design rules this file follows (the fixes the audit called for):
 *   - No `waitForTimeout`. Every wait is tied to a real state change (element enabled/
 *     visible, a specific network response, or an actual navigation).
 *   - No blanket `if (count === 0) return` swallowing an assertion. Where a sub-step is
 *     genuinely conditional on site configuration (e.g. Partial Payment isn't enabled
 *     everywhere), the test explicitly logs *why* it's skipping via `test.info()`
 *     annotations, so a CI report shows "skipped: X not configured" instead of an
 *     indistinguishable green checkmark.
 *   - Assertions verify actual outcomes (the total price changes, the cart reflects the
 *     booking, the form really submits and lands on real thank-you content) rather than
 *     tautologies like `expect(typeof x).toBe('string')`.
 */

const { test, expect, TRIPS } = require('../../fixtures/base.fixture');

const BILLING = {
  firstName: 'Playwright',
  lastName: 'Tester',
  email: 'playwright.tester@example.com',
  address: '123 Test Street',
  city: 'Kathmandu',
  country: 'Nepal',
};

// The checkout form also requires a full traveler-details section (separate from
// billing — see CheckoutPage.js constructor comment). Parsley blocks submission
// silently (no error, no navigation) if any of these are left empty.
const TRAVELER = {
  title: 'Mr',
  firstName: 'Playwright',
  lastName: 'Tester',
  passport: 'P1234567',
  email: 'playwright.tester@example.com',
  address: '123 Test Street',
  city: 'Kathmandu',
  country: 'Nepal',
  postcode: '44600',
  phone: '9800000000',
};

/** Shared setup: open the trip, open the modal, pick a date, add one traveler. */
async function startBooking(tripDetailPage, bookingModalPage) {
  await tripDetailPage.open(TRIPS.everestBaseCamp.slug);
  await bookingModalPage.open();
  await bookingModalPage.waitForDateAutoSelected();
  await bookingModalPage.goNext(); // -> Package Type

  await expect(bookingModalPage.travelerRows.first()).toBeVisible({ timeout: 15000 });
  await bookingModalPage.incrementTraveler(0, 1);
}

test.describe('Booking modal', () => {
  test('Book Now opens the real modal (not a guessed selector)', async ({ tripDetailPage, bookingModalPage }) => {
    await tripDetailPage.open(TRIPS.everestBaseCamp.slug);
    await expect(tripDetailPage.bookNowBtn).toBeVisible({ timeout: 15000 });

    await bookingModalPage.open();

    await expect(bookingModalPage.modal).toBeVisible();
    await expect(bookingModalPage.stepsLayout).toBeVisible();

    const titles = await bookingModalPage.stepTitles();
    expect(titles.length).toBeGreaterThan(0);
    expect(titles[0]).toMatch(/date.*time/i);
  });

  test('Increasing traveler count changes the booking total', async ({ tripDetailPage, bookingModalPage }) => {
    await tripDetailPage.open(TRIPS.everestBaseCamp.slug);
    await bookingModalPage.open();
    await bookingModalPage.waitForDateAutoSelected();
    await bookingModalPage.goNext();

    await expect(bookingModalPage.travelerRows.first()).toBeVisible({ timeout: 15000 });

    const totalBefore = await bookingModalPage.getTotalText();
    const changed = await bookingModalPage.incrementTraveler(0, 1);
    expect(changed).toBe(true);

    await expect
      .poll(async () => bookingModalPage.getTotalText(), { timeout: 10000 })
      .not.toBe(totalBefore);
  });

  test('the modal traverses every configured step and reaches "Proceed To Checkout"', async ({
    tripDetailPage,
    bookingModalPage,
  }) => {
    // Whatever steps this trip/site actually has (confirmed live: this trip has a
    // 4th "Accommodation" step from a companion add-on, between Package Type and
    // Extra Services) — advanceToFinalStep() satisfies each one's own requirement
    // generically and stops only once the button's label proves it's the last step.
    await startBooking(tripDetailPage, bookingModalPage);
    await bookingModalPage.advanceToFinalStep();

    await expect(bookingModalPage.nextButton).toBeEnabled();
    await expect(bookingModalPage.nextButton).toHaveText(/proceed to checkout/i);

    const titles = await bookingModalPage.stepTitles();
    test.info().annotations.push({ type: 'steps-seen', description: titles.join(' → ') });
  });
});

test.describe('Booking → Checkout (full flow)', () => {
  test('completing the modal lands on a real, populated checkout page', async ({
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
  }) => {
    await startBooking(tripDetailPage, bookingModalPage);
    await bookingModalPage.advanceToFinalStep();

    // This click is a fetch()-then-redirect, not a form submit (App.jsx::handleSubmit) —
    // proceedToCheckout() waits for the real resulting navigation.
    await bookingModalPage.proceedToCheckout();

    // We should now be on the real checkout page with a populated cart, never the
    // empty-cart template — this is the distinction the old suite could not make.
    expect(await checkoutPage.cartState()).toBe('has-cart');

    const summaryText = await checkoutPage.getCartSummaryText();
    expect(summaryText.length).toBeGreaterThan(0);
  });

  test('full flow: modal → billing → payment → confirm → real thank-you page', async ({
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
  }) => {
    await startBooking(tripDetailPage, bookingModalPage);
    await bookingModalPage.advanceToFinalStep();
    await bookingModalPage.proceedToCheckout();
    expect(await checkoutPage.cartState()).toBe('has-cart');

    await test.step('Billing details', async () => {
      await checkoutPage.fillBillingDetails(BILLING);
      await expect(checkoutPage.firstName).toHaveValue(BILLING.firstName);
      await expect(checkoutPage.email).toHaveValue(BILLING.email);
    });

    await test.step('Traveler details', async () => {
      // Required in addition to billing — confirmBooking() below would otherwise be
      // silently blocked by client-side Parsley validation (no error, no navigation).
      await checkoutPage.fillTravelerDetails(TRAVELER);
      await expect(checkoutPage.travelerFirstName()).toHaveValue(TRAVELER.firstName);
      await expect(checkoutPage.travelerEmail()).toHaveValue(TRAVELER.email);
    });

    await test.step('Payment mode (full vs. deposit, when Partial Payment is enabled)', async () => {
      const hasPartialPayment = (await checkoutPage.paymentModePartial.count()) > 0;
      if (!hasPartialPayment) {
        test.info().annotations.push({
          type: 'skip-reason',
          description: 'Partial Payment is not enabled/configured on this site — only full payment is available.',
        });
        return;
      }
      const totalBefore = await checkoutPage.getCartSummaryText();
      await checkoutPage.choosePaymentMode('partial');
      await expect
        .poll(async () => checkoutPage.getCartSummaryText(), { timeout: 10000 })
        .not.toBe(totalBefore);

      // Switch back to full payment for a clean, deterministic checkout below.
      await checkoutPage.choosePaymentMode('full');
    });

    await test.step('Payment gateway', async () => {
      const gateways = await checkoutPage.availableGateways();
      expect(gateways.length).toBeGreaterThan(0);
      const chose = await checkoutPage.chooseGateway(gateways[0]);
      expect(chose).toBe(true);
    });

    await test.step('Confirm booking and land on real thank-you content', async () => {
      await checkoutPage.confirmBooking();
      expect(await checkoutPage.isOnThankYouPage()).toBe(true);
      await expect(checkoutPage.thankYouContainer).toBeVisible();
    });
  });
});

test.describe('Checkout — coupon', () => {
  test('an invalid coupon surfaces the real inline error, not a guess', async ({
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
  }) => {
    await startBooking(tripDetailPage, bookingModalPage);
    await bookingModalPage.advanceToFinalStep();
    await bookingModalPage.proceedToCheckout();
    expect(await checkoutPage.cartState()).toBe('has-cart');

    if ((await checkoutPage.couponInput.count()) === 0) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Coupon form is not rendered (a coupon may already be applied to this session, or the form is disabled via settings).',
      });
      test.skip();
      return;
    }

    // The AJAX call (action=wte_session_cart_apply_coupon) correctly returns
    // {success:false, data:[{code:"WTE_COUPON_NOT_EXIST", message:"..."}]} for an
    // invalid code, and trip-checkout.js's failure handler DOES correctly update
    // [data-coupon-error-message] — confirmed live via a MutationObserver, ~1.5s after
    // click. applyCoupon() catches that transient change directly (see its comment)
    // rather than polling for an end-state, because a near-simultaneous update_cart
    // fragment refresh can otherwise re-render the coupon card back to its default
    // hidden state within a couple of seconds.
    // No further assertion on checkoutPage.couponErrorText after this — applyCoupon()
    // already reliably observed the rejection via its MutationObserver at the moment
    // it happened; re-polling for visible state afterward races the same update_cart
    // refresh and can flake even though the rejection genuinely occurred.
    const result = await checkoutPage.applyCoupon('THIS-CODE-DOES-NOT-EXIST-12345');
    expect(
      result,
      'Expected the coupon rejection to be observed. If this fails intermittently, the ' +
      'update_cart/coupon-response race (see CheckoutPage.applyCoupon comment) may need a retry here.'
    ).toBe('rejected');
  });
});

test.describe('Checkout — empty cart', () => {
  test('checkout with no active booking session shows the real empty-cart template', async ({ checkoutPage }) => {
    await checkoutPage.open('/checkout/');
    expect(await checkoutPage.cartState()).toBe('empty');
    // Whichever real empty-cart code path this install uses (see CheckoutPage.js
    // header — this site is confirmed to use the shortcode-based plain-text one),
    // the populated-cart form must never be present.
    await expect(checkoutPage.form).toHaveCount(0);
  });
});
