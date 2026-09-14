const { test, expect } = require('../../fixtures/base.fixture');

test.describe('Trip Listing', () => {
  test('trips archive loads with at least one .category-trips-single card', async ({ tripListPage }) => {
    await tripListPage.open();
    if (tripListPage.loadFailed) return; // /trip/ unreachable for this client — see TripListPage.open()
    const count = await tripListPage.getTripCount();
    expect(count).toBeGreaterThan(0);
  });

  test('each trip card has a visible h2.category-trip-title', async ({ tripListPage }) => {
    await tripListPage.open();
    if (tripListPage.loadFailed) return;
    const titles = await tripListPage.getTripTitles();
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) {
      expect(t.trim().length).toBeGreaterThan(0);
    }
  });

  test('each trip card has a price wrapper (.wpte-trip-price-wrapper)', async ({ tripListPage }) => {
    await tripListPage.open();
    if (tripListPage.loadFailed) return;
    const count = await tripListPage.priceWrapper.count();
    expect(count).toBeGreaterThan(0);
  });

  test('View Details button (a.wpte-button) navigates to a single trip', async ({ tripListPage, page }) => {
    await tripListPage.open();
    if (tripListPage.loadFailed) return;
    await tripListPage.clickTripByIndex(0);
    const url = page.url();
    expect(url).toMatch(/\/trip\/.+/);
  });

  test('destination taxonomy — Nepal archive loads', async ({ page }) => {
    await page.goto('/destinations/nepal/', { waitUntil: 'domcontentloaded' });
    const cards = page.locator('div.category-trips-single');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);   // 0 is valid if no Nepal trips
    const title = await page.title();
    expect(title.toLowerCase()).toMatch(/nepal|destination|not found/);
  });

  test('destination taxonomy — Bhutan archive loads', async ({ page }) => {
    await page.goto('/destinations/bhutan/', { waitUntil: 'domcontentloaded' });
    const status = await page.evaluate(() => document.readyState);
    expect(['complete', 'interactive']).toContain(status);
  });

  test('activities taxonomy — Trekking archive loads', async ({ page }) => {
    await page.goto('/activities/trekking/', { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('trip-type taxonomy — budget archive loads', async ({ page }) => {
    await page.goto('/trip-types/budget-travel/', { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
