import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Clock, Users } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatHour } from "@/lib/utils/format";
import { FacilityIcon } from "@/features/catalog/facilityIcons";
import {
  getHomestayDetail,
  getVenueDetail,
} from "@/features/catalog/service";
import { HOMESTAY_CHECK_IN_HOUR, HOMESTAY_CHECK_OUT_HOUR } from "@/lib/siteConfig";
import { Gallery } from "./Gallery";

export const dynamic = "force-dynamic";

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ category: string; id: string }>;
}) {
  const { category, id } = await params;

  if (category === "homestay") {
    const homestay = await getHomestayDetail(id);
    if (!homestay) notFound();

    const images = [
      ...(homestay.imageUrl ? [homestay.imageUrl] : []),
      ...homestay.photos.map((p) => p.url),
    ];

    return (
      <Shell>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Gallery name={homestay.name} images={images} />
            <h1 className="mt-6 text-2xl font-bold text-gray-900">{homestay.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <Users className="size-4" />
              {homestay.minCapacity}-{homestay.maxCapacity} Pax
            </p>
            <p className="mt-4 text-gray-600">
              {homestay.description ?? `Kabin A-frame ${homestay.name} di tengah suasana alam yang tenang dan asri.`}
            </p>

            <div className="mt-6 rounded-lg bg-cream-50 p-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Facilities</p>
              <ul className="grid grid-cols-2 gap-2 text-sm text-gray-600 sm:grid-cols-3">
                {homestay.facilities.map(({ facility }) => (
                  <li key={facility.id} className="flex items-center gap-2">
                    <FacilityIcon iconName={facility.iconName} />
                    {facility.name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 flex gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="size-4" />
                Check-in {HOMESTAY_CHECK_IN_HOUR}:00
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-4" />
                Check-out {HOMESTAY_CHECK_OUT_HOUR}:00
              </span>
            </div>
          </div>

          <Card className="h-fit p-5">
            <p className="text-sm text-gray-500">Starting from</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(homestay.weekdayPrice)}
              <span className="text-sm font-normal text-gray-500">/malam</span>
            </p>
            <dl className="mt-4 space-y-1 text-sm">
              <PriceRow label="Weekday" value={homestay.weekdayPrice} />
              <PriceRow label="Weekend" value={homestay.weekendPrice} />
              <PriceRow label="Holiday" value={homestay.holidayPrice} />
              <PriceRow label="Extra bed" value={homestay.extraBedPrice} />
            </dl>
            <LinkButton href="/booking" variant="primary" className="mt-5 w-full">
              Book Now
            </LinkButton>
          </Card>
        </div>
      </Shell>
    );
  }

  if (category === "venue") {
    const venue = await getVenueDetail(id);
    if (!venue) notFound();

    const images = [
      ...(venue.imageUrl ? [venue.imageUrl] : []),
      ...venue.photos.map((p) => p.url),
    ];

    return (
      <Shell>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Gallery name={venue.name} images={images} />
            <h1 className="mt-6 text-2xl font-bold text-gray-900">{venue.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <Users className="size-4" />
              Kapasitas {venue.minCapacity}-{venue.maxCapacity} orang
            </p>
            <p className="mt-4 text-gray-600">
              {venue.description ?? `Ruang serbaguna ${venue.name} untuk berbagai acara dan pertemuan.`}
            </p>

            <div className="mt-6 rounded-lg bg-cream-50 p-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Available days</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {venue.availableDays.map((d) => (
                  <span
                    key={d.day}
                    className="rounded-full bg-white px-2.5 py-1 capitalize text-gray-600 shadow-sm"
                  >
                    {d.day.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Card className="h-fit p-5">
            <p className="text-sm text-gray-500">Price</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(venue.pricePerHour)}
              <span className="text-sm font-normal text-gray-500">/jam</span>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Booking hourly, e.g. {formatHour(9)} - {formatHour(12)}.
            </p>
            <LinkButton href="/booking" variant="primary" className="mt-5 w-full">
              Book Now
            </LinkButton>
          </Card>
        </div>
      </Shell>
    );
  }

  notFound();
}

function PriceRow({ label, value }: { label: string; value: bigint }) {
  return (
    <div className="flex justify-between text-gray-600">
      <dt>{label}</dt>
      <dd className="font-medium text-gray-900">{formatCurrency(value)}</dd>
    </div>
  );
}

// The (public) route group's layout.tsx already renders the global
// Navbar/Footer around every page in this group - this just adds the
// detail page's own content container, without another copy of the shell
// (that duplication was the reported "double header/footer" bug).
function Shell({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>;
}
