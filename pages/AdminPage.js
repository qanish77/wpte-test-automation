const BasePage = require('./BasePage');

class AdminPage extends BasePage {
  constructor(page) {
    super(page);

    // WP login form (wp-login.php)
    this.loginUserField = page.locator('#user_login');
    this.loginPassField = page.locator('#user_pass');
    this.loginSubmitBtn = page.locator('#wp-submit');
    this.loginError     = page.locator('#login_error, .notice-error');

    // Admin chrome — present on every admin page when logged in
    this.adminBar  = page.locator('#wpadminbar');
    this.adminMenu = page.locator('#adminmenu');

    // WTE entries in the admin sidebar
    this.wteMenuParent   = page.locator('#menu-posts-trip');
    // Live-confirmed real href: "edit.php?post_type=booking&page=class-wp-travel-engine-
    // admin.php" — NOT "wp-travel-engine-settings", which no longer exists as a menu
    // link on this install (that stale slug's own admin.php page now 404/403s — see
    // goToSettings() below). Filtered on the href, not the link text ("Settings"),
    // since several OTHER plugins' sidebar entries share that exact same text.
    this.wteSettingsLink = page.locator('#adminmenu a[href*="class-wp-travel-engine-admin.php"]').first();

    // WTE settings page — a React app with a left-hand ACCORDION nav, live-mapped
    // in full: General (sub-items: General, Pages, Trip Settings) | Emails
    // (Emails, Notifications, Settings) | Display (Display, Appearance, Single
    // Trip, Trip Archive, Checkout, Labels) | Currency (Currency, General) |
    // Payments (Payments, General, Tax Settings, Booking Fee, + one per gateway) |
    // Dashboard (Dashboard, User Dashboard, Social Login) | Extensions (one per
    // add-on) | Performance (Performance, General). Each top-level header is a
    // `span.wpte-menu-link` inside an `li.wpte-has-subtabs`; its own sub-items are
    // additional `span.wpte-menu-link`s inside the SAME li (index 0 is the header
    // itself, re-matched by any text-based query — always skip it). "General" is
    // expanded by default, landing on its own "Pages" sub-item (Checkout/Thank You/
    // Confirmation/etc. page assignments) — confirmed live via screenshot.
    // IMPORTANT: every sub-item ALSO has its own real, stable hash URL (found via
    // its actual `href`, e.g. `#currency-general`, `#emails_notification`,
    // `#payment-general`) — goToCurrencySettings()/goToPaymentsGeneralSettings()/
    // goToNotificationsSettings() below navigate directly via that hash rather
    // than clicking through the accordion, after live-confirming (via a failure
    // screenshot) that clicking through it is genuinely unreliable: the sidebar
    // highlights the right sub-item as "active" while the main content panel
    // silently keeps showing the previous tab's content — a real client-side
    // routing bug in this app, not a timing issue.
    this.settingsAppRoot  = page.locator('#wptravelengine-global-settings-app');
    // Real class confirmed live (44 matches on a freshly loaded settings page) —
    // every nav header AND sub-item uses it, so this is a genuine "how many
    // sections/tabs does this page expose" signal, unlike the old guessed
    // `.nav-tab-wrapper .nav-tab` (0 matches — a different, unrelated WP admin
    // convention this React app doesn't use).
    this.settingsNavTabs  = page.locator('.wpte-menu-link');
    this.settingsContainer = page.locator('#wptravelengine-global-settings-app, .wte-settings-wrap, .wte-admin-container, #wte-settings, form[id*="wte"]').first();

    // Most fields in this app (Payment Currency, Checkout/Thank You/Confirmation
    // Page, etc.) are a `.wpte-form-control` block whose own <label> names the
    // field — a custom-dropdown widget (not a native <select>) or plain input,
    // carrying no stable name/id of its own. settingsField() scopes to that block
    // by its exact label text, the one thing that IS stable.
    const settingsField = (labelText) => page
      .locator('.wpte-form-control')
      .filter({ has: page.locator('label', { hasText: labelText }) })
      .first();
    // Currency section's own "General" sub-item — see goToCurrencySettings().
    this.currencyField = settingsField('Payment Currency');
    // General section's own "Pages" sub-item (the default landing view).
    this.checkoutPageField = settingsField('Checkout Page');
    this.thankYouPageField = settingsField('Thank You Page');
    this.confirmationPageField = settingsField('Confirmation Page');

    // Payments section's own "General" sub-item — each gateway is a real, plain
    // `<label>`-wrapped checkbox (live-confirmed: Book Now Pay Later, PayPal
    // Standard, Direct Bank Transfer, Check Payments, Stripe, Authorize.Net,
    // Razorpay all render this way, unnamed but each inside its own <label>).
    this.paymentGatewayCheckbox = (gatewayLabel) => page
      .locator('label', { hasText: gatewayLabel })
      .locator('input[type="checkbox"]');

    // Emails section's own "Notifications" sub-item — a real email-template
    // manager (Admin/Customer tabs, one entry per trigger e.g. "Booking
    // Confirmation", each with its own Enable Notification toggle, Name, Subject,
    // and rich-text Email Content editor) — live-confirmed; there is no separate
    // "admin recipient email" field anywhere in this app (that's WordPress core's
    // own Settings > General "Administration Email Address", a different page).
    this.notificationEnableToggle = settingsField('Enable Notification').locator('input[type="checkbox"]');
    this.notificationNameField = settingsField('Name');

    // Real class confirmed live: `<button type="submit">Save Settings</button>`
    // (the CSS-in-JS hashed class alongside it is unstable — matched on type+text
    // instead, same approach used throughout this file for every other add-on's
    // own settings block).
    this.saveSettingsBtn = page.locator('button[type="submit"]', { hasText: 'Save Settings' }).first();

    // Trip list (edit.php?post_type=trip)
    this.tripListTable = page.locator('#the-list, table.wp-list-table');
    this.tripRows      = page.locator('#the-list tr.type-trip, #the-list tr[id*="post-"]');
    this.tripCount     = page.locator('.displaying-num');
    this.addNewTripBtn = page.locator('a.page-title-action').first();

    // Trip edit page (post.php)
    // Live-confirmed: this site's post editor renders inside an iframe (the
    // modern block-editor canvas, `iframe[name="editor-canvas"]`), and the title
    // itself is a contenteditable `<h1 class="editor-post-title__input">` rich-text
    // block — NOT a plain `<input id="title">` (classic editor) or a top-level
    // `.editor-post-title__input` (both 0 matches; the class name coincidentally
    // matches the guess, but the element lives inside the iframe, invisible to a
    // page-level locator). Read its text with `.textContent()`, not
    // `.inputValue()` — it isn't a real form input.
    this.tripTitleInput = page.frameLocator('iframe[name="editor-canvas"]').locator('.editor-post-title__input');
    // Live-confirmed real container for the whole WTE trip-edit meta app (the one
    // holding every `a.wpte-menu-link` tab: General, Overview & Info, Itinerary,
    // Date & Price, Extra Services, Accommodation, Travel Insurance, Pickup
    // Points, etc.) — found by walking up from a real tab link. The old guess
    // `#wp-travel-engine-settings, .wp-travel-engine-metabox, [id*="wte"]` never
    // matched anything (that's not this app's real id).
    this.tripMetaBox = page.locator('#wptravelengine-edit-trip');
    // General tab's own real Duration field (days) — `input[name="duration.period"]`,
    // live-confirmed value "7" for Everest Base Camp. Trip cost/price is NOT a
    // single flat field anywhere on this page — see tripDatesTab/editPricingDatesBtns
    // above; it's configured per price category inside a package's own pricing
    // editor, opened via "Edit Pricing & Dates".
    this.tripDurationField = page.locator('input[name="duration.period"]');
    this.publishBtn     = page.locator('#publish, #save-post, .editor-post-publish-button__button').first();

    // ── Accommodation add-on (wptravelengine-accommodation) ─────────────────
    // Trip edit meta tab — added via `wp_travel_engine_admin_trip_meta_tabs` filter,
    // live-confirmed same sidebar link element as every other trip-edit meta tab.
    this.accommodationTripEditTab = page.locator('a.wpte-menu-link', { hasText: 'Accommodation' }).first();
    // Room table on the trip-edit tab — live-confirmed columns: Single Room | No. of
    // Guests | Capacity | Short Description | Price Per Room | Action. Identified by
    // its "Single Room" header (unique to this table) rather than a CSS-in-JS class.
    this.accommodationTripEditRoomTable = page
      .locator('table')
      .filter({ has: page.locator('th', { hasText: 'Single Room' }) })
      .first();
    this.accommodationTripEditRoomRows = this.accommodationTripEditRoomTable.locator('tbody tr');

    // Global settings — Extensions > Accommodation. Real <input name="..."> attributes
    // confirmed live (React form, but these specific fields use stable form names).
    this.accommodationEnableToggle = page.locator('input[name="accommodation.enable"]');
    this.accommodationTitleInput   = page.locator('input[name="accommodation.title"]');
    this.accommodationAllowSharedToggle = page.locator('input[name="accommodation.allow_shared_room_bookings"]');
    this.accommodationPricingFormatPerTraveler = page.locator('button', { hasText: 'Per Traveler' });
    this.accommodationPricingFormatPerRoom = page.locator('button', { hasText: 'Per Room' });
    // Global settings' own room table — same shell, fewer columns (Room Type | Guests |
    // Short Description | Action, no per-trip price/capacity overrides).
    this.accommodationGlobalRoomTable = page
      .locator('table')
      .filter({ has: page.locator('th', { hasText: 'Room Type' }) })
      .first();
    this.accommodationGlobalRoomRows = this.accommodationGlobalRoomTable.locator('tbody tr');

    // ── Trip Fixed Starting Dates add-on ─────────────────────────────────────
    // Trip edit meta tab (label carries a live package-count badge, e.g. "Date &
    // Price2" — hasText matches the substring regardless of the badge digit).
    this.tripDatesTab = page.locator('a.wpte-menu-link', { hasText: /date.*price/i }).first();
    // Its own sub-tabs, confirmed live: Packages | Date Settings | Partial Payments |
    // Installment Payments | Price on Request.
    this.tripDatesSubTabs = page.locator('button, a').filter({ hasText: /^(Packages|Date Settings|Partial Payments|Installment Payments|Price on Request)$/ });
    // Each configured package's row has a name input and this real button (confirmed
    // live: <button class="wpte-btn-edit" type="button">Edit Pricing & Dates</button> —
    // NOT an <a>, despite looking like a link).
    this.editPricingDatesBtns = page.locator('button.wpte-btn-edit', { hasText: 'Edit Pricing & Dates' });

    // ── Group Discount add-on — Global Settings ──────────────────────────────
    // Extensions submenu link uses a DIFFERENT hash pattern than sibling add-ons
    // (confirmed live: href="...#extension-group-discount" — not "#group-discount"
    // the way Accommodation used "#accommodation"). Real, stable <input name="...">
    // attributes confirmed live (same React-form pattern as Accommodation's fields).
    this.groupDiscountApplyToggle = page.locator('input[name="group_discount.enable"]');
    this.groupDiscountInfoInput = page.locator('input[name="group_discount.info"]');
    this.groupDiscountGuideTitleInput = page.locator('input[name="group_discount.guide_title"]');
    this.groupDiscountGuideOpenTitleInput = page.locator('input[name="group_discount.guide_open_title"]');

    // ── Partial Payment add-on — Global Settings ─────────────────────────────
    // Extensions submenu hash live-confirmed: href="...#extension-partial-payment"
    // (same "extension-" prefix pattern as Group Discount, not Accommodation's plain
    // form). Real, stable <input name="..."> attributes confirmed live — same
    // React-form pattern as every other add-on's settings block. Field names/shape
    // match this add-on's own CLAUDE.md (Settings::get_global keys) exactly.
    this.partialPaymentEnableToggle = page.locator('input[name="partial_payment.enable"]');
    this.partialPaymentPercentInput = page.locator('input[name="partial_payment.payment_percent"]');
    this.partialPaymentEnableFullPaymentToggle = page.locator('input[name="partial_payment.enable_full_payment"]');
    this.partialPaymentCutoffDaysInput = page.locator('input[name="partial_payment.cutoff_days"]');
    this.partialPaymentEnableReminderToggle = page.locator('input[name="partial_payment.enable_reminder"]');
    this.partialPaymentReminderDurationInput = page.locator('input[name="partial_payment.reminder_duration"]');

    // ── Partial Payment add-on — Trip Edit screen ────────────────────────────
    // Lives under the same "Date & Price" meta tab as FSD (tripDatesTab above), on
    // its own "Partial Payments" sub-tab (tripDatesSubTabs already matches this
    // label). Its "Use Global / Use Custom / Disable" control (trip-level
    // `partial_payment_use` meta) is a plain button group, NOT native radio inputs
    // — live-confirmed real markup: `<button type="button">Use Global</button>`
    // etc., no name/value/role attributes to key off of, so matched by their own
    // exact visible text (same approach as Accommodation's Per Traveler/Per Room
    // buttons above).
    this.tripPartialPaymentSubTab = page.locator('button, a').filter({ hasText: 'Partial Payments' }).first();
    this.tripPartialPaymentUseGlobalBtn = page.locator('button', { hasText: 'Use Global' });
    this.tripPartialPaymentUseCustomBtn = page.locator('button', { hasText: 'Use Custom' });
    this.tripPartialPaymentDisableBtn = page.locator('button', { hasText: 'Disable' });

    // ── Pickup Point add-on — Trip Edit screen ───────────────────────────────
    // Own meta tab (a.wpte-menu-link) live-confirmed labeled exactly "Pickup
    // Points". Its table has real headers Location | Pickup Type | Price (INR ₹) |
    // Action — identified by the "Pickup Type" header (unique to this table) same
    // as Accommodation's "Single Room" pattern above. Rows are `.wpte-sortable-item`
    // React-DnD rows (drag-and-drop reordering, per this add-on's own docs).
    // Per-row controls, live-confirmed real markup:
    //   - Location: a genuine `<input type="text" name="location">` (name is NOT
    //     row-indexed — this is a React-controlled form — so always read/act on it
    //     scoped to one row, never queried globally).
    //   - Price: `<input type="number">` with NO name attribute at all.
    //   - Pickup Type: NOT a native <select> — a custom-dropdown div showing the
    //     current value as plain text ("Paid"/"Free") in `.cw__custom-select__input-value .text`.
    this.pickupPointsTripEditTab = page.locator('a.wpte-menu-link', { hasText: 'Pickup Points' }).first();
    this.pickupPointsTable = page
      .locator('table')
      .filter({ has: page.locator('th', { hasText: 'Pickup Type' }) })
      .first();
    this.pickupPointsRows = this.pickupPointsTable.locator('tbody tr');
    // "Make Pickup Point Mandatory" — real, stable checkbox name matching the REST
    // `pickup_points_required` field exactly.
    this.pickupPointsRequiredToggle = page.locator('input[name="pickup_points_required"]');

    // ── Travel Insurance add-on — Global Settings ────────────────────────────
    // Extensions submenu hash live-confirmed: href="...#travel_insurance" (no
    // "extension-" prefix — a third distinct pattern from Accommodation's plain
    // form and Group Discount/Partial Payment's "extension-" prefix). This tab has
    // its own three sub-tabs: Checkout | Insurance Plans | Affiliate.
    this.travelInsuranceCheckoutSubTab = page.locator('button, a').filter({ hasText: 'Checkout' }).first();
    this.travelInsurancePlansSubTab = page.locator('button, a').filter({ hasText: 'Insurance Plans' }).first();
    this.travelInsuranceAffiliateSubTab = page.locator('button, a').filter({ hasText: 'Affiliate' }).first();
    // "Checkout" sub-tab fields — real, stable <input name="travel_insurance.*">
    // attributes, matching the REST field names exactly (same React-form pattern
    // as every other add-on's settings block).
    this.travelInsuranceTitleInput = page.locator('input[name="travel_insurance.title"]');
    this.travelInsuranceQuestionInput = page.locator('input[name="travel_insurance.question"]');
    this.travelInsuranceYesLabelInput = page.locator('input[name="travel_insurance.yes_label"]');
    this.travelInsuranceNoLabelInput = page.locator('input[name="travel_insurance.no_label"]');
    this.travelInsuranceFollowUpQuestionInput = page.locator('input[name="travel_insurance.follow_up_question"]');
    this.travelInsuranceFollowUpRequiredToggle = page.locator('input[name="travel_insurance.follow_up_required"]');
    this.travelInsuranceEnablePerDayPriceToggle = page.locator('input[name="travel_insurance.enable_per_day_price"]');
    // "Insurance Plans" sub-tab — a real <table> (Title | Price | Action), live-
    // confirmed distinct from every other add-on's admin table by its "Title"
    // header (Accommodation uses "Single Room", Pickup Points uses "Location").
    // Title is a plain `input[placeholder="Enter title"]`; price is
    // `input[placeholder="Enter price"]` with a currency/"%" suffix span next to it
    // depending on the plan's own pricing_type — neither input carries a `name`
    // attribute (React-controlled), so always scope to one row via
    // travelInsurancePlansRows, never query globally.
    this.travelInsurancePlansTable = page
      .locator('table')
      .filter({ has: page.locator('th', { hasText: 'Title' }) })
      .first();
    this.travelInsurancePlansRows = this.travelInsurancePlansTable.locator('tbody tr');

    // ── Travel Insurance add-on — Trip Edit screen ───────────────────────────
    // Own meta tab labeled "Travel Insurance". Real, stable checkbox names
    // matching the REST trip-meta field names exactly.
    this.tripTravelInsuranceMandatoryToggle = page.locator('input[name="travel_insurance.mandatory"]');
    this.tripTravelInsuranceAllowMultipleToggle = page.locator('input[name="travel_insurance.allow_multiple_insurance"]');
  }

