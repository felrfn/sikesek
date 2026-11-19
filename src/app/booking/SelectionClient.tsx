"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Calendar } from "@/components/ui/Calendar";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { formatCurrency, formatLongDate } from "@/lib/utils/format";
import { getMaxBookableDate } from "@/lib/siteConfig";
import type { RateTier } from "@/lib/pricing";
import { useCart } from "@/features/booking/CartContext";
import { cartItemKey, type CartItem } from "@/features/booking/types";
import { checkItemAvailability } from "@/features/booking/actions";
import { getHomestayPricesForDate } from "@/features/catalog/pricing";
import type { CartItemInput } from "@/lib/validation/booking";
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
      imageUrl: string | null;
    }
  | {
      type: "edutrip";
      id: string;
      name: string;
      description: string;
      price: number;
      unit: string;
      imageUrl: string | null;
    }
  | {
      type: "venue";
      id: string;
      name: string;
      description: string;
      price: number;
      unit: string;
      imageUrl: string | null;
    };

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => 8 + i); // 08:00 - 22:00

const FILTER_LABELS = {
  all: "Semua",
  homestay: "Homestay",
  venue: "Venue",
  edutrip: "Edutrip",
} as const;

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function SelectionClient({
  catalog,
  today,
  closedDates,
}: {
  catalog: Catalog;
  today: string;
  closedDates: string[];
}) {
  const router = useRouter();
  const cart = useCart();
  const [filter, setFilter] = useState<"all" | "homestay" | "venue" | "edutrip">(
    "all",
  );
  const [venueTimes, setVenueTimes] = useState<Record<string, { start: number; end: number }>>(
    {},
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const arrivalDate = cart.arrivalDate || today;
  const maxBookableDate = useMemo(() => getMaxBookableDate(today), [today]);

  // Section 8/9/10: the displayed and charged price must always agree, and
  // there is exactly one place that calculates it - the backend's
  // getHomestayNightlyRate (via this server action), not a client-side
  // weekday/weekend guess. Refetched whenever the selected date changes.
  const [homestayPrices, setHomestayPrices] = useState<
    Record<string, { amount: number; tier: RateTier }>
  >({});
  const [pricesLoading, setPricesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Resetting to "loading" when the date changes (not just on mount) is
    // syncing with sessionStorage/an external fetch, not deriving state
    // from props/state - the valid exception to this lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPricesLoading(true);
    getHomestayPricesForDate(arrivalDate).then((prices) => {
      if (!cancelled) {
        setHomestayPrices(prices);
        setPricesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [arrivalDate]);

  // Bottom-sheet plumbing: close on Escape and stop the page behind it from
  // scrolling while the sheet is open (mobile/tablet only - desktop uses the
  // sticky right-hand summary instead).
  useEffect(() => {
    if (!summaryOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSummaryOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [summaryOpen]);

  const items = useMemo<CatalogItem[]>(() => {
    const homestayItems: CatalogItem[] = catalog.homestays.map((h) => ({
      type: "homestay",
      id: h.id,
      name: h.name,
      description: `Inap dengan panorama sungai asri di ${h.name}.`,
      price: homestayPrices[h.id]?.amount ?? Number(h.weekdayPrice),
      unit: "malam",
      imageUrl: h.imageUrl,
    }));
    const venueItems: CatalogItem[] = catalog.venues.map((v) => ({
      type: "venue",
      id: v.id,
      name: v.name,
      description: `Kapasitas ${v.minCapacity}-${v.maxCapacity} orang.`,
      price: Number(v.pricePerHour),
      unit: "jam",
      imageUrl: v.imageUrl,
    }));
    const edutripItems: CatalogItem[] = catalog.edutrips.map((e) => ({
      type: "edutrip",
      id: e.id,
      name: e.name,
      description: e.activities.map((a) => a.activity.name).join(", "),
      price: Number(e.pricePerPax),
      unit: "pax",
      imageUrl: null,
    }));
    if (filter === "homestay") return homestayItems;
    if (filter === "venue") return venueItems;
    if (filter === "edutrip") return edutripItems;
    return [...edutripItems, ...homestayItems, ...venueItems];
  }, [catalog, filter, homestayPrices]);

  function isInCart(type: string, id: string) {
    return cart.items.some(
      (item) => item.type === type && item.id === id && item.date === arrivalDate,
    );
  }

  function cartInputFor(item: CatalogItem): CartItemInput {
    if (item.type === "homestay") {
      return { type: "homestay" as const, id: item.id, date: arrivalDate };
    }
    if (item.type === "venue") {
      const times = venueTimes[item.id] ?? { start: 9, end: 10 };
      return {
        type: "venue" as const,
        id: item.id,
        date: arrivalDate,
        startHour: times.start,
        endHour: times.end,
      };
    }
    return { type: "edutrip" as const, id: item.id, date: arrivalDate, pax: 1 };
  }

  async function handleAdd(item: CatalogItem) {
    if (cart.arrivalDate !== arrivalDate) cart.setArrivalDate(arrivalDate);
    setConflicts((prev) => ({ ...prev, [item.id]: "" }));

    // Section 4/5: surface a conflict on the selection page itself, before
    // the user ever reaches payment. This is advisory only - the real,
    // race-safe check happens again at submit time.
    if (item.type !== "edutrip") {
      setPendingId(item.id);
      const result = await checkItemAvailability(cartInputFor(item));
      setPendingId(null);
      if (!result.available) {
        setConflicts((prev) => ({
          ...prev,
          [item.id]: result.message ?? "Item ini tidak tersedia.",
        }));
        return;
      }
    }

    if (item.type === "homestay") {
      const homestay = catalog.homestays.find((h) => h.id === item.id);
      if (!homestay) return;
      const computed = homestayPrices[homestay.id];
      const pricePerNight = computed?.amount ?? Number(homestay.weekdayPrice);
      cart.addItem({
        type: "homestay",
        id: homestay.id,
        name: homestay.name,
        imageUrl: homestay.imageUrl,
        date: arrivalDate,
        pricePerNight,
        tier: computed?.tier ?? "WEEKDAY",
        subtotal: pricePerNight,
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

  async function handleCheckout() {
    setCheckoutError(null);
    setIsCheckingOut(true);

    const cartInputs: CartItemInput[] = cart.items.map((item) =>
      item.type === "homestay"
        ? { type: "homestay", id: item.id, date: item.date }
        : item.type === "venue"
          ? {
              type: "venue",
              id: item.id,
              date: item.date,
              startHour: item.startHour,
              endHour: item.endHour,
            }
          : { type: "edutrip", id: item.id, date: item.date, pax: item.pax },
    );

    const results = await Promise.all(cartInputs.map((input) => checkItemAvailability(input)));
    setIsCheckingOut(false);

    const failed = results.find((r) => !r.available);
    if (failed) {
      setCheckoutError(
        `${failed.message ?? "Salah satu item yang dipilih sudah tidak tersedia."} Silakan hapus item tersebut dan pilih tanggal/jam lain.`,
      );
      return;
    }

    router.push("/booking/data-entry");
  }

  function cartItemDetail(item: CartItem) {
    if (item.type === "venue") {
      return `${formatLongDate(item.date)} · ${formatHour(item.startHour)}-${formatHour(item.endHour)}`;
    }
    if (item.type === "homestay") {
      return `${formatLongDate(item.date)} · 1 malam`;
    }
    return `${formatLongDate(item.date)} · ${item.pax} pax`;
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-8 pt-6 lg:grid-cols-3 lg:pb-10">
      <div className="space-y-6 lg:col-span-2">
        <Card className="p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold text-gray-900">Tanggal Kedatangan</h2>
            <span className="text-xs text-gray-400">
              Dapat dipesan hingga 90 hari ke depan
            </span>
          </div>
          <Calendar
            value={arrivalDate}
            onChange={(iso) => cart.setArrivalDate(iso)}
            today={today}
            maxDate={maxBookableDate}
            disabledDates={closedDates}
          />
        </Card>

        <div>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-gray-900">
              Jenis Tiket &amp; Fasilitas
            </h2>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="flex w-max gap-1 rounded-full bg-gray-100 p-1 text-sm">
                {(["all", "homestay", "venue", "edutrip"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={filter === key}
                    className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                      filter === key
                        ? "bg-brand-700 text-white"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {FILTER_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <Card key={`${item.type}:${item.id}`} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                    {item.type !== "edutrip" ? (
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <ImagePlaceholder
                            label={item.name}
                            className="h-full w-full text-xs"
                          />
                        )}
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase text-gray-400">
                        {FILTER_LABELS[item.type]}
                      </p>
                      <h3 className="truncate font-semibold text-gray-900">
                        {item.name}
                      </h3>
                      <p className="line-clamp-2 text-sm text-gray-500">
                        {item.description}
                      </p>
                      {conflicts[item.id] ? null : (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-600">
                          <ShieldCheck className="size-3.5" />
                          TERSEDIA
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center sm:gap-1">
                    <div className="min-w-0 sm:text-right">
                      <p className="font-semibold text-gray-900">
                        {item.type === "homestay" && pricesLoading
                          ? "..."
                          : formatCurrency(item.price)}
                      </p>
                      <p className="text-xs text-gray-400">
                        /{item.unit}
                        {item.type === "homestay" && homestayPrices[item.id] ? (
                          <span className="ml-1 capitalize">
                            ({homestayPrices[item.id].tier.toLowerCase()})
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {item.type !== "venue" ? (
                      <Button
                        size="sm"
                        variant={
                          isInCart(item.type, item.id) ? "outline" : "primary"
                        }
                        className="min-h-11 shrink-0 sm:mt-1 sm:min-h-0"
                        disabled={pendingId === item.id}
                        onClick={() => handleAdd(item)}
                      >
                        {pendingId === item.id
                          ? "Memeriksa..."
                          : isInCart(item.type, item.id)
                            ? "Ditambahkan"
                            : "+ Tambah"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {item.type === "venue" ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 sm:flex sm:flex-wrap sm:items-end">
                    <label className="min-w-0 text-xs text-gray-500">
                      Jam mulai
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
                        className="mt-1 block min-h-10 w-full rounded-md border border-gray-300 px-2 py-1 text-sm sm:w-auto"
                      >
                        {HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>
                            {formatHour(h)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-0 text-xs text-gray-500">
                      Jam selesai
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
                        className="mt-1 block min-h-10 w-full rounded-md border border-gray-300 px-2 py-1 text-sm sm:w-auto"
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
                      className="col-span-2 min-h-11 sm:col-span-1 sm:min-h-0"
                      disabled={pendingId === item.id}
                      onClick={() => handleAdd(item)}
                    >
                      {pendingId === item.id
                        ? "Memeriksa..."
                        : isInCart("venue", item.id)
                          ? "Ditambahkan"
                          : "+ Tambah"}
                    </Button>
                  </div>
                ) : null}

                {conflicts[item.id] ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600"
                  >
                    <AlertTriangle className="size-3.5" />
                    {conflicts[item.id]}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <Card className="p-5 lg:sticky lg:top-6">
          <h2 className="font-semibold text-gray-900">Ringkasan Pemesanan</h2>
          <p className="mt-1 text-sm text-gray-500">
            Kedatangan: {formatLongDate(arrivalDate)}
          </p>

          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            {cart.items.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada item dipilih.</p>
            ) : (
              cart.items.map((item) => (
                <div
                  key={cartItemKey(item)}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium text-gray-800">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {cartItemDetail(item)}
                    </p>
                    <button
                      type="button"
                      onClick={() => cart.removeItem(cartItemKey(item))}
                      className="mt-1 text-xs text-red-500 hover:underline"
                    >
                      Hapus
                    </button>
                  </div>
                  <p className="shrink-0 font-medium text-gray-900">
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

          {checkoutError ? (
            <p
              role="alert"
              className="mt-3 flex items-start gap-1.5 text-xs font-medium text-red-600"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {checkoutError}
            </p>
          ) : null}

          <Button
            className="mt-4 w-full"
            variant="primary"
            disabled={cart.items.length === 0 || isCheckingOut}
            onClick={handleCheckout}
          >
            {isCheckingOut ? "Memeriksa ketersediaan..." : "LANJUT KE PEMBAYARAN"}
            <ChevronRight className="size-4" />
          </Button>
        </Card>
      </div>

      {/* Phones/tablets: the summary card sits after a potentially long
          catalog, so the total, a detail toggle and the primary action are
          pinned to the viewport edge instead. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-gray-600">
              {cart.items.length === 0
                ? "Belum ada item dipilih"
                : `${cart.items.length} item · ${formatCurrency(cart.total)}`}
            </p>
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              disabled={cart.items.length === 0}
              className="shrink-0 text-sm font-semibold text-brand-700 underline-offset-2 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              Rincian
            </button>
          </div>

          {checkoutError ? (
            <p
              role="alert"
              className="mt-2 text-xs font-medium text-red-600"
            >
              {checkoutError}
            </p>
          ) : null}

          <Button
            className="mt-2 min-h-11 w-full"
            disabled={cart.items.length === 0 || isCheckingOut}
            onClick={handleCheckout}
          >
            {isCheckingOut ? "Memeriksa ketersediaan..." : "Lanjut ke Pembayaran"}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {summaryOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Tutup rincian pemesanan"
            onClick={() => setSummaryOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-summary-title"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mx-auto max-w-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="booking-summary-title"
                    className="font-semibold text-gray-900"
                  >
                    Ringkasan Pemesanan
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Kedatangan: {formatLongDate(arrivalDate)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSummaryOpen(false)}
                  aria-label="Tutup"
                  className="-mr-1 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="size-5" />
                </button>
              </div>

              <ul className="mt-3 divide-y divide-gray-100 border-y border-gray-100">
                {cart.items.map((item) => (
                  <li
                    key={cartItemKey(item)}
                    className="flex items-start justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium text-gray-800">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {cartItemDetail(item)}
                      </p>
                      <button
                        type="button"
                        onClick={() => cart.removeItem(cartItemKey(item))}
                        className="mt-1 text-xs font-medium text-red-500 hover:underline"
                      >
                        Hapus
                      </button>
                    </div>
                    <span className="shrink-0 font-medium text-gray-900">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </li>
                ))}
                {cart.items.length === 0 ? (
                  <li className="py-4 text-center text-sm text-gray-400">
                    Belum ada item dipilih.
                  </li>
                ) : null}
              </ul>

              <div className="mt-3 flex items-center justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(cart.total)}
                </span>
              </div>

              {checkoutError ? (
                <p
                  role="alert"
                  className="mt-2 text-xs font-medium text-red-600"
                >
                  {checkoutError}
                </p>
              ) : null}

              <Button
                className="mt-3 min-h-11 w-full"
                disabled={cart.items.length === 0 || isCheckingOut}
                onClick={handleCheckout}
              >
                {isCheckingOut
                  ? "Memeriksa ketersediaan..."
                  : "Lanjut ke Pembayaran"}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
