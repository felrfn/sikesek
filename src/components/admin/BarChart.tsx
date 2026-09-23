export function BarChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex h-48 gap-3">
      {data.map((d) => (
        <div
          key={d.label}
          className="flex h-full flex-1 flex-col items-center justify-end gap-2"
        >
          <div
            className="w-full rounded-t bg-green-200"
            style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
          />
          <span className="text-xs text-gray-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
