import type { CartItem } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { FLAT_SHIPPING_RATE } from "@/lib/config";
import { clampQuantity } from "@/lib/quantity";

export const CART_STORAGE_KEY = "morchadi-cart-v1";

/**
 * A cart item joined to its catalogue entry. The item carries a price *snapshot* taken when
 * it was added; the line prices off `entry.price` instead, so a catalogue edit is reflected
 * the moment the shopper reloads and a stale snapshot can never decide what is charged.
 */
export interface CartLine {
  entry: CatalogueEntry;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isPayable: boolean;
}

export interface CartTotals {
  subtotal: number;
  shipping: number;
  total: number;
}

function toCartItem(entry: CatalogueEntry, quantity: number): CartItem {
  return {
    productId: entry.id,
    name: entry.name,
    price: entry.price,
    image: entry.image ?? "",
    qty: clampQuantity(quantity),
  };
}

function indexCatalogue(catalogue: CatalogueEntry[]): Map<string, CatalogueEntry> {
  return new Map(catalogue.map((entry) => [entry.id, entry]));
}

export function countCartItems(items: CartItem[]): number {
  return items.reduce((count, item) => count + item.qty, 0);
}

export function findCartItem(
  items: CartItem[],
  productId: string,
): CartItem | undefined {
  return items.find((item) => item.productId === productId);
}

/**
 * Adding a product already in the cart increments that line rather than appending a second
 * one, and the result is clamped, so a line can never exceed the per-line maximum however
 * many times Add to cart is pressed. An out-of-stock entry is refused outright — the
 * buttons that call this are disabled, and this is the backstop behind them.
 */
export function addProductToCart(
  items: CartItem[],
  entry: CatalogueEntry,
  quantity: number = 1,
): CartItem[] {
  if (!entry.inStock) return items;

  const requestedQuantity = clampQuantity(quantity);
  const existingItem = findCartItem(items, entry.id);

  if (existingItem === undefined) {
    return [...items, toCartItem(entry, requestedQuantity)];
  }

  return items.map((item) =>
    item.productId === entry.id
      ? toCartItem(entry, item.qty + requestedQuantity)
      : item,
  );
}

export function removeProductFromCart(
  items: CartItem[],
  productId: string,
): CartItem[] {
  return items.filter((item) => item.productId !== productId);
}

export function setCartItemQuantity(
  items: CartItem[],
  productId: string,
  quantity: number,
): CartItem[] {
  return items.map((item) =>
    item.productId === productId
      ? { ...item, qty: clampQuantity(quantity) }
      : item,
  );
}

/**
 * Turns whatever was in localStorage into something shaped like a cart, discarding anything
 * it cannot read. It validates shape only — whether the ids are real is
 * `reconcileCartWithCatalogue`'s job.
 */
export function parsePersistedCart(rawValue: string | null): CartItem[] {
  if (rawValue === null) return [];

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return [];
  }

  if (!Array.isArray(parsedValue)) return [];

  return parsedValue.filter(isPersistedCartItem).map((entry) => ({
    productId: entry.productId,
    name: typeof entry.name === "string" ? entry.name : "",
    price: typeof entry.price === "number" ? entry.price : 0,
    image: typeof entry.image === "string" ? entry.image : "",
    qty: clampQuantity(entry.qty),
  }));
}

interface PersistedCartItem {
  productId: string;
  name?: unknown;
  price?: unknown;
  image?: unknown;
  qty: number;
}

function isPersistedCartItem(value: unknown): value is PersistedCartItem {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.productId === "string" &&
    candidate.productId.length > 0 &&
    typeof candidate.qty === "number"
  );
}

/**
 * The gate every persisted cart passes through before it becomes state. It drops items whose
 * product has left the catalogue, merges any duplicate lines for one product, re-clamps
 * quantities, and refreshes each snapshot from the catalogue. An item whose product is now
 * `inStock: false` is deliberately kept — the shopper chose it, so the cart page shows it and
 * asks them to remove it rather than silently deleting it.
 */
export function reconcileCartWithCatalogue(
  items: CartItem[],
  catalogue: CatalogueEntry[],
): CartItem[] {
  const catalogueById = indexCatalogue(catalogue);
  const mergedByProductId = new Map<string, CartItem>();

  for (const item of items) {
    const entry = catalogueById.get(item.productId);
    if (entry === undefined) continue;

    const alreadyMerged = mergedByProductId.get(entry.id);
    const mergedQuantity =
      alreadyMerged === undefined ? item.qty : alreadyMerged.qty + item.qty;

    mergedByProductId.set(entry.id, toCartItem(entry, mergedQuantity));
  }

  return Array.from(mergedByProductId.values());
}

export function buildCartLines(
  items: CartItem[],
  catalogue: CatalogueEntry[],
): CartLine[] {
  const catalogueById = indexCatalogue(catalogue);
  const lines: CartLine[] = [];

  for (const item of items) {
    const entry = catalogueById.get(item.productId);
    if (entry === undefined) continue;

    const quantity = clampQuantity(item.qty);
    lines.push({
      entry,
      quantity,
      unitPrice: entry.price,
      lineTotal: entry.price * quantity,
      isPayable: entry.inStock,
    });
  }

  return lines;
}

export function selectPayableLines(lines: CartLine[]): CartLine[] {
  return lines.filter((line) => line.isPayable);
}

export function hasUnavailableLine(lines: CartLine[]): boolean {
  return lines.some((line) => !line.isPayable);
}

/**
 * Money for the whole cart. Only payable lines contribute, so an item that went out of stock
 * while it sat in the cart charges nothing and does not on its own attract shipping. `mrp`
 * is absent from this file by design — the charged amount is always `price`.
 */
export function calculateCartTotals(lines: CartLine[]): CartTotals {
  const payableLines = selectPayableLines(lines);
  const subtotal = payableLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = payableLines.length > 0 ? FLAT_SHIPPING_RATE : 0;

  return { subtotal, shipping, total: subtotal + shipping };
}
