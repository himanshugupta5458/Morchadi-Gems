import type { Address, CartItem, CheckoutData } from "@/types/cart";
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
function formatItemLines(items: CartItem[]): string[] {
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
