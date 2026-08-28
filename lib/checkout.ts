import { isIndianState, type Address, type CartItem, type CheckoutData } from "@/types/cart";
import { calculateCartTotals, selectPayableLines, type CartLine } from "@/lib/cart";
import { parseSelectedOptions } from "@/lib/options";

export const CHECKOUT_STORAGE_KEY = "morchadi-checkout-v1";

/**
 * Builds the bundle `/address` hands to `/payment`. Only payable lines go in — an
 * unavailable line cannot be ordered, and `/address` is unreachable while one is in the
 * cart anyway. Amounts come from `calculateCartTotals`, which prices off the catalogue.
 *
 * These amounts are for rendering a summary across the redirect and nothing else. The
 * order-creation route recomputes all of them server-side from `cart`'s ids and quantities
 * and ignores what is stored here. See ADR-011.
 */
export function buildCheckoutData(
  lines: CartLine[],
  address: Address,
): CheckoutData {
  const payableLines = selectPayableLines(lines);
  const { subtotal, shipping, total } = calculateCartTotals(payableLines);

  const cart: CartItem[] = payableLines.map((line) => ({
    productId: line.entry.id,
    name: line.entry.name,
    price: line.unitPrice,
    image: line.entry.image ?? "",
    qty: line.quantity,
    ...(line.selectedOptions === undefined
      ? {}
      : { selectedOptions: line.selectedOptions }),
  }));

  return { cart, address, subtotal, shipping, total };
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.productId === "string" &&
    candidate.productId.length > 0 &&
    typeof candidate.qty === "number" &&
    typeof candidate.price === "number" &&
    typeof candidate.name === "string" &&
    typeof candidate.image === "string"
  );
}

/**
 * Keeps a stored line's recorded choices only when they are still a record of strings. The
 * bundle is display-and-fulfilment data, never pricing data, so a malformed selection costs
 * the line its options rather than costing the shopper their order.
 */
function withParsedSelection(item: CartItem): CartItem {
  const selectedOptions = parseSelectedOptions(item.selectedOptions);
  const line: CartItem = {
    productId: item.productId,
    name: item.name,
    price: item.price,
    image: item.image,
    qty: item.qty,
  };

  return selectedOptions === undefined ? line : { ...line, selectedOptions };
}

/** A stamped identifier survives only as a non-empty string; anything else is simply absent. */
function readStampedString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** A stamped amount survives only as a real number. A negative one is not an amount. */
function readStampedAmount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function isAddress(value: unknown): value is Address {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const requiredStrings = ["name", "phone", "email", "line1", "city", "pincode"];

  return (
    requiredStrings.every((key) => typeof candidate[key] === "string") &&
    typeof candidate.state === "string" &&
    isIndianState(candidate.state) &&
    (candidate.line2 === undefined || typeof candidate.line2 === "string")
  );
}

/**
 * Shape validation only. It answers "is this bundle renderable?", never "are these amounts
 * correct?" — nothing downstream is allowed to trust the numbers it lets through.
 *
 * Takes an already-parsed value rather than a string, because two callers hand it one from
 * different places: `parseCheckoutData` below unwraps `sessionStorage`, and the admin
 * notification route unwraps a POST body. Both sources are equally untrusted, so both go
 * through this one validator rather than each writing its own.
 */
export function parseCheckoutValue(parsedValue: unknown): CheckoutData | null {
  if (typeof parsedValue !== "object" || parsedValue === null) return null;
  const candidate = parsedValue as Record<string, unknown>;

  if (!Array.isArray(candidate.cart) || candidate.cart.length === 0) return null;
  if (!candidate.cart.every(isCartItem)) return null;
  if (!isAddress(candidate.address)) return null;
  if (
    typeof candidate.subtotal !== "number" ||
    typeof candidate.shipping !== "number" ||
    typeof candidate.total !== "number"
  ) {
    return null;
  }

  const stampedOrderId = readStampedString(candidate.orderId);
  const stampedTrackingId = readStampedString(candidate.trackingId);
  const stampedAmountPrepaid = readStampedAmount(candidate.amountPrepaid);
  const stampedAmountDue = readStampedAmount(candidate.amountDue);

  return {
    cart: candidate.cart.map(withParsedSelection),
    address: candidate.address,
    subtotal: candidate.subtotal,
    shipping: candidate.shipping,
    total: candidate.total,
    ...(stampedOrderId === undefined ? {} : { orderId: stampedOrderId }),
    ...(stampedTrackingId === undefined ? {} : { trackingId: stampedTrackingId }),
    ...(stampedAmountPrepaid === undefined ? {} : { amountPrepaid: stampedAmountPrepaid }),
    ...(stampedAmountDue === undefined ? {} : { amountDue: stampedAmountDue }),
  };
}

/** The `sessionStorage` bundle, unwrapped from its JSON and validated. */
export function parseCheckoutData(rawValue: string | null): CheckoutData | null {
  if (rawValue === null) return null;

  try {
    return parseCheckoutValue(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

/**
 * `sessionStorage` throws in some private-browsing modes and when the quota is full. A
 * checkout must not die because a summary could not be cached, so both accessors swallow
 * the failure and the caller carries on — `writeCheckoutData` reports whether it landed.
 */
export function writeCheckoutData(data: CheckoutData): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readCheckoutData(): CheckoutData | null {
  if (typeof window === "undefined") return null;
  try {
    return parseCheckoutData(window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Records which order the stored bundle was paid against, called on `/payment` once the server
 * has answered and immediately before the browser leaves for Cashfree.
 *
 * Both of the order's identifiers are stamped: the payment reference, which the confirmation
 * page matches the bundle against, and the ten-character order number, which is the only thing
 * the bundle exists to *carry* rather than to be checked by. Cashfree returns the browser with
 * its own id in the URL and knows nothing about ours, so without this stamp the confirmation
 * page would have no way to name the order the way the shopper will
 * ([ADR-043](/docs/decisions/ADR-043-order-id-as-primary-identifier.md)).
 *
 * The two amounts are stamped with them, and stamping them changes nothing about how much the
 * bundle is trusted: they are the *server's* answer, copied back from the create-order response
 * rather than computed here, and the only thing that reads them is the reconciliation that
 * decides whether to show a receipt at all. It still writes no item, no address and no price,
 * so nothing the shopper is charged can be traced to this function. A failed write is not an
 * error worth reporting: the guard on the other side falls back to matching the total, and the
 * confirmation page falls back to the payment reference.
 */
export interface StampedOrderReference {
  /** The Cashfree `MG_…` id, or the `COD_…` reference for an order the gateway never saw. */
  paymentReference: string;
  trackingId: string | null;
  /** What the gateway was asked for, and what is left owing. Both from the server's response. */
  amountPrepaid: number;
  amountDue: number;
}

export function stampCheckoutDataOrder(reference: StampedOrderReference): void {
  const storedData = readCheckoutData();
  if (storedData === null) return;

  writeCheckoutData({
    ...storedData,
    orderId: reference.paymentReference,
    ...(reference.trackingId === null ? {} : { trackingId: reference.trackingId }),
    amountPrepaid: reference.amountPrepaid,
    amountDue: reference.amountDue,
  });
}

export function clearCheckoutData(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
  } catch {
    return;
  }
}
