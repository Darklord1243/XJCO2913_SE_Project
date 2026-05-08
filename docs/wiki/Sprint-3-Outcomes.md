# Sprint 3 Outcomes: Booking Lifecycle & Analytics

## Sprint Goal
Complete the booking lifecycle with cancellation and extension capabilities, introduce weekly revenue analytics, and deliver an interactive scooter map.

## Completed Backlog Items
- **ID 12**: Cancel booking.
- **ID 19**: View weekly income for rental options (1hr, 4hr, 1day, 1week).
- **ID 11**: Option to extend current booking.
- **ID 18**: Display the five scooter locations on a visual map.

## Technical Achievements

1. **Cancel Booking (ID 12)**: Implemented `PATCH /api/bookings/:bookingId/cancel` with atomic SQLite transactions that simultaneously set the booking to `completed` and restore the scooter to `available`. The frontend "My Bookings" page now shows a Cancel button on every active booking with real-time status feedback.

2. **Extend Booking (ID 11)**: Implemented `PATCH /api/bookings/:bookingId/extend` with server-side duration rank validation ensuring only longer plans are permitted. The frontend provides an inline dropdown selector showing available upgrade options, with price recalculation from the authoritative `scooter_pricing` table.

3. **Weekly Income Analytics (ID 19)**: Implemented `GET /api/bookings/income/weekly` endpoint that aggregates booking revenue grouped by `duration_code` over a configurable 7-day window. A new `/income` dashboard page displays four income cards (one per hire plan), individual booking counts, and a grand total summary. Users can navigate between weeks using Previous/Next controls.

4. **Visual Map Display (ID 18)**: Integrated Leaflet.js with OpenStreetMap tiles to render an interactive map centred on Leeds. All scooter locations are plotted as colour-coded circle markers (green for available, blue for in-use, amber for reserved, red for maintenance, grey for offline). Clicking a marker opens a popup with scooter ID, status, location description, and starting hourly rate.

## Progress Summary

| ID | Description | Priority | Status |
|---|---|---|---|
| 12 | Cancel booking | 1 | ✅ Complete |
| 19 | View weekly income for rental options | 1 | ✅ Complete |
| 11 | Option to extend current booking | 2 | ✅ Complete |
| 18 | Display scooter locations on visual map | 2 | ✅ Complete |

## Cumulative Progress After Sprint 3

All **8 Priority-1** backlog items are now complete:
- Sprint 1: ID 1, ID 4, ID 16/17
- Sprint 2: ID 5, ID 6, ID 8, ID 10
- Sprint 3: ID 12, ID 19

Additionally, **3 Priority-2** items have been completed (ID 11, ID 17, ID 18).
