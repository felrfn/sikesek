import Image from "next/image";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { formatCurrency } from "@/lib/utils/format";
import { FacilityIcon } from "@/features/catalog/facilityIcons";
import type { getActiveHomestays } from "@/features/catalog/service";

type Homestay = Awaited<ReturnType<typeof getActiveHomestays>>[number];

export function HomestayCard({ homestay }: { homestay: Homestay }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <Link href={`/facilities/homestay/${homestay.id}`} className="relative block h-40 w-full">
        {homestay.imageUrl ? (
          <Image
            src={homestay.imageUrl}
            alt={homestay.name}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover"
          />
        ) : (
          <ImagePlaceholder label={homestay.name} className="h-full w-full" />
        )}
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700">
          <Users className="size-3.5" />
          {homestay.minCapacity}-{homestay.maxCapacity} Pax
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link href={`/facilities/homestay/${homestay.id}`}>
          <h3 className="font-semibold uppercase text-gray-900 hover:text-brand-700">
            {homestay.name}
          </h3>
        </Link>
        <dl className="space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <dt>Weekday</dt>
            <dd className="font-medium text-gray-900">
              {formatCurrency(homestay.weekdayPrice)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Weekend</dt>
            <dd className="font-medium text-gray-900">
              {formatCurrency(homestay.weekendPrice)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Holiday</dt>
            <dd className="font-medium text-gray-900">
              {formatCurrency(homestay.holidayPrice)}
            </dd>
          </div>
        </dl>
        <div className="mt-auto rounded-lg bg-cream-50 p-3 text-xs text-gray-600">
          <p className="mb-1.5 font-medium text-gray-700">Facilities:</p>
          <ul className="grid grid-cols-2 gap-1">
            {homestay.facilities.map(({ facility }) => (
              <li key={facility.id} className="flex items-center gap-1.5">
                <FacilityIcon iconName={facility.iconName} />
                {facility.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
