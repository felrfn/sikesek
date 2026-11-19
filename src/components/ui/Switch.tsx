"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Accessible on/off slider used for account status fields. The parent owns
 * the value; this only renders the track/knob and reports changes.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative mt-0.5 h-[22px] w-10 shrink-0 rounded-full transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked
            ? "cursor-pointer bg-brand-600 hover:bg-brand-700"
            : "cursor-pointer bg-gray-200 hover:bg-gray-300",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-[3px] left-[3px] size-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-[18px]",
          )}
        />
      </button>
    </div>
  );
}
