import { Bell, Search } from "lucide-react";

export function AdminTopbar({
  title,
  searchPlaceholder = "Search...",
}: {
  title?: string;
  searchPlaceholder?: string;
}) {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      {title ? (
        <p className="font-semibold text-brand-700">{title}</p>
      ) : (
        <label className="flex w-72 items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-400">
          <Search className="size-4" />
          <input
            placeholder={searchPlaceholder}
            className="w-full outline-none placeholder:text-gray-400"
          />
        </label>
      )}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100"
        >
          <Bell className="size-5" />
        </button>
        <div className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
          AD
        </div>
      </div>
    </header>
  );
}
