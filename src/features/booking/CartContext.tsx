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
  /** Empty until either sessionStorage hydration or the selection page's
   *  effect sets a real value - see the empty-string handling note below. */
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
  /** Forget the old invoice after it expires so a retry creates a new one. */
  clearInvoice: () => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

interface StoredState {
  arrivalDate: string;
  items: CartItem[];
  customer: CustomerInfo | null;
  invoiceNumber: string | null;
}

// Deliberately has no notion of "today" - see the hydration note on
// CartProvider for why this must be identical in every environment
// (server render, and the client's first/hydration render).
const EMPTY_STATE: StoredState = {
  arrivalDate: "",
  items: [],
  customer: null,
  invoiceNumber: null,
};

function readSessionStorage(): StoredState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Always starts from the same deterministic, window-independent value on
  // both the server render and the client's hydration render. Reading
  // sessionStorage (browser-only) directly in this initializer would make
  // the client's very first render diverge from the server's, which is a
  // real hydration mismatch - not just for this field, but for every
  // consumer of the cart (booking selection, data entry, payment all read
  // from this context). The actual stored state is loaded afterwards, in
  // an effect, which React only ever runs post-hydration.
  const [state, setState] = useState<StoredState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readSessionStorage();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from an external system (sessionStorage) unavailable during SSR, not state derived from props/state
      setState(stored);
    }
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
      // Mutating the cart after a Transaction row already exists for it
      // (`invoiceNumber` set) must invalidate that reference - otherwise a
      // later payment attempt reuses a DB transaction whose line items no
      // longer match what the UI is showing (the exact "EDU TRIP KESEK 2
      // shown, AREN 1 + JOGLO charged" bug: an abandoned booking's
      // invoiceNumber survived in sessionStorage across an unrelated cart
      // edit, and Midtrans then rejected the reused order_id on top of
      // that). See PaymentClient's snapUrl-reuse fix for the other half.
      addItem: (item) =>
        setState((prev) => ({
          ...prev,
          items: [
            ...prev.items.filter((i) => cartItemKey(i) !== cartItemKey(item)),
            item,
          ],
          invoiceNumber: null,
        })),
      removeItem: (key) =>
        setState((prev) => ({
          ...prev,
          items: prev.items.filter((i) => cartItemKey(i) !== key),
          invoiceNumber: null,
        })),
      total: cartTotal(state.items),
      customer: state.customer,
      setCustomer: (customer) => setState((prev) => ({ ...prev, customer })),
      invoiceNumber: state.invoiceNumber,
      setInvoiceNumber: (invoiceNumber) =>
        setState((prev) => ({ ...prev, invoiceNumber })),
      clearInvoice: () =>
        setState((prev) => ({ ...prev, invoiceNumber: null })),
      clear: () => setState(EMPTY_STATE),
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
