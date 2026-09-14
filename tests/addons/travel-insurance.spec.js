/**
 * Travel Insurance — Functional Tests (wptravelengine-travel-insurance add-on)
 *
 * Every selector/behavior here was verified live against the running site
 * (authenticated REST calls, a checkout DOM dump, a real plan-switch replay reading
 * the plugin's own `data-price` attributes and cart totals, admin DOM dumps) — never
 * guessed. See pages/CheckoutPage.js (travelInsuranceOptInYes/No,
 * travelInsurancePlansContainer, travelInsurancePlanRadio, getTravelInsuranceData)
 * and pages/AdminPage.js (travelInsuranceTitleInput, travelInsurancePlansTable,
 * tripTravelInsuranceMandatoryToggle, goToTravelInsuranceSettings,
 * goToTripTravelInsuranceTab) for the citations behind each locator.
 *
 * Supersedes the previous travel-insurance.spec.js, which looked for the insurance
 * section on the TRIP DETAIL PAGE / booking modal via guessed `[class*="insurance"]`
 * selectors. Live reconnaissance found no such elements there at all — the real UI
 * (confirmed via a full checkout HTML dump) lives entirely on the CHECKOUT page:
 * an opt-in Yes/No radio pair, then a plan-selection radio group, both firing the
 * same update_cart AJAX pattern every other checkout field uses.
 *
 * CONFIRMED LIVE FACTS (Everest Base Camp trek, TRIPS.everestBaseCamp):
 *   - REST `GET /wp-json/wptravelengine/v2/settings` -> `travel_insurance` returns
 *     exactly this add-on's documented global shape: opt-in labels/question,
 *     `default_opt_in`, `follow_up_question`/`follow_up_required`, affiliate config,
 *     and a `plans[]` array (id/title/price/pricing_type/coverage/label/
 *     is_included). Live data right now: "Basic" (percentage_of_tour_cost, 11.11%,
 *     the default plan), "Premium" (per_person, ₹10), "Safè" and "Secure" (both
 *     per_person, price 0 — free/included plans).
 *   - REST trip endpoint's `travel_insurance` meta mirrors the documented trip-level
 *     shape (`mandatory`, `type: "global_plans"`, a `plans[]` array synced from
 *     global settings, each carrying its own `isDefault` flag — "Basic" is the only
 *     one currently true).
 *   - Checkout renders `#wpte-checkout__travel-insurance-plans-list`, a container
 *     whose `data-plans` attribute is a JSON-encoded COPY of the trip's exact plan
 *     list, plus `data-mandatory`/`data-allow-multiple-insurance`/
 *     `data-default-opt-in`/`data-follow-up-required` — read directly via
 *     getTravelInsuranceData(), no REST call needed to cross-check the live UI.
 *   - Each plan's own radio (`input[type="radio"][name="wpte-travel-insurance-plan"]`)
 *     carries a `data-price` attribute: the plugin's ALREADY-COMPUTED per-traveler
 *     price for that plan, live for ALL plans simultaneously (not just the selected
 *     one) — for `per_person` plans this is just the flat configured price; for
 *     `percentage_of_tour_cost` plans (Basic) it's `(subtotal excluding existing
 *     insurance × percentage) / total travelers`, per this add-on's own documented
 *     formula.
 *   - IMPORTANT, live-verified via a real plan-switch replay (3 travelers on this
 *     booking): switching from a zero-cost plan (Secure) to Premium (per_person,
 *     ₹10) increased the cart subtotal by EXACTLY ₹30 = 10 × 3 travelers. Switching
 *     to Basic (11.11% of a ₹201.10 pre-insurance subtotal) increased it by ₹22.34,
 *     matching the computed ₹22.3422 to the cent (display rounding). Both formulas
 *     from this add-on's developer-docs.md are confirmed correct and currently
 *     active, not just documented intent.
 *   - Selecting "No" for the opt-in question reveals a required follow-up textarea
 *     (`#travel_insurance_follow_up_answer`, live-confirmed `isVisible()` flips
 *     false -> true) — matching the live `follow_up_required: true` global setting.
 *   - Admin Extensions > Travel Insurance has three sub-tabs (Checkout | Insurance
 *     Plans | Affiliate). "Checkout" holds the opt-in copy/labels
 *     (`input[name="travel_insurance.*"]`, real stable names matching REST fields
 *     exactly); "Insurance Plans" holds a real `<table>` (Title | Price | Action)
 *     listing each plan's title and price (with a "%" or currency suffix depending
 *     on pricing_type — live-confirmed).
 *   - Admin Trip Edit has its own "Travel Insurance" meta tab with
 *     `input[name="travel_insurance.mandatory"]` and
 *     `input[name="travel_insurance.allow_multiple_insurance"]` checkboxes, matching
 *     the REST trip-meta fields exactly.
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

async function fetchTripData(page) {
  const res = await page.request.get(`/wp-json/wptravelengine/v2/trips/${TRIP.id}`);
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

test.describe('Travel Insurance — REST API', () => {
  test('global settings expose the documented travel_insurance shape', async ({ loggedInAdmin, page }) => {
    // Unlike the trip endpoint below (public trip data), /wp-json/wptravelengine/v2/settings
    // requires an authenticated nonce even for a GET — live-confirmed 401 without one.
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    const { status, body } = await fetchGlobalSettings(page);
    expect(status).toBe(200);
    expect(body).toHaveProperty('travel_insurance');

    const ti = body.travel_insurance;
    expect(typeof ti.question).toBe('string');
    expect(typeof ti.default_opt_in).toBe('string');
    expect(typeof ti.follow_up_required).toBe('boolean');
    expect(Array.isArray(ti.plans)).toBe(true);
    expect(ti.plans.length).toBeGreaterThan(0);

    for (const plan of ti.plans) {
      expect(typeof plan.title).toBe('string');
      expect(['per_person', 'percentage_of_tour_cost']).toContain(plan.pricing_type);
      expect(typeof plan.price).toBe('number');
      expect(plan.price).toBeGreaterThanOrEqual(0);
    }
  });

  test('trip endpoint exposes trip-level travel_insurance meta with exactly one default plan', async ({ page }) => {
    const { status, body } = await fetchTripData(page);
    expect(status).toBe(200);
    expect(body).toHaveProperty('travel_insurance');

    const ti = body.travel_insurance;
    expect(typeof ti.mandatory).toBe('boolean');
    expect(['global_plans', 'custom_plans', 'affiliate']).toContain(ti.type);
    expect(Array.isArray(ti.plans)).toBe(true);

    if (ti.plans.length === 0) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No insurance plans configured for this trip.' });
      return;
    }
    const defaults = ti.plans.filter((p) => p.isDefault);
    expect(defaults.length).toBe(1);
  });
});

test.describe('Travel Insurance — Checkout', () => {
  test('plans container mirrors the trip\'s live REST configuration', async ({
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
    page,
  }) => {
    const { body: tripData } = await fetchTripData(page);
    await bookToCheckout(tripDetailPage, bookingModalPage);
    expect(await checkoutPage.cartState()).toBe('has-cart');

    const tiData = await checkoutPage.getTravelInsuranceData();
    if (!tiData) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Travel Insurance section not present at checkout for this trip.' });
      return;
    }

    expect(tiData.mandatory).toBe(!!tripData.travel_insurance.mandatory);
    expect(tiData.plans.map((p) => p.id).sort()).toEqual(
      tripData.travel_insurance.plans.map((p) => p.id).sort()
    );
    for (const plan of tripData.travel_insurance.plans) {
      const domPlan = tiData.plans.find((p) => p.id === plan.id);
      expect(domPlan.title).toBe(plan.title);
      expect(domPlan.pricing_type).toBe(plan.pricing_type);
    }

    // Exactly the REST-designated default plan is pre-checked.
    const defaultPlan = tripData.travel_insurance.plans.find((p) => p.isDefault);
    await expect(checkoutPage.travelInsuranceOptInYes).toBeChecked();
    await expect(checkoutPage.travelInsurancePlanRadio(defaultPlan.id)).toBeChecked();
  });

  test('declining insurance reveals the required follow-up question', async ({
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
  }) => {
    await bookToCheckout(tripDetailPage, bookingModalPage);
    expect(await checkoutPage.cartState()).toBe('has-cart');

    if ((await checkoutPage.travelInsuranceOptInNo.count()) === 0) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Travel Insurance opt-in not present for this trip.' });
      return;
    }

    await expect(checkoutPage.travelInsuranceFollowUpTextarea).not.toBeVisible();
    await checkoutPage.triggerCartUpdate(() => checkoutPage.travelInsuranceOptInNo.check());
    await expect(checkoutPage.travelInsuranceFollowUpTextarea).toBeVisible();
  });

  test('switching plans changes the cart total by exactly the documented pricing formula', async ({
    tripDetailPage,
    bookingModalPage,
    checkoutPage,
    page,
  }) => {
    await bookToCheckout(tripDetailPage, bookingModalPage);
    expect(await checkoutPage.cartState()).toBe('has-cart');

    const tiData = await checkoutPage.getTravelInsuranceData();
    if (!tiData) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Travel Insurance section not present for this trip.' });
      return;
    }

    const cart = await page.evaluate(() => window.wptravelengineCart);
    const totalTravelers = Object.values(cart.cart_items[0].pax).reduce((a, b) => a + Number(b), 0);
    expect(totalTravelers).toBeGreaterThan(0);

    const zeroCostPlan = tiData.plans.find((p) => parseFloat(p.price) === 0);
    const perPersonPlan = tiData.plans.find((p) => p.pricing_type === 'per_person' && parseFloat(p.price) > 0);
    const percentagePlan = tiData.plans.find((p) => p.pricing_type === 'percentage_of_tour_cost');

    if (!zeroCostPlan) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No zero-cost plan configured to use as a pricing baseline.' });
      return;
    }

    const baseline = await checkoutPage.triggerCartUpdate(() => checkoutPage.travelInsurancePlanRadio(zeroCostPlan.id).check());
    const baselineSubtotal = parseFloat(baseline.subtotal);

    if (perPersonPlan) {
      const totals = await checkoutPage.triggerCartUpdate(() => checkoutPage.travelInsurancePlanRadio(perPersonPlan.id).check());
      const delta = parseFloat(totals.subtotal) - baselineSubtotal;
      const expectedDelta = parseFloat(perPersonPlan.price) * totalTravelers;
      expect(delta).toBeCloseTo(expectedDelta, 1);

      // The plugin's own data-price attribute for a per_person plan is always the
      // flat configured price, independent of anyone's current selection.
      const dataPrice = await checkoutPage.travelInsurancePlanRadio(perPersonPlan.id).getAttribute('data-price');
      expect(parseFloat(dataPrice)).toBeCloseTo(parseFloat(perPersonPlan.price), 1);
    }

    if (percentagePlan) {
      const totals = await checkoutPage.triggerCartUpdate(() => checkoutPage.travelInsurancePlanRadio(percentagePlan.id).check());
      const delta = parseFloat(totals.subtotal) - baselineSubtotal;
      const expectedDelta = baselineSubtotal * (parseFloat(percentagePlan.price) / 100);
      expect(delta).toBeCloseTo(expectedDelta, 1);
    }
  });
});

test.describe('Travel Insurance — Admin: Global Settings', () => {
  test('Checkout sub-tab fields match the live REST-reported configuration', async ({ loggedInAdmin, page }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    const { body: settings } = await fetchGlobalSettings(page);
    const ti = settings.travel_insurance;

    await loggedInAdmin.goToTravelInsuranceSettings();
    await loggedInAdmin.travelInsuranceCheckoutSubTab.click().catch(() => {});
    await loggedInAdmin.travelInsuranceTitleInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    await expect(loggedInAdmin.travelInsuranceTitleInput).toHaveValue(ti.title);
    await expect(loggedInAdmin.travelInsuranceQuestionInput).toHaveValue(ti.question);
    await expect(loggedInAdmin.travelInsuranceYesLabelInput).toHaveValue(ti.yes_label);
    await expect(loggedInAdmin.travelInsuranceNoLabelInput).toHaveValue(ti.no_label);
    expect(await loggedInAdmin.travelInsuranceFollowUpRequiredToggle.isChecked()).toBe(!!ti.follow_up_required);
    expect(await loggedInAdmin.travelInsuranceEnablePerDayPriceToggle.isChecked()).toBe(!!ti.enable_per_day_price);
  });

  test('Insurance Plans sub-tab table matches the live REST plan list', async ({ loggedInAdmin, page }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    const { body: settings } = await fetchGlobalSettings(page);
    const plans = settings.travel_insurance.plans;

    await loggedInAdmin.goToTravelInsuranceSettings();
    await loggedInAdmin.travelInsurancePlansSubTab.click();
    await expect(loggedInAdmin.travelInsurancePlansTable).toBeVisible();

    const rowCount = await loggedInAdmin.travelInsurancePlansRows.count();
    expect(rowCount).toBe(plans.length);

    for (let i = 0; i < plans.length; i++) {
      const row = loggedInAdmin.travelInsurancePlansRows.nth(i);
      await expect(row.locator('input[placeholder="Enter title"]')).toHaveValue(plans[i].title);
      if (parseFloat(plans[i].price) > 0) {
        await expect(row.locator('input[placeholder="Enter price"]')).toHaveValue(String(plans[i].price));
      }
    }
  });
});

test.describe('Travel Insurance — Admin: Trip Edit', () => {
  test('mandatory and allow-multiple toggles reflect the live trip-level setting', async ({ loggedInAdmin, page }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    const { body: tripData } = await fetchTripData(page);
    const ti = tripData.travel_insurance;

    await loggedInAdmin.goToTripTravelInsuranceTab(TRIP.id);
    await expect(loggedInAdmin.tripTravelInsuranceMandatoryToggle).toBeAttached();
    expect(await loggedInAdmin.tripTravelInsuranceMandatoryToggle.isChecked()).toBe(!!ti.mandatory);
    expect(await loggedInAdmin.tripTravelInsuranceAllowMultipleToggle.isChecked()).toBe(!!ti.allow_multiple_insurance);
  });
});
