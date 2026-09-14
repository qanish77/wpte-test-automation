const BasePage = require('./BasePage');

// Selectors from:
//   wp-travel-engine/includes/templates/single-trip/tabs-nav.php
//   wp-travel-engine/includes/templates/single-trip/trip-sidebar.php
//   wp-travel-engine/includes/templates/templates/single-trip.html (Gutenberg block)
//   wp-travel-engine/includes/templates/script-templates/booking-process/
class TripDetailPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Page Header & Navigation ─────────────────────────────────────────────
    this.tripTitle   = page.locator('h1.entry-title, h1').first();
    this.priceWrapper = page.locator('.wpte-trip-price-wrapper').first();
    this.breadcrumbs = page.locator('.breadcrumbs, .wp-breadcrumb, nav[class*="breadcrumb"]');

    // ── Tabs — from tabs-nav.php ─────────────────────────────────────────────
    this.tabsContainer = page.locator('#tabs-container.wpte-tabs-container, #tabs-container');
    this.tabLinks      = page.locator('a.nav-tab.nb-tab-trigger:not([id*="-mobile"])');
    this.activeTab     = page.locator('a.nav-tab.nb-tab-active, a.nav-tab[aria-selected="true"]');

    // Tab content panels (WTE uses numeric IDs: #nb-{N}-configurations)
    // Overview=1, Itinerary=2, Cost=3, Dates=4, FAQs=5, Map=6
    this.overviewPanel   = page.locator('#nb-1-configurations, #nb-overview-configurations, [id*="overview"]').first();
    this.itineraryPanel  = page.locator('#nb-2-configurations, #nb-itinerary-configurations, [id*="itinerary"]').first();
    this.costPanel       = page.locator('#nb-3-configurations, #nb-cost-configurations, [id*="cost"]').first();
    this.datesPanel      = page.locator('#nb-4-configurations, #nb-dates-configurations, [id*="dates"]').first();
    this.faqPanel        = page.locator('#nb-5-configurations, #nb-faq-configurations, [id*="faq"]').first();
    this.mapPanel        = page.locator('#nb-6-configurations, #nb-map-configurations, [id*="map"]').first();

    // ── Itinerary Content ────────────────────────────────────────────────────
    this.itineraryDays   = page.locator('.wpte-itinerary-item, [class*="itinerary-day"], [class*="itinerary-item"]');
    this.itineraryTitle  = page.locator('.wpte-itinerary-title, [class*="itinerary-title"]');
    this.faqItems        = page.locator('.wpte-faq-item, [class*="faq-item"]');
    this.faqSection      = page.locator('.wpte-faq-section, [class*="faq-section"]');

    // ── Gallery ───────────────────────────────────────────────────────────────
    this.gallery         = page.locator('.wpte-gallery-container, [class*="gallery"]');
    this.galleryImages   = page.locator('.wpte-gallery-container img, [class*="gallery"] img');

    // ── Booking — Gutenberg block renders button.wte-book-now with id="open-booking-modal" ─
    this.bookNowBtn       = page.locator('button.wte-book-now, #open-booking-modal, a.wte-book-now').first();
    // Booking modal (rendered via JS after clicking Book Now)
    this.bookingModal     = page.locator('.wte-booking-modal, #wte-booking-popup, [class*="booking-modal"]').first();
    this.bookingForm      = page.locator('.wpte-bf-outer, .wpte-booking-area-wrapper, .wpte-bf-content').first();
    this.bookingSummary   = page.locator('.wpte-bf-summary, [class*="booking-summary"]');

    // ── Booking Form Fields ──────────────────────────────────────────────────
    this.travelerInput    = page.locator('input[name*="pax"], input[name*="traveler"], [class*="pqty"] input, input[name*="num_"]').first();
    this.travelerPlusBtn  = page.locator('[class*="pqty"] .plus, [class*="increment"], button.plus').first();
    this.travelerMinusBtn = page.locator('[class*="pqty"] .minus, [class*="decrement"], button.minus').first();

    // Price elements in booking sidebar
    this.priceWrap        = page.locator('.wpte-bf-price-wrap, .wpte-bf-price, [class*="bf-price"]').first();
    this.regPrice         = page.locator('.wpte-bf-reg-price, .wpte-bf-price-from, [class*="bf-reg-price"]').first();
    this.offerPrice       = page.locator('.wpte-bf-offer-price, .wpte-bf-offer-amount, [class*="offer-price"]').first();
    this.discountTag      = page.locator('.wpte-bf-discount-tag, [class*="discount-tag"]').first();

    // ── Enquiry Form ──────────────────────────────────────────────────────────
    this.enquiryForm      = page.locator('.wpte-enquiry-form, form[class*="enquiry"], form[class*="inquiry"]').first();
    this.enquiryBtn       = page.locator('button:has-text("Enquiry"), a:has-text("Enquiry"), [class*="enquiry"] button').first();

    // ── Fixed Starting Dates (add-on) — WTE new design uses wte-fsd__ prefix ─
    this.fsdSection       = page.locator('.wte-fsd__container, [class*="fixed-departure"]').first();
    this.fsdDateOptions   = page.locator('.wte-fsd__availability-start-date, [class*="wte-fsd__availability-start"]');
    this.fsdPrices        = page.locator('.wte-fsd__availability-price-wrap, [class*="wte-fsd__availability-price"]');
    this.fsdBookNowBtns   = page.locator('.wte-fsd__booknow-btn, .book-btn.wte-fsd__booknow-btn');
    this.fsdFilterBtns    = page.locator('.wte-fsd__button, [class*="wte-fsd__button"]');
    this.fsdShowMoreBtn   = page.locator('.wte-fsd__availability-show-more-wrap button, [class*="show-more"] button').first();
    this.fsdSeatsLeft     = page.locator('[class*="wte-fsd__availability"][class*="seat"], [class*="space-left"], [class*="seats"]');

    // ── Add-on Specific Selectors (for edge case detection) ─────────────────
    // Real Group Discount markup (tiered per-traveler pricing) — distinct from
    // the generic sale-price badge (.wpte-bf-discount-tag), which is unrelated.
    this.groupDiscountSection = page.locator('.category-trip-group-avil, .pop-trip-grpavil-txt, .wte-fsd__group-discount');
    // Rendered only once the booking wizard's Extra Services step is active —
    // call advanceBookingStep() after clickBookNow() before checking this.
    this.extraServicesSection = page.locator('.wte-process-tab-content-wrapper, .wte-trip-options, .wte-trip-guest-wrapper');
    // NOTE: Insurance/Pickup/Accommodation have no frontend in core WTE — each is
    // gated by wptravelengine_is_addon_active() behind a separate add-on plugin
    // constant not present in this codebase. These selectors are best-effort
    // guesses; verify against the live site's DOM before trusting them.
    this.insuranceSection     = page.locator('[class*="insurance"], [class*="wte-ti"]');
    this.pickupPointField     = page.locator('[name="pickup"], input[name*="location"]');
    this.accommodationSection = page.locator('[class*="accommodation"]');

    // ── Map Section ───────────────────────────────────────────────────────────
    this.mapContainer    = page.locator('.wpte-map-container, [class*="trip-map"], #nb-map-configurations');

    // ── Footer ───────────────────────────────────────────────────────────────
    this.relatedTrips    = page.locator('.wpte-related-trips, [class*="related-trips"]');
  }

  async open(slug) {
    // waitUntil: 'domcontentloaded' (set in BasePage.goto) ensures the server-rendered HTML
    // is fully parsed when this resolves — h1, tabs, price etc. are already in the DOM.
    await this.goto(`/trip/${slug}/`);
    // Close the "Special Offer" banners now so they can't intercept tab clicks later.
    await this.dismissPromoBanners();
  }

  async getTripTitle() {
    return this.tripTitle.textContent();
  }

  /** Click a tab by its text label (e.g. 'Itinerary', 'Cost', 'FAQs', 'Map', 'Dates') */
  async clickTab(tabText) {
    const tabLink = this.tabLinks.filter({ hasText: tabText }).first();
    const isVisible = await tabLink.isVisible().catch(() => false);
    if (!isVisible) {
      // Tab may not exist or may be hidden, try without clicking
      return;
    }
    // A sibling ".wte-tab-title" wrapper can sit on top of this tab during its
    // transition animation and not settle within the actionability window under
    // load (tracing/video overhead). The tab is a plain <a onclick>, so if the
    // hit-tested click keeps getting intercepted, dispatch the click event
    // directly — bypassing hit-testing — rather than resorting to force:true.
    await tabLink.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    try {
      await tabLink.click({ timeout: 8000 });
    } catch (err) {
      await tabLink.dispatchEvent('click');
    }
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for the tab panel to become visible (panels have display:none initially).
    // Tab IDs are only numeric by default (wte_get_default_settings_tab()) — an admin
    // can reconfigure trip_tabs or add custom tabs with non-numeric keys, so resolve
    // the real panel via aria-controls first and only fall back to the hardcoded map.
    const ariaControls = await tabLink.getAttribute('aria-controls').catch(() => null);
    const panelId = ariaControls ? `#${ariaControls}` : this.getTabPanelId(tabText);
    if (panelId) {
      await this.page.locator(panelId).waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    }
    await this.page.waitForTimeout(300);
  }

  /** Get the panel ID for a tab name */
  getTabPanelId(tabText) {
    const tabNames = {
      'overview': '#nb-1-configurations',
      'itinerary': '#nb-2-configurations',
      'cost': '#nb-3-configurations',
      'dates': '#nb-4-configurations',
      'faq': '#nb-5-configurations',
      'map': '#nb-6-configurations',
    };
    const key = tabText.toLowerCase();
    return tabNames[key] || null;
  }

  /** Click the Book Now / Check Availability button to open the booking modal */
  async clickBookNow() {
    await this.bookNowBtn.click();
    await this.bookingModal.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  }

  /** Advance the booking modal's step wizard (date-time → package-type → extra-services).
   * The modal only renders the ACTIVE step's markup — clickBookNow() alone only opens
   * step 1. Call this once per step to reach later steps like Extra Services. */
  async advanceBookingStep() {
    const nextBtn = this.page.locator('.wte-process-btn-next').first();
    if (await nextBtn.count() === 0) return false;
    if (!(await nextBtn.isVisible({ timeout: 2000 }).catch(() => false))) return false;
    await nextBtn.click().catch(() => {});
    await this.page.waitForTimeout(400);
    return true;
  }

  async getItineraryDayCount() {
    return this.itineraryDays.count();
  }

  async getFaqCount() {
    return this.faqItems.count();
  }

  /** Expand all FAQ items */
  async expandAllFaqs() {
    const expandBtn = this.page.locator('.wpte-faq-expand-all, .expand-all-button').first();
    if (await expandBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expandBtn.click();
    }
  }

  /** Check if an add-on is present on this trip - uses count() not isVisible()
   * because elements may exist in hidden tabs */
  async hasAddon(addonName) {
    const selectors = {
      fsd: '.wte-fsd__container',
      groupDiscount: '.category-trip-group-avil, .pop-trip-grpavil-txt, .wte-fsd__group-discount',
      extraServices: '.wte-process-tab-content-wrapper, .wte-trip-options, .wte-trip-guest-wrapper',
      insurance: '[class*="insurance"]',
      pickup: '[name="pickup"]',
      accommodation: '[class*="accommodation"]',
    };
    const selector = selectors[addonName];
    if (!selector) return false;
    return (await this.page.locator(selector).count()) > 0;
  }

  /** Check if FSD add-on is available on the current trip
   * Must be called after clicking the Dates tab
   */
  async hasFSD() {
    // Use count() not isVisible() - FSD section exists in DOM even before clicking Dates tab
    return (await this.fsdSection.count()) > 0;
  }

  /** Get current price from booking sidebar */
  async getCurrentPrice() {
    const priceEl = this.offerPrice.isVisible().catch(() => false) ? this.offerPrice : this.priceWrap;
    if (await priceEl.count() === 0) return null;
    const text = await priceEl.textContent();
    const match = text.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }

  /** Check if booking form/modal is currently visible */
  async isBookingFormOpen() {
    const modalSelectors = [
      '.wte-booking-modal',
      '#wte-booking-popup',
      '.wpte-bf-outer',
      '.wpte-booking-area-wrapper'
    ];
    for (const sel of modalSelectors) {
      const el = this.page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
        return true;
      }
    }
    return false;
  }

  /** Close booking modal if open */
  async closeBookingModal() {
    const closeBtn = this.page.locator('.wte-booking-modal .mfp-close, .wte-booking-modal [class*="close"], .mfp-close').first();
    if (await closeBtn.count() > 0 && await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await this.page.waitForTimeout(300);
    }
  }

  /** Get all tab names */
  async getTabNames() {
    return this.tabLinks.allTextContents();
  }

  /** Verify all expected tabs exist */
  async hasRequiredTabs() {
    const tabTexts = (await this.getTabNames()).join(' ').toLowerCase();
    return {
      overview: /overview/i.test(tabTexts),
      itinerary: /itinerary/i.test(tabTexts),
      cost: /cost/i.test(tabTexts),
      faqs: /faq/i.test(tabTexts),
      map: /map/i.test(tabTexts),
      dates: /date/i.test(tabTexts),
    };
  }
}

module.exports = TripDetailPage;
