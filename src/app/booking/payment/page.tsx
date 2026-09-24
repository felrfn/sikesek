import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StepHeader } from "../StepHeader";
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
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto w-full max-w-2xl px-4 pt-6">
        <StepHeader />
      </div>
      <div className="flex-1 px-4 py-16">
        <PaymentClient receiptDate={receiptDate} />
      </div>
      <Footer />
    </div>
  );
}
