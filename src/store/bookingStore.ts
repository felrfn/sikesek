import { create } from 'zustand';

interface BookingItem {
  id: string;
  name: string;
  price: number;
  type: 'homestay' | 'edutrip';
}

interface CustomerData {
  name: string;
  email: string;
  phone: string;
}

interface BookingState {
  checkIn: Date | null;
  checkOut: Date | null;
  selectedItems: BookingItem[];
  customerData: CustomerData | null;
  transactionId: string | null;
  setDates: (checkIn: Date, checkOut: Date) => void;
  addItem: (item: BookingItem) => void;
  removeItem: (id: string) => void;
  setCustomerData: (data: CustomerData) => void;
  setTransactionId: (id: string) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  checkIn: null,
  checkOut: null,
  selectedItems: [],
  customerData: null,
  transactionId: null,
  setDates: (checkIn, checkOut) => set({ checkIn, checkOut }),
  addItem: (item) => set((state) => {
    if (state.selectedItems.find((i) => i.id === item.id)) return state;
    return { selectedItems: [...state.selectedItems, item] };
  }),
  removeItem: (id) => set((state) => ({
    selectedItems: state.selectedItems.filter((i) => i.id !== id),
  })),
  setCustomerData: (data) => set({ customerData: data }),
  setTransactionId: (id) => set({ transactionId: id }),
  reset: () => set({ checkIn: null, checkOut: null, selectedItems: [], customerData: null, transactionId: null }),
}));
