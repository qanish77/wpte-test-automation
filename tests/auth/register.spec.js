const { test, expect } = require('../../fixtures/base.fixture');
const { USERS } = require('../../utils/test-data');

test.describe('Registration', () => {
  test('register form is hidden by default, revealed via toggle', async ({ loginPage }) => {
    await loginPage.open();
    // .wpte-lrf-wrap.wpte-register is rendered with style="display:none"
    const registerWrapper = loginPage.page.locator('.wpte-lrf-wrap.wpte-register');
    const initiallyHidden = await registerWrapper.evaluate(el => el.style.display === 'none' || !el.offsetParent).catch(() => true);
    expect(initiallyHidden).toBe(true);

    // After clicking the toggle it should become visible
    await loginPage.showRegisterLink.click();
    await loginPage.page.waitForTimeout(300);
    await expect(registerWrapper).toBeVisible();
  });

  test('register form fields are present after toggle', async ({ loginPage }) => {
    await loginPage.open();
    await loginPage.showRegisterLink.click();
    await loginPage.page.waitForTimeout(300);
    await expect(loginPage.regUsernameInput).toBeVisible();
    await expect(loginPage.regEmailInput).toBeVisible();
    await expect(loginPage.regPasswordInput).toBeVisible();
    await expect(loginPage.registerBtn).toBeVisible();
  });

  test('registering with existing email should not show dashboard', async ({ loginPage }) => {
    await loginPage.register(`dup_${Date.now()}`, USERS.registered.email, 'TestPass@9988!');
    const dashboardShown = await loginPage.page.locator('.wpte-lrf-wrap.wpte-dashboard').isVisible({ timeout: 3000 }).catch(() => false);
    expect(dashboardShown).toBe(false);
  });

  test('successful new registration shows dashboard', async ({ loginPage }) => {
    const ts = Date.now();
    await loginPage.register(`traveler_${ts}`, `traveler_${ts}@mailtest.dev`, 'NewTravel@2026!');
    await expect(loginPage.page.locator('.wpte-lrf-wrap.wpte-dashboard')).toBeVisible({ timeout: 12000 });
  });
});
