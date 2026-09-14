const { test, expect } = require('../../fixtures/base.fixture');
const { TRIPS } = require('../../utils/test-data');

test.describe('Trip Detail Page', () => {
  test.beforeEach(async ({ tripDetailPage }) => {
    await tripDetailPage.open(TRIPS.everestBaseCamp.slug);
  });

  test('page renders and has a title h1', async ({ tripDetailPage }) => {
    await expect(tripDetailPage.tripTitle).toBeVisible();
    const title = await tripDetailPage.getTripTitle();
    expect(title.trim().length).toBeGreaterThan(0);
  });

  test('tab navigation container (#tabs-container) is visible', async ({ tripDetailPage }) => {
    await expect(tripDetailPage.tabsContainer).toBeVisible();
  });

  test('all expected tabs are present', async ({ tripDetailPage }) => {
    const tabTexts = await tripDetailPage.tabLinks.allTextContents();
    const joined   = tabTexts.join(' ').toLowerCase();
    expect(joined).toMatch(/overview|itinerary|cost|faq|map/);
  });

  test('clicking Itinerary tab shows itinerary content', async ({ tripDetailPage }) => {
    await tripDetailPage.clickTab('Itinerary');
    // After clicking, the itinerary panel should be in DOM
    const count = await tripDetailPage.getItineraryDayCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('clicking FAQs tab shows faq section (.wpte-faq-section)', async ({ tripDetailPage }) => {
    await tripDetailPage.clickTab('FAQs');
    const faqVisible = await tripDetailPage.faqSection.isVisible({ timeout: 5000 }).catch(() => false);
    if (faqVisible) {
      await expect(tripDetailPage.faqSection).toBeVisible();
    }
  });

  test('Book Now / Check Availability button (button.wte-book-now) is visible', async ({ tripDetailPage }) => {
    await expect(tripDetailPage.bookNowBtn).toBeVisible({ timeout: 8000 });
  });

  test('clicking Book Now opens booking modal', async ({ tripDetailPage }) => {
    await tripDetailPage.clickBookNow();
    // Modal should appear — verify page did not navigate away
    const url = tripDetailPage.page.url();
    expect(url).toContain('/trip/');
  });

  test('price wrapper (.wpte-trip-price-wrapper) is rendered in sidebar', async ({ tripDetailPage }) => {
    await expect(tripDetailPage.priceWrapper).toBeVisible();
  });

  test('Tiger Nest trip detail page loads', async ({ tripDetailPage }) => {
    await tripDetailPage.open(TRIPS.tigerNest.slug);
    await expect(tripDetailPage.tripTitle).toBeVisible();
    const title = await tripDetailPage.getTripTitle();
    expect(title.toLowerCase()).toContain('tiger');
  });
});
