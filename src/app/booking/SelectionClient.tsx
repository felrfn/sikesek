"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Calendar } from "@/components/ui/Calendar";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { formatCurrency, formatLongDate } from "@/lib/utils/format";
import { useCart } from "@/features/booking/CartContext";
import { cartItemKey } from "@/features/booking/types";
import type { getBookableCatalog } from "@/features/catalog/service";

type Catalog = Awaited<ReturnType<typeof getBookableCatalog>>;

type CatalogItem =
  | {
      type: "homestay";
      id: string;
      name: string;
      description: string;
      price: number;
      unit: string;
    }
  | {
      type: "edutrip";
      id: string;
      name: string;
      description: string;
      price: number;
      unit: string;
    }
  | {
      type: "venue";
      id: string;
      name: string;
      description: string;
      price: number;
      unit: string;
    };

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => 8 + i); // 08:00 - 22:00

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function SelectionClient({
  catalog,
  today,
}: {
  catalog: Catalog;
  today: string;
}) {
  const router = useRouter();
  const cart = useCart();
  const [filter, setFilter] = useState<"all" | "homestay" | "venue" | "edutrip">(
    "all",
  );
  const [venueTimes, setVenueTimes] = useState<Record<string, { start: number; end: number }>>(
    {},
  );

  const arrivalDate = cart.arrivalDate || today;

  const items = useMemo<CatalogItem[]>(() => {
    const homestayItems: CatalogItem[] = catalog.homestays.map((h) => ({
      type: "homestay",
      id: h.id,
      name: h.name,
      description: `Inap dengan panorama sungai asri di ${h.name}.`,
      price: Number(h.weekdayPrice),
      unit: "malam",
    }));
    const venueItems: CatalogItem[] = catalog.venues.map((v) => ({
      type: "venue",
      id: v.id,
      name: v.name,
      description: `Kapasitas ${v.minCapacity}-${v.maxCapacity} orang.`,
      price: Number(v.pricePerHour),
      unit: "jam",
    }));
    const edutripItems: CatalogItem[] = catalog.edutrips.map((e) => ({
      type: "edutrip",
      id: e.id,
      name: e.name,
      description: e.activities.map((a) => a.activity.name).join(", "),
      price: Number(e.pricePerPax),
      unit: "pax",
    }));
    if (filter === "homestay") return homestayItems;
    if (filter === "venue") return venueItems;
    if (filter === "edutrip") return edutripItems;
    return [...edutripItems, ...homestayItems, ...venueItems];
  }, [catalog, filter]);

  function isInCart(type: string, id: string) {
    return cart.items.some(
      (item) => item.type === type && item.id === id && item.date === arrivalDate,
    );
  }

  function handleAdd(item: CatalogItem) {
    if (cart.arrivalDate !== arrivalDate) cart.setArrivalDate(arrivalDate);

    if (item.type === "homestay") {
      const homestay = catalog.homestays.find((h) => h.id === item.id);
      if (!homestay) return;
      cart.addItem({
        type: "homestay",
        id: homestay.id,
        name: homestay.name,
        imageUrl: homestay.imageUrl,
        date: arrivalDate,
        pricePerNight: Number(homestay.weekdayPrice),
        tier: "WEEKDAY",
        subtotal: Number(homestay.weekdayPrice),
      });
      return;
    }

    if (item.type === "venue") {
      const venue = catalog.venues.find((v) => v.id === item.id);
      if (!venue) return;
      const times = venueTimes[item.id] ?? { start: 9, end: 10 };
      const hours = Math.max(1, times.end - times.start);
      cart.addItem({
        type: "venue",
        id: venue.id,
        name: venue.name,
        imageUrl: venue.imageUrl,
        date: arrivalDate,
        startHour: times.start,
        endHour: times.end,
        pricePerHour: Number(venue.pricePerHour),
        subtotal: Number(venue.pricePerHour) * hours,
      });
      return;
    }

    const pkg = catalog.edutrips.find((e) => e.id === item.id);
    if (!pkg) return;
    cart.addItem({
      type: "edutrip",
      id: pkg.id,
      name: pkg.name,
      date: arrivalDate,
      pax: 1,
      pricePerPax: Number(pkg.pricePerPax),
      subtotal: Number(pkg.pricePerPax),
    });
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-gray-900">Tanggal Kedatangan</h2>
          <Calendar
            value={arrivalDate}
            onChange={(iso) => cart.setArrivalDate(iso)}
            today={today}
          />
        </Card>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Ticket Types &amp; Facilities
            </h2>
            <div className="flex gap-1 rounded-full bg-gray-100 p-1 text-sm">
              {(["all", "homestay", "venue", "edutrip"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1 capitalize ${
                    filter === key ? "bg-brand-700 text-white" : "text-gray-500"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <Card key={`${item.type}:${item.id}`} className="p-4">
                <div className="flex items-center gap-4">
                  {item.type === "homestay" ? (
                    <ImagePlaceholder label="" className="size-16 shrink-0 rounded-lg" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase text-gray-400">{item.type}</p>
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <p className="truncate text-sm text-gray-500">{item.description}</p>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <ShieldCheck className="size-3.5" />
                      AVAILABLE
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(item.price)}
                    </p>
                    <p className="text-xs text-gray-400">/{item.unit}</p>
                    {item.type !== "venue" ? (
                      <Button
                        size="sm"
                        variant={isInCart(item.type, item.id) ? "outline" : "primary"}
                        className="mt-2"
                        onClick={() => handleAdd(item)}
                      >
                        {isInCart(item.type, item.id) ? "Added" : "+ Add"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {item.type === "venue" ? (
                  <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-3">
                    <label className="text-xs text-gray-500">
                      Start
                      <select
                        value={venueTimes[item.id]?.start ?? 9}
                        onChange={(e) =>
                          setVenueTimes((prev) => ({
                            ...prev,
                            [item.id]: {
                              start: Number(e.target.value),
                              end: Math.max(
                                Number(e.target.value) + 1,
                                prev[item.id]?.end ?? Number(e.target.value) + 1,
                              ),
                            },
                          }))
                        }
                        className="mt-1 block rounded-md border border-gray-300 px-2 py-1 text-sm"
                      >
                        {HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>
                            {formatHour(h)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-gray-500">
                      End
                      <select
                        value={venueTimes[item.id]?.end ?? 10}
                        onChange={(e) =>
                          setVenueTimes((prev) => ({
                            ...prev,
                            [item.id]: {
                              start: prev[item.id]?.start ?? 9,
                              end: Number(e.target.value),
                            },
                          }))
                        }
                        className="mt-1 block rounded-md border border-gray-300 px-2 py-1 text-sm"
                      >
                        {HOUR_OPTIONS.filter(
                          (h) => h > (venueTimes[item.id]?.start ?? 9),
                        ).map((h) => (
                          <option key={h} value={h}>
                            {formatHour(h)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      size="sm"
                      variant={isInCart("venue", item.id) ? "outline" : "primary"}
                      onClick={() => handleAdd(item)}
                    >
                      {isInCart("venue", item.id) ? "Added" : "+ Add"}
                    </Button>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Card className="sticky top-6 p-5">
          <h2 className="font-semibold text-gray-900">Booking Summary</h2>
          <p className="mt-1 text-sm text-gray-500">
            Arrival: {formatLongDate(arrivalDate)}
          </p>

          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            {cart.items.length === 0 ? (
              <p className="text-sm text-gray-400">No items selected yet.</p>
            ) : (
              cart.items.map((item) => (
                <div
                  key={cartItemKey(item)}
                  className="flex items-start justify-between text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <button
                      type="button"
                      onClick={() => cart.removeItem(cartItemKey(item))}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(item.subtotal)}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="font-semibold text-gray-900">Total</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(cart.total)}
            </p>
          </div>

          <Button
            className="mt-4 w-full"
            variant="primary"
            disabled={cart.items.length === 0}
            onClick={() => router.push("/booking/data-entry")}
          >
            CHECKOUT
            <ChevronRight className="size-4" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
