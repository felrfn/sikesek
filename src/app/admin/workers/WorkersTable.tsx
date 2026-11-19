"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { mailtoHref, whatsappHref } from "@/lib/utils/contact";

type WorkerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  approvedAt: Date | null;
  today: string;
};

const TODAY_META: Record<
  string,
  { label: string; tone: "success" | "danger" | "warning" | "neutral" }
> = {
  AVAILABLE: { label: "Tersedia", tone: "success" },
  UNAVAILABLE: { label: "Tidak tersedia", tone: "danger" },
  LEAVE: { label: "Cuti", tone: "warning" },
  OFF: { label: "Libur", tone: "neutral" },
};

export function WorkersTable({ workers }: { workers: WorkerRow[] }) {
  const router = useRouter();
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(
    () =>
      [...workers].sort(
        (a, b) => a.name.localeCompare(b.name, "id") * (sortAsc ? 1 : -1),
      ),
    [workers, sortAsc],
  );

  return (
    <Card>
      <div className="overflow-x-auto rounded-b-xl">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-gray-50 text-xs tracking-wide text-gray-400 uppercase">
            <tr>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSortAsc((value) => !value)}
                  title="Urutkan berdasarkan nama"
                  className="inline-flex items-center gap-1 transition-colors hover:text-gray-700"
                >
                  Nama
                  {sortAsc ? (
                    <ArrowUp className="size-3.5 text-brand-700" />
                  ) : (
                    <ArrowDown className="size-3.5 text-brand-700" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3">Kontak</th>
              <th className="px-4 py-3">Status Akun</th>
              <th className="px-4 py-3">Hari Ini</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((worker) => {
              const today = TODAY_META[worker.today] ?? TODAY_META.OFF;
              return (
                <tr
                  key={worker.id}
                  onClick={() => router.push(`/admin/workers/${worker.id}`)}
                  title="Klik untuk melihat detail"
                  className="cursor-pointer transition-colors hover:bg-gray-50/70"
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap text-gray-900">
                    {worker.name}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={mailtoHref(worker.email)}
                      onClick={(event) => event.stopPropagation()}
                      className="block text-gray-600 hover:text-brand-700 hover:underline"
                    >
                      {worker.email}
                    </a>
                    {worker.phone ? (
                      <a
                        href={whatsappHref(worker.phone)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="block text-xs text-gray-500 hover:text-brand-700 hover:underline"
                      >
                        {worker.phone}
                      </a>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={worker.approvedAt ? "success" : "neutral"}>
                      {worker.approvedAt ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={today.tone}>{today.label}</Badge>
                  </td>
                </tr>
              );
            })}

            {workers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                  Belum ada petugas lapangan.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
