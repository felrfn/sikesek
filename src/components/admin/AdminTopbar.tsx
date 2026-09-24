import { Bell } from "lucide-react";

// The search box this header used to render here was purely decorative (no
// onChange/state ever wired to it - see the task write-up that asked for
// its removal). Each list page that actually needs search now owns its own
// functional search input next to its own filters instead.
export function AdminTopbar({ title }: { title?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      {title ? <p className="font-semibold text-brand-700">{title}</p> : <div />}
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
