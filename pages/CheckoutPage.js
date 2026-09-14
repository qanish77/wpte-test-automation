const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Page Object for the WP Travel Engine checkout page.
//
// Verified directly against plugin source v6.8.6 AND against the live site's actual
// rendered HTML (curl'd directly — this matters because there are two genuinely
// different "empty cart" code paths and only one is live on this install):
//   - includes/classes/Core/Shortcodes/CheckoutV2.php — the `[WP_TRAVEL_ENGINE_PLACE_ORDER]`
//     shortcode handler. CONFIRMED this is what the live Checkout page (a normal WP
//     page containing that shortcode) actually uses. When the cart is empty, it just
//     `echo`s a plain validation sentence with NO wrapper element at all — not
//     `.wpte-checkout__cart-empty-box`. Confirmed live text: "Sorry, you may not have
//     selected the number of travellers for this trip...".
//   - includes/templates/template-checkout/content-cart-empty.php — a DIFFERENT
//     empty-cart template (`.wpte-checkout__cart-empty-box`), used only by the
//     standalone full-page checkout template path (no shortcode on the page). Kept
//     here as a secondary check for portability, but it is NOT what this site shows.
//   - includes/templates/template-checkout/content-checkout.php      — page shell/layout
//   includes/classes/Filters/CheckoutPageTemplate.php               — print_checkout_form(),
//                                                                      print_checkout_form_button()
//   includes/templates/template-checkout/content-checkout-form.php  — section hook order
//   includes/templates/template-checkout/content-billing-details.php
//   includes/classes/Builders/FormFields/BillingFormFields.php      — name="billing[<key>]" / id="billing_<key>"
//   includes/classes/Builders/FormFields/DefaultFormFields.php      — only fname/lname/email/address/city/country exist
//   includes/templates/template-checkout/content-payment-modes.php  — full vs. deposit radios
//   includes/templates/template-checkout/content-payment-methods.php — gateway radios (name has a
//                                                                        permanent upstream typo: wpte_checkout_paymnet_method)
//   includes/templates/template-checkout/content-coupon-form.php
//   includes/classes/Core/Controllers/Ajax/Checkout.php              — update_cart AJAX fragment refresh
//   includes/templates/thank-you/content-thank-you.php               — thank-you content markers
//
// IMPORTANT: the Thank You page is a normal WP page chosen in Settings
// (option key `pages.wp_travel_engine_thank_you`) — its URL/slug is NOT fixed by the
// plugin, so this page object always detects it by content marker, never by URL guess.
class CheckoutPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Page states ───────────────────────────────────────────────────────────
    this.cartEmptyBox = page.locator('.wpte-checkout__cart-empty-box');
    // Live-confirmed empty-cart signal for shortcode-based checkout pages (see file
    // header) — CheckoutV2.php's plain-text validation sentence, no wrapper element.
    this.emptyCartMessage = page.getByText(/may not have selected the number of travellers/i);
    this.pageLayout = page.locator('.wpte-checkout__page-layout');
    this.form = page.locator('form#wptravelengine-checkout__form');

    // ── Cart summary / coupon (sidebar) ──────────────────────────────────────
    this.cartSummaryTable = page.locator('.wpte-checkout__booking-summary-table');
    this.couponInput = page.locator('#wpte-checkout__coupon');
    this.couponApplyBtn = page.locator('button[data-apply-coupon]');
    this.couponCard = page.locator('.wpte-checkout__coupon-card');
    this.couponRemoveBtn = page.locator('button[data-remove-coupon]');
    this.couponErrorText = page.locator('[data-coupon-error-message]');

    // ── Billing details (BillingFormFields — only these 6 fields exist) ─────
    this.firstName = page.locator('#billing_fname');
    this.lastName = page.locator('#billing_lname');
    this.email = page.locator('#billing_email');
    this.address = page.locator('#billing_address');
    this.city = page.locator('#billing_city');
    this.country = page.locator('#billing_country');

    // ── Traveler details (per-traveler section, index 0..n) ─────────────────
    // Live-confirmed via the form's data-parsley-required attributes: title, fname,
    // lname, passport, email, address, city, country, postcode and phone are ALL
    // required here (separate from — and in addition to — the billing fields above).
    // Skipping these leaves Parsley blocking submission client-side with no error
    // dialog and no navigation, which looks exactly like a hung/broken submit button.
    this.travelerTitle = (i = 0) => page.locator(`#travellers_${i}_title`);
    this.travelerFirstName = (i = 0) => page.locator(`#travellers_${i}_fname`);
    this.travelerLastName = (i = 0) => page.locator(`#travellers_${i}_lname`);
    this.travelerPassport = (i = 0) => page.locator(`#travellers_${i}_passport`);
    this.travelerEmail = (i = 0) => page.locator(`#travellers_${i}_email`);
    this.travelerAddress = (i = 0) => page.locator(`#travellers_${i}_address`);
    this.travelerCity = (i = 0) => page.locator(`#travellers_${i}_city`);
    this.travelerCountry = (i = 0) => page.locator(`#travellers_${i}_country`);
    this.travelerPostcode = (i = 0) => page.locator(`#travellers_${i}_postcode`);
    this.travelerPhone = (i = 0) => page.locator(`#travellers_${i}_phone`);

    // ── Payment mode (full vs. deposit) ──────────────────────────────────────
    // IMPORTANT — live-confirmed on this install's CURRENT checkout page: these two
    // radios do NOT exist. A full-HTML string search for "payment_mode" finds zero
    // occurrences anywhere in the rendered checkout page. There is no customer-facing
    // full-vs-partial toggle at all on this site right now — the split is computed
    // automatically and exposed only via the embedded `window.wptravelengineCart
    // .cart_totals` object (partial_total/due_total/payable_now — see getCartTotals()
    // below), confirmed mathematically consistent with the admin-configured
    // `partial_payment.payment_percent` (AdminPage.partialPaymentPercentInput) across
    // multiple independent live captures, regardless of which payment gateway
    // (this.gatewayRadios) is selected. Kept here (matching zero elements, never
    // thrown on) only so choosePaymentMode() below degrades gracefully if a future
    // site config ever reintroduces this UI.
    this.paymentModeFull = page.locator('#wp_travel_engine_payment_mode-full');
    this.paymentModePartial = page.locator('#wp_travel_engine_payment_mode-partial');

    // ── Payment gateway — real radio name, permanent typo preserved from plugin source ─
    this.gatewayRadios = page.locator('input[name="wpte_checkout_paymnet_method"]');

    // ── Travel Insurance add-on (wptravelengine-travel-insurance) ────────────────
    // Live-confirmed real markup. Opt-in: `input[name="travel_insurance_opt_in"]`
    // radios (yes/no), `data-onchange="update"` (same update_cart AJAX pattern as
    // every other checkout field). Declining reveals a required follow-up textarea
    // (`#travel_insurance_follow_up_answer`) IF the global `follow_up_required`
    // setting is on — hidden/shown via inline style + `data-hidden-by-insurance`,
    // not a class toggle, so use `toBeVisible()`, not `count()`, to check it.
    this.travelInsuranceOptInYes = page.locator('#travel_insurance_opt_in_yes');
    this.travelInsuranceOptInNo = page.locator('#travel_insurance_opt_in_no');
    this.travelInsuranceFollowUpTextarea = page.locator('#travel_insurance_follow_up_answer');
    // The plans container carries a `data-plans` attribute — a JSON-encoded COPY of
    // this trip's exact plan list (id/title/pricing_type/price/coverage/isDefault/
    // is_included), plus `data-mandatory`/`data-allow-multiple-insurance` — a
    // reliable, structured ground-truth source read straight off the DOM, no REST
    // call needed. Each plan's own radio additionally carries a `data-price`
    // attribute: the plugin's own ALREADY-COMPUTED per-traveler price for that plan
    // (for `per_person` plans this is simply the plan's flat price; for
    // `percentage_of_tour_cost` plans — e.g. "Basic" — it's the derived
    // per-traveler share of `(pre-insurance subtotal × percentage) / travelers`,
    // confirmed live to match the checkout summary's own displayed line item).
    this.travelInsurancePlansContainer = page.locator('#wpte-checkout__travel-insurance-plans-list');
    // Scoped to `[type="radio"]` — after a plan is selected, the plugin ALSO adds a
    // hidden `<input>` sharing this exact same `name` (for form submission), which
    // makes a bare `name`+`value` locator ambiguous (strict-mode violation,
    // confirmed live) once a selection has been made.
    this.travelInsurancePlanRadio = (planId) => page.locator(`input[type="radio"][name="wpte-travel-insurance-plan"][value="${planId}"]`);

    // ── Pickup Point add-on — per-traveler select (wptravelengine-pickup-points) ──
    // Live-confirmed real markup: a plain `<select id="travellers_{i}_pickup_point"
    // name="travellers[i][pickup_point]">` with a blank "Select a pickup point"
    // default option plus one `<option value="{id}">` per configured pickup point
    // (paid options render a `<span class="wpte-price" data-value="...">`, free ones
    // just the text "Free" — both before the location name). `data-onchange="update"`
    // triggers the same update_cart AJAX fragment refresh as every other checkout
    // field (see triggerCartUpdate() below for why reading its response, not
    // window.wptravelengineCart, is the reliable way to observe the result).
    this.pickupPointSelect = (i = 0) => page.locator(`#travellers_${i}_pickup_point`);

    // ── Terms & privacy (DefaultFormFields::privacy_form_fields()) ───────────
    this.termsCheckbox = page.locator('input[type="checkbox"][name*="terms_conditions"]');

    // ── Submit — CheckoutPageTemplate::print_checkout_form_button() ─────────
    // The coupon form's "Apply" button shares this exact class + type — live DOM confirmed
    // it also carries data-apply-coupon, which "Confirm Booking" never does. Without the
    // :not() exclusion this locator is ambiguous (strict-mode violation, 2 elements).
    this.submitButton = page.locator('button[type="submit"].wpte-checkout__form-submit-button:not([data-apply-coupon])');

    // ── Thank you page ────────────────────────────────────────────────────────
    this.thankYouMain = page.locator('.wpte-thankyou__main');
    this.thankYouContainer = page.locator('.wpte-thankyou__container');
  }

  async open(path = '/checkout/') {
    await this.goto(path);
  }

  /**
   * 'empty' | 'has-cart' | 'unknown' — checks both real empty-cart code paths
   * (see file header) plus the populated-cart `<form>`, in that order.
   */
  async cartState() {
    if ((await this.cartEmptyBox.count()) > 0) return 'empty';
    if ((await this.form.count()) > 0) return 'has-cart';
    if ((await this.emptyCartMessage.count()) > 0) return 'empty';
    return 'unknown';
  }

  async fillBillingDetails({ firstName, lastName, email, address, city, country } = {}) {
    if (firstName) await this.firstName.fill(firstName);
    if (lastName) await this.lastName.fill(lastName);
    if (email) await this.email.fill(email);
    if (address) await this.address.fill(address);
    if (city) await this.city.fill(city);
    if (country) {
      const tagName = await this.country.evaluate((el) => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await this.country
          .selectOption({ label: country })
          .catch(() => this.country.selectOption(country));
      } else {
        await this.country.fill(country);
      }
    }
  }

  /**
   * Fills one traveler's required fields (index 0..n — see constructor comment for
   * why every one of these is required on this install). Without this,
   * confirmBooking() clicks a perfectly enabled button that Parsley silently blocks
   * client-side — no error shown, no navigation, indistinguishable from a hang.
   */
  async fillTravelerDetails(
    { title, firstName, lastName, passport, email, address, city, country, postcode, phone } = {},
    index = 0
  ) {
    if (title) {
      await this.travelerTitle(index)
        .selectOption({ label: title })
        .catch(() => this.travelerTitle(index).selectOption(title));
    }
    if (firstName) await this.travelerFirstName(index).fill(firstName);
    if (lastName) await this.travelerLastName(index).fill(lastName);
    if (passport) await this.travelerPassport(index).fill(passport);
    if (email) await this.travelerEmail(index).fill(email);
    if (address) await this.travelerAddress(index).fill(address);
    if (city) await this.travelerCity(index).fill(city);
    if (country) {
      await this.travelerCountry(index)
        .selectOption({ label: country })
        .catch(() => this.travelerCountry(index).selectOption(country));
    }
    if (postcode) await this.travelerPostcode(index).fill(postcode);
    if (phone) await this.travelerPhone(index).fill(phone);
  }

  /**
   * Selecting a payment mode triggers an AJAX fragment refresh
   * (Core/Controllers/Ajax/Checkout.php::process_request, action=update_cart) that
   * re-renders the submit button, cart summary and payment-mode/method fragments —
   * we wait for that response, never a fixed sleep, before trusting any of those
   * fragments' new content.
   */
  async choosePaymentMode(mode /* 'full' | 'partial' */) {
    const target = mode === 'partial' ? this.paymentModePartial : this.paymentModeFull;
    if ((await target.count()) === 0) return false;
    await Promise.all([
      this.page
        .waitForResponse((res) => res.url().includes('admin-ajax.php'), { timeout: 15000 })
        .catch(() => null),
      target.check(),
    ]);
    return true;
  }

  /** Every currently rendered payment gateway's `value` (bank transfer, check, PayPal, etc.) */
  async availableGateways() {
    const count = await this.gatewayRadios.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await this.gatewayRadios.nth(i).getAttribute('value'));
    }
    return values;
  }

  async chooseGateway(value) {
    const radio = this.page.locator(`input[name="wpte_checkout_paymnet_method"][value="${value}"]`);
    if ((await radio.count()) === 0) return false;
    await radio.check();
    return true;
  }

  /**
   * Verified against src/public/js/pages/trip-checkout/coupon.js: a valid coupon does a
   * full `window.location.reload()` on success (fires a new `load` event, same URL); an
   * invalid one reveals `[data-coupon-error-message]` in place with no reload at all.
   *
   * Live-confirmed via network + a MutationObserver: a rejection DOES update the DOM
   * correctly (server returns e.g. WTE_COUPON_NOT_EXIST, and the span's text/display
   * update within ~1.5s) — but there's a genuine race with a near-simultaneous
   * update_cart AJAX fragment refresh that sometimes re-renders the coupon card back to
   * its default hidden state within a couple of seconds, before a plain
   * `locator.waitFor({state:'visible'})` poll reliably observes it (measured ~50% miss
   * rate). A MutationObserver attached before the click catches the transient change
   * itself, regardless of whether it's later overwritten.
   *
   * Returns 'applied' | 'rejected' | 'unknown' (neither happened within the timeout).
   *
   * Even the MutationObserver above can still lose the race (e.g. if the update_cart
   * refresh replaces the WHOLE coupon-card subtree in one shot rather than mutating
   * the tracked node in place, no mutation ever fires on it). Since we know the
   * rejection genuinely happens almost every time, retry a couple of times on
   * 'unknown' before giving up — each attempt re-attaches the observer fresh.
   */
  async applyCoupon(code, { retries = 2 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await this.applyCouponOnce(code);
      if (result !== 'unknown') return result;
    }
    return 'unknown';
  }

  async applyCouponOnce(code) {
    await this.couponInput.fill(code);

    const rejectionSeen = this.page.evaluate(() => new Promise((resolve) => {
      const el = document.querySelector('[data-coupon-error-message]');
      if (!el) return resolve(false);
      const isShown = () => el.textContent.trim().length > 0 && el.style.display !== 'none';
      if (isShown()) return resolve(true);
      const obs = new MutationObserver(() => {
        if (isShown()) {
          obs.disconnect();
          resolve(true);
        }
      });
      obs.observe(el, { attributes: true, attributeFilter: ['style'], childList: true, characterData: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(false); }, 15000);
    }));

    await this.couponApplyBtn.click();

    return Promise.race([
      this.page.waitForEvent('load', { timeout: 15000 }).then(() => 'applied'),
      rejectionSeen.then((seen) => (seen ? 'rejected' : 'unknown')),
    ]).catch(() => 'unknown');
  }

  async removeCoupon() {
    if ((await this.couponRemoveBtn.count()) === 0) return false;
    await this.couponRemoveBtn.click();
    return true;
  }

  async getCartSummaryText() {
    await this.cartSummaryTable.waitFor({ state: 'visible', timeout: 10000 });
    return (await this.cartSummaryTable.textContent())?.trim() ?? null;
  }

  /**
   * Parses the Travel Insurance plans container's `data-plans` JSON (see
   * travelInsurancePlansContainer's doc above) into a plain object, alongside its
   * sibling data-* attributes. Returns null if the container isn't present (e.g.
   * the add-on isn't active for this trip).
   */
  async getTravelInsuranceData() {
    return this.page.evaluate(() => {
      const el = document.querySelector('#wpte-checkout__travel-insurance-plans-list');
      if (!el) return null;
      return {
        mandatory: el.getAttribute('data-mandatory') === 'yes',
        allowMultiple: el.getAttribute('data-allow-multiple-insurance') === 'yes',
        defaultOptIn: el.getAttribute('data-default-opt-in'),
        followUpRequired: el.getAttribute('data-follow-up-required') === 'yes',
        plans: JSON.parse(el.getAttribute('data-plans') || '[]'),
      };
    });
  }

  /**
   * The plugin's own computed cart totals, embedded server-side as
   * `window.wptravelengineCart.cart_totals` (see paymentModeFull/paymentModePartial
   * doc above for why this — not a UI toggle — is the real data source for Partial
   * Payment verification on this install). Returns null if the object isn't present
   * (e.g. an empty cart / no active booking session).
   *
   * IMPORTANT — live-confirmed this global is a ONE-TIME snapshot from the page's
   * initial server-rendered HTML and is never reassigned after a later `update_cart`
   * AJAX fragment refresh (confirmed by directly capturing an update_cart response's
   * own `cart_totals` — correct and changed — immediately after this function kept
   * returning the original page-load values). Safe to use for a single read right
   * after the checkout page first loads (as Partial Payment's tests do); NOT safe
   * for a before/after comparison across an in-page interaction — use
   * triggerCartUpdate() for that instead.
   */
  async getCartTotals() {
    return this.page.evaluate(() => window.wptravelengineCart?.cart_totals ?? null);
  }

  /**
   * Runs `triggerFn` (e.g. selecting a pickup point, changing a quantity — anything
   * that fires the checkout's `update_cart` AJAX fragment refresh) and returns the
   * `cart_totals` from that real AJAX response — the reliable way to read totals
   * AFTER an interaction (see getCartTotals()'s doc for why the window global itself
   * can't be used for this). Returns null if no matching response arrives in time.
   *
   * IMPORTANT — live-confirmed via request/response tracing: a SINGLE form
   * interaction on this checkout (e.g. one pickup-point selection) can fire two or
   * three redundant `update_cart` requests in a row (all carrying the same new
   * value, presumably duplicate event bindings), and — because a slow shared-
   * hosting round trip means a PRIOR interaction's own redundant requests can still
   * be in flight when the NEXT interaction starts — grabbing just the first matching
   * response after triggering was confirmed to sometimes return a stale, leftover
   * result from the previous interaction instead of the current one (reproduced: a
   * paid pickup selection's captured "total" was byte-identical to the prior no-
   * pickup baseline, even though the select's own value had correctly changed).
   * Fixed by draining until the matching-response traffic goes quiet for a bit,
   * always keeping the LAST one seen — the true settled state — rather than the
   * first.
   */
  async triggerCartUpdate(triggerFn, { quietMs = 1200, timeoutMs = 15000 } = {}) {
    let totals = null;
    let lastSeenAt = null;
    const handler = async (res) => {
      if (res.url().includes('admin-ajax.php') && res.url().includes('update_cart')) {
        try {
          const json = await res.json();
          totals = json.cart_totals ?? totals;
          lastSeenAt = Date.now();
        } catch (e) {
          // ignore non-JSON / unrelated admin-ajax responses
        }
      }
    };
    this.page.on('response', handler);
    await triggerFn();
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await this.page.waitForTimeout(150);
      if (lastSeenAt !== null && Date.now() - lastSeenAt >= quietMs) break;
    }
    this.page.off('response', handler);
    return totals;
  }

  /**
   * Submits the real (non-AJAX) POST form
   * (`<form id="wptravelengine-checkout__form" method="POST">`, action value
   * `wp_travel_engine_new_booking_process_action`) and waits for the resulting
   * navigation to whichever page is configured as the Thank You page.
   */
  async confirmBooking() {
    if ((await this.termsCheckbox.count()) > 0) {
      await this.termsCheckbox.check().catch(() => {});
    }
    await expect(this.submitButton).toBeEnabled({ timeout: 10000 });
    const startUrl = this.page.url();
    await this.submitButton.click();
    await this.page.waitForURL((url) => url.toString() !== startUrl, { timeout: 30000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  async isOnThankYouPage() {
    return (await this.thankYouMain.count()) > 0;
  }
}

module.exports = CheckoutPage;
