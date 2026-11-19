"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  CircleCheck,
  Copy,
  Plus,
  Search,
  SearchX,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import {
  createKtrArea,
  deleteKtrArea,
  setKtrAreaActive,
  updateKtrArea,
} from "@/features/ktrAreas/actions";
import type { KtrAreaRow, OfficerOption } from "@/features/ktrAreas/types";

export function KtrAreasClient({
  areas,
  officers,
}: {
  areas: KtrAreaRow[];
  officers: OfficerOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<KtrAreaRow | "new" | null>(null);
  const [createdAreaId, setCreatedAreaId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function copyAreaId(areaId: string) {
    try {
      await navigator.clipboard.writeText(areaId);
      setCopiedId(areaId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard can be blocked by the browser; the id is still visible to
      // select manually, so this is not worth surfacing as an error.
    }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return areas;
    return areas.filter((area) =>
      `${area.name} ${area.locationDescription ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [areas, query]);

  const activeCount = areas.filter((area) => area.isActive).length;
  const detectionCount = areas.reduce(
    (sum, area) => sum + area.detectionCount,
    0,
  );

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-brand-50 p-4">
          <Camera className="size-5 text-brand-700" />
          <p className="mt-3 text-sm text-gray-500">Total Area</p>
          <p className="text-2xl font-bold text-brand-800">{areas.length}</p>
        </Card>
        <Card className="bg-green-50 p-4">
          <CircleCheck className="size-5 text-green-600" />
          <p className="mt-3 text-sm text-gray-500">Area Aktif</p>
          <p className="text-2xl font-bold text-green-700">{activeCount}</p>
        </Card>
        <Card className="bg-amber-50 p-4">
          <Camera className="size-5 text-amber-600" />
          <p className="mt-3 text-sm text-gray-500">Total Deteksi</p>
          <p className="text-2xl font-bold text-amber-700">{detectionCount}</p>
        </Card>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama area…"
            className="h-9 w-56 rounded-lg border border-gray-200 bg-white pr-3 pl-9 text-sm outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCreatedAreaId(null);
            setEditing("new");
          }}
        >
          <Plus className="size-4" />
          Tambah Area
        </Button>
      </div>

      {createdAreaId ? (
        <Card className="mt-4 border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Area berhasil dibuat. Berikan id ini ke pipeline AI (atau biarkan
            pipeline mengambilnya dari{" "}
            <code className="rounded bg-white/70 px-1">GET /api/ktr/areas</code>):
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-white px-2 py-1 font-mono text-xs text-gray-800">
              {createdAreaId}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyAreaId(createdAreaId)}
            >
              {copiedId === createdAreaId ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copiedId === createdAreaId ? "Tersalin" : "Salin"}
            </Button>
            <button
              type="button"
              className="text-sm text-green-800 hover:underline"
              onClick={() => setCreatedAreaId(null)}
            >
              Tutup
            </button>
          </div>
        </Card>
      ) : null}

      {actionError ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </p>
      ) : null}

      <Card className="mt-4">
        <div className="overflow-x-auto rounded-b-xl">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-gray-50 text-xs tracking-wide text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Stream</th>
                <th className="px-4 py-3">Petugas Default</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deteksi</th>
                <th className="w-44 px-4 py-3">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((area) => (
                <tr
                  key={area.id}
                  onClick={() => {
                    setCreatedAreaId(null);
                    setEditing(area);
                  }}
                  title="Klik untuk mengedit"
                  className="cursor-pointer transition-colors hover:bg-gray-50/70"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{area.name}</p>
                    <p className="text-xs text-gray-500">
                      {area.locationDescription ?? "Belum ada deskripsi lokasi"}
                    </p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void copyAreaId(area.id);
                      }}
                      title={`Salin area id: ${area.id}`}
                      className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-gray-400 hover:text-brand-700"
                    >
                      {copiedId === area.id ? (
                        <Check className="size-3" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {area.id}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="block max-w-56 truncate font-mono text-xs text-gray-600"
                      title={area.streamUrl ?? undefined}
                    >
                      {area.streamUrl ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {area.assignedEmployee?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={area.isActive ? "success" : "neutral"}>
                      {area.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {area.detectionCount}
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex justify-end gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="whitespace-nowrap"
                        disabled={busyId === area.id}
                        onClick={async () => {
                          setBusyId(area.id);
                          setActionError(null);
                          const result = await setKtrAreaActive(
                            area.id,
                            !area.isActive,
                          );
                          setBusyId(null);
                          if (result.error) setActionError(result.error);
                          else router.refresh();
                        }}
                      >
                        {area.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <button
                        type="button"
                        title="Hapus area"
                        aria-label={`Hapus ${area.name}`}
                        disabled={busyId === area.id}
                        onClick={async () => {
                          if (
                            !confirm(
                              `Hapus area "${area.name}"? Area yang sudah punya riwayat deteksi hanya bisa dinonaktifkan.`,
                            )
                          ) {
                            return;
                          }
                          setBusyId(area.id);
                          setActionError(null);
                          const result = await deleteKtrArea(area.id);
                          setBusyId(null);
                          if (result.error) setActionError(result.error);
                          else router.refresh();
                        }}
                        className="rounded-md border border-gray-200 p-1.5 text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <SearchX className="mx-auto size-8 text-gray-300" />
                    <p className="mt-3 text-sm font-medium text-gray-700">
                      {areas.length === 0
                        ? "Belum ada area terpantau"
                        : "Tidak ada area yang cocok"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {areas.length === 0
                        ? "Tambahkan kamera pertama lewat tombol di atas."
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
        title={editing === "new" ? "Tambah Area Terpantau" : "Edit Area Terpantau"}
      >
        {editing ? (
          <KtrAreaForm
            area={editing === "new" ? null : editing}
            officers={officers}
            onCancel={() => setEditing(null)}
            onSaved={(areaId) => {
              setEditing(null);
              setActionError(null);
              if (areaId) setCreatedAreaId(areaId);
              router.refresh();
            }}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

function KtrAreaForm({
  area,
  officers,
  onSaved,
  onCancel,
}: {
  area: KtrAreaRow | null;
  officers: OfficerOption[];
  onSaved: (areaId: string | null) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = area
      ? await updateKtrArea(area.id, formData)
      : await createKtrArea(formData);

    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved(area ? null : result.areaId ?? "");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-gray-500">
        Satu baris per kamera/zona. Pipeline AI melaporkan deteksi memakai id
        area ini.
      </p>
        <label className="block text-sm font-medium text-gray-700">
          Nama area
          <input
            name="name"
            required
            maxLength={120}
            placeholder="Contoh: Gazebo 01"
            defaultValue={area?.name}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Deskripsi lokasi
          <input
            name="locationDescription"
            maxLength={500}
            placeholder="Contoh: sisi utara kolam utama"
            defaultValue={area?.locationDescription ?? ""}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </label>

        <label className="block text-sm font-medium text-gray-700">
          URL stream kamera
          <input
            name="streamUrl"
            maxLength={2048}
            placeholder="rtsp://camera.local/stream"
            defaultValue={area?.streamUrl ?? ""}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            Hanya referensi untuk pipeline AI. Kamera bisa dikelola pipeline
            sendiri, jadi kolom ini boleh dikosongkan.
          </span>
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Petugas default
          <select
            name="assignedEmployeeId"
            defaultValue={area?.assignedEmployee?.id ?? ""}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          >
            <option value="">— Tidak ada —</option>
            {officers.map((officer) => (
              <option key={officer.id} value={officer.id}>
                {officer.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-gray-500">
            Hanya informasi; tidak menugaskan deteksi secara otomatis. Tugas
            tetap diberikan dari halaman KTR Monitoring.
          </span>
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Status
          <select
            name="isActive"
            defaultValue={area ? String(area.isActive) : "true"}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          >
            <option value="true">Aktif — menerima deteksi</option>
            <option value="false">Nonaktif — menolak deteksi</option>
          </select>
        </label>

        {area ? (
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Area id</p>
            <code className="font-mono text-xs text-gray-800">{area.id}</code>
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 border-t border-gray-100 pt-4">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Batal
          </Button>
        </div>
    </form>
  );
}
