import { cn } from "@/lib/utils/cn";

/**
 * Product photography isn't available in this environment, so catalog
 * cards fall back to a labeled gradient placeholder instead of a stock
 * photo. Swap for real images via each record's `imageUrl` once available.
 */
export function ImagePlaceholder({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50 text-center text-sm font-medium text-brand-700",
        className,
      )}
    >
      {label}
    </div>
  );
}
