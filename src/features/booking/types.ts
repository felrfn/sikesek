export interface HomestayCartItem {
  type: "homestay";
  id: string;
  name: string;
  imageUrl: string | null;
  date: string; // ISO date (check-in); check-out is date + 1 night for this MVP flow
  pricePerNight: number;
  tier: "WEEKDAY" | "WEEKEND" | "HOLIDAY";
  subtotal: number;
}

export interface VenueCartItem {
  type: "venue";
  id: string;
  name: string;
  imageUrl: string | null;
  date: string; // ISO date
  hours: number;
  pricePerHour: number;
  subtotal: number;
}

export interface EdutripCartItem {
  type: "edutrip";
  id: string;
  name: string;
  date: string; // ISO date
  pax: number;
  pricePerPax: number;
  subtotal: number;
}

export type CartItem = HomestayCartItem | VenueCartItem | EdutripCartItem;

export function cartItemKey(item: CartItem) {
  return `${item.type}:${item.id}:${item.date}`;
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
}
