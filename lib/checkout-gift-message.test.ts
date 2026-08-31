import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { findAdminOrderDetail } from "@/lib/admin-order-detail";
import { GIFT_MESSAGE_MAX_LENGTH } from "@/lib/gift-message";
import { prisma } from "@/lib/prisma";
import { getCodEligibilityCatalogue } from "@/lib/products";

/**
 * The gift note end to end: typed at `/payment`, sanitised by the route, written to
 * `orders.gift_message`, and read back by the screen an operator packs from.
 *
 * The cash-on-delivery path is used throughout because it is the one that touches no gateway —
 * no `fetch`, no credentials, no payment session — so what is being tested is the note and the
 * row rather than a Cashfree stub. The rule it is held to is every other client input's:
 * `lib/gift-message.test.ts` proves the note is not an input to any pricing function, and the
 * cases here prove the same thing against the real route, the real catalogue and a real row.
 *
 * See [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const GIFT_TEST_PHONE = "9876500044";

const GIFT_TEST_ADDRESS = {
  name: "Gift Note Test",
  phone: GIFT_TEST_PHONE,
  email: "gift.note@example.com",
  line1: "9 Johari Bazaar",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302003",
};

let unavailableReason: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

/**
 * A piece the catalogue on disk still takes on delivery, found rather than named — the same
 * reasoning `lib/checkout-payment-paths.test.ts` gives for not hard-coding a product id.
 */
function firstPieceTakenOnDelivery(): string {
  const eligible = getCodEligibilityCatalogue().find(
    (entry) => entry.minPrepaidAmount === 0,
  );

  if (eligible === undefined) {
    throw new Error(
      "no product in data/products.json reads minPrepaidAmount: 0, so no cart can reach the cash-on-delivery path",
    );
  }

  return eligible.id;
}

const COD_ELIGIBLE_ID = firstPieceTakenOnDelivery();

async function postCreateOrder(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/create-order/route");
  return POST(
    new Request("http://localhost:3000/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function placeCodOrder(extra: Record<string, unknown>): Promise<{
  trackingId: string;
  codOrderReference: string;
}> {
  const response = await postCreateOrder({
    items: [{ productId: COD_ELIGIBLE_ID, qty: 2 }],
    address: GIFT_TEST_ADDRESS,
    paymentPath: "cod",
    ...extra,
  });

  expect(response.status).toBe(200);
  return response.json();
}

async function removeGiftTestRows(): Promise<void> {
  if (unavailableReason !== null) return;

  const customer = await prisma.customer.findUnique({
    where: { phone: GIFT_TEST_PHONE },
    select: { id: true },
  });
  if (customer === null) return;

  const orderIds = (
    await prisma.order.findMany({ where: { customerId: customer.id }, select: { id: true } })
  ).map((order) => order.id);

  await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderLineItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.customer.delete({ where: { id: customer.id } });
}

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    unavailableReason = `no database at DATABASE_URL (${firstLineOf(error)}) — ${START_POSTGRES_HINT}`;
  }

  vi.spyOn(console, "log").mockImplementation(() => {});
  await removeGiftTestRows();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await removeGiftTestRows();
});

afterAll(async () => {
  vi.restoreAllMocks();
  await prisma.$disconnect();
});

describe("a gift note through a real checkout", () => {
  it("is written to the order and read back on the admin detail", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const note = "Please wrap it in the red box. It is for my sister's birthday.";
    const { trackingId } = await placeCodOrder({ giftMessage: note });

    const written = await prisma.order.findUniqueOrThrow({ where: { id: trackingId } });
    expect(written.giftMessage).toBe(note);

    const detail = await findAdminOrderDetail(trackingId);
    expect(detail?.giftMessage).toBe(note);
  });

  it("leaves the column null on an order placed without one", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { trackingId } = await placeCodOrder({});

    const written = await prisma.order.findUniqueOrThrow({ where: { id: trackingId } });
    expect(written.giftMessage).toBeNull();

    expect((await findAdminOrderDetail(trackingId))?.giftMessage).toBeNull();
  });

  it("charges exactly the same with a note as without one", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const plain = await placeCodOrder({});
    const plainRow = await prisma.order.findUniqueOrThrow({ where: { id: plain.trackingId } });

    await removeGiftTestRows();

    const noted = await placeCodOrder({ giftMessage: "A note that costs nothing." });
    const notedRow = await prisma.order.findUniqueOrThrow({ where: { id: noted.trackingId } });

    expect(notedRow.subtotal.toString()).toBe(plainRow.subtotal.toString());
    expect(notedRow.shippingFee.toString()).toBe(plainRow.shippingFee.toString());
    expect(notedRow.total.toString()).toBe(plainRow.total.toString());
    expect(notedRow.amountDue.toString()).toBe(plainRow.amountDue.toString());
  });

  it("cannot be used to move the total, however large or however written", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const plain = await placeCodOrder({});
    const plainRow = await prisma.order.findUniqueOrThrow({ where: { id: plain.trackingId } });

    const hostileNotes: unknown[] = [
      "x".repeat(10_000),
      '{"total": 1, "subtotal": 1, "shipping": 0}',
      { total: 1 },
      1,
      null,
    ];

    for (const giftMessage of hostileNotes) {
      await removeGiftTestRows();

      const placed = await placeCodOrder({ giftMessage });
      const row = await prisma.order.findUniqueOrThrow({ where: { id: placed.trackingId } });

      expect(row.total.toString()).toBe(plainRow.total.toString());
      expect(row.amountDue.toString()).toBe(plainRow.total.toString());
      expect(row.amountPrepaid.toString()).toBe("0");
    }
  });

  it("truncates an oversized note to the column's own cap rather than failing the order", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { trackingId } = await placeCodOrder({ giftMessage: "y".repeat(10_000) });

    const written = await prisma.order.findUniqueOrThrow({ where: { id: trackingId } });
    expect(written.giftMessage).toHaveLength(GIFT_MESSAGE_MAX_LENGTH);
  });

  it("records a note that is only whitespace as no note at all", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { trackingId } = await placeCodOrder({ giftMessage: "    \n  " });

    const written = await prisma.order.findUniqueOrThrow({ where: { id: trackingId } });
    expect(written.giftMessage).toBeNull();
  });
});
