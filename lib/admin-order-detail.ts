import "server-only";
import type { OrderStatus, PaymentType, Prisma, PrismaClient } from "@prisma/client";
import type { AddressFormValues } from "@/lib/address";
import { EMPTY_ADDRESS_FORM } from "@/lib/address";
import { prisma } from "@/lib/prisma";

/**
 * One line of the order as it was bought, not as the catalogue reads today. Every field here
 * is a snapshot column — renaming or rephotographing a product cannot rewrite an old order.
 *
 * `unitCost` is absent, as it is from the list. Margin is real data and the detail page has no
 * use for it, so a query that never selects it cannot serialise it into the page's props.
 */
export interface AdminOrderDetailLine {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  selectedOptions: Record<string, string>;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** One `order_status_history` row, oldest first on the page. */
export interface AdminOrderStatusEvent {
  id: string;
  status: OrderStatus;
  changedAt: Date;
  changedBy: string;
  reason: string | null;
}

export interface AdminOrderDetail {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: OrderStatus;
  paymentType: PaymentType;
  subtotal: number;
  shippingFee: number;
  total: number;
  amountPrepaid: number;
  amountDue: number;
  codAmountCollected: boolean;
  codCollectedAt: Date | null;
  itemReceivedBack: boolean;
  itemReceivedBackAt: Date | null;
  isRefunded: boolean;
  refundedAt: Date | null;
  /** Null until somebody has decided; `0` once somebody has decided nothing goes back. */
  refundAmount: number | null;
  cashfreeOrderId: string;
  cashfreePaymentStatus: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  shippingAddress: AddressFormValues;
  /**
   * The note the shopper typed at the payment step, for whoever packs the parcel, or null.
   * Read-only on this page and everywhere else: it is the customer's words, and an operator
   * editing them would be putting their own into a card the customer thinks they wrote.
   */
  giftMessage: string | null;
  lines: AdminOrderDetailLine[];
  history: AdminOrderStatusEvent[];
}

function readJsonString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

/**
 * The stored `shipping_address` as form values.
 *
 * It is a `Json` column, so what comes back is whatever was written — today always an
 * `Address` from checkout, and tomorrow possibly a row hand-created by an operator or one
 * written by an older version of this code. Every field is read defensively and missing ones
 * become the empty string, because a detail page that throws on one malformed row is a page
 * that cannot be used to *fix* that row.
 */
export function readShippingAddress(value: Prisma.JsonValue): AddressFormValues {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return EMPTY_ADDRESS_FORM;
  }

  const source = value as Record<string, unknown>;

  return {
    name: readJsonString(source, "name"),
    phone: readJsonString(source, "phone"),
    email: readJsonString(source, "email"),
    line1: readJsonString(source, "line1"),
    line2: readJsonString(source, "line2"),
    city: readJsonString(source, "city"),
    state: readJsonString(source, "state"),
    pincode: readJsonString(source, "pincode"),
  };
}

/**
 * The recorded choices for one line, as `{ "Letter": "A" }`. Display and fulfilment only — no
 * amount has ever read them (ADR-019) — so anything that is not a string pair is dropped
 * rather than rendered as `[object Object]`.
 */
export function readSelectedOptions(value: Prisma.JsonValue): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );

  return Object.fromEntries(entries);
}

/**
 * An order id as the database spells it. Ids are minted from an uppercase alphabet
 * (`lib/order-id.ts`), and the ways one arrives — read off a courier label, pasted out of a
 * chat client that lowercased it, typed by the owner — do not all preserve case.
 */
export function normaliseOrderId(raw: string): string {
  return raw.trim().toUpperCase();
}

export type AdminOrderDetailClient = Pick<PrismaClient, "order">;

/**
 * One order, everything on it, in one query.
 *
 * The `[id]` segment is `orders.id` itself — the ten-character number ADR-043 made the order's
 * public name and the same value the list's first column links on. There is no lookup by
 * `cashfree_order_id` here and there should not be: that is the payment's name, and an admin
 * URL keyed on it would be a second identifier for the same row.
 *
 * The status history is ordered oldest-first in the query rather than in the page, so the
 * timeline reads as a story in every caller. `changedAt` ties are broken on `id` so two rows
 * written in the same millisecond cannot swap places between renders.
 */
export async function findAdminOrderDetail(
  orderId: string,
  client: AdminOrderDetailClient = prisma,
): Promise<AdminOrderDetail | null> {
  const order = await client.order.findUnique({
    where: { id: normaliseOrderId(orderId) },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      status: true,
      paymentType: true,
      subtotal: true,
      shippingFee: true,
      total: true,
      amountPrepaid: true,
      amountDue: true,
      codAmountCollected: true,
      codCollectedAt: true,
      itemReceivedBack: true,
      itemReceivedBackAt: true,
      isRefunded: true,
      refundedAt: true,
      refundAmount: true,
      cashfreeOrderId: true,
      cashfreePaymentStatus: true,
      shippingAddress: true,
      giftMessage: true,
      customer: { select: { name: true, phone: true, email: true } },
      lineItems: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productId: true,
          productName: true,
          productImage: true,
          selectedOptions: true,
          quantity: true,
          unitPrice: true,
        },
      },
      statusHistory: {
        orderBy: [{ changedAt: "asc" }, { id: "asc" }],
        select: { id: true, status: true, changedAt: true, changedBy: true, reason: true },
      },
    },
  });

  if (order === null) return null;

  return {
    id: order.id,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    status: order.status,
    paymentType: order.paymentType,
    subtotal: order.subtotal.toNumber(),
    shippingFee: order.shippingFee.toNumber(),
    total: order.total.toNumber(),
    amountPrepaid: order.amountPrepaid.toNumber(),
    amountDue: order.amountDue.toNumber(),
    codAmountCollected: order.codAmountCollected,
    codCollectedAt: order.codCollectedAt,
    itemReceivedBack: order.itemReceivedBack,
    itemReceivedBackAt: order.itemReceivedBackAt,
    isRefunded: order.isRefunded,
    refundedAt: order.refundedAt,
    refundAmount: order.refundAmount === null ? null : order.refundAmount.toNumber(),
    cashfreeOrderId: order.cashfreeOrderId,
    cashfreePaymentStatus: order.cashfreePaymentStatus,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    customerEmail: order.customer.email,
    shippingAddress: readShippingAddress(order.shippingAddress),
    giftMessage: order.giftMessage,
    lines: order.lineItems.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      productImage: line.productImage,
      selectedOptions: readSelectedOptions(line.selectedOptions),
      quantity: line.quantity,
      unitPrice: line.unitPrice.toNumber(),
      lineTotal: line.unitPrice.toNumber() * line.quantity,
    })),
    history: order.statusHistory.map((event) => ({
      id: event.id,
      status: event.status,
      changedAt: event.changedAt,
      changedBy: event.changedBy,
      reason: event.reason,
    })),
  };
}
