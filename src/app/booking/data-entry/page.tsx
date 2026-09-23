import { MinimalHeader } from "../MinimalHeader";
import { StepHeader } from "../StepHeader";
import { DataEntryForm } from "./DataEntryForm";

export default function DataEntryPage() {
  return (
    <div>
      <MinimalHeader />
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <StepHeader />
      </div>
      <DataEntryForm />
    </div>
  );
}
