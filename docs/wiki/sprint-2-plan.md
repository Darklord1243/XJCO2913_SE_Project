# Sprint 2 Plan: Booking Mechanism

## Objective
Sprint 2 focuses on implementing the core booking mechanism to support end-to-end scooter reservation and payment simulation workflows.

## Target Backlog Items
- **ID 5**: Booking flow initiation and confirmation.
- **ID 6**: Payment process simulation.
- **ID 8**: Booking persistence and record management.
- **ID 10**: Scooter state update during booking lifecycle.

## Architecture Scope

### 1) Database Updates (SQLite)
Introduce a new `bookings` table linked to existing `users` and `scooters` entities.

#### Proposed table responsibilities
- Store booking ownership (`userId`).
- Store scooter linkage (`scooterId`).
- Store booking duration/plan selection.
- Store total calculated price.
- Track booking status (`active`, `completed`).
- Track timestamps for auditability.

#### Proposed schema direction
- `id` (primary key)
- `user_id` (foreign key -> `users.id`)
- `scooter_id` (foreign key -> `scooters.scooter_id`)
- `duration_code` (enum-like text: `oneHour`, `fourHours`, `oneDay`, `oneWeek`)
- `total_price` (numeric)
- `status` (text: `active` or `completed`)
- `created_at`, `updated_at`

## 2) Backend API Design

### Route
- `POST /api/bookings`

### Functional responsibilities
1. **Verify user token**
   - Validate authentication token from request headers.
   - Resolve authenticated user context (`userId`).
2. **Check scooter availability**
   - Query scooter by `scooterId`.
   - Reject request if scooter is not `available`.
3. **Calculate booking price**
   - Determine price using selected duration (`1hr`, `4hr`, `1day`, `1week`) and scooter pricing.
4. **Simulate payment success (ID 6)**
   - Perform deterministic payment simulation step.
   - Return failure response if simulation fails (extensible for future payment integration).
5. **Insert booking record (ID 8)**
   - Create booking row with status `active`.
6. **Update scooter status (ID 10)**
   - Update scooter from `available` to `in_use` (or agreed canonical value).
7. **Return success payload**
   - Include booking summary, computed total, and updated scooter status.

### Transaction requirements
Use a single database transaction for:
- booking insert
- scooter status update

If any step fails, rollback all changes.

### Suggested response contract
- **Success (201)**
  - `{ success: true, data: { bookingId, scooterId, duration, totalPrice, status } }`
- **Failure (4xx/5xx)**
  - `{ success: false, error: "..." }`

## 3) Frontend UI Plan

### ScooterList integration
- Add a **Book Now** action per scooter card.
- Enable only when scooter status is `available`.

### Booking modal workflow
1. User clicks **Book Now**.
2. Modal opens with:
   - duration selection (`1hr`, `4hr`, `1day`, `1week`)
   - simulated payment input fields
3. User confirms booking.
4. Frontend sends `POST /api/bookings`.
5. On success:
   - show confirmation feedback
   - refresh scooter availability view

### My Bookings dashboard
- Add a dedicated section/page for authenticated users:
  - list bookings
  - display status (`active`, `completed`)
  - show scooter reference, duration, total price, booking time

## 4) Engineering Notes
- Keep modular architecture:
  - `routes/bookings.js`
  - booking service/helper layer for price + payment simulation
- Reuse existing auth/session mechanism for token handling.
- Preserve consistent API error shape and Prettier formatting standards.

## 5) Acceptance Criteria (Sprint 2)
- Booking API accepts authenticated requests and creates valid booking records.
- Scooter availability changes immediately after successful booking.
- Payment simulation is integrated in the booking flow.
- Frontend supports booking initiation via modal and shows booking outcomes.
- Users can view their booking history in a **My Bookings** dashboard.
