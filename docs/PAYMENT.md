# Payment Policy & Operations

SIKESEK booking payments are processed through the Midtrans Snap API. This
document is the source of truth for the current payment lifecycle: the five
minute payment window, the public Snap.js popup, countdown handling, automatic
expiry, and late-payment refunds.

Related source files:

- `src/lib/payment.ts` - payment-window constants and helpers
- `src/lib/midtrans.ts` - Midtrans Snap create/status/expire/refund logic
- `src/features/booking/createBooking.ts` - transaction creation and conflict checks
- `src/features/booking/availabilityCheck.ts` - advisory availability check
- `src/features/booking/actions.ts` - payment session actions
- `src/features/booking/paymentReconciliation.ts` - status reconciliation
- `src/features/payments/expiryService.ts` - expiry job implementation
- `src/features/payments/refundService.ts` - refunds and automatic late refunds
- `src/app/booking/payment/PaymentClient.tsx` - popup and countdown UI

For the mobile app’s view of payment status, see
[Booking & Payment (as seen by the mobile app)](./MOBILE_API.md#booking--payment-as-seen-by-the-mobile-app).
For the AI/KTR data contract, see [KTR AI Ingest](./KTR_INGEST.md).

## 1. Payment lifecycle

```text
Customer presses `Bayar` on /booking/payment
  -> submitBooking creates a PENDING Transaction
  -> createPaymentSession stores a 5-minute paymentExpiresAt
  -> Midtrans Snap createTransaction receives an expiry window
  -> PaymentClient calls window.snap.pay(token, callbacks)
  -> Midtrans popup (Snap.js)
  -> Midtrans settlement -> backend reconciliation -> tickets
```

The normal customer-facing flow never redirects the browser to
`snap.redirect_url`. The client opens Midtrans’s hosted Snap.js popup with
`window.snap.pay(token, callbacks)`. `snap.redirect_url` is still stored on the
transaction, but only as a fallback for transactions created before Snap.js
popup support.

## 2. Five minute payment window

A payment is valid for **5 minutes**.

The authoritative deadline is stored on `Transaction.paymentExpiresAt` and is
set when the booking is created (`createdAt + 5 minutes`). The Midtrans Snap
request receives an explicit expiry window:

```json
{
  "expiry": {
    "start_time": "2026-10-31 12:05:00 +0700",
    "unit": "minutes",
    "duration": 5
  }
}
```

Because asynchronous Midtrans payment methods can be selected after the payment
screen is opened, `start_time` is passed explicitly instead of relying on
Midtrans’s implicit transaction-time start.

The public payment page computes a live countdown from `paymentExpiresAt`. When
the countdown reaches zero, the client asks the backend to expire the pending
session and disables further payment. The expired panel offers two actions:
retry with the same cart (creates a fresh invoice and Snap session) or start
over from the selection page. The old invoice is never extended.

`/booking/success` also refreshes itself while the transaction is `PENDING`,
so a customer who chose an asynchronous payment method sees the expired state
without pressing "Check Again". The scheduled backend job remains the source
of truth for cleaning up overdue rows.

Booking availability treats a `PENDING` transaction as blocking only while its
`paymentExpiresAt` is in the future. A `PAID` transaction always blocks. Once a
pending payment expires, the affected slot becomes available again without waiting
for the payment job to finish, and the job itself marks the booking cancelled.

### Expiry job

The expiry endpoint is:

```text
GET /api/cron/payments
Authorization: Bearer <CRON_SECRET>
```

It:

1. Finds up to 100 overdue `PENDING` transactions.
2. Reconciles each row against Midtrans before expiring.
3. Calls Midtrans’s expire API when still pending.
4. Marks the local transaction `EXPIRED`.
5. Cancels open booking lines.

`POST /api/midtrans/webhook` and the public status endpoint use the same
reconciliation path, so late settlements are handled consistently.

Scheduler configuration:

- Vercel Cron: this repository ships `vercel.json` with
  `crons: [{ "path": "/api/cron/payments", "schedule": "0 3 * * *" }]`.
  Vercel sends the configured `CRON_SECRET` as a bearer token automatically.
- Other platforms: run once a day with `Authorization: Bearer $CRON_SECRET`.
- Manual fallback: call
  `GET /api/cron/payments` with `Authorization: Bearer $CRON_SECRET`.

The endpoint fails closed when `CRON_SECRET` is not configured. Verify the job
is actually running by checking for fresh `payment.expired` audit rows: a
`PENDING` transaction whose `paymentExpiresAt` is in the past and has no audit
row means the scheduler is not invoking the endpoint.

## 3. Snap.js popup and countdown

The payment client loads Snap.js and invokes:

```ts
window.snap.pay(token, {
  onSuccess: () => router.push(`/booking/success?invoice=${invoiceNumber}`),
  onPending: () => router.push(`/booking/success?invoice=${invoiceNumber}`),
  onError: () => setError("Pembayaran gagal diproses."),
  onClose: () => setError("Jendela pembayaran ditutup sebelum selesai."),
});
```

The browser countdown displays:

```text
Pembayaran SIKESEK
Selesaikan pembayaran dalam
MM:SS
```

The heading `Pembayaran SIKESEK` is rendered by SIKESEK’s UI. Midtrans does not
allow the Snap popup title to be changed per transaction; merchant branding is
configured through the Midtrans merchant dashboard.

Midtrans client configuration is expected through:

```text
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
NEXT_PUBLIC_APP_URL
MIDTRANS_SERVER_KEY
```

## 4. Late payment handling

A settlement is treated as a late payment when:

- its local transaction was already `EXPIRED` or `FAILED`;
- its `paymentExpiresAt` has passed;
- its booking lines were already cancelled before the settlement.

When a late settlement is reconciled, the backend:

- marks the transaction `PAID` and records `latePaymentAt`;
- keeps booking lines cancelled;
- does **not** create tickets or send the confirmation email;
- requests a full automatic refund for the remaining amount.

The automatic refund uses a deterministic key:

```text
LATE-<transactionId>
```

Therefore webhook retries, expiry retries, and admin retries converge on one
Midtrans refund attempt.

The automatic refund path records:

- a `Refund` row with `automatic: true`;
- a system-actor audit trail;
- the full remaining refund amount.

If the automatic refund fails, the transaction remains `PAID` with
`latePaymentAt`, and the booking stays cancelled. The admin payments page exposes
a retry action (`retryLatePaymentRefund`) and shows failed automatic refunds in
the refund history.

Automatic refunds are still issued through Midtrans’s refund API. Because refund
settlement can vary by payment channel and may initially report asynchronously,
the internal refund workflow keeps the transaction refundable (`PAID` /
`PARTIALLY_REFUNDED`) while a refund attempt is in progress and reconciles the
result before recording `REFUNDED` or `PARTIALLY_REFUNDED`.

Manual admin refunds continue to use the normal refund path and a
`REF-<transactionId>-<attempt>`-style key based on refund history.

## 5. Data model changes

`Transaction` now stores:

- `snapToken` - token used by the Snap.js popup
- `paymentExpiresAt` - authoritative 5-minute deadline
- `latePaymentAt` - set when a settlement arrives after the deadline

`Refund` now stores:

- `automatic` - whether the refund was system-initiated
- nullable `requestedByUserId` - system actor support

## 6. Related documentation

- [Payment Rules](../../.ai/RULES.md)
- [Payment Architecture](../../.ai/ARCHITECTURE.md)
- [Mobile API - Booking and Payment](./MOBILE_API.md#booking--payment-as-seen-by-the-mobile-app)
- [Storage Policy](./STORAGE.md)
- [KTR AI Ingest](./KTR_INGEST.md)
- [Midtrans Snap documentation](https://docs.midtrans.com/docs/snap-snap-integration-guide)
