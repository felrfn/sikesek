import { cn } from "@/lib/utils/cn";

export function BarChart({
  data,
}: {
  data: { label: string; fullLabel?: string; count: number }[];
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 text-center">
        <p className="text-sm font-medium text-gray-600">Belum ada booking</p>
        <p className="mt-1 text-xs text-gray-400">
          Tidak ada booking baru dalam 7 hari terakhir.
        </p>
      </div>
    );
  }

  const max = Math.max(...data.map((item) => item.count));

  return (
    <div
      role="img"
      aria-label={`Grafik booking 7 hari terakhir, total ${total} booking.`}
      className="flex flex-col"
    >
      <div className="relative flex h-44 items-end gap-2 border-b border-gray-200">
        {/* Horizontal guide lines, purely decorative. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => (
            <div key={line} className="border-t border-gray-100" />
          ))}
        </div>

        {data.map((item) => {
          const height = Math.max(3, (item.count / max) * 150);
          return (
            <div
              key={item.label}
              className="group relative z-10 flex h-full flex-1 flex-col items-center justify-end"
              title={`${item.fullLabel ?? item.label}: ${item.count} booking`}
            >
              <span
                className={cn(
                  "mb-1 text-[10px] font-semibold tabular-nums",
                  item.count === 0 ? "text-gray-300" : "text-gray-600",
                )}
              >
                {item.count}
              </span>
              <div
                className={cn(
                  "w-full max-w-10 rounded-t transition-colors",
                  item.count === 0
                    ? "bg-gray-100"
                    : "bg-brand-600 group-hover:bg-brand-700",
                )}
                style={{ height: `${height}px` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2">
        {data.map((item) => (
          <span
            key={item.label}
            className="flex-1 text-center text-[11px] text-gray-500"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
