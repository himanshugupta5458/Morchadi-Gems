import type { Address, CheckoutData } from "@/types/cart";
import { CONTACT_CONFIG, LEGAL_CONFIG, SITE_CONFIG } from "@/lib/config";
import { formatRupees } from "@/lib/format";
import type { AdminMessageItem, CodOrderMessageInput } from "@/lib/notify-message";
import { formatSelectedOptions } from "@/lib/options";
import { formatTrackingDate } from "@/lib/order-tracking-copy";
import { absoluteUrl } from "@/lib/site-url";

const CONTACT_SUPPORT_EMAIL = CONTACT_CONFIG.supportEmail;

/**
 * The palette and type stack below are read, not invented: the hex values are
 * `tailwind.config.ts`'s `colors` object and the serif/sans fallbacks match `font-display` /
 * `font-sans` in the same file. An email client cannot load this project's Tailwind build or
 * its Google Fonts, so every value that would normally be a class is restated here as a literal
 * — keep the two in sync by hand if the storefront palette ever moves.
 */
const BRAND_INK = "#1C1C1C";
const BRAND_IVORY = "#FDFBF7";
const BRAND_WHITE = "#FFFFFF";
const BRAND_GOLD = "#C6A24C";
const BRAND_MUTED = "#6B6B6B";
const BRAND_LINE = "#E8E4DC";

const FONT_DISPLAY_STACK = "Georgia, 'Times New Roman', serif";
const FONT_SANS_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const EMAIL_WIDTH = 600;
const CONTENT_PADDING = "0 40px";

/**
 * The two things every composed email carries back to its caller: a subject honest about what
 * kind of order this is, and the HTML body. Kept together because the two are written as one
 * decision — the subject and the body of the paid/partial email both branch on the same
 * `amountDue` fact, so a caller that only wanted one would still have to compute both.
 */
export interface ComposedCustomerEmail {
  subject: string;
  html: string;
}

const ESCAPE_TABLE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Every string in this email — a name, a street line, a product title — is customer-submitted
 * or catalogue text, never markup this project wrote. HTML has no `URLSearchParams` to lean on
 * the way the WhatsApp side does, so each one is escaped on the way in rather than trusted.
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPE_TABLE[character]);
}

function formatItemListHtml(items: readonly AdminMessageItem[]): string {
  return items
    .map((item) => {
      const selection = formatSelectedOptions(item.selectedOptions);
      const selectionHtml =
        selection.length === 0
          ? ""
          : `<div style="color:${BRAND_MUTED};font-size:13px;margin-top:2px;">${escapeHtml(selection)}</div>`;

      return `<li style="margin-bottom:12px;">
        <div>${escapeHtml(item.name)} &times;${item.qty}</div>
        ${selectionHtml}
      </li>`;
    })
    .join("");
}

function formatAddressHtml(address: Address): string {
  const lines = [
    address.name,
    address.line1,
    ...(address.line2 === undefined || address.line2.trim().length === 0
      ? []
      : [address.line2]),
    `${address.city}, ${address.state} ${address.pincode}`,
    `Phone: ${address.phone}`,
  ];

  return lines.map((line) => escapeHtml(line)).join("<br />");
}

