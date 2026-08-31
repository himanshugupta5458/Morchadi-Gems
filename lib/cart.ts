import type { CartItem } from "@/types/cart";
import type { CatalogueEntry, SelectedOptions } from "@/types/product";
import { calculateShipping } from "@/lib/config";
import {
  isSelectionStale,
  lineKey,
  parseSelectedOptions,
  resolveSelectedOptions,
} from "@/lib/options";
import { validateOrderLineOptions } from "@/lib/order-options";
import { clampQuantity } from "@/lib/quantity";
import { selectDisplayImage } from "@/lib/variant-images";

export const CART_STORAGE_KEY = "morchadi-cart-v1";

/**
 * A cart item joined to its catalogue entry. The item carries a price *snapshot* taken when
 * it was added; the line prices off `entry.price` instead, so a catalogue edit is reflected
 * the moment the shopper reloads and a stale snapshot can never decide what is charged.
 */
export interface CartLine {
  /** `lineKey(productId, selectedOptions)`. What every edit and removal addresses. */
  key: string;
  entry: CatalogueEntry;
  selectedOptions?: SelectedOptions;
  /**
   * The photograph of the variant this line records, or the product's own when the catalogue
   * maps none for the selection. Display only, and derived from the catalogue rather than
   * from the stored item, so a line shows the current picture the way it charges the current
   * price. See ADR-027.
   */
  image: string | null;
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

/**
 * The selection is resolved against the entry's current options rather than taken as given,
 * so every line in the cart carries a complete, catalogue-valid choice — including a line
 * whose shopper never opened a selector, which gets the defaults.
 *
 * The stored `image` follows that selection, so the thumbnail a shopper carries through
 * checkout and onto the receipt is the finish they chose. Like `price`, it is a snapshot
 * refreshed on every reconcile; unlike `price`, nothing downstream computes with it.
 */
function toCartItem(
  entry: CatalogueEntry,
  quantity: number,
  requestedOptions?: SelectedOptions,
): CartItem {
  const selectedOptions = resolveSelectedOptions(entry.options, requestedOptions);

  return {
    productId: entry.id,
    name: entry.name,
    price: entry.price,
    image: selectDisplayImage(entry.image, entry.variantImages, selectedOptions) ?? "",
    qty: clampQuantity(quantity),
    ...(selectedOptions === undefined ? {} : { selectedOptions }),
  };
}

/** The identity of the line an item occupies. Options never touch price — only identity. */
export function cartItemKey(item: CartItem): string {
  return lineKey(item.productId, item.selectedOptions);
}

function indexCatalogue(catalogue: CatalogueEntry[]): Map<string, CatalogueEntry> {
  return new Map(catalogue.map((entry) => [entry.id, entry]));
}

export function countCartItems(items: CartItem[]): number {
  return items.reduce((count, item) => count + item.qty, 0);
}

/**
 * Takes a line key, not a product id. The two are the same string for a product sold in one
 * configuration, which is why every option-less call site reads unchanged.
 */
export function findCartItem(
  items: CartItem[],
  key: string,
): CartItem | undefined {
  return items.find((item) => cartItemKey(item) === key);
}

/**
 * Adding a product already in the cart *with the same choices* increments that line rather
 * than appending a second one, and the result is clamped, so a line can never exceed the
 * per-line maximum however many times Add to cart is pressed. A different choice is a
 * different line. An out-of-stock entry is refused outright — the buttons that call this are
 * disabled, and this is the backstop behind them.
 */
export function addProductToCart(
  items: CartItem[],
  entry: CatalogueEntry,
  quantity: number = 1,
  selectedOptions?: SelectedOptions,
): CartItem[] {
  if (!entry.inStock) return items;

  const requestedQuantity = clampQuantity(quantity);
  const addedItem = toCartItem(entry, requestedQuantity, selectedOptions);
  const addedKey = cartItemKey(addedItem);

  if (findCartItem(items, addedKey) === undefined) {
    return [...items, addedItem];
  }

  return items.map((item) =>
    cartItemKey(item) === addedKey
      ? toCartItem(entry, item.qty + requestedQuantity, item.selectedOptions)
      : item,
  );
}

/**
 * What happened to a request to change a line's choices: the cart as it now stands, and the
 * refusal if there was one.
 *
 * A refusal returns the *unchanged* items rather than throwing, so a caller can render the
 * message beside the control the shopper is still looking at and leave their selection where
 * it was to be corrected.
 */
export interface CartOptionChange {
  items: CartItem[];
  /** `null` when the change was applied. The validator's own sentence otherwise. */
  error: string | null;
}

const MISSING_LINE_ERROR = "That piece is no longer in your cart.";
const UNAVAILABLE_LINE_ERROR =
  "This piece sold out while it was in your cart, so its options can no longer be changed.";

/**
 * Changes one line's recorded choices, having asked the same question checkout asks.
 *
 * **The check is `validateOrderLineOptions`, not a second copy of it.** That is the function
 * `/api/create-order` runs over every line before an order is created, so a selection this
 * accepts is one checkout will accept, and a value the catalogue has withdrawn is refused here
 * in the words the order route would have used. Building a cart-side rule instead would have
 * meant two answers to "is this a legal choice" that agree until the catalogue changes. See
 * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md) and ADR-019.
 *
 * A change that lands on a line the cart already holds — the shopper editing one of two
 * bangles down to the size of the other — merges into it and sums the quantities, exactly as
 * adding the same choice twice does. A change that does not keeps the line where it was in the
 * list, because a line that jumped to the bottom on every edit would read as a removal.
 */
export function changeCartItemOptions(
  items: CartItem[],
  catalogue: CatalogueEntry[],
  key: string,
  requestedOptions: SelectedOptions,
): CartOptionChange {
  const editedIndex = items.findIndex((item) => cartItemKey(item) === key);
  if (editedIndex === -1) return { items, error: MISSING_LINE_ERROR };

  const edited = items[editedIndex];
  const entry = indexCatalogue(catalogue).get(edited.productId);
  if (entry === undefined) return { items, error: MISSING_LINE_ERROR };
  if (!entry.inStock) return { items, error: UNAVAILABLE_LINE_ERROR };

  const { errors } = validateOrderLineOptions(
    [{ productId: entry.id, qty: edited.qty, selectedOptions: requestedOptions }],
    [
      {
        id: entry.id,
        name: entry.name,
        ...(entry.options === undefined ? {} : { options: entry.options }),
      },
    ],
  );
  if (errors.length > 0) return { items, error: errors[0].message };

  const updated = toCartItem(entry, edited.qty, requestedOptions);
  const updatedKey = cartItemKey(updated);
  const withoutEdited = items.filter((item) => cartItemKey(item) !== key);
  const twinIndex = withoutEdited.findIndex((item) => cartItemKey(item) === updatedKey);

  if (twinIndex === -1) {
    const next = [...withoutEdited];
    next.splice(editedIndex, 0, updated);
    return { items: next, error: null };
  }

  return {
    items: withoutEdited.map((item, index) =>
      index === twinIndex
        ? toCartItem(entry, item.qty + edited.qty, requestedOptions)
        : item,
    ),
    error: null,
  };
}

export function removeProductFromCart(
  items: CartItem[],
  key: string,
): CartItem[] {
  return items.filter((item) => cartItemKey(item) !== key);
}

/**
 * Puts a removed line back exactly where it was, with the quantity and the recorded choices it
 * had. The other half of `removeProductFromCart`, and what the cart's Undo is built on.
 *
 * The item is replayed rather than re-derived: `addProductToCart` would clamp the quantity to
 * one line's maximum and re-resolve the options against the catalogue, which is right for a
 * shopper adding something and wrong for one taking back a removal they did not mean. What was
 * in the cart a second ago was already valid, and Undo owes them that and not an approximation
 * of it.
 *
 * A cart that has moved on since the removal is respected rather than overwritten. An index
 * past the end appends, and a line the shopper re-added by hand in the meantime absorbs the
 * restored quantity instead of becoming a duplicate — the same merge adding the identical
 * choice twice already performs.
 */
export function restoreCartItem(
  items: CartItem[],
  restoredItem: CartItem,
  index: number,
): CartItem[] {
  const restoredKey = cartItemKey(restoredItem);
  const existingIndex = items.findIndex((item) => cartItemKey(item) === restoredKey);

  if (existingIndex !== -1) {
    return items.map((item, position) =>
      position === existingIndex
        ? { ...item, qty: clampQuantity(item.qty + restoredItem.qty) }
        : item,
    );
  }

  const restored = [...items];
  restored.splice(Math.max(0, Math.min(index, items.length)), 0, restoredItem);
  return restored;
}

export function setCartItemQuantity(
  items: CartItem[],
  key: string,
  quantity: number,
): CartItem[] {
  return items.map((item) =>
    cartItemKey(item) === key ? { ...item, qty: clampQuantity(quantity) } : item,
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

  return parsedValue.filter(isPersistedCartItem).map((entry) => {
    const selectedOptions = parseSelectedOptions(entry.selectedOptions);

    return {
      productId: entry.productId,
      name: typeof entry.name === "string" ? entry.name : "",
      price: typeof entry.price === "number" ? entry.price : 0,
      image: typeof entry.image === "string" ? entry.image : "",
      qty: clampQuantity(entry.qty),
      ...(selectedOptions === undefined ? {} : { selectedOptions }),
    };
  });
}

interface PersistedCartItem {
  productId: string;
  name?: unknown;
  price?: unknown;
  image?: unknown;
  qty: number;
  selectedOptions?: unknown;
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
 * product has left the catalogue, drops items whose recorded choice the catalogue no longer
 * offers, merges any duplicate lines for one line key, re-clamps quantities, and refreshes
 * each snapshot from the catalogue. An item whose product is now `inStock: false` is
 * deliberately kept — the shopper chose it, so the cart page shows it and asks them to remove
 * it rather than silently deleting it.
 *
 * A withdrawn option is treated more harshly than a sold-out product because there is nothing
 * to keep: the line describes a piece we cannot make. Substituting another value would ship
 * the shopper something they did not ask for. See ADR-019.
 */
export function reconcileCartWithCatalogue(
  items: CartItem[],
  catalogue: CatalogueEntry[],
): CartItem[] {
  const catalogueById = indexCatalogue(catalogue);
  const mergedByLineKey = new Map<string, CartItem>();

  for (const item of items) {
    const entry = catalogueById.get(item.productId);
    if (entry === undefined) continue;
    if (isSelectionStale(entry.options, item.selectedOptions)) continue;

    const reconciledItem = toCartItem(entry, item.qty, item.selectedOptions);
    const key = cartItemKey(reconciledItem);
    const alreadyMerged = mergedByLineKey.get(key);
    const mergedQuantity =
      alreadyMerged === undefined ? item.qty : alreadyMerged.qty + item.qty;

    mergedByLineKey.set(key, toCartItem(entry, mergedQuantity, item.selectedOptions));
  }

  return Array.from(mergedByLineKey.values());
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
      key: cartItemKey(item),
      entry,
      ...(item.selectedOptions === undefined
        ? {}
        : { selectedOptions: item.selectedOptions }),
      image: selectDisplayImage(entry.image, entry.variantImages, item.selectedOptions),
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
 *
 * Shipping comes from `calculateShipping`, the same function `buildOrderFromCart` uses on the
 * server. This total is what the shopper is shown; the server recomputes it independently and
 * its answer is the one that is charged.
 */
export function calculateCartTotals(lines: CartLine[]): CartTotals {
  const payableLines = selectPayableLines(lines);
  const subtotal = payableLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = calculateShipping(subtotal);

  return { subtotal, shipping, total: subtotal + shipping };
}

/**
 * What the payable lines would come to at their compare-at prices — the figure the cart's
 * "Subtotal (MRP)" row states and the one its "You save" row is the difference from.
 *
 * **Display only, and deliberately not a field of `CartTotals`.** Every number in that object
 * is one an amount is computed from, and `mrp` is barred from all of them (see the note on
 * `calculateCartTotals`). Keeping this a separate call means no total can acquire a compare-at
 * price by destructuring, and the savings row stays what it is: an account of a discount the
 * catalogue already applied, not a second price.
 *
 * A record whose `mrp` is not above its `price` shows no saving of its own, and contributes its
 * `price` here, so the row can never claim a discount the product page does not show.
 */
export function calculateCartMrpSubtotal(lines: CartLine[]): number {
  return selectPayableLines(lines).reduce(
    (sum, line) => sum + Math.max(line.entry.mrp, line.unitPrice) * line.quantity,
    0,
  );
}
