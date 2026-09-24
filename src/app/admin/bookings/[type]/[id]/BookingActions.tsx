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
    <div className="flex flex-wrap gap-2">
      {bookingStatus === "PENDING" ? (
        <Button
          size="sm"
          disabled={isPending || paymentStatus !== "PAID"}
          onClick={() => run(confirmBooking)}
          title={paymentStatus !== "PAID" ? "Payment must be confirmed first" : undefined}
        >
          Confirm
        </Button>
      ) : null}
      {bookingStatus === "CONFIRMED" ? (
        <Button size="sm" disabled={isPending} onClick={() => run(adminCheckIn)}>
          Check-in
        </Button>
      ) : null}
      {bookingStatus === "CHECKED_IN" ? (
        <Button size="sm" disabled={isPending} onClick={() => run(completeBooking)}>
          Mark completed
        </Button>
      ) : null}
      {["PENDING", "CONFIRMED"].includes(bookingStatus) ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(cancelBooking)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={isPending}
            onClick={() => run(rejectBooking)}
          >
            Reject
          </Button>
        </>
      ) : null}
    </div>
  );
}
