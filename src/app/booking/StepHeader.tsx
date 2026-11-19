"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const steps = [
  { path: "/booking", label: "Pilih Layanan" },
  { path: "/booking/data-entry", label: "Data Pemesan" },
  { path: "/booking/payment", label: "Pembayaran" },
];

export function StepHeader() {
  const pathname = usePathname();
  const foundIndex = steps.findIndex((step) => step.path === pathname);
  const activeIndex = Math.max(0, foundIndex);
  const activeStep = steps[activeIndex];

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 sm:px-6">
      {/* Compact stepper for phones: one line of context plus a segmented
          progress bar, so the three long labels never wrap into a mess. */}
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Langkah {activeIndex + 1} dari {steps.length}
          </p>
          <p className="truncate font-semibold text-gray-900">
            {activeStep.label}
          </p>
        </div>
        <div className="flex shrink-0 gap-1" aria-hidden="true">
          {steps.map((step, index) => (
            <span
              key={step.path}
              className={cn(
                "h-1.5 w-6 rounded-full",
                index <= activeIndex ? "bg-brand-700" : "bg-gray-200",
              )}
            />
          ))}
        </div>
      </div>

      <div className="hidden gap-4 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold whitespace-nowrap text-gray-900">
          Pesan Kunjungan Anda
        </h1>
        <ol className="flex items-center gap-3 text-sm text-gray-400">
          {steps.map((step, index) => {
            const isDone = index < activeIndex;
            const isCurrent = index === activeIndex;
            const body = (
              <>
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-xs",
                    isCurrent
                      ? "bg-brand-700 text-white"
                      : isDone
                        ? "bg-brand-100 text-brand-700"
                        : "bg-gray-100 text-gray-400",
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap",
                    isCurrent ? "font-medium text-brand-700" : undefined,
                  )}
                >
                  {step.label}
                </span>
              </>
            );

            return (
              <li key={step.path} className="flex items-center gap-3">
                {index > 0 ? (
                  <span className="h-px w-6 bg-gray-200" aria-hidden="true" />
                ) : null}
                {isDone ? (
                  <Link
                    href={step.path}
                    className="flex items-center gap-2 rounded transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    {body}
                  </Link>
                ) : (
                  <span
                    className="flex items-center gap-2"
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
