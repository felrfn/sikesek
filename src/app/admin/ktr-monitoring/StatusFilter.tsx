"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { DetectionStatus } from "@prisma/client";

const STATUS_OPTIONS: DetectionStatus[] = [
  "DETECTED",
  "NOTIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "FALSE_POSITIVE",
  "DISMISSED",
];

/**
 * Composes with the Today/All tabs and date-range filter (all URL-param
 * driven) rather than resetting them - a plain <form method="get"> would
 * have dropped every other query param on submit (section 44).
 */
export function StatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(status: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (status) next.set("status", status);
    else next.delete("status");
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-xs text-gray-500">
      Status
      <select
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(e) => apply(e.target.value)}
        className="rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700"
      >
        <option value="">All</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
