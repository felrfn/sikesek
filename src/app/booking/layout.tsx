import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CartProvider } from "@/features/booking/CartContext";

// Booking is part of the public site.
export const metadata: Metadata = {
  title: {
    default: "Booking · Arenan Kalikesek",
    template: "%s · Arenan Kalikesek",
  },
};

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">{children}</div>
    </CartProvider>
  );
}