/** A label-left, value-right row pair, shared by the order-meta block and the payment box. */
function renderKeyValueRowsHtml(rows: readonly [string, string][]): string {
  return rows
    .map(
      ([label, value]) => `<tr>
        <td style="padding:4px 0;font-size:14px;color:${BRAND_INK};">${escapeHtml(label)}</td>
        <td style="padding:4px 0;font-size:14px;color:${BRAND_INK};text-align:right;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");
}

interface JourneyStep {
  key: string;
  label: string;
  complete: boolean;
}

const ORDER_JOURNEY_STEPS: readonly JourneyStep[] = [
  { key: "placed", label: "Order Placed", complete: true },
  { key: "packed", label: "Packed", complete: false },
  { key: "shipped", label: "Shipped", complete: false },
  { key: "delivered", label: "Delivered", complete: false },
];

const JOURNEY_STEP_COLUMN_WIDTH = 100;
const JOURNEY_CONNECTOR_WIDTH = 40;

function renderJourneyCircleCell(step: JourneyStep, stepNumber: number): string {
  const fillColor = step.complete ? BRAND_GOLD : BRAND_LINE;
  const glyphColor = step.complete ? BRAND_WHITE : BRAND_MUTED;
  const glyph = step.complete ? "&#10003;" : String(stepNumber);

  return `<td width="${JOURNEY_STEP_COLUMN_WIDTH}" align="center" valign="top">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        <td
          data-step="${step.key}"
          bgcolor="${fillColor}"
          width="30"
          height="30"
          align="center"
          valign="middle"
          style="width:30px;height:30px;border-radius:15px;background-color:${fillColor};font-family:${FONT_SANS_STACK};font-size:13px;font-weight:bold;color:${glyphColor};line-height:30px;text-align:center;"
        >${glyph}</td>
      </tr>
    </table>
  </td>`;
}

function renderJourneyConnectorCell(): string {
  return `<td width="${JOURNEY_CONNECTOR_WIDTH}" valign="middle" style="padding-top:15px;">
    <div style="height:2px;line-height:2px;font-size:0;background-color:${BRAND_LINE};">&nbsp;</div>
  </td>`;
}

function renderJourneyLabelCell(step: JourneyStep): string {
  const textColor = step.complete ? BRAND_INK : BRAND_MUTED;
  const fontWeight = step.complete ? "bold" : "normal";

  return `<td width="${JOURNEY_STEP_COLUMN_WIDTH}" align="center" style="padding-top:8px;font-family:${FONT_SANS_STACK};font-size:11px;line-height:14px;color:${textColor};font-weight:${fontWeight};">${escapeHtml(step.label)}</td>`;
}

/**
 * A static row of four steps with only "Order Placed" ever filled — there is no live shipment
 * feed behind this email, so the graphic never claims to know more than that the order exists.
 * The same markup renders for every order type and every send, which is what the structural
 * test in `customer-email-message.test.ts` checks against.
 */
function renderOrderJourneyHtml(): string {
  const circleRow = ORDER_JOURNEY_STEPS.map((step, index) =>
    [
      index === 0 ? "" : renderJourneyConnectorCell(),
      renderJourneyCircleCell(step, index + 1),
    ].join(""),
  ).join("");

  const labelRow = ORDER_JOURNEY_STEPS.map((step, index) =>
    [
      index === 0 ? "" : `<td width="${JOURNEY_CONNECTOR_WIDTH}"></td>`,
      renderJourneyLabelCell(step),
    ].join(""),
  ).join("");

  return `<!-- journey-start -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>${circleRow}</tr>
    <tr>${labelRow}</tr>
  </table>
  <!-- journey-end -->`;
}

function renderOrderDetailsHtml(
  trackingId: string,
  createdAt: Date | null,
  itemsHtml: string,
): string {
  const metaRows: [string, string][] = [
    ["Order number", trackingId],
    ...(createdAt === null
      ? []
      : ([["Placed on", formatTrackingDate(createdAt)]] as [string, string][])),
  ];

  return `<p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND_MUTED};">Order details</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${renderKeyValueRowsHtml(metaRows)}
    </table>
    <p style="margin:16px 0 4px 0;font-weight:bold;color:${BRAND_INK};">Items</p>
    <ul style="margin:0;padding-left:20px;list-style:disc;color:${BRAND_INK};">${itemsHtml}</ul>`;
}

/** Visually distinct from the order-details block on purpose — a bordered, shaded box, per the design brief. */
function renderPaymentBoxHtml(rows: readonly [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_IVORY};border:1px solid ${BRAND_LINE};border-radius:2px;">
    <tr>
      <td style="padding:16px 20px;">
        <p style="margin:0 0 8px 0;font-weight:bold;color:${BRAND_INK};">Payment</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${renderKeyValueRowsHtml(rows)}
        </table>
      </td>
    </tr>
  </table>`;
}

