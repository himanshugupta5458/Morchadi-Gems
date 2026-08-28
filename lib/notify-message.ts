import type { Address, CheckoutData } from "@/types/cart";
import type { SelectedOptions } from "@/types/product";
import type { UtmParams } from "@/types/utm";
import { LEGAL_CONFIG, SITE_CONFIG } from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { formatSelectedOptions } from "@/lib/options";

/**
 * WhatsApp reads a single asterisk pair as bold. Written once here so the markup and the text
 * that uses it stay in one file.
 */
function bold(text: string): string {
  return `*${text}*`;
}

function formatAddressLines(address: Address): string[] {
  return [
    address.name,
    address.line1,
    ...(address.line2 === undefined || address.line2.trim().length === 0
      ? []
      : [address.line2]),
    `${address.city}, ${address.state} ${address.pincode}`,
    `Phone: ${address.phone}`,
    `Email: ${address.email}`,
  ];
}

/**
 * The least a line has to be for this message to describe it: what it is called, how many, and
 * what was chosen on it. A `CartItem` from the shopper's own summary satisfies it, and so does
 * an `OrderCaptureLine` the server priced and wrote itself, which is what lets one set of
 * formatting serve a message built from an untrusted bundle and one built from a Postgres row.
 */
export interface AdminMessageItem {
  name: string;
  qty: number;
  selectedOptions?: SelectedOptions;
}

/**
 * One numbered line per item, with its recorded choices indented underneath.
 *
 * The choices are the reason this message exists in the form it does. Cashfree knows the amount
 * but not that the ring is the letter A, and an item line without its selection is an order
 * that cannot be packed.
 *
 * Orders are now captured in Postgres too
 * ([ADR-042](/docs/decisions/ADR-042-order-capture-in-postgres.md)), which makes this message a
 * notification rather than the archive — and the fallback that makes a failed capture
 * recoverable, since that write is not allowed to fail a checkout.
 */
function formatItemLines(items: readonly AdminMessageItem[]): string[] {
  return items.flatMap((item, index) => {
    const heading = `${index + 1}. ${item.name} x${item.qty}`;
    const selection = formatSelectedOptions(item.selectedOptions);

    return selection.length === 0 ? [heading] : [heading, `   ${selection}`];
  });
}

/**
 * Where the order came from, when the browser knew. Source, medium and campaign only: the
 * other two `utm_` fields are reporting detail rather than something the owner acts on while
 * packing a parcel, and they stay in GA4. An order with none of the three prints no section at
 * all, so an untagged order reads exactly as it did before attribution existed.
 */
function formatUtmLines(utm: UtmParams): string[] {
  return [
    ...(utm.source === undefined ? [] : [`Source: ${utm.source}`]),
    ...(utm.medium === undefined ? [] : [`Medium: ${utm.medium}`]),
    ...(utm.campaign === undefined ? [] : [`Campaign: ${utm.campaign}`]),
  ];
}

export interface AdminOrderMessageInput {
  orderId: string;
  /** Cashfree's `order_amount`, the only amount that is authoritative. Null when unreadable. */
  amountPaid: number | null;
  /**
   * The campaign this order's browser first arrived on, or null for the ordinary order that
   * carries none. See [ADR-039](/docs/decisions/ADR-039-analytics-and-utm-attribution.md).
   */
  utm?: UtmParams | null;
  /**
   * The shopper's own summary of what they bought and where it goes. Display and fulfilment
   * information only, and null when it could not be validated — the message degrades to the
   * order id and the amount rather than being withheld.
   */
  bundle: CheckoutData | null;
}

/**
 * The WhatsApp message an admin receives for a paid order, as plain text with real newlines.
 * URL encoding happens later in `buildCallMeBotUrl`, so this stays readable and assertable.
 *
 * The campaign section, when there is one, sits directly under the order so it is read before
 * the packing detail rather than after it. It describes the visit and never the payment.
 *
 * Every amount that carries weight comes from `amountPaid`, which is Cashfree's. The bundle's
 * own subtotal and shipping are shown as a breakdown because they help whoever packs the
 * parcel, and they are labelled as the shopper's summary so a mismatch reads as a discrepancy
 * to investigate rather than as the truth.
 */
