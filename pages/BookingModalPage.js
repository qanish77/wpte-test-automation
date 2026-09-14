const { expect } = require('@playwright/test');
const BasePage = require('./BasePage');

// Page Object for the WP Travel Engine trip-booking modal.
//
// This is a React SPA (webpack entry `public.components.trip-booking-modal`), NOT
// the legacy Underscore.js template also still present in the plugin (guarded behind
// `wte_after_single_trip` in includes/tour-packages/packages.php). Both render some
// shared class names by design (so old SCSS keeps working), which is why several
// selectors below match either implementation — but the modal chrome itself
// (open/close, portal target) only exists in the React version, which is what's
// actually wired up to click handlers (src/public/js/components/trip-booking-modal/index.js).
//
// Verified directly against plugin source v6.8.6:
//   src/public/js/components/trip-booking-modal/index.js   — mount + click-trigger wiring
//   src/public/js/components/modal/index.js                — modal chrome (portaled to <body>)
//   src/public/js/components/trip-booking-modal/App.jsx    — step state machine, submit handler
//   src/public/js/components/trip-booking-modal/components/StepsForm.jsx — nav/prev/next markup
//   src/public/js/components/trip-booking-modal/components/tabs/DateTime.jsx
//   src/public/js/components/trip-booking-modal/components/tabs/Packages.jsx
//   src/public/js/components/trip-booking-modal/components/tabs/ExtraServices.jsx
//   src/public/js/components/trip-booking-modal/fragments/{Counter,PricingTable}.jsx
//   src/public/js/components/trip-booking-modal/components/Summary.jsx
//
// Submit flow (App.jsx handleSubmit): the final step's button posts a `fetch()` to
// admin-ajax (action=wte_add_trip_to_cart) and on success does
// `window.location.href = result.data.redirect` — there is no <form> submit and no
// fixed animation delay to wait out. proceedToCheckout() below waits for the real
// resulting navigation instead of a timeout.
class BookingModalPage extends BasePage {
  constructor(page) {
    super(page);

    // ── Trigger (lives on the trip detail page) ──────────────────────────────
    this.openTrigger = page.locator('#open-booking-modal, button.wte-book-now').first();

    // ── Modal chrome — portaled directly to document.body ───────────────────
    this.overlay = page.locator('.wpte-modal__screen-overlay');
    this.modal = page.locator('.wpte-modal');
    this.closeButton = page.locator('button.wpte-modal__close-button');

    // IMPORTANT — confirmed live, not just in source: the legacy Underscore.js
    // booking template (includes/templates/script-templates/booking-process/wte-booking.php)
    // is ALSO present in the DOM on every trip page (hidden via `display:none` on its
    // `#wte__booking` wrapper, output unconditionally by the `wte_after_single_trip`
    // hook), and it reuses several of the same class names as the live React modal
    // (`.wte-process-layout`, `.wte-trip-guest-wrapper`, `.wte-qty-number`, etc.) so its
    // old SCSS keeps working. A bare `page.locator('.wte-process-layout')` matches BOTH
    // and throws a Playwright strict-mode violation. Every in-modal locator below is
    // therefore scoped as a descendant of `this.modal` (the open, portaled instance),
    // never queried globally.
    this.stepsLayout = this.modal.locator('.wte-process-layout');
    this.navItems = this.modal.locator('.wte-process-nav-item');
    this.activeNavItem = this.modal.locator('.wte-process-nav-item.active');
    this.prevButton = this.modal.locator('.wte-process-btn-prev');
    this.nextButton = this.modal.locator('.wte-process-btn-next');
    // StepsForm.jsx adds a `loading` class to the active tab item while the next
    // step's data is being fetched (set true synchronously on Next-click, cleared by
    // the tab component's own useEffect once ready) — a real signal to wait on
    // instead of a fixed sleep when advancing between steps.
    this.loadingTabItem = this.modal.locator('.wte-process-tab-item.loading');

    // ── "Date & Time" step (DateTime.jsx) — flatpickr, driven by the
    // wptravelengine-trip-fixed-starting-dates add-on's configured package dates.
    // Live-confirmed: the calendar month view mixes real .flatpickr-day cells with
    // .prevMonthDay/.nextMonthDay overflow cells from adjacent months — the locators
    // below exclude those so counts/queries only see the CURRENT month's real days.
    // Past dates get .flatpickr-disabled; a day is auto-selected on load (today, if
    // bookable) — see waitForDateAutoSelected().
    this.calendar = this.modal.locator('.flatpickr-calendar');
    this.selectedDay = this.modal.locator('.flatpickr-day.selected');
    this.calendarDays = this.modal.locator(
      '.flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)'
    );
    this.availableCalendarDays = this.modal.locator(
      '.flatpickr-day:not(.flatpickr-disabled):not(.prevMonthDay):not(.nextMonthDay)'
    );
    this.disabledCalendarDays = this.modal.locator(
      '.flatpickr-day.flatpickr-disabled:not(.prevMonthDay):not(.nextMonthDay)'
    );
    this.timeSlotButtons = this.modal.locator('.wte-booking-times button');

    // ── "Package Type" step (Packages.jsx) ───────────────────────────────────
    // Wrapper div class is confirmed (Packages.jsx:159); the `button` inside is the
    // ButtonGroup component's rendered control — scoped to this wrapper rather than
    // guessed globally.
    this.packageButtons = this.modal.locator('.wte-button-group.wte-package-type button');
    // Each traveler-category row — shared markup with Extra Services (PricingTable.jsx
    // "Item"/PricingItem renders the same `.wte-trip-guest-wrapper` shape either way);
    // unambiguous in practice because only the active step's tab content is mounted
    // at a time (StepsForm.jsx: `{!isLoading && enabledTabs[currentTab]?.component}`).
    this.travelerRows = this.modal.locator('.wte-trip-guest-wrapper');

    // ── "Extra Services" step (ExtraServices.jsx) — only enabled when the
    // wte-extra-services add-on is active AND the trip has configured services.
    // Live-confirmed real structure (does NOT share .wte-trip-guest-wrapper rows the
    // way Package Type/Accommodation do — a prior version of this file assumed it did;
    // that locator matched nothing on this step and was never actually used anywhere):
    //   - a "default"-type, single-option service renders as a bare .wte-service-options-item
    //     directly under .wte-trip-options, with its own quantity counter
    //     (.wte-counter-wrap) — extraServiceSingleItems.
    //   - a multi-option service ("custom" type, or any service with >1 option) renders
    //     as a group: a .wte-service-multiple-options-header (title + a "Choose One" or
    //     "Choose Any" tag, per the REST `multiple` flag) followed by a sibling
    //     .wte-service-options-collapse holding one .wte-service-options-item per option
    //     — extraServiceGroupHeaders / extraServiceGroupCollapses (paired by index; both
    //     lists are populated in the same group order).
    //   - "Choose One" items toggle via the item's own [role="switch"] — clicking the
    //     outer item div does nothing (confirmed live: it reported "progress" while
    //     aria-checked never changed, see satisfyOneRequiredExtraService below).
    //   - "Choose Any" items (e.g. Vehicle Rental) get their own counter, same widget
    //     as a standalone single item.
    this.extraServiceGroups = this.modal.locator('.wte-trip-options');
    this.extraServiceSingleItems = this.modal.locator('.wte-trip-options > .wte-service-options-item');
    this.extraServiceGroupHeaders = this.modal.locator('.wte-trip-options .wte-service-multiple-options-header');
    this.extraServiceGroupCollapses = this.modal.locator('.wte-trip-options .wte-service-options-collapse');

    // ── "Accommodation" step (wptravelengine-accommodation add-on, Accommodation.jsx)
    // — only inserted when Plugin::is_implementable($trip_id) is true (globally enabled
    // AND at least one enabled room for this trip). Live-confirmed: same
    // .wte-trip-options > .wte-trip-guest-wrapper shell as Package Type/Extra Services,
    // but the quantity control here is a plain <select> ("Select Traveller(s)" / "N
    // Traveller(s)"), not the stepper used elsewhere — only one step's content is
    // mounted at a time, so scoping by these shared classes is safe while this step
    // is actually active.
    this.accommodationRoomRows = this.modal.locator('.wte-trip-options .wte-trip-guest-wrapper');

    // ── Summary sidebar (Summary.jsx) ────────────────────────────────────────
    this.summaryTotal = this.modal.locator('#wte-booking-summary .total-amount .price');
    this.summaryTripTitle = this.modal.locator('.wte-booking-trip-title');
  }

