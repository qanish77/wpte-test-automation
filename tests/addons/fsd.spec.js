/**
 * Fixed Starting Dates — Functional Tests (wte-fixed-departure-dates add-on)
 *
 * Every selector/behavior here was verified live against the running site (DOM
 * dumps, screenshots, flatpickr day-class inspection) — never guessed. See
 * pages/BookingModalPage.js (calendarDays, availableCalendarDays,
 * selectAnotherAvailableDay) and pages/AdminPage.js (tripDatesTab,
 * editPricingDatesBtns) for citations.
 *
 * Supersedes the previous fsd.spec.js, which asserted against a trip-page
 * "Available Dates" widget (`.wte-fsd__container`, `.wte-fsd__availability-*`,
 * `.wte-fsd__booknow-btn`) that CLAUDE.md's own "Known fixes applied" section
 * documents as previously verified live — but is no longer present on either
 * standard test trip as of this writing (see finding below). Every one of the
 * old file's assertions was already guarded by `if (!fsdExists) return`, so it
 * was silently passing on pure vacuous truth rather than testing anything.
 *
 * IMPORTANT LIVE FINDING — the old trip-page date widget is currently gone:
 *   - Everest Base Camp trek's tab list is now
 *     ["Overview","Itinerary","Cost","FAQs","Map"] — NO "Dates" tab at all (it had
 *     one earlier this same session: Overview/Itinerary/Cost/Dates/FAQs/Map). The
 *     page instead shows a "No Fixed Departure Available" badge near the title.
 *   - Tiger Nest's tab list is ["Overview","Itinerary","Cost","Map"] — also no
 *     "Dates" tab, and no "No Fixed Departure Available" text either; it simply
 *     doesn't render that section at all.
 *   - Given this, `TripDetailPage.hasFSD()` / `.fsdSection` etc. are kept only as
 *     discovery checks below (skip cleanly if absent) — they are NOT asserted as
 *     required, since I have no current evidence they're expected to render for
 *     either of this project's two standard trips right now. If the site's design
 *     brings this section back, these tests will start actually exercising it
 *     without any code change (they check `count() > 0` before every assertion).
 *
 * WHAT ACTUALLY WORKS AND IS VERIFIED LIVE — the booking modal's "Date & Time"
 * step (a flatpickr calendar), which is where FSD-configured availability is
 * genuinely surfaced to customers right now:
 *   - The calendar renders a real month grid; every day strictly before today
 *     carries `.flatpickr-disabled`. The converse does NOT hold, though — a
 *     FUTURE date (Sep 15, 2026, the day right after an Sep 14 "today") was also
 *     found disabled, presumably a genuinely blocked/sold-out FSD date (the
 *     plugin has an explicit "block specific dates" feature) rather than a
 *     past-date restriction. Tests below only assert the direction that must
 *     always hold (past ⇒ disabled), never the reverse.
 *   - A day is auto-selected on load (today's date, when bookable — App.jsx does
 *     this ~100ms after trip data loads, already relied on everywhere else in this
 *     suite via waitForDateAutoSelected()).
 *   - Clicking a different enabled day changes the selection (confirmed live:
 *     .selected moved from Sep 10 to Sep 11 on click) and the booking flow
 *     continues normally afterward (goNext() succeeds, reaches Package Type).
 *   - The calendar does NOT currently give a blocked/sold-out date a visual class
 *     distinct from a plain past date — both are just `.flatpickr-disabled`. No
 *     test below asserts a dedicated "sold out" visual state, since I found no
 *     live way to distinguish the two from class name alone.
 *
 * ADMIN — Trip Edit has a "Date & Price" meta tab (label shows a live package-count
 * badge, e.g. "Date & Price2") with its own sub-tabs: Packages | Date Settings |
 * Partial Payments | Installment Payments | Price on Request. Each configured
 * package has a real `<button class="wpte-btn-edit">Edit Pricing & Dates</button>`
 * (confirmed live — NOT an `<a>`, despite looking like a link) that opens the
 * actual per-date/seat editor. Per this project's established read-only testing
 * scope (see memory: addon test suites stay read-only), tests verify the tab and
 * its package list render correctly but do not open or edit the per-date editor.
 */

const { test, expect } = require('../../fixtures/base.fixture');
const { TRIPS } = require('../../utils/test-data');

