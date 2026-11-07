"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the server-rendered success page in sync while a payment is still
 * PENDING. The server page reconciles with Midtrans and runs the local expiry
 * check on every render, so refreshing here is what turns the page into the
 * "expired" state at the five-minute deadline without requiring the customer
 * to press "Check Again".
 */
export function PaymentStatusAutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
