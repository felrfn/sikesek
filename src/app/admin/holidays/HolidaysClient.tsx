"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Plus,
  Search,
  SearchX,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { formatLongDate } from "@/lib/utils/format";
import { getTodayInJakarta } from "@/lib/siteConfig";
import {
  createHoliday,
  deleteHoliday,
  updateHoliday,
} from "@/features/holidays/actions";
import type { Holiday } from "@prisma/client";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function HolidaysClient({ holidays }: { holidays: Holiday[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Holiday | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const today = getTodayInJakarta();

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return holidays
      .filter(
        (holiday) =>
          !term ||
          `${holiday.name} ${holiday.description ?? ""}`
            .toLowerCase()
            .includes(term),
      )
      .sort((a, b) => {
        const diff =
          new Date(a.date).getTime() - new Date(b.date).getTime();
        return sortAsc ? diff : -diff;
      });
  }, [holidays, query, sortAsc]);

  const closedCount = holidays.filter((holiday) => holiday.isClosed).length;
  const openCount = holidays.length - closedCount;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-brand-50 p-4">
          <CalendarDays className="size-5 text-brand-700" />
          <p className="mt-3 text-sm text-gray-500">Total Hari Libur</p>
          <p className="text-2xl font-bold text-brand-800">{holidays.length}</p>
        </Card>
        <Card className="bg-red-50 p-4">
          <CalendarDays className="size-5 text-red-600" />
          <p className="mt-3 text-sm text-gray-500">Ditutup</p>
          <p className="text-2xl font-bold text-red-700">{closedCount}</p>
        </Card>
        <Card className="bg-green-50 p-4">
          <CalendarDays className="size-5 text-green-600" />
          <p className="mt-3 text-sm text-gray-500">Buka (Harga Libur)</p>
          <p className="text-2xl font-bold text-green-700">{openCount}</p>
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama hari libur…"
              className="h-9 w-56 rounded-lg border border-gray-200 bg-white pr-3 pl-9 text-sm outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortAsc((value) => !value)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            Tanggal
            {sortAsc ? (
              <ArrowUp className="size-3.5" />
            ) : (
              <ArrowDown className="size-3.5" />
            )}
          </button>
        </div>

        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Tambah Hari Libur
        </Button>
      </div>

      <Card className="mt-3">
        <div className="overflow-x-auto rounded-b-xl">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-50 text-xs tracking-wide text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Deskripsi</th>
                <th className="px-4 py-3">Ketersediaan</th>
                <th className="w-12 px-4 py-3">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((holiday) => {
                const upcoming = toDateInputValue(holiday.date) >= today;
                return (
                  <tr
                    key={holiday.id}
                    onClick={() => setEditing(holiday)}
                    title="Klik untuk mengedit"
                    className="cursor-pointer transition-colors hover:bg-gray-50/70"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-medium text-gray-900">
                        {formatLongDate(holiday.date)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {upcoming ? "Akan datang" : "Sudah lewat"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{holiday.name}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-500">
                      {holiday.description ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={holiday.isClosed ? "danger" : "success"}>
                        {holiday.isClosed ? "Tutup" : "Buka (harga libur)"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            if (
                              !confirm(
                                `Hapus hari libur "${holiday.name}"? Tindakan ini tidak dapat dibatalkan.`,
                              )
                            ) {
                              return;
                            }
                            await deleteHoliday(holiday.id);
                            router.refresh();
                          }}
                          aria-label={`Hapus ${holiday.name}`}
                          title="Hapus hari libur"
                          className="rounded-md border border-gray-200 p-1.5 text-red-500 transition-colors hover:border-red-300 hover:bg-red-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <SearchX className="mx-auto size-8 text-gray-300" />
                    <p className="mt-3 text-sm font-medium text-gray-700">
                      {holidays.length === 0
                        ? "Belum ada hari libur"
                        : "Tidak ada hari libur yang cocok"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {holidays.length === 0
                        ? "Tambahkan hari libur pertama lewat tombol di atas."
                        : "Coba ubah kata kunci pencarian."}
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Tambah Hari Libur" : "Edit Hari Libur"}
      >
        {editing ? (
          <HolidayForm
            holiday={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              router.refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Drawer>
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-gray-500">
        Tanggal libur bisa ditutup total atau tetap bisa dipesan dengan harga
        hari libur.
      </p>
        <label className="block text-sm font-medium text-gray-700">
          Tanggal
          <input
            name="date"
            type="date"
            required
            defaultValue={holiday ? toDateInputValue(holiday.date) : undefined}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Nama
          <input
            name="name"
            required
            placeholder="Contoh: Hari Kemerdekaan"
            defaultValue={holiday?.name}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Deskripsi
          <textarea
            name="description"
            rows={2}
            placeholder="Keterangan tambahan bila perlu"
            defaultValue={holiday?.description ?? ""}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-cream-50 p-3 text-sm text-gray-700">
          <input
            type="checkbox"
            name="isClosed"
            value="true"
            defaultChecked={holiday?.isClosed}
            className="mt-0.5 size-4 rounded border-gray-300 accent-brand-700"
          />
          <span>
            <span className="font-medium">Tutup untuk booking</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              Jika tidak dicentang, tanggal ini tetap bisa dipesan tetapi semua
              homestay memakai harga hari libur.
            </span>
          </span>
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 border-t border-gray-100 pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Batal
          </Button>
        </div>
    </form>
  );
}
