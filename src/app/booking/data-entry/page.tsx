import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StepHeader } from "../StepHeader";
import { DataEntryForm } from "./DataEntryForm";

export default function DataEntryPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto w-full max-w-2xl px-4 pt-6">
        <StepHeader />
      </div>
      <div className="flex-1">
        <DataEntryForm />
      </div>
      <Footer />
    </div>
  );
}
