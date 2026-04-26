# Sprint 3 Planning: Booking Lifecycle & Analytics

## Objective
Sprint 3 focuses on completing the booking lifecycle management (cancel and extend), introducing revenue analytics, and providing a visual map display for the scooter fleet.

## Target Backlog Items
- **ID 12**: Cancel booking (Priority 1)
- **ID 19**: View weekly income for rental options: 1hr, 4hr, 1day, 1week (Priority 1)
- **ID 11**: Option to extend current booking (Priority 2)
- **ID 18**: Display the five scooter locations on a visual map (Priority 2)

## Database Design

### Booking cancellation (ID 12)
No schema change required. Cancellation sets `bookings.status` from `active` to `completed` and atomically restores `scooters.status` to `available` within a single SQLite transaction.

### Booking extension (ID 11)
No schema change required. Extension upgrades the `duration_code` and recalculates `total_price` based on `scooter_pricing` for the new duration tier.

### Weekly income (ID 19)
No schema change required. Income is derived from existing `bookings` table, aggregating `total_price` grouped by `duration_code` for a given 7-day window.

## API Design

### `PATCH /api/bookings/:bookingId/cancel`

**Functional responsibilities:**
1. Authenticate the user via session token.
2. Validate that the booking exists, belongs to the authenticated user, and has `active` status.
3. Within a single database transaction:
   - Set `bookings.status = 'completed'`
   - Set `scooters.status = 'available'`
4. Return the updated booking record.

**Response contract:**
- Success (200): `{ success: true, data: { bookingId, scooterId, durationCode, totalPrice, status, ... } }`
- Failure (4xx/5xx): `{ success: false, error: "..." }`

### `PATCH /api/bookings/:bookingId/extend`

**Functional responsibilities:**
1. Authenticate the user.
2. Validate: booking exists, belongs to user, status is `active`.
3. Validate: `newDurationCode` is strictly longer than the current duration.
4. Look up new price from `scooter_pricing`.
5. Update `duration_code` and `total_price` on the booking row.
6. Return updated booking with `previousDuration` and `previousPrice` for reference.

**Response contract:**
- Success (200): `{ success: true, data: { ...booking, previousDuration, previousPrice } }`

### `GET /api/bookings/income/weekly?weekStart=YYYY-MM-DD`

**Functional responsibilities:**
1. Authenticate the user.
2. Accept optional `weekStart` query parameter (defaults to current Monday).
3. Aggregate `total_price` by `duration_code` for bookings created within the 7-day window.
4. Return income breakdown per plan, booking counts, and grand total.

**Response contract:**
- Success (200): `{ success: true, data: { weekStart, weekEnd, income: { oneHour, fourHours, oneDay, oneWeek }, counts: { ... }, grandTotal } }`

## Frontend Integration

### My Bookings enhancements (ID 12, ID 11)
- **Cancel button** appears on every active booking card, styled with a distinct error-coloured secondary appearance.
- **Extend button** opens an inline duration selector showing only plans longer than the current one, with Confirm and Cancel actions.

### Income dashboard (ID 19)
- New `/income` route and navigation tab.
- Week navigator (previous/next) controls the query window.
- Four income cards (1hr, 4hr, 1day, 1week) display per-plan revenue and booking count.
- Grand total summary card at the bottom.

### Scooter map (ID 18)
- New `/map` route and navigation tab.
- Leaflet.js map centred on Leeds (53.8008, −1.5491) using free OpenStreetMap tiles.
- Colour-coded circle markers per scooter (green = available, blue = in_use, amber = reserved, red = maintenance, grey = offline).
- Popup on marker click shows scooter ID, status, location, and starting hourly rate.
- Colour legend above the map.
