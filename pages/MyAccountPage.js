const BasePage = require('./BasePage');

// Selectors from wp-travel-engine/includes/templates/account/content-dashboard.php
// and includes/templates/account/tab-content/bookings.php
class MyAccountPage extends BasePage {
  constructor(page) {
    super(page);

    // Dashboard shell
    this.dashboardWrapper = page.locator('.wpte-lrf-wrap.wpte-dashboard');
    this.dashboardTabs    = page.locator('a.wpte-ud-tab');
    this.logoutLink       = page.locator('a.lrf-userprofile-logout');
    this.pageTitle        = page.locator('h2.wpte-my-account-page-title');
    this.description      = page.locator('p.wpte-lrf-description');

    // Tab content panels
    this.tabContents      = page.locator('.wpte-ud-tab-content');

    // Bookings tab
    this.bookingsTabMenu  = page.locator('.wpte-bookings-tabmenu');
    this.activeBookings   = page.locator('.wpte-active-bookings');
    this.bookedTripWrap   = page.locator('.wpte-booked-trip-wrap');
    this.bookedTripTitle  = page.locator('.wpte-booked-trip-title');

    // Edit account form (inside profile tab content)
    this.firstNameField   = page.locator('input[name="first_name"]');
    this.lastNameField    = page.locator('input[name="last_name"]');
    this.emailField       = page.locator('input[name="email"]');
    this.saveBtn          = page.locator('input[name="wte_save_account_details"], button[name="save_account_details"]').first();
  }

  async open() {
    await this.goto('/my-account/');
    await this.page.waitForSelector('.wpte-lrf-wrap', { timeout: 10000 }).catch(() => {});
  }

  async isLoggedIn() {
    return this.dashboardWrapper.isVisible({ timeout: 8000 }).catch(() => false);
  }

  async getPageTitle() {
    if (await this.pageTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
      return this.pageTitle.textContent();
    }
    return null;
  }

  /** Click a dashboard tab by its data-target value or visible text */
  async clickTab(targetOrText) {
    const tab = this.page.locator(`a.wpte-ud-tab[data-target="${targetOrText}"]`)
      .or(this.page.locator('a.wpte-ud-tab').filter({ hasText: targetOrText }));
    await tab.first().click();
    await this.page.waitForTimeout(400);
  }

  async getTabNames() {
    return this.dashboardTabs.allTextContents();
  }

  async logout() {
    await this.logoutLink.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getBookingCount() {
    return this.bookedTripWrap.count();
  }
}

module.exports = MyAccountPage;
