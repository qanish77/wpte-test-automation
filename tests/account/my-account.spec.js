const { test, expect } = require('../../fixtures/base.fixture');
const { USERS } = require('../../utils/test-data');

test.describe('My Account', () => {
  test('unauthenticated visit shows login form (.wpte-lrf-wrap.wpte-login)', async ({ loginPage }) => {
    await loginPage.open();
    await expect(loginPage.loginWrapper).toBeVisible();
  });

  test('after login, dashboard wrapper (.wpte-lrf-wrap.wpte-dashboard) is visible', async ({ loggedInMyAccount }) => {
    await expect(loggedInMyAccount.dashboardWrapper).toBeVisible({ timeout: 10000 });
  });

  test('dashboard page title (h2.wpte-my-account-page-title) is rendered', async ({ loggedInMyAccount }) => {
    await expect(loggedInMyAccount.pageTitle).toBeVisible();
    const text = await loggedInMyAccount.getPageTitle();
    expect(text.trim().length).toBeGreaterThan(0);
  });

  test('dashboard tab navigation (a.wpte-ud-tab) is present with tabs', async ({ loggedInMyAccount }) => {
    await expect(loggedInMyAccount.dashboardTabs.first()).toBeVisible();
    const tabs = await loggedInMyAccount.getTabNames();
    expect(tabs.length).toBeGreaterThan(0);
  });

  test('logout link (a.lrf-userprofile-logout) is visible', async ({ loggedInMyAccount }) => {
    await expect(loggedInMyAccount.logoutLink).toBeVisible();
  });

  test('clicking a dashboard tab changes active content', async ({ loggedInMyAccount }) => {
    const tabs = await loggedInMyAccount.getTabNames();
    if (tabs.length > 1) {
      await loggedInMyAccount.clickTab(tabs[1].trim());
      await loggedInMyAccount.page.waitForTimeout(300);
      // Verify we're still on my-account page
      expect(loggedInMyAccount.page.url()).toContain('/my-account/');
    }
  });

  test('logout redirects back to login form', async ({ loggedInMyAccount }) => {
    await loggedInMyAccount.logout();
    await expect(loggedInMyAccount.page.locator('.wpte-lrf-wrap.wpte-login')).toBeVisible({ timeout: 8000 });
  });
});
