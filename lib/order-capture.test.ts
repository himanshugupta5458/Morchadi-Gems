import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { Address } from "@/types/cart";
import type { CreateOrderItem } from "@/types/order";
import {
  buildOrderCaptureLines,
  captureOrder,
  recordVerifiedPaymentStatus,
  sumOrderCost,
  type OrderCaptureClient,
  type OrderCaptureEntry,
} from "@/lib/order-capture";
import { buildOrderFromCart, mergeOrderItemsByProduct } from "@/lib/order";
import { getOrderCaptureCatalogue, getOrderPricingCatalogue } from "@/lib/products";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const INITIAL_RING_ID = "P001";
const WATCH_RING_ID = "P010";

const CAPTURE_PHONE = "9000000001";

let unavailableReason: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

/** See the note on the same class in `lib/prisma-schema.test.ts`. */
class RollbackSignal extends Error {}

const CAPTURE_ADDRESS: Address = {
  name: "Capture Test",
  phone: CAPTURE_PHONE,
  email: "capture@example.com",
  line1: "1 Test Road",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302001",
};

function priceCart(items: readonly CreateOrderItem[]) {
  const order = buildOrderFromCart(
    mergeOrderItemsByProduct(items),
    getOrderPricingCatalogue(),
  );
  expect(order.valid).toBe(true);
  return order;
}

function captureEntry(productId: string): OrderCaptureEntry {
  const entry = getOrderCaptureCatalogue().find((candidate) => candidate.id === productId);
  if (entry === undefined) throw new Error(`Fixture product ${productId} is missing`);
  return entry;
}

function captureInputFor(items: readonly CreateOrderItem[], cashfreeOrderId: string) {
  const order = priceCart(items);

  return {
    cashfreeOrderId,
    cashfreePaymentStatus: "PENDING",
    address: CAPTURE_ADDRESS,
    utm: null,
    pricing: {
      subtotal: order.subtotal,
      shippingFee: order.shipping,
      total: order.total,
    },
    payment: {
      paymentType: "prepaid" as const,
      amountPrepaid: order.total,
      amountDue: 0,
    },
    lines: buildOrderCaptureLines(items, order.lineItems, getOrderCaptureCatalogue()),
  };
}

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    unavailableReason = `no database at DATABASE_URL (${firstLineOf(error)}) — ${START_POSTGRES_HINT}`;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("the capture catalogue", () => {
  it("carries the cost, the name and the photograph, and nothing that decides a price", () => {
    for (const entry of getOrderCaptureCatalogue()) {
      expect(Object.keys(entry).sort()).toEqual(["cost", "id", "image", "name"]);
      expect(entry).not.toHaveProperty("price");
      expect(entry).not.toHaveProperty("mrp");
      expect(entry.cost).toBeGreaterThan(0);
      expect(entry.image.length).toBeGreaterThan(0);
    }
  });

  it("is a separate object from the one the pricing core is given", () => {
    expect(JSON.stringify(getOrderPricingCatalogue())).not.toContain("cost");
  });
});

describe("the line items an order snapshots", () => {
  it("copies the name and photograph as they read now, not a reference to the catalogue", () => {
    const items: CreateOrderItem[] = [{ productId: INITIAL_RING_ID, qty: 2 }];
    const catalogueAtOrderTime = getOrderCaptureCatalogue();

    const lines = buildOrderCaptureLines(
      items,
      priceCart(items).lineItems,
      catalogueAtOrderTime,
    );

    const renamedCatalogue = catalogueAtOrderTime.map((entry) =>
      entry.id === INITIAL_RING_ID
        ? { ...entry, name: "Renamed After The Order", image: "/products/NEW.webp" }
        : entry,
    );

    expect(lines[0].productName).toBe(captureEntry(INITIAL_RING_ID).name);
    expect(lines[0].productImage).toBe(captureEntry(INITIAL_RING_ID).image);
    expect(lines[0].productName).not.toBe("Renamed After The Order");
    expect(renamedCatalogue[0]).not.toBe(catalogueAtOrderTime[0]);
  });

  it("prices from the server's own arithmetic and costs from the catalogue", () => {
    const items: CreateOrderItem[] = [{ productId: WATCH_RING_ID, qty: 3 }];
    const order = priceCart(items);

    const lines = buildOrderCaptureLines(items, order.lineItems, getOrderCaptureCatalogue());

    expect(lines).toHaveLength(1);
    expect(lines[0].unitPrice).toBe(order.lineItems[0].unitPrice);
    expect(lines[0].unitCost).toBe(captureEntry(WATCH_RING_ID).cost);
    expect(lines[0].quantity).toBe(3);
    expect(sumOrderCost(lines)).toBe(captureEntry(WATCH_RING_ID).cost * 3);
  });

  it("keeps two engravings of one product as two rows", () => {
    const items: CreateOrderItem[] = [
      { productId: INITIAL_RING_ID, qty: 1, selectedOptions: { Letter: "A" } },
      { productId: INITIAL_RING_ID, qty: 2, selectedOptions: { Letter: "B" } },
    ];

    const lines = buildOrderCaptureLines(
      items,
      priceCart(items).lineItems,
      getOrderCaptureCatalogue(),
    );

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.selectedOptions)).toEqual([
      { Letter: "A" },
      { Letter: "B" },
    ]);
    expect(lines.map((line) => line.quantity)).toEqual([1, 2]);
    expect(sumOrderCost(lines)).toBe(captureEntry(INITIAL_RING_ID).cost * 3);
  });

  it("collapses two identical lines into one row of the summed quantity", () => {
    const items: CreateOrderItem[] = [
      { productId: INITIAL_RING_ID, qty: 1, selectedOptions: { Letter: "A" } },
      { productId: INITIAL_RING_ID, qty: 2, selectedOptions: { Letter: "A" } },
    ];

    const lines = buildOrderCaptureLines(
      items,
      priceCart(items).lineItems,
      getOrderCaptureCatalogue(),
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
  });

  it("falls back to the priced lines when a crafted request splits a quantity fractionally", () => {
    const items: CreateOrderItem[] = [
      { productId: INITIAL_RING_ID, qty: 1.5, selectedOptions: { Letter: "A" } },
      { productId: INITIAL_RING_ID, qty: 1.5, selectedOptions: { Letter: "B" } },
    ];
    const order = priceCart(items);

    expect(order.lineItems[0].qty).toBe(3);

    const lines = buildOrderCaptureLines(items, order.lineItems, getOrderCaptureCatalogue());

    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
    expect(Number.isInteger(lines[0].quantity)).toBe(true);
    expect(lines[0].selectedOptions).toBeUndefined();
  });
});

