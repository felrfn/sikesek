import { getBookableCatalog } from "@/features/catalog/service";
import { getClosedDates } from "@/features/holidays/service";
import { getTodayInJakarta } from "@/lib/siteConfig";
import { BookingShell } from "./BookingShell";
import { SelectionClient } from "./SelectionClient";

export const dynamic = "force-dynamic";

export default async function BookingSelectionPage() {
  const [catalog, closedDates] = await Promise.all([
    getBookableCatalog(),
    getClosedDates(),
  ]);
  const today = getTodayInJakarta();

  return (
    <BookingShell reserveBottomBar>
      <SelectionClient catalog={catalog} today={today} closedDates={closedDates} />
    </BookingShell>
  );
}
