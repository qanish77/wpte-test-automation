const BasePage = require('./BasePage');

// Selectors from wp-travel-engine/includes/templates/content-grid.php
// and trip-card/index.php, card-body.php, card-aside.php
class TripListPage extends BasePage {
  constructor(page) {
    super(page);

    // Trip cards — archive list
    this.tripCards    = page.locator('div.category-trips-single');
    this.tripTitles   = page.locator('h2.category-trip-title');
    this.tripLinks    = page.locator('h2.category-trip-title a');
    this.viewBtns     = page.locator('a.wpte-button');               // "View Details"
    this.priceWrapper = page.locator('.wpte-trip-price-wrapper');
    this.duration     = page.locator('.wpte-trip-duration');

    // Search/filter form — from template-trip-search-form.php
    // Broader selector handles minor class-name drift across WTE versions and block vs. widget placement
    const searchFormSel = [
      'form.wpte-trip__search-fields',
      '.wpte-trip__search-fields',
      'form.wpte-trip-search-form',
      '[class*="wte-trip-search"] form',
      'form[class*="search-fields"]',
    ].join(', ');
    this.searchForm         = page.locator(searchFormSel);
    this.destinationSelect  = page.locator(`${searchFormSel} select[name="destination"]`);
    this.activitiesSelect   = page.locator(`${searchFormSel} select[name="activities"]`);
    this.durationSelect     = page.locator(`${searchFormSel} select[name="duration"]`);
    this.searchSubmitBtn    = page.locator(`${searchFormSel} [type="submit"], ${searchFormSel} button`).first();

    // Pagination
    this.paginationNext = page.locator('.next.page-numbers');
  }

  async open() {
    // domcontentloaded (set in BasePage.goto) ensures server-rendered trip cards are in DOM.
    // /trip/ is known to sometimes hang indefinitely — zero bytes ever received — for
    // automated clients (Cloudflare/WAF bot mitigation appears to tarpit it, even though
    // it loads fine for a real browser). Only THAT specific no-response timeout is a soft
    // skip; a real HTTP error status or any other navigation error must still fail loudly.
    this.loadFailed = false;
    let response;
    try {
      response = await this.goto('/trip/');
    } catch (err) {
      if (!err.message.includes('Timeout')) throw err;
      this.loadFailed = true;
      return;
    }
    if (response && !response.ok()) {
      throw new Error(`GET /trip/ returned HTTP ${response.status()} ${response.statusText()}`);
    }
  }

  async getTripCount() {
    return this.tripCards.count();
  }

  async getTripTitles() {
    return this.tripTitles.allTextContents();
  }

  async clickTripByIndex(index = 0) {
    await this.viewBtns.nth(index).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickTripByName(name) {
    await this.page.locator('h2.category-trip-title a').filter({ hasText: name }).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async filterByDestination(destination) {
    if (await this.destinationSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.destinationSelect.selectOption({ label: destination });
    } else {
      // Fall back to taxonomy archive link
      await this.page.getByRole('link', { name: destination, exact: true }).first().click();
    }
    await this.page.waitForLoadState('domcontentloaded');
  }

  async goToNextPage() {
    if (await this.paginationNext.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.paginationNext.click();
      await this.page.waitForLoadState('domcontentloaded');
      return true;
    }
    return false;
  }
}

module.exports = TripListPage;