export function composeAdminOrderMessage({
  orderId,
  amountPaid,
  bundle,
  utm = null,
}: AdminOrderMessageInput): string {
  const sections: string[] = [
    bold(`New Order - ${SITE_CONFIG.brandName}`),
    [
      `${bold("Order:")} ${orderId}`,
      `${bold("Paid:")} ${amountPaid === null ? "amount unavailable" : formatRupees(amountPaid)}`,
    ].join("\n"),
  ];

  const utmLines = utm === null ? [] : formatUtmLines(utm);
  if (utmLines.length > 0) {
    sections.push([bold("Came from"), ...utmLines].join("\n"));
  }

  if (bundle === null) {
    sections.push(
      "No item or delivery summary reached this notification. Open the Cashfree dashboard for the customer details on this order.",
    );
    return sections.join("\n\n");
  }

  sections.push([bold("Items"), ...formatItemLines(bundle.cart)].join("\n"));

  sections.push(
    [
      `${bold("Subtotal:")} ${formatRupees(bundle.subtotal)}`,
      `${bold("Shipping:")} ${formatRupees(bundle.shipping)}`,
      `${bold("Total:")} ${formatRupees(bundle.total)}`,
    ].join("\n"),
  );

  sections.push([bold("Deliver to"), ...formatAddressLines(bundle.address)].join("\n"));

  sections.push(
    `Dispatch within ${LEGAL_CONFIG.dispatchWindow}. Check the Cashfree dashboard to confirm the payment.`,
  );

  return sections.join("\n\n");
}

export interface CodOrderMessageInput {
  /** The ten-character order number, which is what the admin panel is searched by. */
  trackingId: string;
  /** The `COD_…` payment reference the order is filed under. Never a Cashfree order id. */
  codOrderReference: string;
  /** What the courier collects at the door. Not an amount anyone has paid. */
  amountDue: number;
  subtotal: number;
  shipping: number;
  total: number;
  items: readonly AdminMessageItem[];
  address: Address;
  /** See [ADR-039](/docs/decisions/ADR-039-analytics-and-utm-attribution.md). */
  utm?: UtmParams | null;
}

/**
 * The WhatsApp message the owner receives for a cash-on-delivery order.
 *
 * It says the same things the paid message says, in the same order, and says one thing
 * differently on purpose: **no money has moved**. There is no `Paid:` line to misread, the one
 * figure given prominence is what is owed at the door, and the closing line asks for the cash
 * to be collected rather than for a payment to be confirmed. Printing an amount beside a word
 * like "paid" would be a claim about money this shop has not received.
 *
 * Every figure here is the server's own, from the order it has just written to Postgres, so
 * unlike `composeAdminOrderMessage` there is no untrusted summary to caveat and no degraded
 * form to fall back to: a message composed at all is a message about a real row.
 *
 * Both identifiers are printed because they answer different questions. `trackingId` is what
 * the admin panel and the shopper both call this order; `codOrderReference` is the column it is
 * filed under, and the thing a server log names ([ADR-060](/docs/decisions/ADR-060-cod-order-notification.md)).
 */
export function composeCodOrderMessage({
  trackingId,
  codOrderReference,
  amountDue,
  subtotal,
  shipping,
  total,
  items,
  address,
  utm = null,
}: CodOrderMessageInput): string {
  const sections: string[] = [
    bold(`New Cash on Delivery Order - ${SITE_CONFIG.brandName}`),
    [
      `${bold("Order:")} ${trackingId}`,
      `${bold("Reference:")} ${codOrderReference}`,
      `${bold("Payment:")} Cash on delivery. Nothing has been paid yet.`,
      `${bold("Due on delivery:")} ${formatRupees(amountDue)}`,
    ].join("\n"),
  ];

  const utmLines = utm === null ? [] : formatUtmLines(utm);
  if (utmLines.length > 0) {
    sections.push([bold("Came from"), ...utmLines].join("\n"));
  }

  sections.push([bold("Items"), ...formatItemLines(items)].join("\n"));

  sections.push(
    [
      `${bold("Subtotal:")} ${formatRupees(subtotal)}`,
      `${bold("Shipping:")} ${formatRupees(shipping)}`,
      `${bold("Total:")} ${formatRupees(total)}`,
    ].join("\n"),
  );

  sections.push([bold("Deliver to"), ...formatAddressLines(address)].join("\n"));

  sections.push(
    `Dispatch within ${LEGAL_CONFIG.dispatchWindow}. Collect ${formatRupees(amountDue)} in cash at delivery, then mark the cash collected on order ${trackingId} in the admin panel.`,
  );

  return sections.join("\n\n");
}
