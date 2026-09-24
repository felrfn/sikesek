"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { getActivitiesList, getEdutripIncludedItems } from "@/features/facilities/queries";
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
export function EdutripIncludedItemsPicker({ packageId }: { packageId?: string }) {
  const [catalog, setCatalog] = useState<Activity[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    getActivitiesList().then(setCatalog);
    if (packageId) {
      getEdutripIncludedItems(packageId).then((rows) =>
        setItems(rows.map((r) => ({ activityId: r.activityId, name: r.name, descriptionOverride: r.descriptionOverride ?? "" }))),
      );
    }
  }, [packageId]);

  function addExisting(activityId: string) {
    const activity = catalog.find((a) => a.id === activityId);
    if (!activity || items.some((i) => i.activityId === activityId)) return;
    setItems((prev) => [...prev, { activityId, name: activity.name, descriptionOverride: "" }]);
  }

  function addCustom() {
    if (!customName.trim()) return;
    setItems((prev) => [...prev, { name: customName.trim(), descriptionOverride: "" }]);
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
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, descriptionOverride: value } : item)));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Included Items</p>
      <ul className="space-y-1 rounded-md border border-gray-200 p-2">
        {items.map((item, index) => (
          <li key={`${item.activityId ?? item.name}-${index}`} className="rounded-md bg-gray-50 p-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-800">{item.name}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(index, -1)} className="text-gray-400 hover:text-gray-700">
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" onClick={() => move(index, 1)} className="text-gray-400 hover:text-gray-700">
                  <ArrowDown className="size-3.5" />
                </button>
                <button type="button" onClick={() => remove(index)} className="text-gray-400 hover:text-red-600">
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
            <input
              value={item.descriptionOverride}
              onChange={(e) => setOverride(index, e.target.value)}
              placeholder="Description (optional)"
              className="mt-1 block w-full rounded-md border border-gray-200 px-2 py-1 text-xs"
            />
          </li>
        ))}
        {items.length === 0 ? (
          <p className="p-2 text-xs text-gray-400">No included items yet.</p>
        ) : null}
      </ul>

      <div className="flex flex-wrap gap-2">
        <select
          onChange={(e) => {
            if (e.target.value) addExisting(e.target.value);
            e.target.value = "";
          }}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs"
          defaultValue=""
        >
          <option value="" disabled>
            Add from catalog...
          </option>
          {catalog.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="New item name"
            className="rounded-md border border-gray-200 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={addCustom}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            <Plus className="size-3.5" />
            Add
          </button>
        </div>
      </div>

      <input type="hidden" name="includedItemsJson" value={JSON.stringify(items)} />
    </div>
  );
}
