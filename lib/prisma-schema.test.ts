import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const THROWAWAY_PHONE = "919999900001";
const THROWAWAY_ORDER_ID = "TESTORDR01";

let unavailableReason: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

/**
 * Thrown to unwind an interactive transaction once its assertions have run. Prisma rolls a
 * transaction back on any thrown error, so a sentinel is how a write test cleans up after
 * itself without a delete pass that could miss something.
 */
class RollbackSignal extends Error {}

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

describe("the orders and CRM schema", () => {
  it("accepts a customer and an order written to its own shape, then leaves nothing behind", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(
      prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: {
            phone: THROWAWAY_PHONE,
            name: "Schema Smoke Test",
            firstUtmSource: "instagram",
          },
        });

        const order = await tx.order.create({
          data: {
            id: THROWAWAY_ORDER_ID,
            customerId: customer.id,
            subtotal: new Prisma.Decimal(210),
            shippingFee: new Prisma.Decimal(49),
            total: new Prisma.Decimal(259),
            totalCost: new Prisma.Decimal(126),
            cashfreeOrderId: "cf_schema_smoke_test",
            cashfreePaymentStatus: "PAID",
            shippingAddress: { line1: "1 Test Road", city: "Jaipur", pincode: "302001" },
            lineItems: {
              create: [
                {
                  productId: "P001",
                  productName: "Wave Band Initial Ring",
                  productImage: "/products/P001.webp",
                  selectedOptions: { Letter: "A" },
                  quantity: 1,
                  unitPrice: new Prisma.Decimal(210),
                  unitCost: new Prisma.Decimal(126),
                },
              ],
            },
            statusHistory: {
              create: [{ status: "placed", changedBy: "schema-smoke-test" }],
            },
          },
          include: { lineItems: true, statusHistory: true, customer: true },
        });

        expect(order.id).toBe(THROWAWAY_ORDER_ID);
        expect(order.status).toBe("placed");
        expect(order.isRefunded).toBe(false);
        expect(order.refundedAt).toBeNull();
        expect(order.total.toString()).toBe("259");
        expect(order.customer.phone).toBe(THROWAWAY_PHONE);
        expect(order.lineItems).toHaveLength(1);
        expect(order.lineItems[0].unitCost.toString()).toBe("126");
        expect(order.lineItems[0].selectedOptions).toEqual({ Letter: "A" });
        expect(order.statusHistory).toHaveLength(1);
        expect(order.statusHistory[0].reason).toBeNull();

        throw new RollbackSignal();
      }),
    ).rejects.toBeInstanceOf(RollbackSignal);

    expect(await prisma.customer.count({ where: { phone: THROWAWAY_PHONE } })).toBe(0);
    expect(await prisma.order.count({ where: { id: THROWAWAY_ORDER_ID } })).toBe(0);
  });

  it("moves an order through a terminal status without a boolean to contradict it", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(
      prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: { phone: THROWAWAY_PHONE, name: "Schema Smoke Test" },
        });

        await tx.order.create({
          data: {
            id: THROWAWAY_ORDER_ID,
            customerId: customer.id,
            subtotal: new Prisma.Decimal(210),
            shippingFee: new Prisma.Decimal(49),
            total: new Prisma.Decimal(259),
            totalCost: new Prisma.Decimal(126),
            cashfreeOrderId: "cf_schema_smoke_test",
            cashfreePaymentStatus: "PAID",
            shippingAddress: { line1: "1 Test Road", city: "Jaipur", pincode: "302001" },
          },
        });

        const returned = await tx.order.update({
          where: { id: THROWAWAY_ORDER_ID },
          data: {
            status: "returned",
            isRefunded: true,
            refundedAt: new Date("2026-08-20T00:00:00.000Z"),
            refundAmount: new Prisma.Decimal(259),
            statusHistory: {
              create: [
                {
                  status: "returned",
                  changedBy: "schema-smoke-test",
                  reason: "Customer changed their mind",
                },
              ],
            },
          },
          include: { statusHistory: true },
        });

        expect(returned.status).toBe("returned");
        expect(returned.isRefunded).toBe(true);
        expect(returned.refundAmount?.toString()).toBe("259");
        expect(returned.statusHistory).toHaveLength(1);
        expect(returned.statusHistory[0].reason).toBe("Customer changed their mind");

        throw new RollbackSignal();
      }),
    ).rejects.toBeInstanceOf(RollbackSignal);

    expect(await prisma.order.count({ where: { id: THROWAWAY_ORDER_ID } })).toBe(0);
  });
});
