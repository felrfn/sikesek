import { BookingShell } from "../BookingShell";
import { PaymentClient } from "./PaymentClient";

export default function PaymentPage() {
  // Computed once on the server and passed down as plain data, rather than
  // calling `new Date()` inside the client component's render - the same
  // component function runs once during SSR and again during client
  // hydration, and those two `new Date()` calls are not guaranteed to
  // return the same instant, which is exactly what causes a hydration
  // mismatch (see docs/HYDRATION.md for the write-up of this fix).
  const receiptDate = new Date().toISOString();

  return (
    <BookingShell contentClassName="px-4 py-8 sm:py-12">
      <PaymentClient receiptDate={receiptDate} />
    </BookingShell>
  );
}
