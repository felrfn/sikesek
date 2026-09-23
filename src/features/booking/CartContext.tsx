"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { type CartItem, cartItemKey, cartTotal } from "./types";

const STORAGE_KEY = "sikesek.booking.cart";

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

interface CartContextValue {
  arrivalDate: string;
  setArrivalDate: (date: string) => void;
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (key: string) => void;
  total: number;
  customer: CustomerInfo | null;
  setCustomer: (customer: CustomerInfo) => void;
  invoiceNumber: string | null;
  setInvoiceNumber: (invoiceNumber: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

interface StoredState {
  arrivalDate: string;
  items: CartItem[];
  customer: CustomerInfo | null;
  invoiceNumber: string | null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function loadStoredState(): StoredState {
  const fallback: StoredState = {
    arrivalDate: todayIso(),
    items: [],
    customer: null,
    invoiceNumber: null,
  };

  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(() => loadStoredState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-time sync from sessionStorage (an external system unavailable
    // during SSR), not state derived from props/state - the valid
    // exception to this lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadStoredState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // sessionStorage unavailable (private browsing, etc.) - non-fatal
    }
  }, [state, hydrated]);

  const value = useMemo<CartContextValue>(
    () => ({
      arrivalDate: state.arrivalDate,
      setArrivalDate: (date) =>
        setState((prev) => ({ ...prev, arrivalDate: date })),
      items: state.items,
      addItem: (item) =>
        setState((prev) => ({
          ...prev,
          items: [
            ...prev.items.filter((i) => cartItemKey(i) !== cartItemKey(item)),
            item,
          ],
        })),
      removeItem: (key) =>
        setState((prev) => ({
          ...prev,
          items: prev.items.filter((i) => cartItemKey(i) !== key),
        })),
      total: cartTotal(state.items),
      customer: state.customer,
      setCustomer: (customer) => setState((prev) => ({ ...prev, customer })),
      invoiceNumber: state.invoiceNumber,
      setInvoiceNumber: (invoiceNumber) =>
        setState((prev) => ({ ...prev, invoiceNumber })),
      clear: () =>
        setState({
          arrivalDate: todayIso(),
          items: [],
          customer: null,
          invoiceNumber: null,
        }),
    }),
    [state],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
