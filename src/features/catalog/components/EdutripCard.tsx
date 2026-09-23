import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils/format";
import type { getActiveEdutripPackages } from "@/features/catalog/service";

type EdutripPackage = Awaited<
  ReturnType<typeof getActiveEdutripPackages>
>[number];

export function EdutripCard({ pkg }: { pkg: EdutripPackage }) {
  return (
    <Card className="relative flex flex-col gap-3 p-4">
      {pkg.isPopular ? (
        <Badge tone="warning" className="absolute right-3 top-3">
          POPULAR
        </Badge>
      ) : null}
      <div>
        <h3 className="font-semibold uppercase text-gray-900">{pkg.name}</h3>
        <p className="mt-1 text-xs uppercase text-gray-500">Hanya</p>
        <p className="text-lg font-bold text-gray-900">
          {formatCurrency(pkg.pricePerPax)}
          <span className="text-sm font-normal text-gray-500">/pax</span>
        </p>
      </div>
      <ul className="space-y-1 text-sm text-gray-600">
        {pkg.activities.map(({ activity }) => (
          <li key={activity.id} className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-brand-600" />
            {activity.name}
          </li>
        ))}
      </ul>
    </Card>
  );
}
