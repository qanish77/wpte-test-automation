const BasePage = require('./BasePage');

// Selectors from wp-travel-engine/includes/templates/account/form-login.php
class LoginPage extends BasePage {
  constructor(page) {
    super(page);

    // Login form — inside .wpte-lrf-wrap.wpte-login
    this.loginWrapper    = page.locator('.wpte-lrf-wrap.wpte-login');
    this.usernameInput   = page.locator('.wpte-lrf-wrap.wpte-login input#username');
    this.passwordInput   = page.locator('.wpte-lrf-wrap.wpte-login input[name="password"]');
    this.loginBtn        = page.locator('input[name="login"]');
    this.showRegisterLink = page.locator('#wpte-show-register-form');

    // Register form — inside .wpte-lrf-wrap.wpte-register (hidden by default, toggled via JS)
    this.registerWrapper  = page.locator('.wpte-lrf-wrap.wpte-register');
    this.regUsernameInput = page.locator('.wpte-lrf-wrap.wpte-register input[name="username"]');
    this.regEmailInput    = page.locator('.wpte-lrf-wrap.wpte-register input[name="email"]');
    this.regPasswordInput = page.locator('.wpte-lrf-wrap.wpte-register input[name="password"]');
    this.registerBtn      = page.locator('input[name="register"]');

    // Notices (WTE uses its own notice system)
    this.notice = page.locator('.wpte-error, .wpte-notice, .wte-notices, .error-msg, [class*="notice"], [class*="error"]').first();
  }

  async open() {
    await this.goto('/my-account/');
    await this.page.waitForSelector('.wpte-lrf-wrap', { timeout: 10000 }).catch(() => {});
  }

  async login(usernameOrEmail, password) {
    await this.open();
    await this.usernameInput.fill(usernameOrEmail);
    await this.passwordInput.fill(password);
    await this.loginBtn.click();
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for either the dashboard (success) or an error notice (bad credentials)
    await Promise.race([
      this.page.locator('.wpte-lrf-wrap.wpte-dashboard').waitFor({ state: 'visible', timeout: 10000 }),
      this.notice.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});
  }

  /** Opens the register form by clicking "Sign up" link, then submits */
  async register(username, email, password) {
    await this.open();
    // Register form is hidden; click the toggle to reveal it
    if (await this.showRegisterLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.showRegisterLink.click();
      await this.page.waitForTimeout(400);
    }
    await this.regUsernameInput.fill(username);
    await this.regEmailInput.fill(email);
    await this.regPasswordInput.fill(password);
    await this.registerBtn.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Returns true when the dashboard is rendered (login succeeded) */
  async isLoggedIn() {
    return this.page.locator('.wpte-lrf-wrap.wpte-dashboard').isVisible({ timeout: 5000 }).catch(() => false);
  }

  async getNoticeText() {
    if (await this.notice.isVisible({ timeout: 3000 }).catch(() => false)) {
      return this.notice.textContent();
    }
    return null;
  }
}

module.exports = LoginPage;
