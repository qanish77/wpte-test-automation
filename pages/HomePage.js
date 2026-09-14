const BasePage = require('./BasePage');

// Selectors derived from WP Travel Engine archive templates and Travel Monster theme
class HomePage extends BasePage {
  constructor(page) {
    super(page);

    // Primary navigation — Travel Monster theme uses standard WP nav
    this.nav        = page.locator('nav, .site-navigation, header nav').first();
    this.navLinks   = page.locator('nav a, .nav-menu a, .site-navigation a');
    this.menuItems  = {
      allTrips:     page.getByRole('navigation').getByText('All Trips', { exact: false }).first(),
      destination:  page.getByRole('navigation').getByText('Destination', { exact: false }).first(),
      activities:   page.getByRole('navigation').getByText('Activities', { exact: false }).first(),
      tripTypes:    page.getByRole('navigation').getByText('Trip Types', { exact: false }).first(),
      blog:         page.getByRole('navigation').getByText('Blog', { exact: false }).first(),
    };

    // Trip cards on the homepage (uses same archive template)
    this.tripCards  = page.locator('div.category-trips-single');
    this.tripTitles = page.locator('h2.category-trip-title');

    // Search — wpte-trip__search-fields from template-trip-search-form.php
    this.searchForm = page.locator('form.wpte-trip__search-fields').first();
    this.searchInput = page.locator('input[type="search"], input[name="s"]').first();
  }

  async open() {
    await this.goto('/');
    await this.page.waitForSelector('nav, .site-navigation, header', { timeout: 10000 }).catch(() => {});
  }

  async navigateTo(menuKey) {
    const item = this.menuItems[menuKey];
    if (item) {
      await item.click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  async getFeaturedTripCount() {
    return this.tripCards.count();
  }

  async clickFirstTrip() {
    await this.page.locator('a.wpte-button').first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }
}

module.exports = HomePage;
