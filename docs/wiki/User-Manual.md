# User Manual

This manual explains how to use the E-Scooter Hire platform from both end-user and administrator perspectives. It is designed as a practical, step-by-step guide for coursework demonstration, usability testing, and final project handover.

---

## Customer Guide

### 1) Create a New Customer Account
1. Open the application landing page.
2. On the authentication screen, locate the **"New customer"** panel.
3. Enter:
   1. Full name
   2. Email address
   3. **Account type** — Standard, Student, or Senior (student/senior receive 20% off hire plans)
   4. Password
   5. Confirm password
4. If needed, use the password visibility toggle to show/hide password text.
5. Ensure both password fields match and satisfy the minimum length requirement.
6. Click **Create account**.
7. On success, you are automatically signed in and redirected to the customer home page (`/map`).

[Insert Screenshot of Customer Registration Form here]
[Insert Screenshot of Password Mismatch Validation Message here]

### 2) Sign In as an Existing Customer
1. From the authentication screen, use the **Sign In** panel.
2. Enter your email and password.
3. Click **Log in**.
4. After successful authentication, the system loads the customer route set and redirects to the map view.

[Insert Screenshot of Customer Login Panel here]

### 3) Navigate the Customer Interface
1. Confirm the top navigation shows customer options:
   1. **Map**
   2. **Fleet**
   3. **My Bookings**
   4. **My Cards**
   5. **Profile**
   6. **Report Issue**
2. Verify the role label in the brand area reflects your account type (e.g. **Customer**, **Student**, **Senior**).
3. Use the navigation tabs to move between customer features.

[Insert Screenshot of Customer Navigation Bar here]

### 4) View Scooter Locations on the Map
1. Click **Map** in the navigation bar.
2. Wait for scooter markers to load on the map.
3. Review marker colours to understand scooter status:
   1. Green = Available
   2. Blue = In Use
   3. Amber = Reserved
   4. Red = Maintenance
   5. Grey = Offline
4. Click a marker to open details (scooter ID, status, location, hourly rate).
5. Refer to the legend above the map for status interpretation.

[Insert Screenshot of Map with Colour Legend here]
[Insert Screenshot of Marker Popup Details here]

### 5) View Fleet and Hire Pricing
1. Click **Fleet** in the navigation bar.
2. In **Choose a vehicle**, review scooter cards (ID, status, location, starting rate).
3. Click **Select** on a scooter to highlight it for pricing comparison.
4. In **Hire plans**, compare prices for:
   1. 1 hour
   2. 4 hours
   3. 1 day
   4. 1 week
5. Review the **Fleet availability overview** panel for count-by-status summary.

[Insert Screenshot of Fleet List and Scooter Cards here]
[Insert Screenshot of Hire Plans Panel here]
[Insert Screenshot of Fleet Availability Overview here]

### 6) Manage Saved Cards (My Cards)
1. Click **My Cards** in the navigation bar.
2. To add a card, complete all card fields and click **Save card**.
3. Only **simulator test cards** work for bookings in this coursework build (`4242 4242 4242 4242` or `4000 0000 0000 0002`). Other numbers can be saved but show a warning and cannot be charged.
4. Saved cards display **brand** and **last four digits** only — full numbers are never stored.
5. Use **Remove** to delete a saved card from your account.

[Insert Screenshot of My Cards Page here]

### 7) Update Account Type (Profile)
1. Click **Profile** in the navigation bar.
2. Review your current account type.
3. Select **Standard**, **Student**, or **Senior** as appropriate.
4. Click **Save account type** (issues a new session token with the updated type).
5. Student and senior types qualify for a **20% discount** on hire plans, applied automatically at checkout.

[Insert Screenshot of Profile Account Type here]

### 8) Book a Scooter (Simulated Payment)
1. In Fleet view, click **Book now** on an available scooter.
2. In the booking modal:
   1. Confirm scooter details
   2. Select a hire duration
   3. Review the **price preview** (list price, any discount, and total to pay)
   4. Choose **saved card** (re-enter **CVV** required) or **enter new card** details:
      1. Cardholder name
      2. Card number (16 digits)
      3. Expiry date (MM/YY)
      4. CVV (3-4 digits)
3. Click **Confirm booking** (disabled until payment fields are valid).
4. On success, read the confirmation details:
   1. Booking ID
   2. Scooter ID
   3. Hire plan
   4. List price and total paid (if a discount applied)
   5. Discount reason (student, senior, or frequent rider)
   6. Booking status
   7. Payment status/reference
5. Return to Fleet/My Bookings to verify the booking appears as active.

**Discounts (ID22):** 20% off for student/senior account types and for frequent riders (8+ hire hours in the last 7 days). Frequent-rider status is calculated on the server when you book.

[Insert Screenshot of Booking Modal here]
[Insert Screenshot of Booking Confirmation Card here]

### 9) View Booking History
1. Click **My Bookings** in the navigation bar.
2. Review all bookings shown in reverse chronological order.
3. For each booking card, check:
   1. Booking ID
   2. Scooter ID
   3. Duration
   4. Total price
   5. Status (Active/Completed)
   6. Created time

[Insert Screenshot of My Bookings Page here]

### 10) Cancel an Active Booking
1. In **My Bookings**, locate a booking with status **Active**.
2. Click **Cancel Booking**.
3. Wait for the success message.
4. Confirm:
   1. Booking status changes to **Completed**
   2. The scooter becomes available again in fleet listings

[Insert Screenshot of Cancel Booking Button here]
[Insert Screenshot of Post-Cancel Success Message here]

