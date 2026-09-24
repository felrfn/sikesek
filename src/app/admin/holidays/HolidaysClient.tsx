"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatLongDate } from "@/lib/utils/format";
import { createHoliday, deleteHoliday, updateHoliday } from "@/features/holidays/actions";
import type { Holiday } from "@prisma/client";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function HolidaysClient({ holidays }: { holidays: Holiday[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Holiday | "new" | null>(null);

  if (editing) {
    return (
      <HolidayForm
        holiday={editing === "new" ? null : editing}
        onDone={() => {
          setEditing(null);
          router.refresh();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Add Holiday
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Availability</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {holidays.map((holiday) => (
              <tr key={holiday.id}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {formatLongDate(holiday.date)}
                </td>
                <td className="px-4 py-3 text-gray-700">{holiday.name}</td>
                <td className="px-4 py-3 max-w-xs truncate text-gray-500">
                  {holiday.description ?? "-"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={holiday.isClosed ? "danger" : "success"}>
                    {holiday.isClosed ? "Closed" : "Open (holiday pricing)"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(holiday)}>
                      Edit
                    </Button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete holiday "${holiday.name}"?`)) return;
                        await deleteHoliday(holiday.id);
                        router.refresh();
                      }}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {holidays.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No holidays configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function HolidayForm({
  holiday,
  onDone,
  onCancel,
}: {
  holiday: Holiday | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = holiday
      ? await updateHoliday(holiday.id, formData)
      : await createHoliday(formData);

    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <Card className="max-w-lg p-6">
      <h2 className="font-semibold text-gray-900">
        {holiday ? "Edit Holiday" : "Add Holiday"}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Date
          <input
            name="date"
            type="date"
            required
            defaultValue={holiday ? toDateInputValue(holiday.date) : undefined}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Name
          <input
            name="name"
            required
            placeholder="e.g. Independence Day"
            defaultValue={holiday?.name}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Description (optional)
          <textarea
            name="description"
            rows={2}
            defaultValue={holiday?.description ?? ""}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-start gap-2 rounded-md bg-cream-50 p-3 text-sm text-gray-700">
          <input
            type="checkbox"
            name="isClosed"
            value="true"
            defaultChecked={holiday?.isClosed}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Closed for bookings</span>
            <br />
            <span className="text-xs text-gray-500">
              If unchecked, this date stays bookable but every homestay charges its
              configured holiday price instead of weekday/weekend price.
            </span>
          </span>
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
