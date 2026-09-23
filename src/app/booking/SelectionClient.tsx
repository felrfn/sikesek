"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { formatCurrency, formatLongDate } from "@/lib/utils/format";
import { useCart } from "@/features/booking/CartContext";
import { cartItemKey } from "@/features/booking/types";
import type { getBookableCatalog } from "@/features/catalog/service";

type Catalog = Awaited<ReturnType<typeof getBookableCatalog>>;

const WEEKDAY_LABELS = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];
const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  return start;
}

export function SelectionClient({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const cart = useCart();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(cart.arrivalDate)),
  );
  const [filter, setFilter] = useState<"all" | "homestay" | "edutrip">("all");

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const items = useMemo(() => {
    const homestayItems = catalog.homestays.map((h) => ({
      type: "homestay" as const,
      id: h.id,
      name: h.name,
      description: `Inap dengan panorama sungai asri di ${h.name}.`,
      price: Number(h.weekdayPrice),
      unit: "malam",
    }));
    const edutripItems = catalog.edutrips.map((e) => ({
      type: "edutrip" as const,
      id: e.id,
      name: e.name,
      description: e.activities.map((a) => a.activity.name).join(", "),
      price: Number(e.pricePerPax),
      unit: "pax",
    }));
    if (filter === "homestay") return homestayItems;
    if (filter === "edutrip") return edutripItems;
    return [...edutripItems, ...homestayItems];
  }, [catalog, filter]);

  function isInCart(type: string, id: string) {
    return cart.items.some(
      (item) => item.type === type && item.id === id && item.date === cart.arrivalDate,
    );
  }

  function handleAdd(item: (typeof items)[number]) {
    if (item.type === "homestay") {
      const homestay = catalog.homestays.find((h) => h.id === item.id);
      if (!homestay) return;
      cart.addItem({
        type: "homestay",
        id: homestay.id,
        name: homestay.name,
        imageUrl: homestay.imageUrl,
        date: cart.arrivalDate,
        pricePerNight: Number(homestay.weekdayPrice),
        tier: "WEEKDAY",
        subtotal: Number(homestay.weekdayPrice),
      });
    } else {
      const pkg = catalog.edutrips.find((e) => e.id === item.id);
      if (!pkg) return;
      cart.addItem({
        type: "edutrip",
        id: pkg.id,
        name: pkg.name,
        date: cart.arrivalDate,
        pax: 1,
        pricePerPax: Number(pkg.pricePerPax),
        subtotal: Number(pkg.pricePerPax),
      });
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Tanggal Kedatangan</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() - 7);
                  setWeekStart(d);
                }}
                className="rounded p-1 hover:bg-gray-100"
                aria-label="Previous week"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span>
                {MONTH_LABELS[weekDays[3].getMonth()]} {weekDays[3].getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() + 7);
                  setWeekStart(d);
                }}
                className="rounded p-1 hover:bg-gray-100"
                aria-label="Next week"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const iso = toIsoDate(day);
              const selected = iso === cart.arrivalDate;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => cart.setArrivalDate(iso)}
                  className={`flex flex-col items-center gap-1 rounded-lg border py-2 text-sm ${
                    selected
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-gray-200 text-gray-600 hover:border-brand-300"
                  }`}
                >
                  <span className="text-xs opacity-70">
                    {WEEKDAY_LABELS[day.getDay()]}
                  </span>
                  <span className="font-semibold">{day.getDate()}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Ticket Types &amp; Facilities
            </h2>
            <div className="flex gap-1 rounded-full bg-gray-100 p-1 text-sm">
              {(["all", "homestay", "edutrip"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1 capitalize ${
                    filter === key
                      ? "bg-brand-700 text-white"
                      : "text-gray-500"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <Card
                key={`${item.type}:${item.id}`}
                className="flex items-center gap-4 p-4"
              >
                {item.type === "homestay" ? (
                  <ImagePlaceholder
                    label=""
                    className="size-16 shrink-0 rounded-lg"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase text-gray-400">
                    {item.type}
                  </p>
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="truncate text-sm text-gray-500">
                    {item.description}
                  </p>
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
                  <Button
                    size="sm"
                    variant={isInCart(item.type, item.id) ? "outline" : "primary"}
                    className="mt-2"
                    onClick={() => handleAdd(item)}
                  >
                    {isInCart(item.type, item.id) ? "Added" : "+ Add"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Card className="sticky top-6 p-5">
          <h2 className="font-semibold text-gray-900">Booking Summary</h2>
          <p className="mt-1 text-sm text-gray-500">
            Arrival: {formatLongDate(cart.arrivalDate)}
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
