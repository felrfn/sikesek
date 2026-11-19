"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const steps = [
  { path: "/booking", label: "Pilih Layanan" },
  { path: "/booking/data-entry", label: "Data Pemesan" },
  { path: "/booking/payment", label: "Pembayaran" },
];

export function StepHeader() {
  const pathname = usePathname();
  const activeIndex = steps.findIndex((step) => step.path === pathname);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <h1 className="text-lg font-semibold whitespace-nowrap text-gray-900">
        Pesan Kunjungan Anda
      </h1>
      <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-400 sm:gap-3">
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
                className={cn(
                  "whitespace-nowrap",
                  index === activeIndex
                    ? "font-medium text-brand-700"
                    : undefined,
                )}
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
