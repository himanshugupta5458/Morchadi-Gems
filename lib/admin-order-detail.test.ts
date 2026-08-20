import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  findAdminOrderDetail,
  normaliseOrderId,
  readSelectedOptions,
  readShippingAddress,
} from "@/lib/admin-order-detail";
import { EMPTY_ADDRESS_FORM } from "@/lib/address";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

let unavailableReason: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

class RollbackSignal extends Error {}

/** See the note on `RUN_TAG` in `lib/admin-order-updates.test.ts`. */
const RUN_TAG = String(Math.floor(Math.random() * 900) + 100);

let fixtureCounter = 0;

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

describe("normaliseOrderId", () => {
  it("spells an id the way the database does", () => {
    expect(normaliseOrderId("w2acehacuu")).toBe("W2ACEHACUU");
    expect(normaliseOrderId("  W2ACEHACUU  ")).toBe("W2ACEHACUU");
  });
});

/**
 * `shipping_address` is a `Json` column, so what comes back is whatever was written. The detail
 * page is the screen an operator uses to *fix* a bad row, which is precisely the row a strict
 * parser would refuse to render.
 */
describe("readShippingAddress", () => {
  it("reads a complete address", () => {
    const stored = {
      name: "Ananya Iyer",
      phone: "9812300011",
      email: "ananya@example.com",
      line1: "12 Rose Villa",
      line2: "Bandra West",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400050",
    };

    expect(readShippingAddress(stored as unknown as Prisma.JsonValue)).toEqual(stored);
  });

  it("fills a missing or mistyped field with the empty string rather than throwing", () => {
    expect(
      readShippingAddress({ name: "Ananya Iyer", pincode: 400050 } as unknown as Prisma.JsonValue),
    ).toEqual({ ...EMPTY_ADDRESS_FORM, name: "Ananya Iyer" });
  });

  it("survives a column holding something that is not an address at all", () => {
    for (const stored of [null, "a string", 42, ["an", "array"]]) {
      expect(readShippingAddress(stored as unknown as Prisma.JsonValue)).toEqual(
        EMPTY_ADDRESS_FORM,
      );
    }
  });
});

describe("readSelectedOptions", () => {
  it("keeps string pairs and drops everything else", () => {
    expect(readSelectedOptions({ Letter: "A" } as unknown as Prisma.JsonValue)).toEqual({
      Letter: "A",
    });

    expect(
      readSelectedOptions({ Letter: "A", Size: 7 } as unknown as Prisma.JsonValue),
    ).toEqual({ Letter: "A" });

    for (const stored of [null, "text", ["a"]]) {
      expect(readSelectedOptions(stored as unknown as Prisma.JsonValue)).toEqual({});
    }
  });
});

describe("one order, read for the detail page", () => {
  async function withFixture(
    body: (transaction: Prisma.TransactionClient, orderId: string) => Promise<void>,
  ): Promise<void> {
    await expect(
      prisma.$transaction(async (transaction) => {
        fixtureCounter += 1;
        const suffix = `${RUN_TAG}${String(fixtureCounter).padStart(6, "0")}`;
        const orderId = `READ${suffix}`;

        const customer = await transaction.customer.create({
          data: { phone: `8${suffix}`, name: "Ananya Iyer", email: null },
        });

        await transaction.order.create({
          data: {
            id: orderId,
            customerId: customer.id,
            status: "shipped",
            paymentType: "prepaid",
            subtotal: new Prisma.Decimal(420),
            shippingFee: new Prisma.Decimal(60),
            total: new Prisma.Decimal(480),
            totalCost: new Prisma.Decimal(252),
            amountPrepaid: new Prisma.Decimal(480),
            amountDue: new Prisma.Decimal(0),
            cashfreeOrderId: `MG_READ_${suffix}`,
            cashfreePaymentStatus: "PAID",
            shippingAddress: { name: "Ananya Iyer", pincode: "400050" } as unknown as Prisma.InputJsonValue,
            lineItems: {
              create: [
                {
                  productId: "P001",
                  productName: "Wave Band Initial Ring",
                  productImage: "/products/P001.webp",
                  selectedOptions: { Letter: "A" } as unknown as Prisma.InputJsonValue,
                  quantity: 2,
                  unitPrice: new Prisma.Decimal(210),
                  unitCost: new Prisma.Decimal(126),
                },
              ],
            },
            statusHistory: {
              create: [
                { status: "placed", changedAt: new Date("2026-08-01T10:00:00Z"), changedBy: "system", reason: null },
                { status: "packed", changedAt: new Date("2026-08-02T10:00:00Z"), changedBy: "owner", reason: null },
                { status: "shipped", changedAt: new Date("2026-08-03T10:00:00Z"), changedBy: "owner", reason: null },
              ],
            },
          },
        });

        await body(transaction, orderId);
        throw new RollbackSignal();
      }),
    ).rejects.toBeInstanceOf(RollbackSignal);
  }

  it("carries the line items, the totals and the customer", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await withFixture(async (transaction, orderId) => {
      const detail = await findAdminOrderDetail(orderId, transaction);

      expect(detail).not.toBeNull();
      expect(detail?.total).toBe(480);
      expect(detail?.customerName).toBe("Ananya Iyer");
      expect(detail?.customerEmail).toBeNull();
      expect(detail?.lines).toHaveLength(1);
      expect(detail?.lines[0]).toMatchObject({
        productId: "P001",
        quantity: 2,
        unitPrice: 210,
        lineTotal: 420,
        selectedOptions: { Letter: "A" },
      });
    });
  });

  it("returns the history oldest first", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await withFixture(async (transaction, orderId) => {
      const detail = await findAdminOrderDetail(orderId, transaction);

      expect(detail?.history.map((event) => event.status)).toEqual([
        "placed",
        "packed",
        "shipped",
      ]);
    });
  });

  /**
   * `unit_cost` and `total_cost` are margin data. The list's query has never selected them and
   * neither does this one — a field that is not selected cannot be serialised into a page's
   * props by accident. See ADR-040's addendum.
   */
  it("carries no cost figure of any kind", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await withFixture(async (transaction, orderId) => {
      const detail = await findAdminOrderDetail(orderId, transaction);
      const serialised = JSON.stringify(detail);

      expect(serialised).not.toContain("unitCost");
      expect(serialised).not.toContain("totalCost");
      expect(serialised).not.toContain("126");
      expect(serialised).not.toContain("252");
    });
  });

  it("finds an order however its id was capitalised, and nothing for an id that is not one", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await withFixture(async (transaction, orderId) => {
      expect(await findAdminOrderDetail(orderId.toLowerCase(), transaction)).not.toBeNull();
      expect(await findAdminOrderDetail("ZZZZZZZZZZ", transaction)).toBeNull();
    });
  });
});
