"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const steps = [
  { path: "/booking", label: "Selection" },
  { path: "/booking/data-entry", label: "Data Entry" },
  { path: "/booking/payment", label: "Payment" },
];

export function StepHeader() {
  const pathname = usePathname();
  const activeIndex = steps.findIndex((step) => step.path === pathname);

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-6 py-4">
      <h1 className="text-lg font-semibold text-gray-900">Book Your Visit</h1>
      <ol className="flex items-center gap-3 text-sm text-gray-400">
        {steps.map((step, index) => (
          <li key={step.path} className="flex items-center gap-3">
            {index > 0 ? <span className="h-px w-8 bg-gray-200" /> : null}
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-xs",
                  index === activeIndex
                    ? "bg-brand-700 text-white"
                    : index < activeIndex
                      ? "bg-brand-100 text-brand-700"
                      : "bg-gray-100 text-gray-400",
                )}
              >
                {index + 1}
              </span>
              <span
                className={
                  index === activeIndex
                    ? "font-medium text-brand-700"
                    : undefined
                }
              >
                {step.label}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