  async goToGroupDiscountSettings() {
    await this.goto('/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php#extension-group-discount');
    await this.page.locator('text=Apply Group Discount').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }

  async goToPartialPaymentSettings() {
    await this.goto('/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php#extension-partial-payment');
    await this.partialPaymentEnableToggle.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
  }

  /** Opens the trip-edit page's Date & Price > Partial Payments sub-tab. */
  async goToTripPartialPaymentTab(tripId) {
    await this.goToTripDatesTab(tripId);
    await this.tripPartialPaymentSubTab.click();
    await this.page.waitForTimeout(500);
  }

  /** Opens the trip-edit page and switches to its Pickup Points meta tab. */
  async goToTripPickupPointsTab(tripId) {
    await this.goToTripEdit(tripId);
    await this.pickupPointsTripEditTab.click();
    await this.pickupPointsTable.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }

  async goToTravelInsuranceSettings() {
    await this.goto('/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php#travel_insurance');
    await this.travelInsuranceTitleInput.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
  }

  /** Opens the trip-edit page and switches to its Travel Insurance meta tab. */
  async goToTripTravelInsuranceTab(tripId) {
    await this.goToTripEdit(tripId);
    await this.page.locator('a.wpte-menu-link', { hasText: 'Travel Insurance' }).first().click();
    await this.tripTravelInsuranceMandatoryToggle.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
  }