### 11) Extend an Active Booking
1. In **My Bookings**, locate an active booking with extension options.
2. Click **Extend**.
3. Choose a longer duration from the dropdown.
4. Click **Confirm**.
5. Verify the success message shows the updated duration and new total price.
6. Confirm the booking card reflects the updated plan.

[Insert Screenshot of Extend Booking Dropdown here]
[Insert Screenshot of Extend Booking Success Message here]

### 12) Log Out
1. Click **Logout** in the top navigation.
2. Confirm the app returns to the authentication screen.
3. Verify no protected customer page is accessible without signing in again.

[Insert Screenshot of Logout Button and Auth Screen Redirect here]

---

## System Administrator Guide

### 1) Sign In as Administrator
1. Open the authentication page.
2. In the **Sign In** form, enter administrator credentials.
3. Click **Log in**.
4. On success, the system redirects to `/admin/bookings`.
5. Confirm the navigation shows admin-only sections:
   1. Bookings
   2. Fleet Manage
   3. Issues
   4. Income

[Insert Screenshot of Admin Login here]
[Insert Screenshot of Admin Navigation Dashboard here]

### 2) Review Booking Oversight Dashboard
1. Open **Bookings** in the admin navigation.
2. Use filters as needed:
   1. Status (All/Active/Completed)
   2. Scooter ID
3. Click **Reset filters** to clear current filter state.
4. Review dashboard summary metrics:
   1. Total bookings
   2. Active bookings
   3. Completed bookings
   4. Revenue total (filtered set)
5. Inspect individual booking cards for user, scooter, plan, pricing, and timestamps.

[Insert Screenshot of Admin Bookings Filters here]
[Insert Screenshot of Admin Booking Summary Metrics here]
[Insert Screenshot of Admin Booking Card Detail here]

### 3) View Weekly Income Analytics
1. Open **Income** in admin navigation.
2. Review income cards for each hire plan:
   1. 1 Hour
   2. 4 Hours
   3. 1 Day
   4. 1 Week
3. Inspect the weekly bar chart for comparative performance.
4. Use **Previous** and **Next** buttons to move between weekly windows.
5. Check the displayed grand total at the bottom.

[Insert Screenshot of Income Cards here]
[Insert Screenshot of Weekly Income Bar Chart here]
[Insert Screenshot of Week Navigation Controls here]

### 4) Manage Fleet (Add / Edit / Retire / Re-activate)

#### 4.1 Add a New Scooter
1. Open **Fleet Manage**.
2. Click **Add scooter**.
3. Fill in all required fields:
   1. Scooter ID
   2. Status
   3. Location description
   4. Latitude and longitude
   5. Pricing for 1 hour / 4 hours / 1 day / 1 week
4. Click **Add scooter** to submit.
5. Confirm success notification and verify the new scooter appears in the list.

[Insert Screenshot of Add Scooter Form here]
[Insert Screenshot of Add Scooter Success Message here]

#### 4.2 Edit an Existing Scooter
1. In Fleet Manage, locate the target scooter card.
2. Click **Edit scooter**.
3. Update status, location, coordinates, or pricing as needed.
4. Click **Save changes**.
5. Confirm success feedback and updated card values.

[Insert Screenshot of Edit Scooter Inline Form here]
[Insert Screenshot of Save Changes Confirmation here]

#### 4.3 Retire a Scooter
1. Locate a non-retired scooter.
2. Click **Retire**.
3. Confirm the retirement action when prompted.
4. Verify:
   1. The scooter is marked retired in admin view
   2. The scooter no longer appears in customer public fleet/map listing

[Insert Screenshot of Retire Confirmation Dialog here]
[Insert Screenshot of Retired Scooter State in Admin List here]

#### 4.4 Re-activate a Retired Scooter
1. Locate a retired scooter in admin fleet list.
2. Click **Re-activate**.
3. Confirm or adjust fields in the edit form (status prefilled to operational state).
4. Save changes.
5. Verify the scooter is available again in operational listings.

[Insert Screenshot of Re-activate Action here]
[Insert Screenshot of Reactivated Scooter Status here]

### 5) Triage Issues / Feedback
1. Open **Issues** in admin navigation.
2. Use filters:
   1. Status (All/Open/Resolved)
   2. Priority (All/Low/High)
3. Review issue cards (ID, scooter, reporter, priority, status, description).
4. For priority management:
   1. Click **Escalate** to set priority to high
   2. Click **De-escalate** to set priority to low
5. For lifecycle management:
   1. Click **Resolve** to mark issue resolved
   2. Click **Reopen** to return issue to open state
6. Confirm success message and refreshed issue state after each action.

[Insert Screenshot of Issues Filter Bar here]
[Insert Screenshot of Issue Card with Escalate/Resolve Buttons here]
[Insert Screenshot of Issue Status/Priority Update Confirmation here]

### 6) Administrator Logout
1. Click **Logout** in the top-right navigation area.
2. Confirm redirection to the authentication screen.
3. Verify admin routes are inaccessible until the next successful admin login.

[Insert Screenshot of Admin Logout and Redirect here]

---

## Notes and Best Practices
1. Use valid data formats for all forms (especially pricing, coordinates, and payment fields).
2. If an action fails, read the displayed error message and retry with corrected input.
3. Privileged operations (fleet management, issues triage, analytics) require administrator privileges; UI access alone is not a substitute for backend authorisation.
4. Keep screenshots up to date with the final submitted UI to maintain documentation fidelity.

