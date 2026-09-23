import { MinimalHeader } from "../MinimalHeader";
import { StepHeader } from "../StepHeader";
import { PaymentClient } from "./PaymentClient";

export default function PaymentPage() {
  return (
    <div>
      <MinimalHeader />
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <StepHeader />
      </div>
      <div className="px-4 py-16">
        <PaymentClient />
      </div>
    </div>
  );
}