describe("capturing an order", () => {
  it("writes the customer, order, line items and first history row", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(
      prisma.$transaction(async (tx) => {
        const items: CreateOrderItem[] = [
          { productId: INITIAL_RING_ID, qty: 1, selectedOptions: { Letter: "A" } },
        ];
        const input = captureInputFor(items, "cf_capture_test_1");

        const outcome = await captureOrder(input, tx);

        expect(outcome.kind).toBe("CAPTURED");
        if (outcome.kind !== "CAPTURED") throw new RollbackSignal();

        expect(outcome.orderId).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/);
        expect(outcome.customerCreated).toBe(true);

        const written = await tx.order.findUniqueOrThrow({
          where: { id: outcome.orderId },
          include: { lineItems: true, statusHistory: true, customer: true },
        });

        expect(written.status).toBe("placed");
        expect(written.paymentType).toBe("prepaid");
        expect(written.total.toString()).toBe(String(input.pricing.total));
        expect(written.amountPrepaid.toString()).toBe(String(input.pricing.total));
        expect(written.amountDue.toString()).toBe("0");
        expect(written.subtotal.toString()).toBe(String(input.pricing.subtotal));
        expect(written.shippingFee.toString()).toBe(String(input.pricing.shippingFee));
        expect(written.totalCost.toString()).toBe(String(sumOrderCost(input.lines)));
        expect(written.cashfreeOrderId).toBe("cf_capture_test_1");
        expect(written.cashfreePaymentStatus).toBe("PENDING");
        expect(written.customer.phone).toBe(CAPTURE_PHONE);
        expect(written.shippingAddress).toEqual(CAPTURE_ADDRESS);

        expect(written.lineItems).toHaveLength(1);
        expect(written.lineItems[0].productName).toBe(captureEntry(INITIAL_RING_ID).name);
        expect(written.lineItems[0].productImage).toBe(captureEntry(INITIAL_RING_ID).image);
        expect(written.lineItems[0].selectedOptions).toEqual({ Letter: "A" });
        expect(written.lineItems[0].unitCost.toString()).toBe(
          String(captureEntry(INITIAL_RING_ID).cost),
        );

        expect(written.statusHistory).toHaveLength(1);
        expect(written.statusHistory[0].status).toBe("placed");
        expect(written.statusHistory[0].changedBy).toBe("system");
        expect(written.statusHistory[0].reason).toBeNull();

        throw new RollbackSignal();
      }),
    ).rejects.toBeInstanceOf(RollbackSignal);

    expect(await prisma.customer.count({ where: { phone: CAPTURE_PHONE } })).toBe(0);
  });

  it("reuses the customer when the same phone orders twice, and never rewrites their first campaign", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(
      prisma.$transaction(async (tx) => {
        const items: CreateOrderItem[] = [{ productId: WATCH_RING_ID, qty: 1 }];

        const first = await captureOrder(
          {
            ...captureInputFor(items, "cf_capture_dedup_1"),
            utm: { source: "instagram", medium: "paid_social", campaign: "rakhi_2026" },
          },
          tx,
        );

        const second = await captureOrder(
          {
            ...captureInputFor(items, "cf_capture_dedup_2"),
            utm: { source: "google", medium: "cpc", campaign: "diwali_2026" },
          },
          tx,
        );

        expect(first.kind).toBe("CAPTURED");
        expect(second.kind).toBe("CAPTURED");
        if (first.kind !== "CAPTURED" || second.kind !== "CAPTURED") {
          throw new RollbackSignal();
        }

        expect(second.customerId).toBe(first.customerId);
        expect(first.customerCreated).toBe(true);
        expect(second.customerCreated).toBe(false);
        expect(second.orderId).not.toBe(first.orderId);
        expect(await tx.customer.count({ where: { phone: CAPTURE_PHONE } })).toBe(1);

        const customer = await tx.customer.findUniqueOrThrow({
          where: { phone: CAPTURE_PHONE },
        });

        expect(customer.firstUtmSource).toBe("instagram");
        expect(customer.firstUtmMedium).toBe("paid_social");
        expect(customer.firstUtmCampaign).toBe("rakhi_2026");

        const orders = await tx.order.findMany({
          where: { customerId: first.customerId },
          orderBy: { cashfreeOrderId: "asc" },
        });

        expect(orders.map((order) => order.utmSource)).toEqual(["instagram", "google"]);

        throw new RollbackSignal();
      }),
    ).rejects.toBeInstanceOf(RollbackSignal);

    expect(await prisma.customer.count({ where: { phone: CAPTURE_PHONE } })).toBe(0);
  });

  it("leaves the first campaign null forever when the first order carried none", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(
      prisma.$transaction(async (tx) => {
        const items: CreateOrderItem[] = [{ productId: WATCH_RING_ID, qty: 1 }];

        await captureOrder(captureInputFor(items, "cf_capture_noutm_1"), tx);
        await captureOrder(
          {
            ...captureInputFor(items, "cf_capture_noutm_2"),
            utm: { source: "instagram" },
          },
          tx,
        );

        const customer = await tx.customer.findUniqueOrThrow({
          where: { phone: CAPTURE_PHONE },
        });

        expect(customer.firstUtmSource).toBeNull();

        throw new RollbackSignal();
      }),
    ).rejects.toBeInstanceOf(RollbackSignal);
  });
});

