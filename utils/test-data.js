const BASE_URL = process.env.BASE_URL || 'https://silent-flowers-190203.1wp.site';

// URL constants for common pages
const URLS = {
  home: '/',
  login: '/my-account/',
  register: '/my-account/',
  allTrips: '/trip/',
  destinations: '/destination/',
  activities: '/activities/',
  tripTypes: '/trip-type/',
  blog: '/blog/',
  contact: '/contact-us/',
  about: '/about-us/',
  cart: '/cart/',
  checkout: '/checkout/',
  bookingConfirmation: '/booking-confirmation/',
  search: '/?s=',  // search base URL
};

// Admin URLs
const ADMIN_URLS = {
  login:    '/wp-admin/',
  dashboard: '/wp-admin/index.php',
  settings: '/wp-admin/edit.php?post_type=booking&page=class-wp-travel-engine-admin.php',
  tripList: '/wp-admin/edit.php?post_type=trip',
  newTrip:  '/wp-admin/post-new.php?post_type=trip',
  tripEdit: (id) => `/wp-admin/post.php?post=${id}&action=edit`,
  categories: '/wp-admin/edit-tags.php?taxonomy=trip_types&post_type=trip',
  coupons: '/wp-admin/edit.php?post_type=wpte_coupon',
};

// User credentials
const USERS = {
  registered: {
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD,
    username: 'testuser',
  },
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  newUser: {
    username: `traveler_${Date.now()}`,
    email: `traveler_${Date.now()}@example.com`,
    password: 'NewUser@123',
  },
};

// Test trip data
const TRIPS = {
  everestBaseCamp: {
    name: 'Everest Base Camp Trek',
    slug: 'everest-base-camp-trek',
    id: 2951,
    destination: 'Nepal',
    minPrice: 50,
    duration: '14 Days',
    difficulty: 'Challenging',
  },
  tigerNest: {
    name: 'Tiger Nest Monastery Tour in Bhutan',
    slug: 'tiger-nest-monastery-tour-in-bhutan',
    destination: 'Bhutan',
    minPrice: 68,
    duration: '5 Days',
    difficulty: 'Moderate',
  },
};

module.exports = {
  BASE_URL,
  URLS,
  ADMIN_URLS,
  USERS,
  TRIPS,
};
