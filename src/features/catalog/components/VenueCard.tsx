import { Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { formatCurrency } from "@/lib/utils/format";
import type { getActiveVenues } from "@/features/catalog/service";

type Venue = Awaited<ReturnType<typeof getActiveVenues>>[number];

const WEEKEND_DAYS = new Set(["SATURDAY", "SUNDAY"]);

export function VenueCard({ venue }: { venue: Venue }) {
  const days = new Set(venue.availableDays.map((d) => d.day));
  const weekdayOnly =
    days.size > 0 && [...days].every((day) => !WEEKEND_DAYS.has(day));

  return (
    <Card className="flex flex-col overflow-hidden">
      <ImagePlaceholder label={venue.name} className="h-44 w-full" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold uppercase text-gray-900">
          {venue.name}
        </h3>
        <p className="flex items-center gap-1 text-sm text-gray-500">
          <Users className="size-3.5" />
          Kapasitas {venue.minCapacity}-{venue.maxCapacity} Orang
        </p>
        {weekdayOnly ? (
          <p className="text-xs font-medium text-brand-600">
            Penyewaan only weekday
          </p>
        ) : null}
        <div className="mt-auto border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-500">Hanya</p>
          <p className="text-lg font-bold text-gray-900">
            {formatCurrency(venue.pricePerHour)}
            <span className="text-sm font-normal text-gray-500">/jam</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