describe("a database that will not answer", () => {
  const unreachable = new Error("Can't reach database server at localhost:5432");

  function failingClient(): OrderCaptureClient {
    return {
      customer: {
        findUnique: vi.fn().mockRejectedValue(unreachable),
        create: vi.fn().mockRejectedValue(unreachable),
      },
      order: { create: vi.fn().mockRejectedValue(unreachable) },
    } as unknown as OrderCaptureClient;
  }

  it("makes captureOrder report FAILED rather than throw", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await captureOrder(
      captureInputFor([{ productId: WATCH_RING_ID, qty: 1 }], "cf_capture_down"),
      failingClient(),
    );

    expect(outcome).toEqual({ kind: "FAILED" });
    expect(logged).toHaveBeenCalled();
    expect(String(logged.mock.calls[0][0])).toContain("cf_capture_down");

    logged.mockRestore();
  });

  it("makes recordVerifiedPaymentStatus report FAILED rather than throw", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      order: { updateMany: vi.fn().mockRejectedValue(unreachable) },
    } as unknown as OrderCaptureClient;

    await expect(
      recordVerifiedPaymentStatus("cf_verify_down", "PAID", client),
    ).resolves.toBe("FAILED");
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});

describe("recording what verification confirmed", () => {
  it("moves the payment status without touching the fulfilment status", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(
      prisma.$transaction(async (tx) => {
        const captured = await captureOrder(
          captureInputFor([{ productId: WATCH_RING_ID, qty: 1 }], "cf_capture_verify_1"),
          tx,
        );
        if (captured.kind !== "CAPTURED") throw new RollbackSignal();

        expect(await recordVerifiedPaymentStatus("cf_capture_verify_1", "PAID", tx)).toBe(
          "UPDATED",
        );

        const paid = await tx.order.findUniqueOrThrow({ where: { id: captured.orderId } });
        expect(paid.cashfreePaymentStatus).toBe("PAID");
        expect(paid.status).toBe("placed");

        expect(await recordVerifiedPaymentStatus("cf_capture_verify_1", "PAID", tx)).toBe(
          "UNCHANGED",
        );

        throw new RollbackSignal();
      }),
    ).rejects.toBeInstanceOf(RollbackSignal);
  });

  it("is a silent no-op for a Cashfree order this shop never captured", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(
      recordVerifiedPaymentStatus("cf_never_captured_anywhere", "PAID", prisma),
    ).resolves.toBe("UNCHANGED");
  });
});

describe("a Decimal round trip", () => {
  it("keeps a rupee amount exact rather than approximately right", () => {
    const order = priceCart([{ productId: INITIAL_RING_ID, qty: 3 }]);

    expect(new Prisma.Decimal(order.total).toString()).toBe(String(order.total));
  });
});
