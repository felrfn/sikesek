"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { setWorkerAvailability } from "@/features/workers/actions";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_OPTIONS = ["AVAILABLE", "UNAVAILABLE", "LEAVE", "OFF"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const statusTone: Record<Status, "success" | "danger" | "warning" | "neutral"> = {
  AVAILABLE: "success",
  UNAVAILABLE: "danger",
  LEAVE: "warning",
  OFF: "neutral",
};

interface ScheduleEntry {
  date: string; // YYYY-MM-DD
  status: Status;
  note: string | null;
}

/**
 * Month calendar view of one worker's availability (section 6) - a missing
 * day is implicitly AVAILABLE (matching the WorkerSchedule model's
 * default-available convention), so admins only ever need to record
 * exceptions rather than every ordinary working day.
 */
export function WorkerAvailabilityCalendar({
  workerId,
  yearMonth,
  schedule,
}: {
  workerId: string;
  yearMonth: string;
  schedule: ScheduleEntry[];
}) {
  const router = useRouter();
  const [year, month] = yearMonth.split("-").map(Number);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const scheduleByDate = new Map(schedule.map((s) => [s.date, s]));
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = firstDay.getUTCDay();

  function navTo(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    router.push(`/admin/workers/${workerId}?month=${next}`);
  }

  function handleSet(status: Status, note: string) {
    if (!editingDate) return;
    setError(null);
    startTransition(async () => {
      const result = await setWorkerAvailability({
        workerId,
        date: editingDate,
        status,
        note: note || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditingDate(null);
      router.refresh();
    });
  }

  const editing = editingDate ? scheduleByDate.get(editingDate) : undefined;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navTo(-1)}
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="font-medium text-gray-900">
          {MONTH_LABELS[month - 1]} {year}
        </p>
        <button
          type="button"
          onClick={() => navTo(1)}
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const entry = scheduleByDate.get(dateStr);
          const status: Status = entry?.status ?? "AVAILABLE";
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setEditingDate(dateStr)}
              className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border border-gray-100 p-1 text-xs hover:bg-gray-50"
            >
              <span className="text-gray-700">{day}</span>
              <span
                className={`size-1.5 rounded-full ${
                  status === "AVAILABLE"
                    ? "bg-green-500"
                    : status === "UNAVAILABLE"
                      ? "bg-red-500"
                      : status === "LEAVE"
                        ? "bg-amber-500"
                        : "bg-gray-400"
                }`}
              />
            </button>
          );
        })}
      </div>

      <Modal
        open={editingDate !== null}
        onClose={() => setEditingDate(null)}
        title={editingDate ?? ""}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={isPending}
                onClick={() => handleSet(s, editing?.note ?? "")}
                className="rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50"
              >
                <Badge tone={statusTone[s]}>{s}</Badge>
              </button>
            ))}
          </div>
          <label className="block text-sm text-gray-700">
            Reason / note (optional)
            <input
              key={editingDate}
              defaultValue={editing?.note ?? ""}
              onBlur={(e) => {
                if (editing) handleSet(editing.status, e.target.value);
              }}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. Family event"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setEditingDate(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