function renderDeliveryAddressHtml(address: Address): string {
  return `<p style="margin:0 0 4px 0;font-weight:bold;color:${BRAND_INK};">Deliver to</p>
    <p style="margin:0;color:${BRAND_INK};">${formatAddressHtml(address)}</p>`;
}

/** The standard email-safe "button": a coloured table cell holding a link, since a real `<button>` is not reliable in email clients. */
function renderTrackingButtonHtml(trackingUrl: string | null): string {
  if (trackingUrl === null) return "";

  const escapedUrl = escapeHtml(trackingUrl);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding-top:8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${BRAND_INK}" style="background-color:${BRAND_INK};border-radius:2px;">
              <a
                href="${escapedUrl}"
                style="display:inline-block;padding:14px 32px;font-family:${FONT_SANS_STACK};font-size:14px;font-weight:bold;letter-spacing:0.05em;text-transform:uppercase;color:${BRAND_IVORY};text-decoration:none;"
              >Track your order</a>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0 0;font-size:12px;color:${BRAND_MUTED};word-break:break-all;">${escapedUrl}</p>
      </td>
    </tr>
  </table>`;
}

function renderHeaderHtml(): string {
  const logoUrl = escapeHtml(absoluteUrl("/logo.png"));
  const brandName = escapeHtml(SITE_CONFIG.brandName);

  return `<tr>
    <td bgcolor="${BRAND_GOLD}" style="background-color:${BRAND_GOLD};height:4px;line-height:4px;font-size:0;">&nbsp;</td>
  </tr>
  <tr>
    <td align="center" style="padding:28px 40px;border-bottom:1px solid ${BRAND_LINE};">
      <img
        src="${logoUrl}"
        width="140"
        height="85"
        alt="${brandName}"
        style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;max-width:140px;height:auto;"
      />
    </td>
  </tr>`;
}

function renderFooterHtml(): string {
  return `<tr>
    <td bgcolor="${BRAND_INK}" style="background-color:${BRAND_INK};padding:24px 40px;">
      <p style="margin:0;font-family:${FONT_SANS_STACK};font-size:13px;line-height:20px;color:${BRAND_IVORY};">
        Questions about this order? Email
        <a href="mailto:${CONTACT_SUPPORT_EMAIL}" style="color:${BRAND_IVORY};font-weight:bold;">${CONTACT_SUPPORT_EMAIL}</a>
        or call
        <a href="${CONTACT_CONFIG.phoneHref}" style="color:${BRAND_IVORY};font-weight:bold;">${escapeHtml(CONTACT_CONFIG.phoneDisplay)}</a>.
      </p>
    </td>
  </tr>`;
}

/**
 * The shell every customer email shares: an accent-banded header carrying the logo, a body
 * slot, and a dark footer band with the support address and phone — the same three bands the
 * storefront itself uses (`Header`, page content, `Footer`), rebuilt in table markup because an
 * email client renders neither Tailwind nor flexbox. See ADR-062 for why one shared shell
 * still serves both composers below rather than a template per order type.
 */
function renderEmailShell(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(SITE_CONFIG.brandName)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND_IVORY};font-family:${FONT_SANS_STACK};color:${BRAND_INK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_IVORY};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="${EMAIL_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_WHITE};max-width:${EMAIL_WIDTH}px;width:100%;">
            ${renderHeaderHtml()}
            <tr>
              <td style="padding:${CONTENT_PADDING};">
                ${bodyHtml}
              </td>
            </tr>
            ${renderFooterHtml()}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface CodOrderConfirmationEmailInput {
  order: CodOrderMessageInput;
  trackingUrl: string | null;
  /** When Postgres captured the row. Null only in the impossible case of a fabricated call — a real send always follows a successful capture. */
  createdAt: Date | null;
}

/**
 * The customer's email for a cash-on-delivery order. It says the same things
 * `composeCodOrderMessage` says to the owner, in the same order, and for the same reason: no
 * money has moved, so the word "confirmed" never appears next to a rupee figure. See
 * [ADR-060](/docs/decisions/ADR-060-cod-order-notification.md) for why the paid and
 * cash-on-delivery messages are written as two composers rather than one with a flag.
 */
export function composeCodOrderConfirmationEmail({
  order,
  trackingUrl,
  createdAt,
}: CodOrderConfirmationEmailInput): ComposedCustomerEmail {
  const subject = `Your ${SITE_CONFIG.brandName} cash-on-delivery order is placed`;

  const html = renderEmailShell(`
    <p style="margin:24px 0 0 0;font-size:15px;line-height:24px;">Hi ${escapeHtml(order.address.name)},</p>
    <h1 style="margin:8px 0 0 0;font-family:${FONT_DISPLAY_STACK};font-weight:normal;font-size:24px;line-height:32px;color:${BRAND_INK};">Your cash-on-delivery order is placed</h1>
    <p style="margin:8px 0 0 0;font-size:15px;line-height:24px;">
      Order <strong>${escapeHtml(order.trackingId)}</strong> is placed.
      This is a cash-on-delivery order. <strong>Nothing has been paid yet.</strong> Have
      ${formatRupees(order.amountDue)} ready in cash when it arrives.
    </p>

    <div style="margin:28px 0 0 0;">${renderOrderJourneyHtml()}</div>

    <div style="margin:28px 0 0 0;">
      ${renderOrderDetailsHtml(order.trackingId, createdAt, formatItemListHtml(order.items))}
    </div>

    <div style="margin:24px 0 0 0;">
      ${renderPaymentBoxHtml([
        ["Subtotal", formatRupees(order.subtotal)],
        ["Shipping", formatRupees(order.shipping)],
        ["Total", formatRupees(order.total)],
        ["Due on delivery", formatRupees(order.amountDue)],
      ])}
    </div>

    <div style="margin:24px 0 0 0;">
      ${renderDeliveryAddressHtml(order.address)}
      <p style="margin:16px 0 0 0;font-size:13px;color:${BRAND_MUTED};">Dispatch within ${escapeHtml(LEGAL_CONFIG.dispatchWindow)}.</p>
    </div>

    <div style="margin:28px 0 0 0;">${renderTrackingButtonHtml(trackingUrl)}</div>
  `);

  return { subject, html };
}

export interface PaidOrderConfirmationEmailInput {
  /** The ten-character order number, or null when the capture that assigns one failed. */
  trackingId: string | null;
  /** Cashfree's own reference, printed only when there is no order number to show instead. */
  cashfreeOrderId: string;
  /** Cashfree's `order_amount` — the only authoritative amount, as everywhere else. */
  amountPaid: number | null;
  /**
   * What is still owed at the door, from `orders.amount_due`. Null when it could not be read,
   * and — mirroring how `OrderConfirmation.tsx` already treats this same ambiguity — rendered
   * as though nothing is due rather than left to imply a balance that may not exist.
   */
  amountDue: number | null;
  /** The shopper's own summary, for the items and the delivery address. Null when it failed shape validation, or never reached this notification. */
  bundle: CheckoutData | null;
  trackingUrl: string | null;
  /** From the same captured row `amountDue` is read from. Null under the same conditions. */
  createdAt: Date | null;
}

/**
 * The customer's email once `/api/notify-admin` has re-verified a payment as `PAID`. One
 * composer covers both the fully prepaid order and the partial-payment order, exactly as
 * `OrderConfirmation.tsx` renders both from a single branch on `amountDue`: the two are the
 * same message with one more honest sentence, not two different claims about what happened.
 *
 * Unlike the owner's WhatsApp message, this one **states the balance still due at delivery**
 * on a partial-payment order. `composeAdminOrderMessage` does not — a known, previously
 * accepted gap (ADR-060's consequences) — but this is a new customer-facing channel, or the
 * gap would be silently repeated. This module can close it because it reads
 * `orders.amount_due`, which the WhatsApp message's caller never fetches.
 */
export function composePaidOrderConfirmationEmail({
  trackingId,
  cashfreeOrderId,
  amountPaid,
  amountDue,
  bundle,
  trackingUrl,
  createdAt,
}: PaidOrderConfirmationEmailInput): ComposedCustomerEmail {
  const hasBalanceDue = amountDue !== null && amountDue > 0;
  const orderName = trackingId ?? cashfreeOrderId;
  const greetingName = bundle?.address.name;

  const subject = hasBalanceDue
    ? `Your ${SITE_CONFIG.brandName} order is confirmed: balance due at delivery`
    : `Your ${SITE_CONFIG.brandName} order is confirmed`;

  const statusParagraph = hasBalanceDue
    ? `Your payment went through and your order <strong>${escapeHtml(orderName)}</strong> is confirmed.
       ${amountPaid === null ? "The amount charged" : formatRupees(amountPaid)} has been paid
       online, and the remaining ${formatRupees(amountDue ?? 0)} is due in cash when it is
       delivered.`
    : `Your payment went through and your order <strong>${escapeHtml(orderName)}</strong> is confirmed.
       Nothing more is needed from you.`;

  const orderDetailsHtml =
    bundle === null
      ? `<p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND_MUTED};">Order details</p>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
           ${renderKeyValueRowsHtml([["Order number", orderName]])}
         </table>
         <p style="margin:16px 0 0 0;color:${BRAND_MUTED};">Open the order in
         <a href="${escapeHtml(trackingUrl ?? "#")}" style="color:${BRAND_INK};">your order tracking page</a>
         for the full item list.</p>`
      : renderOrderDetailsHtml(orderName, createdAt, formatItemListHtml(bundle.cart));

  /**
   * `amountPaid` is Cashfree's own `order_amount` and is printed unconditionally, exactly as
   * `composeAdminOrderMessage` prints `*Paid:*` regardless of whether a summary reached it.
   * The bundle's subtotal and shipping are shown alongside it, when there is a bundle, as
   * display detail only — they never replace the one figure that decides what to show as paid.
   */
  const moneyRows: [string, string][] = [
    ...(bundle === null
      ? []
      : ([
          ["Subtotal", formatRupees(bundle.subtotal)],
          ["Shipping", formatRupees(bundle.shipping)],
        ] as [string, string][])),
    [
      hasBalanceDue ? "Paid online" : "Amount paid",
      amountPaid === null ? "amount unavailable" : formatRupees(amountPaid),
    ],
    ...(hasBalanceDue
      ? ([["Due on delivery", formatRupees(amountDue ?? 0)]] as [string, string][])
      : []),
  ];

  const addressHtml = bundle === null ? "" : renderDeliveryAddressHtml(bundle.address);

  const html = renderEmailShell(`
    <p style="margin:24px 0 0 0;font-size:15px;line-height:24px;">${greetingName === undefined ? "Hi," : `Hi ${escapeHtml(greetingName)},`}</p>
    <h1 style="margin:8px 0 0 0;font-family:${FONT_DISPLAY_STACK};font-weight:normal;font-size:24px;line-height:32px;color:${BRAND_INK};">Your order is confirmed</h1>
    <p style="margin:8px 0 0 0;font-size:15px;line-height:24px;">${statusParagraph}</p>

    <div style="margin:28px 0 0 0;">${renderOrderJourneyHtml()}</div>

    <div style="margin:28px 0 0 0;">${orderDetailsHtml}</div>

    <div style="margin:24px 0 0 0;">${renderPaymentBoxHtml(moneyRows)}</div>

    <div style="margin:24px 0 0 0;">
      ${addressHtml}
      <p style="margin:${addressHtml === "" ? "0" : "16px"} 0 0 0;font-size:13px;color:${BRAND_MUTED};">Dispatch within ${escapeHtml(LEGAL_CONFIG.dispatchWindow)}.</p>
    </div>

    <div style="margin:28px 0 0 0;">${renderTrackingButtonHtml(trackingUrl)}</div>
  `);

  return { subject, html };
}