  /** Opens the trip-edit page and switches to its Date & Price meta tab (Packages
   * sub-tab, where FSD packages/dates are configured). */
  async goToTripDatesTab(tripId) {
    await this.goToTripEdit(tripId);
    await this.tripDatesTab.click();
    await this.editPricingDatesBtns.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }

  async loginAsAdmin() {
    await this.goto('/wp-admin/');
    await this.loginUserField.fill(process.env.ADMIN_EMAIL || '');
    await this.loginPassField.fill(process.env.ADMIN_PASSWORD || '');
    // wp-login.php's POST handler (session creation, capability checks, admin-bar
    // hooks) is a heavier server-side request than most on this shared-hosting
    // install, and click()'s built-in post-click navigation wait is bound to the
    // global 30s actionTimeout — matching BasePage.goto's own 60s ceiling for this
    // site's known slow-but-working responses avoids failing on transient slowness.
    await this.loginSubmitBtn.click({ timeout: 60000 });
    await this.page.waitForLoadState('domcontentloaded', { timeout: 60000 });
    // Wait for either admin bar (success) or login error message (bad credentials)
    await Promise.race([
      this.adminBar.waitFor({ state: 'visible', timeout: 10000 }),
      this.loginError.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});
  }

  async isLoggedIn() {
    return this.adminBar.isVisible({ timeout: 6000 }).catch(() => false);
  }