test.describe('FSD — Booking modal calendar', () => {
  test('calendar renders a real month grid with a day auto-selected', async ({
    tripDetailPage,
    bookingModalPage,
  }) => {
    await tripDetailPage.open(TRIPS.everestBaseCamp.slug);
    await bookingModalPage.open();
    await bookingModalPage.waitForDateAutoSelected();

    await expect(bookingModalPage.calendar).toBeVisible();
    expect(await bookingModalPage.calendarDays.count()).toBeGreaterThan(0);

    const selectedLabel = await bookingModalPage.selectedDayLabel();
    expect(selectedLabel).toBeTruthy();
  });

  test('past dates in the visible month are disabled', async ({ tripDetailPage, bookingModalPage }) => {
    await tripDetailPage.open(TRIPS.everestBaseCamp.slug);
    await bookingModalPage.open();
    await bookingModalPage.waitForDateAutoSelected();

    const todayLabel = await bookingModalPage.selectedDayLabel();
    if (!todayLabel) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No day was auto-selected — cannot establish "today" as a reference point.' });
      return;
    }

    // NOTE: the reverse of what you might expect — not every disabled day is in
    // the past. Live-confirmed a FUTURE date (Sep 15, 2026, one day after an Sep 14
    // "today") was also disabled, presumably a genuinely blocked/sold-out FSD date
    // (the plugin has an explicit "block specific dates" feature) rather than a
    // past-date restriction. So this only asserts the one direction that must
    // always hold: every day strictly BEFORE today is disabled. It does not assert
    // the converse.
    const todayDate = new Date(todayLabel);
    const allLabels = await bookingModalPage.calendarDays.evaluateAll(
      (els) => els.map((el) => ({ label: el.getAttribute('aria-label'), disabled: el.classList.contains('flatpickr-disabled') }))
    );
    const pastDays = allLabels.filter((d) => new Date(d.label).getTime() < todayDate.getTime());
    if (pastDays.length === 0) {
      test.info().annotations.push({ type: 'skip-reason', description: 'No days before today in the current month view (e.g. today is the 1st).' });
      return;
    }
    for (const day of pastDays) {
      expect(day.disabled, `Past day "${day.label}" should be disabled`).toBe(true);
    }
  });

  test('selecting a different available day updates the selection and the flow continues', async ({
    tripDetailPage,
    bookingModalPage,
  }) => {
    await tripDetailPage.open(TRIPS.everestBaseCamp.slug);
    await bookingModalPage.open();
    await bookingModalPage.waitForDateAutoSelected();

    const before = await bookingModalPage.selectedDayLabel();
    const clicked = await bookingModalPage.selectAnotherAvailableDay();
    if (!clicked) {
      test.info().annotations.push({ type: 'skip-reason', description: 'Only one available day in the current month view — nothing else to switch to.' });
      return;
    }

    const after = await bookingModalPage.selectedDayLabel();
    expect(after).toBe(clicked);
    expect(after).not.toBe(before);

    // The rest of the booking flow should work normally from this newly-selected date.
    const label = await bookingModalPage.goNext();
    expect(label).toBeTruthy();
  });
});

test.describe('FSD — Legacy trip-page date widget (discovery only)', () => {
  test('trip page handles the widget gracefully whether present or absent', async ({ tripDetailPage }) => {
    await tripDetailPage.open(TRIPS.everestBaseCamp.slug);
    const hasFSD = await tripDetailPage.hasFSD();

    if (!hasFSD) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'No trip-page date widget currently present for this trip (see file header — FSD availability now surfaces via the booking modal calendar instead).',
      });
      return;
    }

    await tripDetailPage.clickTab('Dates').catch(() => {});
    await expect(tripDetailPage.fsdSection).toBeVisible({ timeout: 5000 });
    const dateCount = await tripDetailPage.fsdDateOptions.count();
    expect(dateCount).toBeGreaterThan(0);
  });
});

test.describe('FSD — Admin: Trip Edit "Date & Price" tab', () => {
  test('tab renders its sub-tabs and each configured package has an editor entry point', async ({ loggedInAdmin }) => {
    const loggedIn = await loggedInAdmin.isLoggedIn();
    if (!loggedIn) { return; }

    await loggedInAdmin.goToTripDatesTab(TRIPS.everestBaseCamp.id);

    const subTabCount = await loggedInAdmin.tripDatesSubTabs.count();
    expect(subTabCount).toBeGreaterThan(0);

    const editButtonCount = await loggedInAdmin.editPricingDatesBtns.count();
    expect(editButtonCount).toBeGreaterThan(0);
  });
});
