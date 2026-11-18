"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  adminCheckIn,
  cancelBooking,
  completeBooking,
  confirmBooking,
  rejectBooking,
} from "@/features/bookings/actions";
import type { BookingType } from "@/features/bookings/service";

export function BookingActions({
  bookingType,
  bookingId,
  bookingStatus,
  paymentStatus,
}: {
  bookingType: BookingType;
  bookingId: string;
  bookingStatus: string;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: (t: BookingType, id: string) => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await action(bookingType, bookingId);
      if (result?.error) alert(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {bookingStatus === "PENDING" ? (
        <Button
          size="sm"
          className="w-full"
          disabled={isPending || paymentStatus !== "PAID"}
          onClick={() => run(confirmBooking)}
          title={
            paymentStatus !== "PAID"
              ? "Pembayaran harus lunas terlebih dahulu"
              : undefined
          }
        >
          Konfirmasi
        </Button>
      ) : null}
      {bookingStatus === "CONFIRMED" ? (
        <Button
          size="sm"
          className="w-full"
          disabled={isPending}
          onClick={() => run(adminCheckIn)}
        >
          Check-in
        </Button>
      ) : null}
      {bookingStatus === "CHECKED_IN" ? (
        <Button
          size="sm"
          className="w-full"
          disabled={isPending}
          onClick={() => run(completeBooking)}
        >
          Tandai selesai
        </Button>
      ) : null}
      {["PENDING", "CONFIRMED"].includes(bookingStatus) ? (
        <>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={() => run(cancelBooking)}
          >
            Batalkan
          </Button>
          <Button
            size="sm"
            variant="danger"
            className="w-full"
            disabled={isPending}
            onClick={() => run(rejectBooking)}
          >
            Tolak
          </Button>
        </>
      ) : null}
    </div>
  );
}
