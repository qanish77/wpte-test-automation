class BasePage {
  constructor(page) {
    this.page = page;
  }

  async goto(path = '/') {
    // Use domcontentloaded (not 'load') — WordPress pages with CDN fonts/analytics
    // can delay the load event far past 45s on shared hosting under test load.
    // DOM is ready at domcontentloaded; all our selectors target server-rendered HTML.
    //
    // Measured directly (3 runs of a bare Playwright goto against the trip page):
    // domcontentloaded fires anywhere from ~17s to ~46s. The page loads ~90
    // render-blocking <script> tags and this shared-hosting sandbox serves them
    // slowly — that's the actual bottleneck, not test flakiness. A 45s first
    // attempt covers most loads; on timeout, retry once with 60s for the slow tail.
    try {
      return await this.page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45 * 1000 });
    } catch (err) {
      if (!err.message.includes('Timeout')) throw err;
      // 'commit' resolves as soon as the server responds and navigation starts —
      // it doesn't wait on the ~90 render-blocking <script> tags that make
      // domcontentloaded unreliable on this shared-hosting sandbox under load.
      const response = await this.page.goto(path, { waitUntil: 'commit', timeout: 60 * 1000 });
      await this.page.locator('body').first().waitFor({ state: 'attached', timeout: 60 * 1000 });
      return response;
    }
  }

  /** Dismiss the site's dismissible "Special Offer" notification bars.
   * They render as sticky/fixed overlays and, if left open, intercept clicks
   * meant for elements underneath them (e.g. the trip-detail tab bar). */
  async dismissPromoBanners() {
    const dismissBtns = this.page.locator('button[aria-label="Dismiss banner"]');
    const count = await dismissBtns.count();
    for (let i = 0; i < count; i++) {
      await dismissBtns.first().click().catch(() => {});
    }
  }

  async getTitle() {
    return this.page.title();
  }

  async waitForVisible(selector, timeout = 10000) {
    await this.page.locator(selector).waitFor({ state: 'visible', timeout });
  }

  async clickAndWaitForNav(selector) {
    await this.page.locator(selector).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Returns the text of the first matching .woocommerce-error or .woocommerce-notice */
  async getNoticeText() {
    const errorSel = '.woocommerce-error li, .woocommerce-message, .woocommerce-info';
    const el = this.page.locator(errorSel).first();
    if (await el.isVisible({ timeout: 5000 }).catch(() => false)) {
      return el.textContent();
    }
    return null;
  }

  async getCurrentURL() {
    return this.page.url();
  }
}

module.exports = BasePage;