  /** Click the trigger and wait for the modal to actually render (not a timeout). */
  async open() {
    await this.openTrigger.click();
    await this.overlay.waitFor({ state: 'visible', timeout: 10000 });
    await this.stepsLayout.waitFor({ state: 'visible', timeout: 10000 });
  }

  async isOpen() {
    return (await this.overlay.count()) > 0 && (await this.overlay.isVisible());
  }

  async close() {
    if (await this.closeButton.count() === 0) return;
    await this.closeButton.click();
    await this.overlay.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  /** Text of whichever step tab is currently active, e.g. "Date & Time". */
  async currentStepTitle() {
    if ((await this.activeNavItem.count()) === 0) return null;
    return (await this.activeNavItem.textContent())?.trim() ?? null;
  }

  /** All step titles configured for this trip, in order (varies — Extra Services is conditional). */
  async stepTitles() {
    return (await this.navItems.allTextContents()).map((t) => t.trim());
  }

  async hasExtraServicesStep() {
    const titles = await this.stepTitles();
    return titles.some((t) => /extra services/i.test(t));
  }

  /** A standalone, single-option ("default" type) extra service and its own counter. */
  extraServiceSingleItem(index = 0) {
    const row = this.extraServiceSingleItems.nth(index);
    return {
      row,
      label: row.locator('.wte-service-option-label').first(),
      priceText: row.locator('.wte-service-option-pricing-wrap [class*="price"]').first(),
      counterInput: row.locator('.wte-counter-input'),
      plusBtn: row.locator('.wte-counter-btn-plus'),
      minusBtn: row.locator('.wte-counter-btn-minus'),
      isRequired: async () => (await row.locator('.required').count()) > 0,
    };
  }

  async extraServiceGroupCount() {
    return this.extraServiceGroupHeaders.count();
  }

  /** A multi-option extra service group ("Choose One" or "Choose Any", per its own tag). */
  extraServiceGroup(index = 0) {
    const header = this.extraServiceGroupHeaders.nth(index);
    const collapse = this.extraServiceGroupCollapses.nth(index);
    const items = collapse.locator('.wte-service-options-item');
    return {
      header,
      collapse,
      title: header.locator('.wte-service-options-title'),
      items,
      itemCount: () => items.count(),
      isChooseOne: async () => /choose one/i.test((await header.textContent()) || ''),
      isRequired: async () => (await header.locator('.wte-required').count()) > 0,
      item: (itemIndex) => {
        const item = items.nth(itemIndex);
        return {
          item,
          label: item.locator('.wte-service-option-label').first(),
          priceText: item.locator('[class*="price"]').first(),
          switchEl: item.locator('[role="switch"]'),
          counterInput: item.locator('.wte-counter-input'),
          plusBtn: item.locator('.wte-counter-btn-plus'),
          isSelected: async () => (await item.locator('[role="switch"][aria-checked="true"]').count()) > 0,
          isSoldOut: async () => /sold out/i.test((await item.textContent()) || ''),
        };
      },
    };
  }

  /** Selects a "Choose One" group item — toggles its own [role="switch"]; clicking the
   * outer item div does nothing (see extraServiceGroupHeaders doc above). */
  async selectExtraServiceGroupItem(groupIndex, itemIndex) {
    await this.extraServiceGroup(groupIndex).item(itemIndex).switchEl.click();
  }

  async hasAccommodationStep() {
    const titles = await this.stepTitles();
    return titles.some((t) => /accommodation/i.test(t));
  }

  /** Accommodation room row helpers for a given 0-based index (see accommodationRoomRows doc). */
  accommodationRoom(index = 0) {
    const row = this.accommodationRoomRows.nth(index);
    return {
      row,
      label: row.locator('.check-in-wrapper label'),
      priceText: row.locator('[class*="price"]').first(),
      quantitySelect: row.locator('select'),
    };
  }

  /** Selects a traveler-quantity for a room on the Accommodation step (its own <select>,
   * not the traveler-count stepper used on Package Type/Extra Services). */
  async selectAccommodationRoom(index, quantity) {
    const { quantitySelect } = this.accommodationRoom(index);
    await quantitySelect.selectOption(String(quantity));
  }

  /**
   * IMPORTANT: the step list is NOT fixed to {Date & Time, Package Type, Extra
   * Services}. `App.jsx`'s `stepFormTabs` are built through
   * `applyFilters('wptravelengine.tripBookingModal.stepFormTabs', [...])`, so any
   * active companion add-on can inject its own step at any position — confirmed
   * live: this site's Accommodation add-on inserts an "Accommodation" step between
   * Package Type and Extra Services. Never assume "not the last step" means any
   * specific named step; only the button's own label ("Proceed To Checkout" vs.
   * "Continue") reliably identifies the last one.
   */
  async isOnFinalStep() {
    const label = (await this.nextButton.textContent())?.trim() ?? '';
    return /proceed to checkout/i.test(label);
  }

  async getTotalText() {
    await this.summaryTotal.waitFor({ state: 'visible', timeout: 10000 });
    return (await this.summaryTotal.textContent())?.trim() ?? null;
  }

  /** App.jsx auto-selects the nearest available date ~100ms after trip data loads. */
  async waitForDateAutoSelected(timeout = 10000) {
    await this.selectedDay.waitFor({ state: 'attached', timeout }).catch(() => {});
  }

  async selectedDayLabel() {
    return this.selectedDay.getAttribute('aria-label');
  }

  /** Selects a different available (enabled) day than whatever's currently selected,
   * from the currently-displayed month. Returns its aria-label, or null if there
   * isn't a second available day to switch to. */
  async selectAnotherAvailableDay() {
    // A single combined selector, not availableCalendarDays.locator(':not(.selected)') —
    // .locator() finds descendants, it doesn't filter the current set.
    const candidates = this.modal.locator(
      '.flatpickr-day:not(.flatpickr-disabled):not(.prevMonthDay):not(.nextMonthDay):not(.selected)'
    );
    if ((await candidates.count()) === 0) return null;
    const target = candidates.first();
    const label = await target.getAttribute('aria-label');
    await target.click();
    await this.selectedDay.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
    return label;
  }

  /** Only relevant for trips with fixed departure times; no-op (returns false) otherwise. */
  async selectFirstAvailableTimeSlot() {
    if ((await this.timeSlotButtons.count()) === 0) return false;
    await this.timeSlotButtons.first().click();
    return true;
  }

  /** Advance to the next step. Waits for the plugin's own validation gate (button enabled) — never a fixed sleep. */
  async goNext() {
    await expect(this.nextButton).toBeVisible({ timeout: 10000 });
    await expect(this.nextButton).toBeEnabled({ timeout: 15000 });
    const label = (await this.nextButton.textContent())?.trim();
    await this.nextButton.click();
    return label; // 'Continue' on intermediate steps, 'Proceed To Checkout' on the last one
  }

  async goBack() {
    await this.prevButton.click();
  }

  /** Traveler-category row helpers for a given 0-based index within the current step. */
  row(index = 0) {
    const row = this.travelerRows.nth(index);
    return {
      row,
      label: row.locator('.check-in-wrapper label'),
      incrementBtn: row.locator('.wte-qty-number button.wte-up'),
      decrementBtn: row.locator('.wte-qty-number button.wte-down'),
      countInput: row.locator('.wte-qty-number input'),
      priceText: row.locator('.select-wrapper .offer-price'),
    };
  }

  async travelerCount(index = 0) {
    const { countInput } = this.row(index);
    if ((await countInput.count()) === 0) return null;
    return parseInt((await countInput.inputValue()) || '0', 10);
  }

  /** Increments a traveler-category counter and verifies the input reflects the new count. */
  async incrementTraveler(index = 0, times = 1) {
    const { incrementBtn, countInput } = this.row(index);
    const before = parseInt((await countInput.inputValue()) || '0', 10);
    for (let i = 0; i < times; i++) {
      await expect(incrementBtn).toBeEnabled({ timeout: 5000 });
      await incrementBtn.click();
      await expect(countInput).toHaveValue(String(before + i + 1));
    }
    return countInput.inputValue().then((v) => parseInt(v, 10) === before + times);
  }

  async decrementTraveler(index = 0, times = 1) {
    const { decrementBtn, countInput } = this.row(index);
    for (let i = 0; i < times; i++) {
      const isDisabled = await decrementBtn.isDisabled().catch(() => true);
      if (isDisabled) break;
      await decrementBtn.click();
    }
    return countInput.inputValue();
  }

  /**
   * A trip's Extra Services (ExtraServices.jsx) can mark individual items required
   * (`.required` / `.wte-required` marker next to the item or group's own label).
   * The marker alone doesn't say HOW to satisfy it — a required quantity counter
   * needs count > 0; a required "Choose One" group needs one selectable item
   * clicked (`[role="switch"]`, toggled via `aria-checked`). Satisfies the first
   * not-yet-satisfied required item/group found, skipping sold-out options.
   * Returns true if it made progress (so the caller can re-check and loop).
   */
  async satisfyOneRequiredExtraService() {
    return this.modal.evaluate((modal) => {
      const markers = Array.from(modal.querySelectorAll('.required, .wte-required'));
      for (const marker of markers) {
        // Required marker on a single item's own label -> quantity counter requirement.
        const optionBody = marker.closest('.wte-service-option-title-wrap')?.parentElement;
        const counterInput = optionBody?.querySelector('.wte-counter-input');
        if (counterInput) {
          if (parseInt(counterInput.value, 10) > 0) continue;
          const plusBtn = optionBody.querySelector('.wte-counter-btn-plus');
          if (plusBtn && !plusBtn.disabled) {
            plusBtn.click();
            return true;
          }
          continue;
        }

        // Required marker on a group header -> "Choose One" selectable requirement.
        const header = marker.closest('.wte-service-multiple-options-header');
        const group = header?.parentElement;
        if (group) {
          const alreadySelected = group.querySelector('[role="switch"][aria-checked="true"]');
          if (alreadySelected) continue;
          const items = Array.from(group.querySelectorAll('.wte-service-options-item-selectable'));
          const available = items.find((item) => !/sold out/i.test(item.textContent));
          if (available) {
            // The click handler is bound to the [role="switch"] indicator itself, not
            // the outer selectable item — clicking the outer div doesn't bubble down
            // to it and silently does nothing (confirmed live: aria-checked never
            // flips even though this branch keeps "succeeding").
            (available.querySelector('[role="switch"]') || available).click();
            return true;
          }
        }
      }
      return false;
    });
  }

  /**
   * Advances through however many intermediate steps this trip/site actually has
   * (see isOnFinalStep()'s doc — the count/order is not fixed), generically
   * satisfying a blocked step by incrementing any of its counter rows or required
   * Extra Services, until the button reads "Proceed To Checkout". Does NOT click
   * that final button — call proceedToCheckout() for that, so tests can inspect
   * the last step first if needed.
   */
  async advanceToFinalStep({ maxSteps = 8 } = {}) {
    for (let i = 0; i < maxSteps; i++) {
      // Satisfy the CURRENT step's own requirement first — including the final
      // step (e.g. a required Extra Service) — before deciding whether to stop.
      //
      // A single isDisabled() read right after a step mounts can be transiently
      // wrong — the button can start enabled (before the step's own required-field
      // validation, or even its content/counters, has finished rendering) and only
      // flip to disabled a moment later — so this retries the whole
      // check-and-satisfy cycle rather than trusting one read.
      for (let attempt = 0; attempt < 15; attempt++) {
        if (!(await this.nextButton.isDisabled())) break;

        let madeProgress = false;
        const rowCount = await this.travelerRows.count();
        for (let r = 0; r < rowCount && (await this.nextButton.isDisabled()); r++) {
          const { incrementBtn } = this.row(r);
          const isDisabled = await incrementBtn.isDisabled().catch(() => true);
          if (!isDisabled) {
            await incrementBtn.click();
            madeProgress = true;
          }
        }
        if (await this.nextButton.isDisabled()) {
          madeProgress = (await this.satisfyOneRequiredExtraService()) || madeProgress;
        }

        await this.page.waitForTimeout(300);
        if (!madeProgress && (await this.nextButton.isDisabled())) break;
      }
      await expect(this.nextButton).toBeEnabled({ timeout: 10000 });

      if (await this.isOnFinalStep()) return;

      await this.nextButton.click();
      // Real state-based wait for the tab transition (see loadingTabItem doc above),
      // not a fixed sleep — covers both "briefly appears then clears" and "never
      // appears because this tab's data was already cached".
      await this.loadingTabItem
        .waitFor({ state: 'visible', timeout: 2000 })
        .catch(() => {});
      await this.loadingTabItem.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    }
    throw new Error(
      `advanceToFinalStep: still not on the final step after ${maxSteps} clicks — ` +
        `either a step's requirement couldn't be auto-satisfied, or the step list is longer than expected.`,
    );
  }

  /**
   * Submits the final step. The real behavior is a fetch() to admin-ajax followed by
   * a `window.location.href` redirect on success — we wait for that actual navigation,
   * not for any fixed amount of time.
   */
  async proceedToCheckout() {
    const startUrl = this.page.url();
    await this.goNext();
    await this.page.waitForURL((url) => url.toString() !== startUrl, { timeout: 30000 });
    await this.page.waitForLoadState('domcontentloaded');
  }
}

module.exports = BookingModalPage;
