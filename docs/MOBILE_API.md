  # SIKESEK Mobile API

  The Next.js app in this repository is both the web admin dashboard and the
  backend for the future field-officer mobile app. This document is written
  for that mobile client's developer - it is the contract, not an
  implementation walkthrough. Every endpoint below is documented with the
  same structure: Method, Purpose, Authentication, Request headers, Request
  parameters, Request payload, Response, Error responses, Validation, and
  Business rules.

  ## Scope: what the mobile app is and isn't for

  Per `.ai/ARCHITECTURE.md` ยง3 and `.ai/PRD.md`, the mobile app is a
  **field-officer** tool, not a customer-facing booking app. Its documented
  responsibilities are: authentication, QR ticket scanning, KTR
  notifications/monitoring, violation handling, facility monitoring, and
  profile. Customers still browse facilities and create bookings only on the
  **public website**, never the mobile app - there is still no "create
  booking" endpoint under `/api/mobile/*`, and this remains a product-scope
  change to raise before building it (CLAUDE.md's own rule).

  One explicit, deliberate exception: `POST /api/mobile/facilities/availability`
  below lets a field officer **check** whether a facility is bookable for a
  date/time, as part of "Facility Monitoring" - it does not let the mobile
  app create, modify, or browse full facility details/pricing, and it
  changes nothing about where a booking is actually made (still the public
  website only). Treat this as narrower than "browse facilities", not a
  reversal of the booking-stays-on-the-website decision above.

  ## Two separate auth systems - don't mix them up

  | | Web admin | Mobile app |
  |---|---|---|
  | Who | `ADMIN` accounts only | `FIELD_OFFICER` accounts only |
  | Mechanism | NextAuth cookie session (`/login`) | Bearer JWT (`/api/mobile/auth/*`) |
  | Enforced in | `src/lib/auth/auth.ts`, `src/proxy.ts` | `src/lib/auth/requireMobileAuth.ts` |

  A `FIELD_OFFICER` account **cannot** obtain a web admin session - the
  Credentials provider rejects any non-`ADMIN` login attempt outright. An
  `ADMIN` account *can* also use the mobile API (useful for support/testing),
  but a field officer can never reach `/admin`. This separation is enforced
  server-side, not just hidden in the UI.

  ## Conventions

  **Base path**: all mobile endpoints are under `/api/mobile/*` on this same
  Next.js deployment (there is no separate mobile API host).

  **Content type**: `Content-Type: application/json` on every request with a
  body. All responses are JSON.

  **Authentication header** (every endpoint below except login/refresh):

  ```
  Authorization: Bearer <accessToken>
  ```

  **Error shape** - every error response, from every endpoint in this
  document, looks like:

  ```json
  { "error": { "code": "SOME_CODE", "message": "Human-readable explanation." } }
  ```

  | `code` | Meaning |
  |---|---|
  | `VALIDATION_ERROR` | Request body failed validation - see the endpoint's Validation section |
  | `UNAUTHORIZED` | Missing `Authorization` header |
  | `INVALID_TOKEN` | The bearer token is malformed or not an access token |
  | `TOKEN_EXPIRED` | The access token's 1-hour lifetime has passed - call refresh |
  | `ACCOUNT_INACTIVE` | The account was soft-deleted or has not been approved by an admin |
  | `ACCOUNT_PENDING_APPROVAL` | Login succeeded credential-wise but an admin hasn't approved the account |
  | `INVALID_CREDENTIALS` | Login username/password didn't match (or, on change-password, the supplied current password was wrong) |
  | `WRONG_CLIENT` | Login attempted with a non-`FIELD_OFFICER` account against the mobile login endpoint |
  | `PASSWORD_CHANGE_REQUIRED` | The account still has its admin-generated password and must call `POST /api/mobile/auth/change-password` before any other endpoint will respond |
  | `NOT_FOUND` | The referenced resource (e.g. a KTR detection id) doesn't exist |
  | `INVALID_BOOKING_STATE` | The requested booking-status transition isn't valid from the booking's current status (e.g. checking out a booking that isn't `CHECKED_IN`) |

  **Token lifetimes**: access token 1 hour, refresh token 30 days. There is
  **no server-side refresh-token revocation list** in this build - once
  issued, a refresh token is valid for its full 30 days. If "log out
  everywhere" becomes a requirement, that's a gap to close (a blocklist
  table keyed by token `jti`, checked in `requireMobileAuth`), documented
  here so it isn't forgotten rather than silently designed around.

  ---

  ## Authentication

  ### `POST /api/mobile/auth/login`

  **Purpose**: Exchange a field officer's username/password for an access +
  refresh token pair.

  **Authentication**: Required: No.

  **Request headers**:
  ```
  Content-Type: application/json
  ```

  **Request parameters**: None (no path or query parameters).

  **Request payload**:
  ```json
  {
    "username": "jane.doe",
    "password": "xK9mPqR2wT"
  }
  ```

  **Response** `200 OK`:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "mustChangePassword": true,
    "user": {
      "id": "e42f1155-3061-4462-b981-e96fd8828b97",
      "name": "Jane Doe",
      "email": "jane.doe@sikesek.gov",
      "username": "jane.doe",
      "role": "FIELD_OFFICER"
    }
  }
  ```

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 400 | `VALIDATION_ERROR` | `username` or `password` missing/malformed |
  | 401 | `INVALID_CREDENTIALS` | No such account, or password didn't match |
  | 403 | `WRONG_CLIENT` | The account exists but its role isn't `FIELD_OFFICER` (e.g. an `ADMIN`-only web account) |
  | 403 | `ACCOUNT_PENDING_APPROVAL` | Credentials are correct, but `User.approvedAt` is still `null` - an admin must approve the account first (web admin's User Management page) |

  **Validation**: `username` and `password` both required, non-empty strings.
  Login is by **username**, not email - this is mobile-specific; the web
  admin login (`/login`) is unaffected and still uses email.

  **Business rules**:
  - Soft-deleted accounts (`deletedAt` set) are treated as `INVALID_CREDENTIALS`, not a distinct error - this avoids revealing whether a username was ever registered.
  - Passwords are checked with bcrypt against `User.hashedPassword`; there is no rate-limiting on this endpoint yet in this build - add one (e.g. per-IP/per-username) before a production launch.
  - **Every account is created by an admin with a randomly-generated password** (the admin never chooses or sees a password they picked themselves - see the web admin's User Management page) - `mustChangePassword: true` in the response means this officer is still on that generated password and must change it before doing anything else. The app should navigate straight to a "set your password" screen whenever this is `true`, before showing any other screen.
  - `mustChangePassword` is also `true` immediately after an admin resets a password (the reset always generates a new random one, same as account creation) - this is not only a first-login-ever situation.

  ---

  ### `POST /api/mobile/auth/change-password`

  **Purpose**: Set the officer's own password, clearing `mustChangePassword`.
  This is the **only** endpoint that works while `mustChangePassword` is
  `true` - every other endpoint rejects with `PASSWORD_CHANGE_REQUIRED` until
  this succeeds.

  **Authentication**: Required: Yes (the token from login - this works even
  while `mustChangePassword` is `true`, unlike every other endpoint).

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```

  **Request payload**:
  ```json
  {
    "currentPassword": "xK9mPqR2wT",
    "newPassword": "a-password-the-officer-chose-themself"
  }
  ```

  **Response** `200 OK`:
  ```json
  { "ok": true }
  ```

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 400 | `VALIDATION_ERROR` | `currentPassword` missing, or `newPassword` shorter than 8 characters |
  | 401 | `INVALID_CREDENTIALS` | `currentPassword` did not match the account's actual current password |
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |

  **Validation**: `currentPassword` required; `newPassword` 8-72 characters.

  **Business rules**:
  - Must be called with the **current** password (the admin-generated one on first use) - a leaked/stolen access token alone cannot be used to lock the real officer out by changing their password without also knowing it.
  - Call this exactly once per forced change; after it succeeds, `mustChangePassword` is cleared and every other endpoint works normally again with the same access token (no need to log in again).
  - There is no password-strength policy enforced beyond the 8-character minimum in this build.

  ---

  ### `POST /api/mobile/auth/refresh`

  **Purpose**: Exchange a still-valid refresh token for a new access token,
  without re-entering credentials.

  **Authentication**: Required: No (the refresh token in the body *is* the credential).

  **Request headers**:
  ```
  Content-Type: application/json
  ```

  **Request payload**:
  ```json
  { "refreshToken": "eyJhbGciOiJIUzI1NiJ9..." }
  ```

  **Response** `200 OK`:
  ```json
  { "accessToken": "eyJhbGciOiJIUzI1NiJ9..." }
  ```

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 400 | `VALIDATION_ERROR` | `refreshToken` missing |
  | 401 | `TOKEN_EXPIRED` | Refresh token's 30-day lifetime has passed - the app must send the user back to login |
  | 401 | `INVALID_TOKEN` | Malformed, or not actually a refresh-type token (e.g. an access token was passed here by mistake) |
  | 403 | `ACCOUNT_INACTIVE` | The account was deactivated or unapproved after the refresh token was issued |

  **Business rules**: The refresh token itself is not rotated on use - the
  same refresh token remains valid until its own expiry. This endpoint only
  mints a new *access* token.

  ---

  ## User

  ### `GET /api/mobile/me`

  **Purpose**: Fetch the authenticated officer's own profile.

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  ```

  **Request parameters**: None.

  **Response** `200 OK`:
  ```json
  {
    "id": "e42f1155-3061-4462-b981-e96fd8828b97",
    "name": "Jane Doe",
    "email": "jane.doe@sikesek.gov",
    "username": "jane.doe",
    "phone": null,
    "role": "FIELD_OFFICER",
    "hasProfileImage": false
  }
  ```

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |
  | 403 | `ACCOUNT_INACTIVE` | Account deactivated since the token was issued |

  **Validation**: N/A (no request body).

  **Business rules**: `hasProfileImage` is a boolean, never a URL - profile
  pictures live under the `private/` R2 prefix (docs/STORAGE.md) and are
  never exposed as a bare link. **Not yet implemented**: an endpoint to
  fetch a signed URL for the profile photo itself, and an endpoint to update
  the profile (name/phone) or change password. Add these the same way
  `GET /api/mobile/ktr`'s `evidenceUrl` is produced (a fresh
  `getSignedPrivateUrl()` call per request) when the mobile UI needs them.

  ---

  ## Facility Availability

  There is exactly **one** mobile endpoint for facility status - this one.
  No separate `facilities/status` concept exists anywhere in this backend;
  if a mobile client was built against that assumption, point it at
  `facilities/availability` below instead. It covers single-date,
  date-range, and (for venues) time-of-day checks all in one contract - see
  "Single date vs. date range" and "Live occupancy/rental status" below.

  ### `POST /api/mobile/facilities/availability`

  **Purpose**: Check which facilities are available or unavailable for a
  date, or across a range of dates (and, for meeting points/venues, an
  optional time range) - "Facility Monitoring" in `.ai/ARCHITECTURE.md` ยง3.
  This is a **check**, not a booking - see the "Scope" note above. It
  reuses the exact same conflict rules the public booking flow enforces
  (`src/features/booking/service.ts`), so "available" here always means the
  same thing it would mean if a visitor tried to book that slot on the
  website right now - single-date and date-range queries share one
  implementation (`getFacilityAvailabilityRange`), so they can never drift
  into two different definitions of "available".

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```

  **Request parameters**: None (path/query) - everything is in the body.

  #### Single date vs. date range

  Provide **exactly one** of `date` (a single day) or `startDate`+`endDate`
  (an inclusive range) - never both, never neither. Both forms accept the
  same optional `category` and `startHour`/`endHour`.

  **Request payload - single date**:
  ```json
  {
    "date": "2026-10-10",
    "category": "venue",
    "startHour": 9,
    "endHour": 11
  }
  ```

  **Request payload - date range** (any span up to 90 days, e.g. "the next
  2 weeks"):
  ```json
  {
    "startDate": "2026-10-10",
    "endDate": "2026-10-23",
    "category": "venue",
    "startHour": 9,
    "endHour": 11
  }
  ```

  - `date` (required unless `startDate`/`endDate` are given): `YYYY-MM-DD`,
    today through 90 days ahead - the same bookable window the public
    website enforces.
  - `startDate` / `endDate` (required together, instead of `date`): both
    `YYYY-MM-DD`, each independently validated against the same
    today-through-90-days window `date` uses, so a range can never reach
    further into the future than a single-date query already could.
    `endDate` must be on or after `startDate`.
  - `category` (optional): `"homestay"` | `"venue"` | `"edutrip"`. Omit to
    get all three categories in one call.
  - `startHour` / `endHour` (optional, **venues only**): integers `0-24`,
    `endHour` strictly greater than `startHour`. Must be given together -
    supplying only one is a validation error. They apply to *every* day in
    the query (the same daily hour window checked on each date) and only
    affect how `venue` `status`/`reason` are evaluated; they have no effect
    on `homestay`/`edutrip` entries, and no effect on `rental` (below).

  **Response** `200 OK` - single date (unchanged shape from before range
  support existed, for backward compatibility):
  ```json
  {
    "date": "2026-10-10",
    "timeRange": { "startHour": 9, "endHour": 11 },
    "facilities": [
      {
        "id": "28a24ecd-06d4-41ac-983c-63e285382882",
        "category": "homestay",
        "name": "AREN 4",
        "status": "AVAILABLE",
        "reason": null,
        "rental": null
      },
      {
        "id": "7c2f9e10-4b3a-4f1e-9b7a-2d6a9b6a1234",
        "category": "venue",
        "name": "Balai Pertemuan",
        "status": "UNAVAILABLE",
        "reason": "ALREADY_BOOKED",
        "rental": {
          "isOccupied": true,
          "bookingId": "ae2771c6-0a75-4f8b-ba06-c30127dfe2d9",
          "customerName": "Rafael",
          "startAt": "2026-10-10T02:00:00.000Z",
          "endAt": "2026-10-10T04:00:00.000Z",
          "remainingSeconds": 5587,
          "isExpired": false
        }
      },
      {
        "id": "9a1b2c3d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
        "category": "edutrip",
        "name": "Susur Sungai",
        "status": "UNAVAILABLE",
        "reason": "INACTIVE",
        "rental": null
      }
    ]
  }
  ```

  **Response** `200 OK` - date range (new; `dates` replaces the flat
  `facilities` array with one entry per day):
  ```json
  {
    "startDate": "2026-10-10",
    "endDate": "2026-10-12",
    "timeRange": null,
    "dates": [
      { "date": "2026-10-10", "facilities": [ /* same per-facility shape as above */ ] },
      { "date": "2026-10-11", "facilities": [ /* ... */ ] },
      { "date": "2026-10-12", "facilities": [ /* ... */ ] }
    ]
  }
  ```

  `timeRange` is `null` when `startHour`/`endHour` were omitted from the
  request, in both response shapes. Every active, non-deleted facility
  across the requested category (or all three, if `category` was omitted)
  is included on every date - both available and unavailable ones, so the
  app can render the complete state in one call rather than needing a
  second request to find out why something is missing.

  #### Live occupancy/rental status (`rental`)

  Every facility entry also carries a `rental` field - this is how the app
  determines **when a currently-occupied facility's rental started, when it
  ends, and how much time is left**, without reconstructing that from raw
  booking fields itself:

  ```ts
  rental: {
    isOccupied: boolean;       // true only while genuinely inside the rental window right now
    bookingId: string;         // pass this straight to POST /api/mobile/bookings/checkout
    customerName: string;      // the visitor's name on this booking (Transaction.customerName)
    startAt: string;           // ISO 8601 - when this rental period started
    endAt: string;             // ISO 8601 - the authoritative checkout/expiration instant
    remainingSeconds: number | null; // seconds until endAt; null whenever isOccupied is false
    isExpired: boolean;        // true once endAt has passed, even if nobody has checked out yet
  } | null
  ```

  `bookingId` is exactly the `bookingId` the "Booking Checkout" section
  below expects - this is the intended way a field officer gets a
  `bookingId` to check a visitor out *from the availability/monitoring
  screen*, not only from a QR scan's `VALID` response.

  - `rental` is `null` whenever there's nothing to report: the facility
    has no `CHECKED_IN` booking on that date, the category is
    `edutrip` (pax-based, never an exclusive occupied slot), or - in a
    date-range response - the date being described isn't **today**
    (Asia/Jakarta). "Remaining time" is only meaningful for the day that's
    actually happening right now; a future date's booking has no countdown
    yet, and a past date's is moot.
  - **`status: "UNAVAILABLE"` / `reason: "ALREADY_BOOKED"` does *not* imply
    `rental` is present.** A facility is `ALREADY_BOOKED` as soon as a
    booking *blocks* the date - including a `PENDING` or `CONFIRMED` one
    where the visitor has not arrived yet. `rental` appears only once that
    booking is actually `CHECKED_IN`. So:
    - `reason: "ALREADY_BOOKED"` + `rental: null` → booked, but nobody has
      checked in. There is nothing to check out; **don't show a Checkout
      button**, and don't treat this as a backend error.
    - `reason: "ALREADY_BOOKED"` + `rental: { ... }` → someone is checked
      in. `rental.bookingId` is what Checkout needs.

    Drive the Checkout button off `rental != null`, never off `status`/
    `reason`.
  - `rental` is present for *any* `CHECKED_IN` booking on today's date,
    including one checked in **before** its nominal start hour (an officer
    or admin can admit a guest early). In that case you get
    `isOccupied: false`, `isExpired: false`, `remainingSeconds: null` - but
    `bookingId`/`customerName`/`startAt`/`endAt` are all still there, so
    checkout works. `CHECKED_IN` - not the clock - is the authority on
    whether a visitor is physically present.
  - When non-`null`, `startAt`/`endAt` are computed fresh from the
    booking's own recorded dates/times (`getHomestayRentalWindow`/
    `getVenueRentalWindow` in `src/lib/bookingWindow.ts`) - the exact same
    calculation used to stamp a QR ticket's `validFrom`/`validUntil` at
    ticket-creation time (see "QR Ticket Verification" below). There is no
    second definition of a booking's rental period anywhere in this
    backend. This also means `rental` is populated correctly even if an
    admin force-checked the booking in manually with no `Ticket` row at all
    (`adminCheckIn`'s fallback path) - it never depends on a `Ticket`
    existing.
  - `startAt`/`endAt` are true UTC instants (standard ISO 8601, `Z`
    suffix) - parse them normally and compare against the device's own
    clock, no manual WIB adjustment needed. (The booking's underlying
    `startHour`/`endHour`/check-in-check-out-hour configuration is defined
    in WIB wall-clock terms, but `bookingWindow.ts` converts that to a real
    UTC instant before it's ever compared against a live clock or returned
    here.)
  - **Use `endAt` as the authoritative expiration instant** - poll or
    re-fetch this endpoint to refresh `remainingSeconds`/`isExpired` rather
    than running your own countdown off a stale `remainingSeconds` value
    for more than a short UI tick interval.
  - **Expired is distinct from occupied**: once `endAt` has passed,
    `isOccupied` becomes `false` and `isExpired` becomes `true` -
    *regardless* of whether a field officer has actually called the
    checkout endpoint yet. An overdue-but-not-yet-checked-out booking is
    never reported as "currently occupied".
  - A facility can have `rental` present while its `status` is still
    `AVAILABLE`: `status`/`reason` for venues only reflect a time conflict
    when `startHour`/`endHour` were supplied in the request (see below) -
    `rental` is independent of that and always reflects the real booking,
    with or without an hour range in the request.

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 400 | `VALIDATION_ERROR` | `date`/`startDate`/`endDate` missing, both `date` and a range given together, out of the 90-day window, `endDate` before `startDate`, `startHour`/`endHour` given without each other, or `endHour <= startHour` |
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |
  | 403 | `ACCOUNT_INACTIVE` / `PASSWORD_CHANGE_REQUIRED` | See Conventions |

  **Validation**: exactly one of `date` or `startDate`+`endDate`, each a
  date today through 90 days ahead (`src/lib/validation/booking.ts`'s
  `dateField`, the same rule the public booking flow uses); `endDate` on or
  after `startDate`. `category` optional enum. `startHour`/`endHour`
  optional but paired, `0-24`, `endHour > startHour`.

  **Business rules**:
  - `status` is `"AVAILABLE"` or `"UNAVAILABLE"`. `reason` is `null` when
    available, otherwise one of:
    - `"INACTIVE"` - the facility is deactivated by an admin (checked
      first - an inactive facility is unavailable regardless of date).
    - `"CLOSED_HOLIDAY"` - that date is a closed holiday/maintenance date
      (`Holiday.isClosed`), which blocks every category.
    - `"ALREADY_BOOKED"` - a still-holding, paid-or-pending booking
      already occupies that homestay's date, or overlaps that venue's
      requested hour range. A booking still holds its slot while it is
      `PENDING`, `CONFIRMED` or `CHECKED_IN` (including an overdue
      `CHECKED_IN` one - nobody has checked that visitor out, so the
      facility is not free). A `COMPLETED` booking holds its slot only
      until its rental window ends: a guest who checks out early keeps the
      night/slot they paid for, but once `endAt` passes the facility
      becomes bookable again. **Edutrip packages never return this reason**
      - like the public booking flow, they're pax-based, not an exclusive
      slot, so an edutrip package is only ever `INACTIVE` or
      `CLOSED_HOLIDAY`.
    - These are checked in that order (`INACTIVE` > `CLOSED_HOLIDAY` >
      `ALREADY_BOOKED`); only the first matching reason is returned.
  - If `startHour`/`endHour` are omitted, `venue` `status`/`reason` only
    reflects `INACTIVE`/`CLOSED_HOLIDAY` - without a specific time range
    there's no single slot to check for a booking conflict, so a venue
    that's actually fully booked all day can still come back `AVAILABLE`
    if you don't pass an hour range. Pass `startHour`/`endHour` to get a
    conflict-aware answer for a specific slot. (`rental` is unaffected -
    see above.)
  - This is a read-only, advisory check (same caveat as the public
    website's own pre-payment availability check) - a slot reported
    `AVAILABLE` here can still be taken by someone else between this call
    and an actual booking attempt. There is no reservation/hold created by
    calling this endpoint.
  - `VenueAvailableDay` (which days of the week a venue is nominally open)
    is **not** enforced here, because it isn't enforced by the actual
    booking flow either (`src/features/booking/service.ts`) - it's
    currently display-only on the public catalog pages. Enforcing it would
    be a new business rule, not a reuse of an existing one, so it was left
    out of this endpoint; raise it as a product decision if venues should
    actually be blocked on non-operating days.
  - A homestay's `ALREADY_BOOKED`/`rental` only ever appears on the date
    equal to its booking's check-in date - the same exact-date conflict
    rule the public booking flow already uses (one booking row covers
    exactly one night, `totalNights` is always `1`). A guest who hasn't
    checked out by the next calendar day will not show as occupying that
    homestay on the check-out day's entry even though their stay's `endAt`
    (checkout hour) falls within it - this mirrors a pre-existing
    characteristic of the booking-conflict model, not something new to
    this endpoint, and wasn't changed here to avoid inventing a second
    availability rule just for mobile.

  ---

  ## Booking & Payment (as seen by the mobile app)

  There is **no booking-creation, facility-browsing, or payment-initiation
  API for the mobile app** - see "Scope" above. Customers do this on the
  public website (`/booking`), where the backend is the same Next.js app but
  the flow is session-less and public, not JWT-authenticated.

  What the mobile app *does* see, for a specific booking, is bundled into
  the QR ticket verification response below: `invoiceNumber`, `customerName`,
  `facilityName`, and the ticket's validity window. That is deliberately the
  full extent of booking data a field officer needs to act on a ticket at the
  gate. If a future requirement needs a field officer to look up a booking by
  invoice number directly (not via QR scan), or to see their own check-in
  history, add a `GET /api/mobile/bookings/:invoiceNumber` and
  `GET /api/mobile/bookings/checked-in-by-me` respectively, following the
  same auth/response conventions as the rest of this document - neither
  exists today.

  The mobile app *can* end a stay/usage once it's started: see
  "Booking Checkout" below (`POST /api/mobile/bookings/checkout`) for the
  mobile-side `CHECKED_IN` -> `COMPLETED` transition, and
  "Facility Availability" above's `rental` field for how a field officer
  sees how much time is left before a checkout is due.

  **Payment status values** (`Transaction.paymentStatus`, set only by the
  Midtrans webhook - see `.ai/RULES.md` ยง6/ยง7 and never by the mobile app or
  any admin action): `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `PARTIALLY_REFUNDED`,
  `REFUNDED`. A settlement that arrives after the five-minute payment window is
  treated as late, recorded via `Transaction.latePaymentAt`, and refunded
  automatically - see [docs/PAYMENT.md](./PAYMENT.md).

  **Booking status values** (`*.bookingStatus`, independent of payment
  status): `PENDING`, `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`,
  `REJECTED`. `CHECKED_IN` is reached by the ticket-verify endpoint below (or
  the web admin's equivalent manual check-in) - never by the mobile app
  setting a status field directly.

  ---

  ## QR Ticket Verification - read this carefully

  This is the core mobile flow: a visitor's e-ticket QR encodes an opaque
  ticket **code** (`Ticket.code`, e.g. `SK-fejQEM9BBIYBAS4DnSAI6RGR`) - never
  the invoice number, never anything else guessable or client-supplied. The
  mobile app's only job is to scan that code and POST it here.

  ### `POST /api/mobile/tickets/verify`

  **Purpose**: Verify a scanned ticket code and, if valid, atomically mark
  it used and check the underlying booking in.

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```

  **Request parameters**: None (path/query) - the code is in the body.

  **Request payload**:
  ```json
  { "code": "SK-fejQEM9BBIYBAS4DnSAI6RGR" }
  ```

  **Response**: always `200 OK` at the transport level - the `status` field
  in the body is what the client branches on, not the HTTP status, because
  "ticket expired" or "already used" are expected outcomes of a scan, not
  transport errors.

  ```jsonc
  // status: "VALID" - the ticket was valid and has now been marked used.
  {
    "status": "VALID",
    "message": "Ticket is valid.",
    "invoiceNumber": "INV-20260923-EL68XT",
    "customerName": "Rafael",
    "facilityName": "AREN 4",
    "validFrom": "2026-10-01T07:00:00.000Z",
    "validUntil": "2026-10-02T05:00:00.000Z",
    "bookingType": "homestay",
    "bookingId": "28a24ecd-06d4-41ac-983c-63e285382882"
  }
  ```
  ```jsonc
  // status: "ALREADY_USED" - someone already scanned this ticket (a repeat
  // scan, or the front desk already checked the guest in manually).
  {
    "status": "ALREADY_USED",
    "message": "This ticket has already been used.",
    "usedAt": "2026-10-01T07:12:00.000Z",
    "invoiceNumber": "INV-20260923-EL68XT",
    "facilityName": "AREN 4"
  }
  ```
  ```jsonc
  // status: "NOT_YET_VALID" - scanned before its validity window opens
  // (e.g. a homestay ticket presented before the check-in hour -
  // HOMESTAY_CHECK_IN_HOUR in src/lib/siteConfig.ts).
  {
    "status": "NOT_YET_VALID",
    "message": "This ticket is not valid yet.",
    "validFrom": "2026-10-01T07:00:00.000Z",
    "invoiceNumber": "INV-20260923-EL68XT",
    "facilityName": "AREN 4"
  }
  ```
  ```jsonc
  // status: "EXPIRED" - scanned after its validity window closed.
  {
    "status": "EXPIRED",
    "message": "This ticket has expired.",
    "expiredAt": "2026-10-02T05:00:00.000Z",
    "invoiceNumber": "INV-20260923-EL68XT",
    "facilityName": "AREN 4"
  }
  ```
  ```jsonc
  // status: "CANCELLED" - the underlying booking was cancelled or rejected
  // after payment (e.g. an admin cancellation).
  {
    "status": "CANCELLED",
    "message": "This booking has been cancelled.",
    "invoiceNumber": "INV-20260923-EL68XT"
  }
  ```
  ```jsonc
  // status: "PAYMENT_REQUIRED" - defensive case; shouldn't normally happen
  // since tickets are only created once Midtrans confirms payment.
  {
    "status": "PAYMENT_REQUIRED",
    "message": "Payment has not been confirmed for this booking yet.",
    "invoiceNumber": "INV-20260923-EL68XT"
  }
  ```
  ```jsonc
  // status: "INVALID" - the code doesn't exist at all (typo, forged QR, or
  // a code from a different environment/database).
  { "status": "INVALID", "message": "Ticket code not found." }
  ```

  **Error responses** (transport-level, distinct from the `status` field
  above):
  | Status | Code | Meaning |
  |---|---|---|
  | 400 | `VALIDATION_ERROR` | `code` missing from the body |
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |

  **Validation**: `code` required, non-empty string. No format constraint is
  enforced beyond that - an unrecognized format simply resolves to `INVALID`.

  **Business rules**:
  - This single call **both verifies and consumes** the ticket - there is no separate "peek" endpoint by design, so a code can never be used twice no matter how a flaky connection causes the client to retry (a retry of the same call after a successful consume just returns `ALREADY_USED`, which is safe to show).
  - The web admin's manual "Check-in" button goes through this exact same underlying function (`consumeTicketByCode` in `src/features/tickets/service.ts`), so a walk-up check-in at the front desk and a QR scan can never both consume the same ticket - whichever happens first wins, and the second attempt correctly sees `ALREADY_USED`.
  - The mobile UI should render a large, unmistakable full-screen result per `status` - green for `VALID`, red/amber for every other status - with `message` as the human-readable subtitle.

  ---

  ## Booking Checkout

  ### `POST /api/mobile/bookings/checkout`

  **Purpose**: A field officer ends a visitor's on-site stay/usage of a
  facility they're currently monitoring - the mobile-side counterpart to
  the check-in above. This is the exact same `CHECKED_IN` -> `COMPLETED`
  transition the web admin's "Complete" action performs
  (`transitionBookingStatus` in `src/features/bookings/service.ts`), reused
  as-is rather than a second definition of "booking complete" - with the
  officer attributed via this backend's normal audit log.

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```

  **Request parameters**: None (path/query) - the booking is identified in
  the body.

  **Request payload**:
  ```json
  { "bookingType": "venue", "bookingId": "ae2771c6-0a75-4f8b-ba06-c30127dfe2d9" }
  ```
  - `bookingType` (required): `"homestay"` | `"venue"` | `"edutrip"`.
  - `bookingId` (required): the specific booking row's UUID - either the
    `bookingId` field returned by a `VALID` ticket-verify response above,
    or `rental.bookingId` from `POST /api/mobile/facilities/availability`'s
    per-facility data (see "Facility Availability" above) - use whichever
    screen the officer is acting from.

  **Response** `200 OK`:
  ```json
  {
    "bookingId": "ae2771c6-0a75-4f8b-ba06-c30127dfe2d9",
    "bookingType": "venue",
    "status": "COMPLETED",
    "facilityName": "JOGLO",
    "checkedOutAt": "2026-10-05T15:27:10.003Z"
  }
  ```

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 400 | `VALIDATION_ERROR` | `bookingType` missing/invalid, or `bookingId` missing/not a UUID |
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |
  | 403 | `ACCOUNT_INACTIVE` / `PASSWORD_CHANGE_REQUIRED` | See Conventions |
  | 404 | `NOT_FOUND` | No booking with that id (including a `bookingId` that exists but under a *different* `bookingType`) |
  | 409 | `INVALID_BOOKING_STATE` | The booking isn't currently `CHECKED_IN` - e.g. it's still `PENDING`/`CONFIRMED` (nobody checked this guest in yet), or it's already `COMPLETED` (a duplicate checkout call - the message names the current and attempted status) |

  **Validation**: `bookingType` must be exactly one of the three catalog
  categories; `bookingId` must be a syntactically valid UUID (whether or
  not it actually exists is a `404`, not a `400`).

  **Business rules**:
  - **Duplicate/invalid checkout is prevented by the booking's own state
    machine**, not a separate check: only a `CHECKED_IN` booking can move to
    `COMPLETED` (`ALLOWED_TRANSITIONS` in `src/features/bookings/service.ts`).
    Calling this twice in a row on the same booking always 409s the second
    time with `INVALID_BOOKING_STATE`, since by then the booking is already
    `COMPLETED`.
  - **Authorization is the same as every other operational mobile
    endpoint** (ticket-verify, KTR resolve/claim) - any authenticated
    `FIELD_OFFICER` or `ADMIN` may check out any booking; there is no
    "only the officer who checked this guest in may check them out"
    restriction, matching how ticket-verify itself isn't restricted to a
    specific officer either.
  - **Attribution is recorded in the audit log, not a new column**: there
    is no `completedAt`/`checkedOutAt` column on the booking tables
    themselves - `AuditLog` (`action: "<bookingType>.checked_out"`,
    `entityType`, `entityId`, `actorId`/`actorName`, `createdAt`) is the
    authoritative record of which facility was checked out, by which
    officer, and when, following this backend's one existing audit
    mechanism (`logAudit` in `src/lib/audit.ts`) rather than inventing a
    parallel one. `checkedOutAt` in the response above is simply the
    request-handling instant, for immediate client-side display.
  - A booking's rental window doesn't need to have *expired* to be checked
    out - an officer can end a stay early. Conversely, calling
    `GET /api/mobile/facilities/availability` first and seeing
    `rental.isExpired: true` is exactly the signal that a checkout is
    overdue; this endpoint doesn't auto-checkout an expired booking on its
    own, a field officer still has to call it.

  ---

  ## KTR Monitoring

  ### `GET /api/mobile/ktr`

  **Purpose**: List recent smoke-detection incidents for the field officer
  to review and act on (FR-11).

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  ```

  **Request parameters**: None yet (no pagination/filtering - always the 50
  most recent, newest first). Add `?status=` and `?cursor=` query parameters
  here if the list grows large enough to need them.

  **Response** `200 OK`:
  ```json
  {
    "items": [
      {
        "id": "99b749f8-e617-4a35-8af5-87d616097d88",
        "areaId": "20f03ab6-09b3-401d-adf8-06d26f0d6fe4",
        "areaName": "Kolam Renang A",
        "confidence": 0.94,
        "status": "DETECTED",
        "evidenceUrl": "https://<account>.r2.cloudflarestorage.com/private/ktr/evidence/...(signed)...",
        "handlingBy": null,
        "handlingStartedAt": null,
        "detectedAt": "2026-09-23T13:19:20.710Z",
        "resolvedBy": null,
        "resolvedAt": null,
        "notes": null
      }
    ]
  }
  ```

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |

  **Validation**: N/A.

  **Business rules**:
  - `status` is one of `DETECTED` (just ingested) -> `NOTIFIED` (push sent) -> `ASSIGNED` (an admin assigned one or more workers) -> `IN_PROGRESS` (an assigned worker started work, or any officer claimed the case) -> `RESOLVED` (closed as a real, handled violation). Two additional terminal states exist alongside `RESOLVED`: `FALSE_POSITIVE` (the AI/system flagged something that wasn't actually a violation) and `DISMISSED` (an admin closed the case for an operational reason unrelated to detection accuracy). These two are tracked distinctly - a false positive is never counted as a resolved violation in admin statistics.
  - `evidenceUrl` is either an external `http(s)://` URL stored by the AI pipeline (returned as-is) or a **short-lived (5 minute) signed URL** freshly generated on every call - do not cache or store it. It is `null` when R2 isn't configured and the evidence is an R2 key (docs/STORAGE.md); render an "evidence unavailable" placeholder in that case, not an error state.
  - `handlingBy` / `handlingStartedAt` show the officer who explicitly claimed the case (soft lock). It is `null` until someone presses "Ambil Tindakan" or starts an assigned task.
  - `resolvedBy` / `resolvedAt` record who actually closed the case. This can differ from both the assigned worker and the handling officer.
  - `confidence` is a plain 0-1 number (already unwrapped from Prisma's `Decimal` server-side).

  ### `POST /api/mobile/ktr/:id/resolve`

  **Purpose**: Mark a detection resolved from the field (FR-11's "field
  officer marks a violation resolved") and broadcast the result to every
  active field officer.

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```

  **Request parameters**:
  - Path: `id` - the `SmokingDetection.id` (UUID) to resolve.

  **Request payload** (all fields optional):
  ```json
  { "notes": "Visitor was reminded of the smoke-free policy on site." }
  ```

  **Response** `200 OK`:
  ```json
  {
    "id": "99b749f8-e617-4a35-8af5-87d616097d88",
    "status": "RESOLVED",
    "alreadyResolved": false,
    "resolvedBy": "Budi",
    "resolvedAt": "2026-10-31T08:15:00.000Z"
  }
  ```

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 404 | `NOT_FOUND` | No detection with that id |
  | 409 | `CASE_CLOSED` | The case is already `RESOLVED`, `FALSE_POSITIVE`, or `DISMISSED` |
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |

  **Validation**: `notes`, if present, is truncated to 1000 characters
  server-side; no other constraint.

  **Business rules**:
  - Any authenticated field officer may resolve a case, **even if the admin
    assigned it to someone else and even if another officer is currently
    handling it**. Assignment, handling, and resolution are deliberately
    distinct; `assignedTo` and `resolvedBy` can differ.
  - The first successful resolve wins. A concurrent or repeated call returns
    `alreadyResolved: true` with the existing resolver and does **not**
    broadcast a second time.
  - The resolving user id is always recorded server-side from the auth token,
    never from the request body.
  - On the first successful resolve, every active field officer (including
    the resolver) receives an FCM `KTR_VIOLATION_RESOLVED` message carrying
    `resolvedBy` and `resolvedAt`.
  - The resolver's own open assignment becomes `COMPLETED`; other officers'
    open assignments for the same case become `CANCELLED`.
  - The admin dashboard uses the same backend service, so resolving from the
    web dashboard triggers the same broadcast with the admin's name.

  ### `POST /api/mobile/ktr/:id/claim`

  **Purpose**: "Ambil Tindakan" - a field officer explicitly starts handling
  a case without waiting for an admin assignment. The claim is announced to
  every other active field officer so two people do not unknowingly work on
  the same case.

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  ```

  **Request parameters**:
  - Path: `id` - the `SmokingDetection.id` (UUID) to claim.

  **Request payload**: None required (an empty JSON body is accepted).

  **Response** `200 OK`:
  ```json
  {
    "id": "99b749f8-e617-4a35-8af5-87d616097d88",
    "status": "IN_PROGRESS",
    "alreadyClaimed": false,
    "handlingBy": "Budi",
    "handlingStartedAt": "2026-10-31T08:00:00.000Z"
  }
  ```

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 404 | `NOT_FOUND` | No detection with that id |
  | 409 | `CASE_CLOSED` | The case is already `RESOLVED`, `FALSE_POSITIVE`, or `DISMISSED` |
  | 409 | `ALREADY_CLAIMED` | Another officer is already handling it; response also carries `handledBy` |
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |

  **Business rules**:
  - A worker can claim a case **without** an admin assignment. The claim sets
    `handlingBy`/`handlingStartedAt` and moves the detection to
    `IN_PROGRESS`.
  - This is a **soft lock**: it tells everyone who is handling the case, and
    a second officer's claim gets `ALREADY_CLAIMED`, but any officer may
    still resolve the case (see above).
  - Claiming your own case again is idempotent (`alreadyClaimed: true`) and
    does not send another broadcast.
  - Starting an assigned task via
    `POST /api/mobile/ktr/assignments/:id/status` with `IN_PROGRESS` performs
    the same claim and broadcast.
  - Every other active field officer receives an FCM
    `KTR_VIOLATION_CLAIMED` message with `handledBy` and `handledAt`.

  ### `GET /api/mobile/ktr/assignments`

  **Purpose**: List the authenticated officer's own KTR assignments (tasks
  an admin assigned them to resolve).

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  ```

  **Request parameters**: None (always the caller's own assignments, newest first).

  **Response** `200 OK`:
  ```json
  {
    "assignments": [
      {
        "id": "1e3c4b3a-...",
        "status": "ASSIGNED",
        "note": "Please check this smoking violation at the north parking area.",
        "assignedAt": "2026-09-24T07:00:00.000Z",
        "acceptedAt": null,
        "completedAt": null,
        "violation": {
          "id": "99b749f8-e617-4a35-8af5-87d616097d88",
          "status": "ASSIGNED",
          "detectedAt": "2026-09-24T06:55:00.000Z",
          "notes": null,
          "area": { "id": "...", "name": "Kolam Renang A", "locationDescription": "Area kolam renang utama" }
        }
      }
    ]
  }
  ```

  **Error responses**: `401` as in Conventions.

  **Business rules**: Only assignments where `assignedToId` matches the
  authenticated user are returned. This is the task/assignment record
  (`KtrAssignment`) - distinct from the violation record (`SmokingDetection`)
  and from who ultimately resolves it (`resolvedBy`); one violation can have
  several assignments (several workers) at once. When the case reaches a
  terminal state, the resolver's open assignment becomes `COMPLETED` and
  everyone else's open assignment becomes `CANCELLED` (false-positive and
  dismissed closures cancel all open assignments).

  ### `POST /api/mobile/ktr/assignments/:id/status`

  **Purpose**: The assigned worker moves their own task to `IN_PROGRESS`
  when they start, or `COMPLETED` when done.

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```

  **Request parameters**: Path: `id` - the `KtrAssignment.id` (UUID).

  **Request payload**:
  ```json
  { "status": "IN_PROGRESS" }
  ```

  **Response** `200 OK`:
  ```json
  { "id": "1e3c4b3a-...", "status": "IN_PROGRESS" }
  ```

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 400 | `VALIDATION_ERROR` | `status` missing or not one of `IN_PROGRESS`/`COMPLETED` |
  | 404 | `NOT_FOUND` | No such assignment, or it belongs to a different worker |
  | 409 | `CONFLICT` | Another officer is already handling the case, or the case is already closed |
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |

  **Validation**: `status` must be exactly `IN_PROGRESS` or `COMPLETED` - a
  worker can never set `ASSIGNED` or `CANCELLED` themselves (only an admin
  cancels an assignment, from the web admin UI).

  **Business rules**: Moving to `IN_PROGRESS` is the same signal as
  `POST /api/mobile/ktr/:id/claim` - it claims the detection (soft lock),
  broadcasts `KTR_VIOLATION_CLAIMED` to every other officer, and bubbles the
  detection to `IN_PROGRESS`. If another officer already claimed the case,
  this returns `409 CONFLICT` instead of silently duplicating the work. This
  endpoint never marks the violation itself resolved - that is still
  `POST /api/mobile/ktr/:id/resolve` above, which independently records who
  actually resolved it.

  ---

  ## Push Notifications

  ### `POST /api/mobile/push-tokens`

  **Purpose**: Register (or refresh) this device's FCM token so the backend
  can push notifications to it.

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  ```

  **Request payload**:
  ```json
  {
    "token": "<the FCM registration token from the device SDK>",
    "platform": "android",
    "deviceId": "a device-stable identifier, e.g. installation id"
  }
  ```

  **Response** `200 OK`:
  ```json
  { "ok": true }
  ```

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 400 | `VALIDATION_ERROR` | `token` missing, or `platform` not one of `android`/`ios`/`web` |
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |

  **Validation**: `token` required (max 4096 chars); `platform` optional enum; `deviceId` optional (max 255 chars).

  **Business rules**:
  - The token is always associated with the **authenticated caller** - the request body has no `userId` field, so a client can never register a token on another user's behalf.
  - Call this on every app start and whenever the OS hands the app a new/rotated token (standard FCM practice) - it's a plain upsert keyed by the token itself, so calling it repeatedly with the same token is a safe no-op beyond bumping `lastSeenAt`.
  - A worker may have several active tokens at once (multiple devices) - registering a new one does not deactivate previously-registered tokens from other devices.
  - The backend automatically deactivates a token if Firebase ever reports it as permanently invalid/unregistered (e.g. the app was uninstalled) - a deactivated token stops receiving pushes; re-registering the same token value re-activates it.

  ### Notification data contract

  Every push sent by this backend carries a small, stable `data` payload -
  never a large embedded object - so the client always re-fetches current
  details from the REST API rather than trusting a potentially-stale
  notification body:

  | `type` | Fields | Meaning |
  |---|---|---|
  | `KTR_VIOLATION_NEW` | `violationId`, `areaId`, `confidence`, `detectedAt` | A new KTR violation was ingested - sent to every active field officer. Open the violation and fetch fresh evidence from `GET /api/mobile/ktr`. |
  | `KTR_ASSIGNMENT` | `assignmentId`, `violationId`, `assignedBy` | A new KTR task was assigned to this worker - open `GET /api/mobile/ktr/assignments` or the specific detection. |
  | `KTR_VIOLATION_ASSIGNED` | `violationId`, `assignedTo`, `assignedBy` | Informational broadcast: a case was assigned to another officer. It tells everyone else who is on it; it is not actionable. |
  | `KTR_VIOLATION_CLAIMED` | `violationId`, `handledBy`, `handledAt` | Another officer pressed "Ambil Tindakan" / started the assigned task. The case is being handled, but any officer may still resolve it. |
  | `KTR_VIOLATION_RESOLVED` | `violationId`, `resolvedBy`, `resolvedAt` | The case was resolved - sent to every active field officer, including the resolver. |
  | `BOOKING_ENDING_SOON` | `bookingType`, `bookingId`, `invoiceNumber`, `facilityName`, `validUntil` | A checked-in venue/homestay rental ends in 15 minutes. Sent to every active field officer. See [Facility Booking Reminders](./BOOKING_REMINDERS.md). |
  | `BOOKING_CHECKIN_OVERDUE` | `bookingType`, `bookingId`, `invoiceNumber`, `facilityName`, `checkInDeadline` | A venue/homestay booking is still `CONFIRMED` after its check-in deadline (homestay: 2 hours; venue: 15 minutes). Sent to every active field officer. |

  All `data` values are strings (an FCM constraint). There is deliberately no
  `imageUrl` in any push: R2 evidence URLs expire after 5 minutes, so a stale
  notification image would break. The client fetches a fresh `evidenceUrl`
  from the REST API when the officer opens the case. `KTR_VIOLATION_NEW`,
  `KTR_VIOLATION_ASSIGNED`, `KTR_VIOLATION_CLAIMED`,
  `KTR_VIOLATION_RESOLVED`, `BOOKING_ENDING_SOON`, and
  `BOOKING_CHECKIN_OVERDUE` are broadcast to all active field officers;
  `KTR_ASSIGNMENT` goes only to the assignees.

  ---

  ## Notifications

  ### `GET /api/mobile/notifications`

  **Purpose**: List the authenticated officer's own durable notifications -
  KTR alerts and facility-booking reminders. Use this as the fallback when a
  push is missed (app backgrounded, FCM unavailable, etc.).

  **Authentication**: Required: Yes. Role: `FIELD_OFFICER` or `ADMIN`.

  **Request headers**:
  ```
  Authorization: Bearer <accessToken>
  ```

  **Request parameters**: None yet (always the 50 most recent for this
  user, newest first).

  **Response** `200 OK`:
  ```json
  {
    "items": [
      {
        "id": "...",
        "type": "KTR_VIOLATION_NEW",
        "title": "KTR violation detected",
        "body": "Location: Kolam Renang A | Time: 14:32 on 23 Sep 2026 | Confidence: 94%",
        "sentAt": "2026-09-23T07:32:00.000Z",
        "readAt": null,
        "detection": { "id": "99b749f8-e617-4a35-8af5-87d616097d88", "areaName": "Kolam Renang A" },
        "booking": null
      },
      {
        "id": "...",
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

  **Error responses**:
  | Status | Code | Meaning |
  |---|---|---|
  | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | See Conventions |

  **Validation**: N/A.

  **Business rules**: Only notifications where `recipientId` matches the
  authenticated user are returned - never another officer's. Exactly one of
  `detection` or `booking` is populated; the other is `null`. `type` is the
  event type from the push data contract. Booking reminder display details
  (`facilityName`, `customerName`, `validUntil`/`checkInDeadline`) are context
  only - fetch fresh booking state before acting. **Not yet implemented**: a
  "mark as read" endpoint (`readAt` is always `null` today). Add a
  `PATCH /api/mobile/notifications/:id/read` following this document's
  conventions when the mobile UI needs it.

  ---

  ## Realtime / Push - current state and where to extend it

  There is **no WebSocket/Socket.io server in this build**. Two mechanisms
  currently stand in for "realtime":

  1. **Firebase Cloud Messaging (FCM)** - the backend broadcasts KTR events
    and facility-booking reminders to active field officers' registered
    devices:
    - a new detection (`POST /api/ktr/detect`, called by the
      fog-server/CCTV pipeline, *not* by the mobile app - it's a separate
      machine-to-machine endpoint authenticated with `KTR_INGEST_API_KEY`,
      not a bearer JWT - see `docs/KTR_INGEST.md` for the full contract),
    - a new admin assignment (assignees get the actionable `KTR_ASSIGNMENT`;
      everyone else gets an informational `KTR_VIOLATION_ASSIGNED`),
    - a claim/started task (`KTR_VIOLATION_CLAIMED`, to everyone except the
      claimer),
    - a resolution (`KTR_VIOLATION_RESOLVED`, to everyone including the
      resolver),
    - a venue/homestay rental ending in 15 minutes
      (`BOOKING_ENDING_SOON`), or a `CONFIRMED` booking still not checked in
      after its grace period (`BOOKING_CHECKIN_OVERDUE`) - both from the
      per-minute `GET /api/cron/bookings` job. See
      [Facility Booking Reminders](./BOOKING_REMINDERS.md) for the exact
      policy.

    These go through `src/features/notifications/pushService.ts`, which
    writes one durable `Notification` row per recipient first and treats FCM
    as best-effort: a Firebase failure never fails ingest, assignment,
    claim, resolve, or the reminder cron, and tokens reported as permanently
    invalid are deactivated automatically. This requires
    `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`
    to be configured; without them the push is silently skipped but the
    `Notification` row is still written, so `GET /api/mobile/notifications` is
    always a truthful fallback even if push delivery isn't set up in a given
    environment.
  2. **Polling** - `GET /api/mobile/ktr` and `GET /api/mobile/notifications`
    are meant to be polled by the mobile app for anything push doesn't
    cover promptly (e.g. after the app was backgrounded and missed a push).
    The notifications endpoint now contains both KTR and booking rows.

  Device tokens are registered via `POST /api/mobile/push-tokens` (see
  "Push Notifications" above) - the mobile app should call this on every
  launch and whenever the OS rotates the token, otherwise `FCM` delivery has
  no tokens to send to and every push silently no-ops (the `Notification`
  row is still written either way, so polling always works as a fallback).

  **If/when true realtime (a persistent socket) is needed** - e.g. a live
  admin dashboard, or a "field officer is en route" status - here is how it
  should connect, since Next.js API routes on typical serverless hosting
  cannot hold a socket open:

  - **Connection process**: a small standalone Node process (separate from
    this Next.js deployment) running Socket.io or a raw WebSocket server,
    reachable at its own URL (e.g. `wss://realtime.sikesek.example`).
  - **Authentication**: the client sends the same mobile access JWT
    (`src/lib/auth/mobileJwt.ts`) as a connection query param or the initial
    handshake payload; the realtime server verifies it exactly the way
    `requireMobileAuth` does (same secret, same `verifyToken` logic) before
    accepting the connection. A web admin session would need an equivalent
    short-lived token minted for this purpose, since a browser cookie can't
    be attached to a raw WebSocket handshake as cleanly.
  - **Subscription behavior**: on connect, the server should auto-subscribe
    the client to a room scoped to their own user id (mirroring how
    `Notification.recipientId` already scopes REST data per officer) - e.g.
    room `user:<userId>`. An `ADMIN` connection additionally joins a global
    `admins` room.
  - **Suggested event names/payloads** (to keep this document accurate once
    built - none of these exist yet):
    - `ktr:new_detection` -> the same shape as one item of `GET /api/mobile/ktr`'s `items` array, emitted to the `admins` room and to the assigned area's officer.
    - `ktr:resolved` -> `{ id, status: "RESOLVED", resolvedBy }`, emitted to the `admins` room.
    - `booking:checked_in` -> `{ bookingId, bookingType, invoiceNumber }`, emitted to the `admins` room when a ticket is consumed (see `consumeTicketByCode`).
  - **Unsubscription**: leaving a room happens implicitly on disconnect; no
    explicit "unsubscribe" call is needed given the per-connection room
    model above.
  - **Reconnection**: standard Socket.io exponential backoff is sufficient;
    on reconnect the client should re-authenticate (the JWT may have
    expired while disconnected) and treat a fresh `GET /api/mobile/ktr` /
    `GET /api/mobile/notifications` poll as the source of truth for anything
    it might have missed while offline - the socket is a low-latency
    convenience layer on top of the REST endpoints, never the only way to
    get current data.
  - **Error events**: an `auth_error` event (analogous to this document's
    `INVALID_TOKEN`/`TOKEN_EXPIRED` codes) should be emitted before the
    server closes the connection, so the client can distinguish "your token
    expired, reconnect after refreshing" from a generic network failure.

  ---

  ## Data model reference

  See `prisma/schema.prisma` for the full source of truth. Key enums the
  mobile client needs to know about:

  ```
  Role:              ADMIN | FIELD_OFFICER
  PaymentStatus:     PENDING | PAID | FAILED | EXPIRED | PARTIALLY_REFUNDED | REFUNDED
  BookingStatus:     PENDING | CONFIRMED | CHECKED_IN | COMPLETED | CANCELLED | REJECTED
  DetectionStatus:   DETECTED | NOTIFIED | ASSIGNED | IN_PROGRESS | RESOLVED | FALSE_POSITIVE | DISMISSED
  DetectionSource:   API | MANUAL
  AssignmentStatus:  ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED
  ```

  A `PARTIALLY_REFUNDED` transaction's tickets remain valid (a partial
  refund is an amount adjustment, not a cancellation) - only a fully
  `REFUNDED` transaction's tickets stop verifying (they fall through to
  `PAYMENT_REQUIRED` in the ticket-verify response, and their bookings are
  separately cancelled).

  `PaymentStatus` and `BookingStatus` are intentionally separate concepts -
  see `.ai/RULES.md` ยง6 and `.ai/ARCHITECTURE.md` ยง11. A booking's
  `bookingStatus` is never derived from `paymentStatus` by a mobile client;
  always read both explicitly where both are available (they aren't both
  present in the ticket-verify response - see that endpoint's fields).
