import { calculateShipping } from "@/lib/config";
import { parseSelectedOptions } from "@/lib/options";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/quantity";
import type { CreateOrderItem, OrderItemError } from "@/types/order";

/**
 * The only fields of a product this module is permitted to see. `mrp` is deliberately absent
 * from the type, so the pricing core cannot read a compare-at price even by mistake — the
 * charged amount is `price` and the type system, not a convention, enforces it.
 *
 * Both `Product` and `CatalogueEntry` satisfy this, so callers pass the catalogue they
 * already have.
 */
export interface OrderPricingEntry {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
}

export interface OrderLineItem {
  productId: string;
  name: string;
  /** From the catalogue. Never from the request. */
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface OrderBuildResult {
  valid: boolean;
  errors: OrderItemError[];
  lineItems: OrderLineItem[];
  subtotal: number;
  shipping: number;
  total: number;
}

function rejectedOrder(errors: OrderItemError[]): OrderBuildResult {
  return { valid: false, errors, lineItems: [], subtotal: 0, shipping: 0, total: 0 };
}

function isChargeableQuantity(qty: number): boolean {
  return Number.isInteger(qty) && qty >= MIN_QUANTITY && qty <= MAX_QUANTITY;
}

function indexCatalogue(
  catalogue: readonly OrderPricingEntry[],
): Map<string, OrderPricingEntry> {
  return new Map(catalogue.map((entry) => [entry.id, entry]));
}

/**
 * The server's answer to "what does this cart cost?", and the only place that answer is
 * produced. It takes untrusted product ids and quantities, prices them against the
 * catalogue, and returns either a fully-priced order or every reason it was refused.
 *
 * Three properties matter more than the arithmetic:
 *
 * - **No amount arrives from outside.** The signature has nowhere to put one. Whatever a
 *   client claims a product costs is not an input to this function, and neither is shipping:
 *   it is derived here from the catalogue-priced subtotal, so a client cannot claim to have
 *   qualified for free delivery.
 * - **A rejected order carries no money.** Failure returns zeroed amounts and no line items,
 *   so a caller that ignores `valid` still cannot charge anything.
 * - **Every fault is reported, not just the first.** One round trip tells the shopper about
 *   all of their bad lines.
 *
 * Duplicate ids are refused rather than merged: silently summing them would let a client
 * exceed the per-line quantity cap by repeating a product.
 */
export function buildOrderFromCart(
  items: readonly CreateOrderItem[],
  catalogue: readonly OrderPricingEntry[],
): OrderBuildResult {
  if (items.length === 0) {
    return rejectedOrder([
      {
        productId: null,
        code: "EMPTY_CART",
        message: "There is nothing in this order.",
      },
    ]);
  }

  const catalogueById = indexCatalogue(catalogue);
  const errors: OrderItemError[] = [];
  const lineItems: OrderLineItem[] = [];
  const seenProductIds = new Set<string>();

  for (const item of items) {
    const entry = catalogueById.get(item.productId);

    if (entry === undefined) {
      errors.push({
        productId: item.productId,
        code: "UNKNOWN_PRODUCT",
        message: "This piece is no longer in our catalogue.",
      });
      continue;
    }

    if (seenProductIds.has(entry.id)) {
      errors.push({
        productId: entry.id,
        code: "DUPLICATE_PRODUCT",
        message: `${entry.name} appears more than once in this order.`,
      });
      continue;
    }
    seenProductIds.add(entry.id);

    if (!entry.inStock) {
      errors.push({
        productId: entry.id,
        code: "OUT_OF_STOCK",
        message: `${entry.name} sold out and cannot be ordered.`,
      });
      continue;
    }

    if (!isChargeableQuantity(item.qty)) {
      errors.push({
        productId: entry.id,
        code: "INVALID_QUANTITY",
        message: `Choose between ${MIN_QUANTITY} and ${MAX_QUANTITY} of ${entry.name}.`,
      });
      continue;
    }

    lineItems.push({
      productId: entry.id,
      name: entry.name,
      unitPrice: entry.price,
      qty: item.qty,
      lineTotal: entry.price * item.qty,
    });
  }

  if (errors.length > 0) return rejectedOrder(errors);

  const subtotal = lineItems.reduce((sum, lineItem) => sum + lineItem.lineTotal, 0);
  const shipping = calculateShipping(subtotal);

  return {
    valid: true,
    errors: [],
    lineItems,
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
}

/**
 * Turns a parsed JSON body into the shape `buildOrderFromCart` accepts, or null when it is
 * not recognisable as a list of cart lines at all.
 *
 * A non-numeric `qty` becomes `NaN` rather than failing the whole request, so a bad quantity
 * is reported against the product it belongs to instead of collapsing into one opaque
 * "malformed request". Any extra fields the client sent — a price, a total, a name — are
 * dropped here and never reach the pricing core. `selectedOptions` survives because
 * fulfilment needs it, and it is checked against the catalogue by `validateOrderLineOptions`
 * before it is recorded; the pricing core below ignores it entirely.
 */
export function parseOrderItems(value: unknown): CreateOrderItem[] | null {
  if (!Array.isArray(value)) return null;

  const items: CreateOrderItem[] = [];

  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) return null;

    const record = candidate as Record<string, unknown>;
    if (typeof record.productId !== "string" || record.productId.length === 0) {
      return null;
    }

    const selectedOptions = parseSelectedOptions(record.selectedOptions);

    items.push({
      productId: record.productId,
      qty: typeof record.qty === "number" ? record.qty : Number.NaN,
      ...(selectedOptions === undefined ? {} : { selectedOptions }),
    });
  }

  return items;
}

/**
 * Collapses the lines of one product into a single priced item, summing their quantities.
 *
 * Options gave one product the ability to occupy several cart lines, and
 * `buildOrderFromCart` refuses a repeated product id — deliberately, because merging inside
 * the pricing core would let a client beat the per-line quantity cap by repeating a product.
 * Merging *here*, before pricing, keeps that guard intact: the summed quantity is what gets
 * bounds-checked, so two lines of six are still refused. Nothing about the amount changes,
 * since a choice never changes a price. See ADR-019.
 */
export function mergeOrderItemsByProduct(
  items: readonly CreateOrderItem[],
): CreateOrderItem[] {
  const quantityByProductId = new Map<string, number>();

  for (const item of items) {
    const runningQuantity = quantityByProductId.get(item.productId);
    quantityByProductId.set(
      item.productId,
      runningQuantity === undefined ? item.qty : runningQuantity + item.qty,
    );
  }

  return Array.from(quantityByProductId, ([productId, qty]) => ({ productId, qty }));
}
