"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import {
  getActivitiesList,
  getEdutripIncludedItems,
} from "@/features/facilities/queries";
import type { Activity } from "@prisma/client";

interface Item {
  activityId?: string;
  name: string;
  descriptionOverride: string;
}

/**
 * "What's included" editor for an EduTrip package (section 29) - backed by
 * the existing Activity/EdutripPackageActivity relation rather than a new
 * model. Admin can pick from the shared Activity catalog, type a brand-new
 * one inline, and reorder/remove items; the order is serialized as-is into
 * `sortOrder` server-side.
 */
export function EdutripIncludedItemsPicker({
  packageId,
}: {
  packageId?: string;
}) {
  const [catalog, setCatalog] = useState<Activity[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    getActivitiesList().then(setCatalog);
    if (packageId) {
      getEdutripIncludedItems(packageId).then((rows) =>
        setItems(
          rows.map((r) => ({
            activityId: r.activityId,
            name: r.name,
            descriptionOverride: r.descriptionOverride ?? "",
          })),
        ),
      );
    }
  }, [packageId]);

  function addExisting(activityId: string) {
    const activity = catalog.find((a) => a.id === activityId);
    if (!activity || items.some((i) => i.activityId === activityId)) return;
    setItems((prev) => [
      ...prev,
      { activityId, name: activity.name, descriptionOverride: "" },
    ]);
  }

  function addCustom() {
    if (!customName.trim()) return;
    setItems((prev) => [
      ...prev,
      { name: customName.trim(), descriptionOverride: "" },
    ]);
    setCustomName("");
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function setOverride(index: number, value: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, descriptionOverride: value } : item,
      ),
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-2">
        <span className="text-xs font-medium text-gray-500">
          {items.length} item termasuk
        </span>
      </div>

      <ul className="divide-y divide-gray-100">
        {items.map((item, index) => (
          <li key={`${item.activityId ?? item.name}-${index}`} className="p-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                  {index + 1}
                </span>
                <span className="truncate font-medium text-gray-800">
                  {item.name}
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Naikkan ${item.name}`}
                  title="Naikkan"
                  className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label={`Turunkan ${item.name}`}
                  title="Turunkan"
                  className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Hapus ${item.name}`}
                  title="Hapus item"
                  className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
            <input
              value={item.descriptionOverride}
              onChange={(event) => setOverride(index, event.target.value)}
              placeholder="Deskripsi khusus (opsional)"
              className="mt-2 block w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </li>
        ))}

        {items.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-gray-400">
            Belum ada item. Tambahkan dari katalog atau buat item baru.
          </li>
        ) : null}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/60 p-3">
        <select
          onChange={(event) => {
            if (event.target.value) addExisting(event.target.value);
            event.target.value = "";
          }}
          aria-label="Tambah item dari katalog"
          className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          defaultValue=""
        >
          <option value="" disabled>
            Tambah dari katalog…
          </option>
          {catalog.map((activity) => (
            <option key={activity.id} value={activity.id}>
              {activity.name}
            </option>
          ))}
        </select>

        <div className="flex flex-1 items-center gap-1">
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
            placeholder="Nama item baru"
            className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2.5 text-xs outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
          <button
            type="button"
            onClick={addCustom}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <Plus className="size-3.5" />
            Tambah
          </button>
        </div>
      </div>

      <input
        type="hidden"
        name="includedItemsJson"
        value={JSON.stringify(items)}
      />
    </div>
  );
}