  /**
   * IMPORTANT — the old URL this method used (`/wp-admin/admin.php?page=wp-travel-
   * engine-settings`) is STALE: live-confirmed it now returns HTTP 403 "Sorry, you
   * are not allowed to access this page" even for a full Administrator account (not
   * a credentials or capability problem — every other admin page works fine in the
   * same session). The real, current global-settings URL — confirmed live via the
   * sidebar's own "Settings" link href, and already used by every other add-on's
   * settings navigation in this file (goToGroupDiscountSettings,
   * goToAccommodationSettings, goToPartialPaymentSettings, etc.) — is this
   * `edit.php?post_type=booking&page=class-wp-travel-engine-admin.php` page.
   */
  async goToSettings() {
    await this.goto('/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php');
    // Landing tab is "Pages" by default (live-confirmed via screenshot), not
    // Currency — `.wpte-form-control` is the one wrapper class present on every
    // tab's fields, so it's a reliable "the settings form actually rendered"
    // signal regardless of which tab loads first.
    await this.page.locator('.wpte-form-control').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }


  /** Currency section's own "General" sub-item (the only one) — where Payment
   * Currency actually lives. */
  /**
   * Direct hash-URL navigation, NOT click-based accordion navigation — live-
   * confirmed every sub-item has its own real, stable hash (found via each
   * link's actual `href`: `#currency-general`, `#emails_notification`,
   * `#payment-general`, etc.). This matters: clicking through
   * openSettingsSubItem() was found to be genuinely unreliable here — a
   * screenshot from a real failure showed the sidebar highlighting the correct
   * sub-item as "active" while the main content panel silently kept showing
   * the previous tab's content, a real client-side routing bug in this app
   * that no amount of waiting fixes. Direct hash navigation sidesteps it
   * entirely and matches the pattern already used by every other add-on's
   * settings navigator in this file (goToGroupDiscountSettings(),
   * goToAccommodationSettings(), etc).
   */
  async goToCurrencySettings() {
    await this.goto('/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php#currency-general');
    await this.currencyField.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }

