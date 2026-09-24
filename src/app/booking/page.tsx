import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getBookableCatalog } from "@/features/catalog/service";
import { getClosedDates } from "@/features/holidays/service";
import { getTodayInJakarta } from "@/lib/siteConfig";
import { StepHeader } from "./StepHeader";
import { SelectionClient } from "./SelectionClient";

export const dynamic = "force-dynamic";

export default async function BookingSelectionPage() {
  const [catalog, closedDates] = await Promise.all([
    getBookableCatalog(),
    getClosedDates(),
  ]);
  const today = getTodayInJakarta();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto w-full max-w-6xl px-4 pt-6">
        <StepHeader />
      </div>
      <div className="flex-1">
        <SelectionClient catalog={catalog} today={today} closedDates={closedDates} />
      </div>
      <Footer />
    </div>
  );
}
