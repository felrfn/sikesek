import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

type Tone = "brand" | "green" | "amber" | "red" | "blue";

const toneClasses: Record<
  Tone,
  { icon: string; value: string; hover: string }
> = {
  brand: {
    icon: "bg-brand-50 text-brand-700",
    value: "text-gray-900",
    hover: "hover:border-brand-300",
  },
  green: {
    icon: "bg-green-50 text-green-700",
    value: "text-gray-900",
    hover: "hover:border-green-300",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700",
    value: "text-amber-700",
    hover: "hover:border-amber-300",
  },
  red: {
    icon: "bg-red-50 text-red-600",
    value: "text-red-600",
    hover: "hover:border-red-300",
  },
  blue: {
    icon: "bg-blue-50 text-blue-700",
    value: "text-gray-900",
    hover: "hover:border-blue-300",
  },
};

/**
 * A dashboard KPI that is also a navigation target. Every card on the
 * dashboard should answer "where do I go next?", which is what the old set of
 * static cards was missing.
 */
export function StatCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  href: string;
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  const classes = toneClasses[tone];

  return (
    <Link href={href} className="group block rounded-xl focus-visible:outline-none">
      <Card
        className={cn(
          "h-full p-4 transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-brand-600 group-focus-visible:ring-offset-2",
          classes.hover,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              classes.icon,
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <ChevronRight
            className="size-4 text-gray-300 transition-colors group-hover:text-gray-500"
            aria-hidden="true"
          />
        </div>
        <p className="mt-3 text-sm text-gray-500">{label}</p>
        <p
          className={cn(
            "mt-0.5 text-2xl font-bold tracking-tight tabular-nums",
            classes.value,
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs leading-5 text-gray-500">{hint}</p> : null}
      </Card>
    </Link>
  );
}