  /** Payments section's own "General" sub-item — default gateway + the per-
   * gateway enable checkboxes (see paymentGatewayCheckbox()). */
  /** Direct hash-URL navigation — see goToCurrencySettings()'s doc above for why. */
  async goToPaymentsGeneralSettings() {
    await this.goto('/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php#payment-general');
    await this.paymentGatewayCheckbox('Book Now Pay Later').waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
  }

  /** Emails section's own "Notifications" sub-item — the real email-template
   * manager (see notificationEnableToggle/notificationNameField doc above).
   * Direct hash-URL navigation — see goToCurrencySettings()'s doc above for why. */
  async goToNotificationsSettings() {
    await this.goto('/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php#emails_notification');
    await this.notificationEnableToggle.waitFor({ state: 'attached', timeout: 15000 });
  }

  async goToTripList() {
    await this.goto('/wp-admin/edit.php?post_type=trip');
    await this.page.waitForSelector('#the-list, table.wp-list-table, .wp-list-table', { timeout: 10000 }).catch(() => {});
  }

  async goToTripEdit(tripId) {
    await this.goto(`/wp-admin/post.php?post=${tripId}&action=edit`);
    await this.page.waitForSelector('#title, #post-title-0, .editor-post-title__input, #poststuff', { timeout: 10000 }).catch(() => {});
  }

  /** Any trip-edit meta tab by its exact label (General, Overview & Info,
   * Itinerary, Date & Price, Extra Services, Accommodation, Travel Insurance,
   * Pickup Points, Advanced Settings, etc.) — the same real `a.wpte-menu-link`
   * element every dedicated tab locator in this file (accommodationTripEditTab,
   * tripDatesTab, pickupPointsTripEditTab, ...) already uses. */
  tripEditMetaTab(label) {
    return this.page.locator('a.wpte-menu-link', { hasText: label }).first();
  }

  /** Opens the trip-edit page and switches to its Accommodation meta tab. */
  async goToTripAccommodationTab(tripId) {
    await this.goToTripEdit(tripId);
    await this.accommodationTripEditTab.click();
    await this.accommodationTripEditRoomTable.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }

  /**
   * WTE Settings > Extensions > Accommodation. Navigated by direct hash URL rather
   * than clicking through the sidebar — live-confirmed the "Extensions" submenu is a
   * hover-flyout that intercepts pointer events on its own child links when clicked
   * programmatically (the same link's real href is this exact URL).
   */
  async goToAccommodationSettings() {
    await this.goto('/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php#accommodation');
    await this.accommodationEnableToggle.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
  }
}

module.exports = AdminPage;
