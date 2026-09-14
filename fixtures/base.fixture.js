const { test: base, expect } = require('@playwright/test');
const HomePage = require('../pages/HomePage');
const LoginPage = require('../pages/LoginPage');
const TripListPage = require('../pages/TripListPage');
const TripDetailPage = require('../pages/TripDetailPage');
const BookingPage = require('../pages/BookingPage');
const BookingModalPage = require('../pages/BookingModalPage');
const CheckoutPage = require('../pages/CheckoutPage');
const MyAccountPage = require('../pages/MyAccountPage');
const AdminPage = require('../pages/AdminPage');
const { USERS, TRIPS, URLS, ADMIN_URLS } = require('../utils/test-data');

const test = base.extend({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  tripListPage: async ({ page }, use) => {
    await use(new TripListPage(page));
  },

  tripDetailPage: async ({ page }, use) => {
    await use(new TripDetailPage(page));
  },

  bookingPage: async ({ page }, use) => {
    await use(new BookingPage(page));
  },

  /** Verified page object for the React trip-booking modal (see pages/BookingModalPage.js) */
  bookingModalPage: async ({ page }, use) => {
    await use(new BookingModalPage(page));
  },

  /** Verified page object for the real checkout page (see pages/CheckoutPage.js) */
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },

  myAccountPage: async ({ page }, use) => {
    await use(new MyAccountPage(page));
  },

  /** Provides a page already logged in as the registered test user */
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(USERS.registered.email, USERS.registered.password);
    await use(page);
  },

  /** Provides MyAccountPage already logged in */
  loggedInMyAccount: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(USERS.registered.email, USERS.registered.password);
    const myAccount = new MyAccountPage(page);
    await use(myAccount);
  },

  adminPage: async ({ page }, use) => {
    await use(new AdminPage(page));
  },

  /** Provides AdminPage already logged into wp-admin */
  loggedInAdmin: async ({ page }, use) => {
    const admin = new AdminPage(page);
    await admin.loginAsAdmin();
    await use(admin);
  },
});

// Re-export test data constants for convenience
module.exports = { test, expect, USERS, TRIPS, URLS, ADMIN_URLS };
