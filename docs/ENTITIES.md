# Entity Groups by Feature

Canonical entity names in this document are the Prisma model names from
[`prisma/schema.prisma`](../prisma/schema.prisma). Grouping answers one
question only: *which entities take part in each important feature?* Fields,
constraints, and lifecycle details stay in the schema and in the per-feature
docs ([PAYMENT](./PAYMENT.md), [KTR_INGEST](./KTR_INGEST.md),
[BOOKING_REMINDERS](./BOOKING_REMINDERS.md),
[MOBILE_API](./MOBILE_API.md)).

## 1. KTR (Kawasan Tanpa Rokok) - violations

| Entity | Role in the feature |
| --- | --- |
| `MonitoredArea` | The registered no-smoking area / camera location a violation is reported against |
| `SmokingDetection` | The violation record itself (evidence, status, assignment and resolution links) |
| `KtrAssignment` | The task linking one violation to one or more field officers |
| `User` | Admin/field officer: area owner, assigner, assignee, handler, resolver |
| `UserFcmToken` | Push targets for field officers notified about a new violation |
| `WorkerSchedule` | Worker availability/leave, consulted when assigning officers |
| `Notification` | Durable inbox entry for the violation notification |
| `AuditLog` | Trail of assignment, handling, and resolution actions |

## 2. Payments and recapitulation

| Entity | Role in the feature |
| --- | --- |
| `Transaction` | Invoice header and the source of truth for payment status, deadline, and refunded total |
| `TransactionHomestay`, `TransactionVenue`, `TransactionEdutrip` | Booked lines whose status is confirmed/cancelled along with the payment |
| `Refund` | Refund attempt history (manual admin refunds and automatic late-payment refunds) |
| `Ticket` | Issued as a result of a PAID transaction |
| `User` | Admin requesting a refund; field officer verifying a ticket |
| `AuditLog` | Payment status changes, late-payment handling, and refund actions |

Recapitulation (admin payment reports and dashboards) is derived from
`Transaction`, `Refund`, and the three booking-line entities - there is no
separate summary table.

## 3. Booking

All three booking types share the `Transaction` header and produce `Ticket`
rows. What differs is the catalog and the booking-line entity.

### 3a. Homestay

| Entity | Role in the feature |
| --- | --- |
| `Transaction` | Invoice header for the stay |
| `TransactionHomestay` | One booked homestay unit: dates, nights, extra beds, price, booking status |
| `Homestay` | The bookable unit (capacity, room/bed counts, price tiers) |
| `HomestaySpecialPrice` | Date-specific price override |
| `Holiday` | Closed dates and holiday pricing tier |
| `Facility` | Shared amenity catalog |
| `HomestayFacility` | Amenities attached to a homestay |
| `FacilityPhoto` | Public gallery images |
| `Ticket` | Entry/check-in ticket for the stay |
| `User` | Staff who checks the ticket in |

### 3b. Venue

| Entity | Role in the feature |
| --- | --- |
| `Transaction` | Invoice header for the venue booking |
| `TransactionVenue` | One booked venue slot: date, start/end time, hours, price, booking status |
| `Venue` | The bookable venue (capacity, hourly price) |
| `VenueAvailableDay` | Which weekdays the venue can be booked |
| `Holiday` | Closed dates affecting availability |
| `FacilityPhoto` | Public gallery images |
| `Ticket` | Entry ticket for the slot |
| `User` | Staff who checks the ticket in |

### 3c. Edutrip

| Entity | Role in the feature |
| --- | --- |
| `Transaction` | Invoice header for the visit |
| `TransactionEdutrip` | One booked package visit: date, pax count, price, booking status |
| `EdutripPackage` | The bookable package |
| `Activity` | Master list of included activities |
| `EdutripPackageActivity` | Activities included in a package, with per-package overrides |
| `Holiday` | Closed dates affecting availability |
| `Ticket` | Entry ticket for the visit |
| `User` | Staff who checks the ticket in |

## 4. Cross-cutting entities

| Entity | Used by |
| --- | --- |
| `User` | Authentication, KTR, bookings, payments, auditing |
| `Notification` | KTR violation alerts and booking reminders |
| `BookingNotificationEvent` | Idempotency key for booking reminders |
| `AuditLog` | Every admin/system mutation worth tracing |
| `Holiday` | Availability and pricing across all booking types |

## 5. Entity-to-feature matrix

| Entity | KTR | Payments | Homestay | Venue | Edutrip |
| --- | :-: | :-: | :-: | :-: | :-: |
| `User` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `UserFcmToken` | ✓ | | | | |
| `MonitoredArea` | ✓ | | | | |
| `SmokingDetection` | ✓ | | | | |
| `KtrAssignment` | ✓ | | | | |
| `WorkerSchedule` | ✓ | | | | |
| `Notification` | ✓ | | ✓ | ✓ | ✓ |
| `BookingNotificationEvent` | | | ✓ | ✓ | ✓ |
| `Transaction` | | ✓ | ✓ | ✓ | ✓ |
| `Refund` | | ✓ | | | |
| `TransactionHomestay` | | ✓ | ✓ | | |
| `TransactionVenue` | | ✓ | | ✓ | |
| `TransactionEdutrip` | | ✓ | | | ✓ |
| `Homestay` | | | ✓ | | |
| `HomestaySpecialPrice` | | | ✓ | | |
| `HomestayFacility` | | | ✓ | | |
| `Facility` | | | ✓ | | |
| `Venue` | | | | ✓ | |
| `VenueAvailableDay` | | | | ✓ | |
| `EdutripPackage` | | | | | ✓ |
| `Activity` | | | | | ✓ |
| `EdutripPackageActivity` | | | | | ✓ |
| `FacilityPhoto` | | | ✓ | ✓ | |
| `Holiday` | | | ✓ | ✓ | ✓ |
| `Ticket` | | ✓ | ✓ | ✓ | ✓ |
| `AuditLog` | ✓ | ✓ | ✓ | ✓ | ✓ |
