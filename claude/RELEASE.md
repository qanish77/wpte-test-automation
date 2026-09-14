# WP Travel Engine — Release Testing Checklist

This checklist is version-agnostic and designed for testing any WP Travel Engine release (v6.8.x+).

---

## Pre-Release Verification

### 1. Environment Setup
- [ ] Test site is accessible at configured BASE_URL
- [ ] Admin credentials are valid in .env
- [ ] Test user credentials are valid in .env
- [ ] All required add-ons are installed on test site
- [ ] Test trips (Everest Base Camp, Tiger Nest) exist and are published

### 2. Run Baseline Tests
- [ ] `npm run test:smoke` — quick sanity check (~2 min)
- [ ] `npm run test:release` — full suite on primary browser (~15 min)
- [ ] All baseline tests pass before new testing

---

## Core Functionality Testing

### 3. Trip Listing & Discovery
- [ ] Homepage loads with featured trips
- [ ] Trip listing page (/trip/) shows grid/list of trips
- [ ] Search functionality works
- [ ] Filter by destination works
- [ ] Filter by trip type works
- [ ] Pagination works (if > trips per page)

### 4. Trip Detail Page
- [ ] Trip page loads with correct title and price
- [ ] All tabs are clickable and show content:
  - [ ] Overview tab
  - [ ] Itinerary tab
  - [ ] Cost tab
  - [ ] FAQs tab
  - [ ] Map tab
  - [ ] Dates tab (if FSD active)
- [ ] Image gallery displays
- [ ] Trip sidebar shows price
- [ ] Book Now button is visible and functional

### 5. Booking Flow
- [ ] Clicking Book Now opens booking modal/form
- [ ] Traveler count can be modified
- [ ] Date selection works (calendar or FSD dates)
- [ ] Price updates based on selections
- [ ] Enquiry form is accessible (optional path)

### 6. Checkout Page
- [ ] Checkout page loads at /checkout/
- [ ] With valid booking session: billing form is visible
- [ ] Without booking session: shows meaningful WTE message (not crash)
- [ ] All billing fields are present and editable
- [ ] Payment method selection works
- [ ] Coupon code field is present

### 7. Thank You Page
- [ ] Thank you page loads at /booking-confirmation/
- [ ] Booking details are displayed
- [ ] "Book More" button works

---

## Add-On Testing

### 8. Fixed Starting Dates (FSD)
- [ ] Dates tab shows available departure dates
- [ ] Each date shows price and availability
- [ ] Month filtering works
- [ ] "Show More" button reveals additional dates
- [ ] Book Now on date starts booking for that departure

### 9. Group Discount
- [ ] Discount badge shows percentage
- [ ] Price changes when traveler count increases
- [ ] Discounted and regular prices both visible
- [ ] Works on multiple trips

### 10. Extra Services
- [ ] Extra services section in booking form
- [ ] Services can be selected/deselected
- [ ] Price updates when services added

### 11. Partial Payment / Installments
- [ ] Installment plugin assets load on checkout
- [ ] Payment options include partial/installment
- [ ] Deposit amount is clearly shown

### 12. Travel Insurance
- [ ] Insurance option visible in booking
- [ ] Price is shown
- [ ] Can be toggled (if optional)

### 13. Pick Up Point
- [ ] Pickup location field in booking form
- [ ] Dropdown shows available locations

### 14. Accommodation
- [ ] Accommodation options in booking form
- [ ] Room type selection works

---

## Admin Testing

### 15. WP Admin Login
- [ ] /wp-admin/ shows login form
- [ ] Valid credentials log in successfully
- [ ] Invalid credentials show error message

### 16. WTE Settings
- [ ] Settings page loads at correct URL
- [ ] Currency selector works
- [ ] Checkout page setting is configured
- [ ] Save button works

### 17. Trip Management
- [ ] Trip list page shows all trips
- [ ] Can edit existing trip
- [ ] Trip edit page has all expected sections
- [ ] Add-on settings per trip are accessible

---

## Edge Cases & Error Handling

### 18. Error Conditions
- [ ] Invalid trip slug shows 404/error gracefully
- [ ] Direct checkout without booking shows message (not crash)
- [ ] /booking/ URL redirects appropriately
- [ ] /travel-booking/ returns 404

### 19. Form Validation
- [ ] Empty required fields show validation errors
- [ ] Invalid email format is rejected
- [ ] Invalid traveler count handled gracefully

### 20. Mobile & Responsive
- [ ] Trip page works on mobile viewport (375px)
- [ ] Book Now button accessible on mobile
- [ ] Tabs scroll horizontally if needed
- [ ] Price visible without excessive scrolling

### 21. Navigation
- [ ] Tab switching doesn't cause JS errors
- [ ] Browser back button works correctly
- [ ] All internal links are valid

---

## Performance & Security

### 22. Performance
- [ ] Page loads within 10 seconds
- [ ] No excessive console errors
- [ ] No memory leaks on page navigation

### 23. Security
- [ ] XSS in search doesn't execute
- [ ] Invalid URLs don't expose sensitive data

---

## Cross-Browser Testing (if applicable)

### 24. Browser Compatibility
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

---

## Post-Release Verification

### 25. Final Checks
- [ ] Full test suite passes on release browser(s)
- [ ] HTML report generated and reviewed
- [ ] Critical failures logged and addressed
- [ ] Test results documented in claude/test-log.md

---

## Notes & Known Issues

*Add any release-specific notes or known issues here:*

| Issue | Status | Notes |
|-------|--------|-------|
| | | |
| | | |

---

## Running Tests

```bash
# Quick smoke test
npm run test:smoke

# Full release test
npm run test:release

# Specific test categories
npm run test:trips
npm run test:booking
npm run test:addons
npm run test:admin

# Single file
npx playwright test tests/addons/fsd.spec.js

# Open report
npm run report
```

---

## Version-Specific Notes

### v6.8.5 Release Notes Analysis

> *Since the GitHub API was unavailable, the following is based on typical WTE release patterns. 
> Adjust based on actual changelog when available.*

**Expected Changes in v6.8.5:**
- Bug fixes and performance improvements
- Potential new add-on features
- Security patches
- UI/UX refinements

**Test Focus Areas:**
1. Verify all existing functionality still works
2. Test any new features mentioned in changelog
3. Check for breaking changes in booking flow
4. Validate admin settings changes

---

## Quick Reference: Test Commands

| Test Area | Command | Time |
|-----------|---------|------|
| Smoke | `npm run test:smoke` | ~2 min |
| Full Release | `npm run test:release` | ~15 min |
| Trips Only | `npm run test:trips` | ~3 min |
| Booking Only | `npm run test:booking` | ~3 min |
| All Add-ons | `npm run test:addons` | ~5 min |
| Admin Only | `npm run test:admin` | ~3 min |
| Cross-Browser | `npm run test:cross-browser` | ~20 min |

---

*Last updated: 2026-08-05*