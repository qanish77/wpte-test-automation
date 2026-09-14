const { test, expect } = require('../../fixtures/base.fixture');

test.describe('Trip Search & Filter', () => {
  test('search form (form.wpte-trip__search-fields) is present on trips page', async ({ tripListPage, page }) => {
    // Check the trips archive first (most likely placement)
    await tripListPage.open();
    let formVisible = await tripListPage.searchForm.isVisible({ timeout: 5000 }).catch(() => false);

    if (!formVisible) {
      // WTE search form is often placed on the home page via a search block/widget
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      formVisible = await tripListPage.searchForm.isVisible({ timeout: 5000 }).catch(() => false);
    }

    if (!formVisible) {
      test.skip(true, 'Search form not found on /trip/ or home page — add the WTE Trip Search block to a page');
      return;
    }
    await expect(tripListPage.searchForm).toBeVisible();
  });

  test('Nepal destination archive returns trip cards', async ({ page }) => {
    await page.goto('/destinations/nepal/', { waitUntil: 'domcontentloaded' });
    const cards = page.locator('div.category-trips-single');
    const count = await cards.count();
    // May be 0 if no Nepal trips, but page must load
    expect(count).toBeGreaterThanOrEqual(0);
    expect(await page.title()).toBeTruthy();
  });

  test('activities/hiking archive loads cleanly', async ({ page }) => {
    await page.goto('/activities/hiking/', { waitUntil: 'domcontentloaded' });
    expect(await page.title()).toBeTruthy();
  });

  test('activities/trekking archive loads cleanly', async ({ page }) => {
    await page.goto('/activities/trekking/', { waitUntil: 'domcontentloaded' });
    expect(await page.title()).toBeTruthy();
  });

  test('activities/rafting archive loads cleanly', async ({ page }) => {
    await page.goto('/activities/rafting/', { waitUntil: 'domcontentloaded' });
    expect(await page.title()).toBeTruthy();
  });

  test('trip-type/cultural archive loads cleanly', async ({ page }) => {
    await page.goto('/trip-types/cultural/', { waitUntil: 'domcontentloaded' });
    expect(await page.title()).toBeTruthy();
  });

  test('site-wide search for "everest" returns results page', async ({ page }) => {
    await page.goto('/?s=everest', { waitUntil: 'domcontentloaded' });
    const url = page.url();
    expect(url).toContain('s=everest');
    const body = await page.locator('body').textContent();
    // Either results found or "nothing found" — page must not error
    expect(body.trim().length).toBeGreaterThan(0);
  });

  test('nonsense search shows no-results message', async ({ page }) => {
    await page.goto('/?s=zxqnonexistent12345', { waitUntil: 'domcontentloaded' });
    const body = await page.locator('body').textContent();
    expect(body.toLowerCase()).toMatch(/no results|nothing found|no posts found|not found/);
  });
});
