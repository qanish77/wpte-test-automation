const BasePage = require('./BasePage');

// Selectors verified against the real plugin source (Codewing-Solutions/wptravelengine):
//   includes/classes/Builders/FormFields/BillingFormFields.php — renders name="billing[<key>]" / id="billing_<key>"
//   includes/classes/Builders/FormFields/DefaultFormFields.php — only fname, lname, email, address, city, country exist (no phone/state/postcode)
//   includes/templates/template-checkout/content-payment-methods.php — payment radio name has a permanent typo: wpte_checkout_paymnet_method
//   includes/templates/thank-you/content-thank-you.php
class BookingPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Checkout page shell ──────────────────────────────────────────────────
    this.checkoutContainer = page.locator('.wpte-checkout');
    this.checkoutInner     = page.locator('.wpte-checkout__container');
    this.checkoutTitle     = page.locator('h1.entry-title, h1.page-title');

    // ── Booking summary (right panel) ────────────────────────────────────────
    this.bookingSummary    = page.locator('.wpte-checkout__booking-summary');
    this.summaryTotal      = page.locator('.wpte-checkout__booking-summary-total');
    this.tripNameInSummary = page.locator('.wpte-checkout__booking-summary h3, .summary-trip-name');
    this.tripDateInSummary = page.locator('.wpte-checkout__booking-summary .date, .summary-trip-date');
    this.travelersInSummary = page.locator('.wpte-checkout__booking-summary .travelers, .summary-travelers');

    // ── Checkout Sections (collapsible boxes) ────────────────────────────────
    this.billingBox        = page.locator('.wpte-checkout__box').filter({ hasText: 'Billing' }).first();
    this.billingContent    = this.billingBox.locator('.wpte-checkout__box-content');
    this.paymentBox        = page.locator('.wpte-checkout__box').filter({ hasText: 'Payment' }).first();
    this.paymentContent    = this.paymentBox.locator('.wpte-checkout__box-content');
    this.travelersBox      = page.locator('.wpte-checkout__box').filter({ hasText: 'Traveler' }).first();

    // ── Billing fields rendered by BillingFormFields::map_fields() ──────────
    // Real field set is only fname/lname/email/address/city/country — there is
    // no phone, state, or postcode field on this checkout form.
    this.firstNameInput    = page.locator('#billing_fname, input[name="billing[fname]"]').first();
    this.lastNameInput     = page.locator('#billing_lname, input[name="billing[lname]"]').first();
    this.emailInput        = page.locator('#billing_email, input[name="billing[email]"]').first();
    this.countrySelect     = page.locator('#billing_country, select[name="billing[country]"]').first();
    this.addressInput      = page.locator('#billing_address, input[name="billing[address]"]').first();
    this.cityInput         = page.locator('#billing_city, input[name="billing[city]"]').first();

    // ── Coupon ───────────────────────────────────────────────────────────────
    this.couponInput       = page.locator('input[name="coupon_code"], input[name="wte_coupon"]').first();
    this.couponBtn         = page.locator('button[name="apply_coupon"], .wpte-coupon-btn').first();
    this.couponMessage     = page.locator('.wpte-coupon-message, .coupon-message, [class*="coupon"] .message');

    // ── Payment methods ──────────────────────────────────────────────────────
    this.paymentMethods    = page.locator('.wpte-checkout-payment-info, [class*="payment-method"]');
    // Real attribute has a permanent typo in the plugin source — "paymnet" not "payment".
    // Any *="payment" selector will silently match zero elements.
    this.paymentRadioBtns  = page.locator('input[name="wpte_checkout_paymnet_method"]');
    this.placeOrderBtn     = page.locator('button[name="wte_checkout_place_order"], .wpte-bf-submit input[type="submit"], button[type="submit"].wpte-checkout-submit').first();

    // ── Partial Payment / Installment ────────────────────────────────────────
    this.partialPaymentSection = page.locator('[class*="partial-payment"], [class*="installment"]');
    this.depositAmount      = page.locator('[class*="deposit"], .installment-amount');
    this.balanceAmount     = page.locator('[class*="balance"], .remaining-amount');

    // ── Order totals ─────────────────────────────────────────────────────────
    this.subtotal          = page.locator('.wpte-checkout__total-subtotal, [class*="subtotal"]');
    this.taxAmount         = page.locator('.wpte-checkout__total-tax, [class*="tax"]');
    this.discountAmount    = page.locator('.wpte-checkout__total-discount, [class*="discount"]');
    this.totalAmount       = page.locator('.wpte-checkout__total-grand, [class*="grand-total"], .order-total');

    // ── Thank-you page ───────────────────────────────────────────────────────
    this.thankYouMain      = page.locator('.wpte-thankyou__main');
    this.thankYouContainer = page.locator('.wpte-thankyou__container');
    this.bookingDetails    = page.locator('.thank-you-container');
    this.detailItems       = page.locator('.detail-item');
    this.bookMoreBtn       = page.locator('a.wpte-lrf-btn').filter({ hasText: 'Book More' });
    this.printReceiptBtn   = page.locator('a:has-text("Print"), button:has-text("Print")');
    this.downloadPdfBtn    = page.locator('a:has-text("PDF"), button:has-text("PDF")');

    // ── Error messages ───────────────────────────────────────────────────────
    this.errorMessages     = page.locator('.wpte-error, .wte-error, .notice-error, [class*="error-message"]');
    this.validationErrors  = page.locator('.wpte-validation-error, [class*="validation-error"]');
  }

  async openCheckout() {
    await this.goto('/checkout/');
    await this.page.waitForSelector('h1.entry-title, .wpte-checkout, body', { timeout: 10000 }).catch(() => {});
  }

  async isOnCheckoutPage() {
    return this.checkoutContainer.isVisible({ timeout: 5000 }).catch(() => false);
  }

  async isOnThankYouPage() {
    return this.thankYouMain.isVisible({ timeout: 8000 }).catch(() => false);
  }

  async getBookingDetails() {
    const details = {};
    const items = await this.detailItems.all();
    for (const item of items) {
      const label = await item.locator('strong.item-label').textContent().catch(() => '');
      const value = await item.locator('span.value').textContent().catch(() => '');
      if (label.trim()) details[label.trim()] = value.trim();
    }
    return details;
  }

  async applyCoupon(code) {
    if (await this.couponInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.couponInput.fill(code);
      await this.couponBtn.click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /** Fill billing details for checkout */
  async fillBillingDetails(details = {}) {
    if (details.firstName && await this.firstNameInput.count() > 0) {
      await this.firstNameInput.fill(details.firstName);
    }
    if (details.lastName && await this.lastNameInput.count() > 0) {
      await this.lastNameInput.fill(details.lastName);
    }
    if (details.email && await this.emailInput.count() > 0) {
      await this.emailInput.fill(details.email);
    }
    if (details.country && await this.countrySelect.count() > 0) {
      await this.countrySelect.selectOption(details.country);
    }
    if (details.address && await this.addressInput.count() > 0) {
      await this.addressInput.fill(details.address);
    }
    if (details.city && await this.cityInput.count() > 0) {
      await this.cityInput.fill(details.city);
    }
  }

  /** Get total amount from checkout */
  async getTotalAmount() {
    const totalEl = this.totalAmount.isVisible().catch(() => false) ? this.totalAmount : this.summaryTotal;
    if (await totalEl.count() === 0) return null;
    const text = await totalEl.textContent();
    const match = text.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }

  /** Check for validation errors on the page */
  async getValidationErrors() {
    const errors = [];
    if (await this.errorMessages.count() > 0) {
      const errorTexts = await this.errorMessages.allTextContents();
      errors.push(...errorTexts);
    }
    if (await this.validationErrors.count() > 0) {
      const validationTexts = await this.validationErrors.allTextContents();
      errors.push(...validationTexts);
    }
    return errors;
  }

  /** Attempt to place order (may fail if no valid booking session) */
  async placeOrder() {
    if (await this.placeOrderBtn.count() > 0) {
      await this.placeOrderBtn.click();
      await this.page.waitForTimeout(1000);
    }
  }

  /** Check if checkout has a valid booking session */
  async hasBookingContext() {
    const hasSummary = await this.bookingSummary.count() > 0;
    const hasTrip = await this.tripNameInSummary.count() > 0;
    return hasSummary && hasTrip;
  }
}

module.exports = BookingPage;
