import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Address } from "@/types/cart";
import type { CreateOrderItem } from "@/types/order";
import type { SelectedOptions } from "@/types/product";
import type { UtmParams } from "@/types/utm";
import type { OrderLineItem as PricedOrderLine } from "@/lib/order";
import { generateUniqueOrderId } from "@/lib/order-id";
import { prisma } from "@/lib/prisma";

const LOG_PREFIX = "[order-capture]";

/**
 * The catalogue fields an order line snapshots, produced by `getOrderCaptureCatalogue`. `cost`
 * is here and nowhere a shopper can reach — see the note on that function and ADR-040.
 */
export interface OrderCaptureEntry {
  id: string;
  name: string;
  image: string;
  cost: number;
}

/** One `order_line_items` row, resolved and priced, before it is written. */
export interface OrderCaptureLine {
  productId: string;
  productName: string;
  productImage: string;
  selectedOptions?: SelectedOptions;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface OrderCapturePricing {
  subtotal: number;
  shippingFee: number;
  total: number;
}

export interface CaptureOrderInput {
  /** Cashfree's own order id, the join between their payment record and ours. */
  cashfreeOrderId: string;
  /** Cashfree's status for that order, through this project's one normalisation. */
  cashfreePaymentStatus: string;
  address: Address;
  utm: UtmParams | null;
  /** The server's computed amounts. Never anything the client sent. */
  pricing: OrderCapturePricing;
  lines: OrderCaptureLine[];
}

/**
 * What one capture attempt did. `FAILED` is a normal, non-throwing outcome as far as the
 * checkout route is concerned — see `captureOrder`.
 */
export type OrderCaptureOutcome =
  | {
      kind: "CAPTURED";
      orderId: string;
      customerId: string;
      /** False when the phone number was already known. Drives nothing; logged and tested. */
      customerCreated: boolean;
    }
  | { kind: "FAILED" };

/**
 * The subset of the client capture needs, so a caller can hand in an interactive transaction's
 * client instead. Tests use that to write real rows and roll them back.
 */
export type OrderCaptureClient = Pick<PrismaClient, "customer" | "order">;

function optionsSignature(selectedOptions: SelectedOptions | undefined): string {
  if (selectedOptions === undefined) return "";

  return JSON.stringify(
    Object.entries(selectedOptions).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

interface CaptureGroup {
  productId: string;
  selectedOptions?: SelectedOptions;
  quantity: number;
}

/**
 * Cart lines collapsed by product *and* by choice, which is the granularity an
 * `order_line_items` row has: two rings engraved A and B are two rows, and two identical A
 * rings are one row of quantity two.
 */
function groupCartLinesByChoice(items: readonly CreateOrderItem[]): CaptureGroup[] {
  const groupsByKey = new Map<string, CaptureGroup>();

  for (const item of items) {
    const key = `${item.productId}|${optionsSignature(item.selectedOptions)}`;
    const existing = groupsByKey.get(key);

    if (existing === undefined) {
      groupsByKey.set(key, {
        productId: item.productId,
        quantity: item.qty,
        ...(item.selectedOptions === undefined
          ? {}
          : { selectedOptions: item.selectedOptions }),
      });
      continue;
    }

    existing.quantity += item.qty;
  }

  return Array.from(groupsByKey.values());
}

/**
 * Whether the grouped cart lines reconstruct exactly what was priced and charged.
 *
 * The pricing core validates quantities only *after* merging a product's lines, so a crafted
 * request can be charged for three of something as two lines of 1.5. Those quantities are
 * legitimately paid for and must still be recorded, but 1.5 is not an `Int` and would fail the
 * insert. This is the check that decides whether the per-choice grouping can be trusted; when
 * it cannot, capture falls back to the priced lines, whose quantities the pricing core has
 * already bounds-checked as integers.
 */
function groupsReconstructPricedQuantities(
  groups: readonly CaptureGroup[],
  pricedLines: readonly PricedOrderLine[],
): boolean {
  const groupedQuantityByProductId = new Map<string, number>();

  for (const group of groups) {
    if (!Number.isInteger(group.quantity) || group.quantity < 1) return false;
    groupedQuantityByProductId.set(
      group.productId,
      (groupedQuantityByProductId.get(group.productId) ?? 0) + group.quantity,
    );
  }

  if (groupedQuantityByProductId.size !== pricedLines.length) return false;

  return pricedLines.every(
    (pricedLine) =>
      groupedQuantityByProductId.get(pricedLine.productId) === pricedLine.qty,
  );
}

/**
 * The `order_line_items` rows for one order.
 *
 * Pure, and given three separate inputs on purpose. Quantities and unit prices come from the
 * priced order — the server's own arithmetic, never the request. Names and photographs come
 * from the catalogue **as it reads at this moment**, copied into the row rather than referenced,
 * so renaming or rephotographing a product later cannot rewrite what an old order says was
 * bought. The recorded choices come from the request, where they have already been validated
 * against the catalogue by `validateOrderLineOptions`, and they price nothing (ADR-019).
 */
export function buildOrderCaptureLines(
  items: readonly CreateOrderItem[],
  pricedLines: readonly PricedOrderLine[],
  catalogue: readonly OrderCaptureEntry[],
): OrderCaptureLine[] {
  const unitPriceByProductId = new Map(
    pricedLines.map((pricedLine) => [pricedLine.productId, pricedLine.unitPrice]),
  );
  const catalogueById = new Map(catalogue.map((entry) => [entry.id, entry]));

  const groups = groupCartLinesByChoice(items).filter((group) =>
    unitPriceByProductId.has(group.productId),
  );

  const sourceLines: CaptureGroup[] = groupsReconstructPricedQuantities(
    groups,
    pricedLines,
  )
    ? groups
    : pricedLines.map((pricedLine) => ({
        productId: pricedLine.productId,
        quantity: pricedLine.qty,
      }));

  return sourceLines.map((group) => {
    const entry = catalogueById.get(group.productId);
    const unitPrice = unitPriceByProductId.get(group.productId);

    if (entry === undefined || unitPrice === undefined) {
      throw new Error(`${group.productId} was priced but is not in the catalogue`);
    }

    return {
      productId: entry.id,
      productName: entry.name,
      productImage: entry.image,
      quantity: group.quantity,
      unitPrice,
      unitCost: entry.cost,
      ...(group.selectedOptions === undefined
        ? {}
        : { selectedOptions: group.selectedOptions }),
    };
  });
}

/**
 * `orders.total_cost` — what the goods cost the shop, snapshotted at capture time so the margin
 * on an order stays answerable after the catalogue's cost figures move. Never shown to a
 * shopper and never part of any amount they are charged.
 */
export function sumOrderCost(lines: readonly OrderCaptureLine[]): number {
  return lines.reduce((total, line) => total + line.unitCost * line.quantity, 0);
}

/** What a `customers` row holds that a later order can correct. */
interface StoredCustomerContactDetails {
  id: string;
  name: string;
  email: string | null;
}

/**
 * Brings a returning customer's name and email into line with the order being placed, and
 * writes nothing when neither has moved.
 *
 * The guard is not an optimisation. Most repeat orders carry exactly the details already
 * stored, and an unconditional update would touch `updated_at` on a row nothing about which
 * changed — noise in the one table an operator scans to recognise a repeat buyer.
 *
 * An email is only ever *upgraded*: a submitted address with no email leaves a stored one
 * alone, because the customer supplying less this time is not a reason to forget what they
 * supplied last time. A name has no equivalent case — `validateAddressForm` has already refused
 * an empty one, so every value reaching here is a real name.
 */
async function refreshCustomerContactDetails(
  client: OrderCaptureClient,
  storedCustomer: StoredCustomerContactDetails,
  submittedAddress: Address,
): Promise<void> {
  const submittedEmail = submittedAddress.email.length > 0 ? submittedAddress.email : null;

  const nameHasMoved = storedCustomer.name !== submittedAddress.name;
  const emailHasMoved = submittedEmail !== null && storedCustomer.email !== submittedEmail;

  if (!nameHasMoved && !emailHasMoved) return;

  await client.customer.update({
    where: { id: storedCustomer.id },
    data: {
      ...(nameHasMoved ? { name: submittedAddress.name } : {}),
      ...(emailHasMoved ? { email: submittedEmail } : {}),
    },
  });
}

/**
 * Writes one captured order — the customer, the order, its line items and the first status
 * history row — and **never throws**.
 *
 * This is the whole design of the function. It runs inside `/api/create-order` after Cashfree
 * has already minted a payment session, at which point the shopper is one redirect away from
 * being charged. A database that is down, slow, or mid-migration must not turn that into a
 * failed checkout, so every fault here is caught, logged against the Cashfree order id, and
 * reduced to `FAILED`. The same principle the CallMeBot notification is built on
 * (`lib/notify.ts`): an important side effect that is not permitted to become a new way for the
 * money path to break. The cost is real and is stated in ADR-042 — a capture failure is a paid
 * order with no row, recoverable only from the Cashfree dashboard.
 *
 * **The customer is found or created by phone**, the one identifier a guest checkout always
 * collects. First-touch attribution is written only when the row is created, so the campaign
 * that won someone survives every later purchase and a repeat order never overwrites it
 * (ADR-039).
 *
 * **A returning customer's name and email are refreshed from the order being placed**, which
 * first-touch attribution deliberately is not. The two are opposite kinds of fact: the campaign
 * that won somebody is a historical event and the latest one would be the wrong answer, while a
 * name is a current description of a person and the *oldest* one is the wrong answer. Writing
 * the name once and never again is what let a placeholder typed into a test checkout keep
 * appearing as the buyer on every later order from that phone, on the admin list, on the detail
 * header, and in the operator's search results — while the address panel on the same screen
 * showed the real name that order was actually placed under.
 *
 * The order's own `shipping_address` is untouched by this: it is a snapshot of what was
 * submitted and each order keeps its own. Only the `customers` row, which has no history and is
 * meant to say who this phone belongs to now, is brought up to date.
 *
 * `paymentType` is `prepaid` and `amountDue` is zero, unconditionally. This route is the only
 * thing that creates orders, and the storefront it serves collects the full amount up front.
 */
export async function captureOrder(
  input: CaptureOrderInput,
  client: OrderCaptureClient = prisma,
): Promise<OrderCaptureOutcome> {
  try {
    const existingCustomer = await client.customer.findUnique({
      where: { phone: input.address.phone },
      select: { id: true, name: true, email: true },
    });

    if (existingCustomer !== null) {
      await refreshCustomerContactDetails(client, existingCustomer, input.address);
    }

    const customerId =
      existingCustomer?.id ??
      (
        await client.customer.create({
          data: {
            phone: input.address.phone,
            name: input.address.name,
            email: input.address.email,
            firstUtmSource: input.utm?.source ?? null,
            firstUtmMedium: input.utm?.medium ?? null,
            firstUtmCampaign: input.utm?.campaign ?? null,
          },
          select: { id: true },
        })
      ).id;

    const orderId = await generateUniqueOrderId();

    await client.order.create({
      data: {
        id: orderId,
        customerId,
        status: "placed",
        paymentType: "prepaid",
        subtotal: new Prisma.Decimal(input.pricing.subtotal),
        shippingFee: new Prisma.Decimal(input.pricing.shippingFee),
        total: new Prisma.Decimal(input.pricing.total),
        totalCost: new Prisma.Decimal(sumOrderCost(input.lines)),
        amountPrepaid: new Prisma.Decimal(input.pricing.total),
        amountDue: new Prisma.Decimal(0),
        cashfreeOrderId: input.cashfreeOrderId,
        cashfreePaymentStatus: input.cashfreePaymentStatus,
        utmSource: input.utm?.source ?? null,
        utmMedium: input.utm?.medium ?? null,
        utmCampaign: input.utm?.campaign ?? null,
        shippingAddress: input.address as unknown as Prisma.InputJsonValue,
        lineItems: {
          create: input.lines.map((line) => ({
            productId: line.productId,
            productName: line.productName,
            productImage: line.productImage,
            quantity: line.quantity,
            unitPrice: new Prisma.Decimal(line.unitPrice),
            unitCost: new Prisma.Decimal(line.unitCost),
            selectedOptions:
              line.selectedOptions === undefined
                ? Prisma.DbNull
                : (line.selectedOptions as unknown as Prisma.InputJsonValue),
          })),
        },
        statusHistory: {
          create: [{ status: "placed", changedBy: "system", reason: null }],
        },
      },
      select: { id: true },
    });

    return {
      kind: "CAPTURED",
      orderId,
      customerId,
      customerCreated: existingCustomer === null,
    };
  } catch (captureError) {
    console.error(
      `${LOG_PREFIX} ${input.cashfreeOrderId} was created with Cashfree but could not be written to Postgres`,
      captureError,
    );
    return { kind: "FAILED" };
  }
}

/**
 * The ten-character order number for one Cashfree payment, or null — and **never throws**, for
 * the same reason nothing else on this path does.
 *
 * Keyed on `orders.cashfree_order_id`, the unique column ADR-042 made the join between
 * Cashfree's record and ours, and the same column `recordVerifiedPaymentStatus` below writes
 * through. It is a separate read rather than a value returned by that update because the two
 * answer different questions and only one of them writes: an order whose stored status already
 * matches performs no update at all, and it still has an order number.
 *
 * Null covers a payment this shop never captured — one whose write failed (ADR-042), one placed
 * before capture existed — and a database that is unreachable. `/api/verify-order` renders all
 * three the same way, by falling back to the payment reference, so distinguishing them here
 * would buy the caller nothing.
 */
export async function findTrackingIdForCashfreeOrder(
  cashfreeOrderId: string,
  client: Pick<PrismaClient, "order"> = prisma,
): Promise<string | null> {
  try {
    const order = await client.order.findUnique({
      where: { cashfreeOrderId },
      select: { id: true },
    });

    return order?.id ?? null;
  } catch (lookupError) {
    console.error(
      `${LOG_PREFIX} ${cashfreeOrderId} could not be looked up for its order number`,
      lookupError,
    );
    return null;
  }
}

/**
 * Records what `/api/verify-order` confirmed about a payment, and **never throws**, for the
 * same reason `captureOrder` does not: a shopper is watching a confirmation screen and a
 * database fault must not become an error on it.
 *
 * It updates `cashfree_payment_status` and nothing else. `status` deliberately stays `placed`
 * on a confirmed payment — fulfilment moves when an operator packs the order, not when money
 * arrives, and the two are different facts (ADR-040).
 *
 * The write is skipped when the stored status already matches, because the confirmation page
 * polls a pending payment up to ten times and nine of those would otherwise be no-op updates
 * bumping `updated_at`. An order this shop never captured — one whose write failed, or one
 * placed before this code shipped — matches nothing and is a silent no-op rather than an error.
 */
export async function recordVerifiedPaymentStatus(
  cashfreeOrderId: string,
  cashfreePaymentStatus: string,
  client: Pick<PrismaClient, "order"> = prisma,
): Promise<"UPDATED" | "UNCHANGED" | "FAILED"> {
  try {
    const { count } = await client.order.updateMany({
      where: {
        cashfreeOrderId,
        NOT: { cashfreePaymentStatus },
      },
      data: { cashfreePaymentStatus },
    });

    return count > 0 ? "UPDATED" : "UNCHANGED";
  } catch (updateError) {
    console.error(
      `${LOG_PREFIX} ${cashfreeOrderId} was verified as ${cashfreePaymentStatus} but the Postgres update failed`,
      updateError,
    );
    return "FAILED";
  }
}
