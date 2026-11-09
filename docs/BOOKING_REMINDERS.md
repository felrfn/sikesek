# Facility Booking Reminders

Operational reminders for **venue** and **homestay** bookings, delivered
through the same Firebase Cloud Messaging pipeline as KTR alerts and stored
in the same durable `notifications` inbox.

Edutrip is intentionally out of scope.

## Policy

| Event | Booking condition | Timing | Recipients |
|---|---|---|---|
| `BOOKING_ENDING_SOON` | `CHECKED_IN` | 15 minutes before the rental's `validUntil` | Every active field officer |
| `BOOKING_CHECKIN_OVERDUE` | `CONFIRMED` (never checked in) | After the check-in deadline, before the rental's `validUntil` | Every active field officer |

Check-in deadlines:

- **Homestay** - 2 hours after `validFrom` (`HOMESTAY_CHECK_IN_HOUR`, currently
  13:00 WIB, so the deadline is 15:00 WIB).
- **Venue** - 15 minutes after `validFrom` (the booking's start time).

The policy lives in `src/lib/bookingNotificationPolicy.ts`. Change the grace
constants there if operations wants a different window.

Only bookings whose transaction is `PAID` or `PARTIALLY_REFUNDED` are
considered. A reminder **does not** change the booking or payment status - it
is an alert for field officers, not an automatic cancellation or checkout.

## Cron

```text
GET /api/cron/bookings
Authorization: Bearer <CRON_SECRET>
```

Configure the scheduler (Vercel Cron, platform cron, GitHub Actions, etc.) to
call it once a day (e.g. `0 4 * * *`). It fails closed when `CRON_SECRET` is
unset, matching `GET /api/cron/payments`.

Each logical event is claimed in `booking_notification_events`, whose unique
key is `(booking_type, booking_id, event_type)`. That makes the daily job
idempotent: overlapping or retried runs cannot send the same reminder twice.
Notification rows are still written per recipient, so the in-app inbox remains
the fallback when FCM is unavailable.

## FCM data contract

All values are strings. The client should re-fetch current booking state from
the REST API instead of treating this payload as authoritative.

### `BOOKING_ENDING_SOON`

```json
{
  "type": "BOOKING_ENDING_SOON",
  "bookingType": "venue",
  "bookingId": "ae2771c6-0a75-4f8b-ba06-c30127dfe2d9",
  "invoiceNumber": "INV-20261101-001",
  "facilityName": "Aula Utama",
  "validUntil": "2026-11-01T10:00:00.000Z"
}
```

### `BOOKING_CHECKIN_OVERDUE`

```json
{
  "type": "BOOKING_CHECKIN_OVERDUE",
  "bookingType": "homestay",
  "bookingId": "28a24ecd-06d4-41ac-983c-63e285382882",
  "invoiceNumber": "INV-20261101-002",
  "facilityName": "Homestay Melati",
  "checkInDeadline": "2026-11-01T08:00:00.000Z"
}
```

There is deliberately no `imageUrl`.

## In-app inbox

`GET /api/mobile/notifications` now returns both KTR and booking rows:

```json
{
  "items": [
    {
      "id": "notification-1",
      "type": "BOOKING_ENDING_SOON",
      "title": "Sewa fasilitas hampir berakhir",
      "body": "Sewa Aula Utama untuk Sari berakhir dalam 15 menit...",
      "sentAt": "2026-11-01T09:45:00.000Z",
      "readAt": null,
      "detection": null,
      "booking": {
        "bookingType": "venue",
        "bookingId": "ae2771c6-0a75-4f8b-ba06-c30127dfe2d9",
        "invoiceNumber": "INV-20261101-001",
        "eventType": "BOOKING_ENDING_SOON",
        "facilityName": "Aula Utama",
        "customerName": "Sari",
        "validUntil": "2026-11-01T10:00:00.000Z"
      }
    }
  ]
}
```

KTR rows keep `detection` populated and `booking: null`.

## Mobile checklist

- Register the FCM token with `POST /api/mobile/push-tokens` on every launch
  and whenever FCM rotates it.
- Create an Android notification channel and request `POST_NOTIFICATIONS`
  permission on Android 13+.
- The backend sends a `notification` payload, so Android can display it while
  the app is backgrounded or swiped away. For foreground messages, show a
  local notification from `FirebaseMessaging.onMessage`.
- Handle taps for both event types. Deep-link using `bookingType` +
  `bookingId`; keep the in-app notification list as the fallback. There is
  currently no dedicated mobile booking-detail endpoint, so route to the
  facility monitoring / availability screen and use the id as context. Add a
  dedicated `GET /api/mobile/bookings/:type/:id` later if the UI needs the full
  record.
- Do not cache or trust `facilityName`/deadline strings as booking state. Fetch
  fresh state from the relevant REST endpoint when the screen opens.
- Re-register the token after logout/login on a shared device. (A dedicated
  unregister endpoint is not implemented yet.)
