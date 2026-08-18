import type { SelectedOptions } from "@/types/product";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  qty: number;
  /**
   * The recorded choices for this line, complete and current against the catalogue. Absent
   * on a product sold in one configuration. Two lines of one product with different
   * selections are two lines — see `lineKey` in `lib/options.ts` and ADR-019.
   */
  selectedOptions?: SelectedOptions;
}

/**
 * All 28 states and 8 union territories. The single source for both the `/address` dropdown
 * and the validator that checks what came back from it, so the control cannot offer a value
 * the validator rejects.
 */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

export function isIndianState(value: string): value is IndianState {
  return INDIAN_STATES.some((state) => state === value);
}

export interface Address {
  name: string;
  phone: string;
  email: string;
  line1: string;
  line2?: string;
  city: string;
  state: IndianState;
  pincode: string;
}

/**
 * The bundle handed from `/address` to `/payment`. Its amounts are for **display only** —
 * the order-creation route recomputes every one of them from `cart`'s product ids and
 * quantities against `data/products.json`, and never reads the numbers stored here. See
 * ADR-011.
 */
export interface CheckoutData {
  cart: CartItem[];
  address: Address;
  subtotal: number;
  shipping: number;
  total: number;
  /**
   * The order `/payment` created for this bundle, stamped just before the browser leaves for
   * Cashfree. Absent on a bundle that has not reached payment yet.
   *
   * Display-only, like the amounts: `/order-confirmation` uses it to tell "this bundle belongs
   * to the order I am confirming" from "this is a leftover from an abandoned checkout", and it
   * decides *whether* to show stored items — never whether the order was paid. See ADR-014.
   */
  orderId?: string;
}
