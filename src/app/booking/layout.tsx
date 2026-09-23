import type { ReactNode } from "react";
import { CartProvider } from "@/features/booking/CartContext";

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">{children}</div>
    </CartProvider>
  );
}
