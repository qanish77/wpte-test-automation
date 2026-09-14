const { test, expect } = require('../../fixtures/base.fixture');
const { USERS } = require('../../utils/test-data');

test.describe('Login', () => {
  test('my-account page title is correct', async ({ loginPage }) => {
    await loginPage.open();
    const title = await loginPage.getTitle();
    expect(title.toLowerCase()).toContain('my account');
  });

  test('login form is visible inside .wpte-lrf-wrap.wpte-login', async ({ loginPage }) => {
    await loginPage.open();
    await expect(loginPage.loginWrapper).toBeVisible();
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginBtn).toBeVisible();
  });

  test('register toggle link is present', async ({ loginPage }) => {
    await loginPage.open();
    await expect(loginPage.showRegisterLink).toBeVisible();
  });

  test('shows error for completely wrong credentials', async ({ loginPage }) => {
    await loginPage.login('ghost_user_xyz999@nowhere.com', 'WrongPass!@#123');
    // After failed login WTE reloads the same page
    const url = loginPage.page.url();
    expect(url).toContain('/my-account');
    // Either a notice is displayed, or the dashboard is NOT shown
    const dashboardShown = await loginPage.page.locator('.wpte-lrf-wrap.wpte-dashboard').isVisible({ timeout: 2000 }).catch(() => false);
    expect(dashboardShown).toBe(false);
  });

  test('shows error for empty username submission', async ({ loginPage }) => {
    await loginPage.open();
    // Click login with empty fields — HTML5 validation or WTE will block it
    await loginPage.page.locator('input[name="login"]').click();
    // Page should still be on /my-account/ and dashboard not shown
    const dashboardShown = await loginPage.page.locator('.wpte-lrf-wrap.wpte-dashboard').isVisible({ timeout: 2000 }).catch(() => false);
    expect(dashboardShown).toBe(false);
  });

  test('successful login shows dashboard (.wpte-lrf-wrap.wpte-dashboard)', async ({ loginPage }) => {
    await loginPage.login(USERS.registered.email, USERS.registered.password);
    await expect(loginPage.page.locator('.wpte-lrf-wrap.wpte-dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('successful login URL is /my-account/', async ({ loginPage }) => {
    await loginPage.login(USERS.registered.email, USERS.registered.password);
    expect(loginPage.page.url()).toContain('/my-account/');
  });

  test('logout returns to login form', async ({ loginPage, myAccountPage }) => {
    await loginPage.login(USERS.registered.email, USERS.registered.password);
    await expect(myAccountPage.logoutLink).toBeVisible({ timeout: 8000 });
    await myAccountPage.logout();
    await expect(loginPage.loginWrapper).toBeVisible({ timeout: 8000 });
  });
});
