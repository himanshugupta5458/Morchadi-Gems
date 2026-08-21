import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, type OrderStatus, type PaymentType } from "@prisma/client";
import type { AddressFormValues } from "@/lib/address";
import { findAdminOrderDetail } from "@/lib/admin-order-detail";
import {
  applyAdminOrderStatusChange,
  findChangedAddressFields,
  updateAdminOrderReceipt,
  updateAdminOrderShippingAddress,
  type AdminOrderWriteClient,
} from "@/lib/admin-order-updates";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const OPERATOR = "test-operator";

let unavailableReason: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

/** See the note on the same class in `lib/order-capture.test.ts`. */
class RollbackSignal extends Error {}

const STORED_ADDRESS: AddressFormValues = {
  name: "Ananya Iyer",
  phone: "9812300011",
  email: "ananya@example.com",
  line1: "12 Rose Villa",
  line2: "Bandra West",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400050",
};

type TransactionClient = Prisma.TransactionClient;

/**
 * Fixture rows are created inside a transaction that is always rolled back, but the `orders.id`,
 * `cashfree_order_id` and `customers.phone` unique indexes are still live while it is open — and
 * Vitest runs test files in parallel. A per-run tag keeps two files from picking the same values
 * and blocking on each other's uncommitted rows.
 */
const RUN_TAG = String(Math.floor(Math.random() * 900) + 100);

let fixtureCounter = 0;

interface FixtureOptions {
  status?: OrderStatus;
  paymentType?: PaymentType;
  amountPrepaid?: number;
  total?: number;
}

async function createFixtureOrder(
  transaction: TransactionClient,
  options: FixtureOptions = {},
): Promise<string> {
  fixtureCounter += 1;

  const total = options.total ?? 1200;
  const amountPrepaid = options.amountPrepaid ?? total;
  const status = options.status ?? "placed";
  const suffix = `${RUN_TAG}${String(fixtureCounter).padStart(6, "0")}`;
  const id = `TEST${suffix}`;

  const customer = await transaction.customer.create({
    data: { phone: `7${suffix}`, name: "Ananya Iyer", email: "ananya@example.com" },
  });

  await transaction.order.create({
    data: {
      id,
      customerId: customer.id,
      status,
      paymentType: options.paymentType ?? "prepaid",
      subtotal: new Prisma.Decimal(total),
      shippingFee: new Prisma.Decimal(0),
      total: new Prisma.Decimal(total),
      totalCost: new Prisma.Decimal(total / 2),
      amountPrepaid: new Prisma.Decimal(amountPrepaid),
      amountDue: new Prisma.Decimal(total - amountPrepaid),
      cashfreeOrderId: `MG_TEST_${suffix}`,
      cashfreePaymentStatus: "PAID",
      shippingAddress: STORED_ADDRESS as unknown as Prisma.InputJsonValue,
      lineItems: {
        create: [
          {
            productId: "P001",
            productName: "Wave Band Initial Ring",
            productImage: "/products/P001.webp",
            selectedOptions: { Letter: "A" } as unknown as Prisma.InputJsonValue,
            quantity: 1,
            unitPrice: new Prisma.Decimal(total),
            unitCost: new Prisma.Decimal(total / 2),
          },
        ],
      },
      statusHistory: { create: [{ status: "placed", changedBy: "system", reason: null }] },
    },
  });

  return id;
}

async function inRolledBackTransaction(
  body: (transaction: TransactionClient) => Promise<void>,
): Promise<void> {
  await expect(
    prisma.$transaction(async (transaction) => {
      await body(transaction);
      throw new RollbackSignal();
    }),
  ).rejects.toBeInstanceOf(RollbackSignal);
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

describe("findChangedAddressFields", () => {
  it("names only what moved, and ignores whitespace", () => {
    expect(findChangedAddressFields(STORED_ADDRESS, STORED_ADDRESS)).toEqual([]);

    expect(
      findChangedAddressFields(STORED_ADDRESS, { ...STORED_ADDRESS, line1: " 12 Rose Villa " }),
    ).toEqual([]);

    expect(
      findChangedAddressFields(STORED_ADDRESS, {
        ...STORED_ADDRESS,
        line2: "Khar West",
        pincode: "400052",
      }),
    ).toEqual(["line2", "pincode"]);
  });
});

describe("moving an order", () => {
  it("updates the status and appends one history row naming the operator", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction);

      const outcome = await applyAdminOrderStatusChange(
        { orderId, changedBy: OPERATOR, submission: { status: "packed", reason: "", refundAmount: "", refundAcknowledged: false } },
        transaction,
      );

      expect(outcome).toEqual({ kind: "UPDATED" });

      const detail = await findAdminOrderDetail(orderId, transaction);
      expect(detail?.status).toBe("packed");
      expect(detail?.history).toHaveLength(2);
      expect(detail?.history[1]).toMatchObject({
        status: "packed",
        changedBy: OPERATOR,
        reason: null,
      });
    });
  });

  it("leaves the refund columns alone on an ordinary step", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction, { status: "packed" });

      await applyAdminOrderStatusChange(
        { orderId, changedBy: OPERATOR, submission: { status: "shipped", reason: "", refundAmount: "", refundAcknowledged: false } },
        transaction,
      );

      const detail = await findAdminOrderDetail(orderId, transaction);
      expect(detail?.isRefunded).toBe(false);
      expect(detail?.refundedAt).toBeNull();
      expect(detail?.refundAmount).toBeNull();
    });
  });

  it("records a real refund with its amount and its moment", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction);

      const outcome = await applyAdminOrderStatusChange(
        {
          orderId,
          changedBy: OPERATOR,
          submission: {
            status: "cancelled",
            reason: "Customer changed their mind before dispatch",
            refundAmount: "1200",
            refundAcknowledged: false,
          },
        },
        transaction,
      );

      expect(outcome).toEqual({ kind: "UPDATED" });

      const detail = await findAdminOrderDetail(orderId, transaction);
      expect(detail?.status).toBe("cancelled");
      expect(detail?.isRefunded).toBe(true);
      expect(detail?.refundAmount).toBe(1200);
      expect(detail?.refundedAt).not.toBeNull();
      expect(detail?.history[1]?.reason).toBe("Customer changed their mind before dispatch");
    });
  });

  /**
   * A decision to refund nothing is still a decision, so the amount is written; the timestamp
   * is not, because ADR-040 states `isRefunded ≡ refundedAt IS NOT NULL` and a refund that did
   * not happen has no date.
   */
  it("records a decision to refund nothing without claiming a refund happened", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction, { status: "shipped" });

      await applyAdminOrderStatusChange(
        {
          orderId,
          changedBy: OPERATOR,
          submission: {
            status: "rto",
            reason: "Three failed attempts, consignee unreachable",
            refundAmount: "0",
            refundAcknowledged: false,
          },
        },
        transaction,
      );

      const detail = await findAdminOrderDetail(orderId, transaction);
      expect(detail?.isRefunded).toBe(false);
      expect(detail?.refundAmount).toBe(0);
      expect(detail?.refundedAt).toBeNull();
    });
  });

  it("settles a Cash on Delivery cancellation on an acknowledgement alone", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction, {
        paymentType: "cod",
        amountPrepaid: 0,
      });

      const refused = await applyAdminOrderStatusChange(
        { orderId, changedBy: OPERATOR, submission: { status: "cancelled", reason: "Unreachable", refundAmount: "", refundAcknowledged: false } },
        transaction,
      );
      expect(refused).toMatchObject({ kind: "REJECTED", error: "REFUND_NOT_ACKNOWLEDGED" });
      expect((await findAdminOrderDetail(orderId, transaction))?.status).toBe("placed");

      const accepted = await applyAdminOrderStatusChange(
        { orderId, changedBy: OPERATOR, submission: { status: "cancelled", reason: "Unreachable", refundAmount: "", refundAcknowledged: true } },
        transaction,
      );
      expect(accepted).toEqual({ kind: "UPDATED" });

      const detail = await findAdminOrderDetail(orderId, transaction);
      expect(detail?.status).toBe("cancelled");
      expect(detail?.isRefunded).toBe(false);
      expect(detail?.refundAmount).toBe(0);
      expect(detail?.refundedAt).toBeNull();
    });
  });

  it("writes nothing at all when a change is refused", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction);

      const invalidStep = await applyAdminOrderStatusChange(
        { orderId, changedBy: OPERATOR, submission: { status: "delivered", reason: "", refundAmount: "", refundAcknowledged: false } },
        transaction,
      );
      expect(invalidStep).toMatchObject({ kind: "REJECTED", error: "INVALID_TRANSITION" });

      const missingReason = await applyAdminOrderStatusChange(
        { orderId, changedBy: OPERATOR, submission: { status: "cancelled", reason: "", refundAmount: "0", refundAcknowledged: false } },
        transaction,
      );
      expect(missingReason).toMatchObject({ kind: "REJECTED", error: "REASON_REQUIRED" });

      const detail = await findAdminOrderDetail(orderId, transaction);
      expect(detail?.status).toBe("placed");
      expect(detail?.history).toHaveLength(1);
    });
  });

  it("reports an order that does not exist", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const outcome = await applyAdminOrderStatusChange({
      orderId: "ZZZZZZZZZZ",
      changedBy: OPERATOR,
      submission: { status: "packed", reason: "", refundAmount: "", refundAcknowledged: false },
    });

    expect(outcome).toEqual({ kind: "NOT_FOUND" });
  });
});

describe("correcting a shipping address", () => {
  const CORRECTED: AddressFormValues = { ...STORED_ADDRESS, line2: "Khar West", pincode: "400052" };

  it("is allowed while the parcel has not left, and is audited without a status change", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    for (const status of ["placed", "packed"] as const) {
      await inRolledBackTransaction(async (transaction) => {
        const orderId = await createFixtureOrder(transaction, { status });

        const outcome = await updateAdminOrderShippingAddress(
          { orderId, changedBy: OPERATOR, values: CORRECTED },
          transaction,
        );

        expect(outcome).toEqual({ kind: "UPDATED" });

        const detail = await findAdminOrderDetail(orderId, transaction);
        expect(detail?.status).toBe(status);
        expect(detail?.shippingAddress.pincode).toBe("400052");
        expect(detail?.history).toHaveLength(2);
        expect(detail?.history[1]).toMatchObject({
          status,
          changedBy: OPERATOR,
          reason: "Address updated (line2, pincode)",
        });
      });
    }
  });

  it("is refused once the parcel has left, and changes nothing", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    for (const status of ["shipped", "delivered", "rto", "returned", "cancelled"] as const) {
      await inRolledBackTransaction(async (transaction) => {
        const orderId = await createFixtureOrder(transaction, { status });

        const outcome = await updateAdminOrderShippingAddress(
          { orderId, changedBy: OPERATOR, values: CORRECTED },
          transaction,
        );

        expect(outcome).toMatchObject({ kind: "REJECTED", error: "ADDRESS_LOCKED" });

        const detail = await findAdminOrderDetail(orderId, transaction);
        expect(detail?.shippingAddress.pincode).toBe("400050");
        expect(detail?.history).toHaveLength(1);
      });
    }
  });

  it("writes no audit row when nothing actually changed", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction);

      const outcome = await updateAdminOrderShippingAddress(
        { orderId, changedBy: OPERATOR, values: STORED_ADDRESS },
        transaction,
      );

      expect(outcome).toEqual({ kind: "UNCHANGED" });
      expect((await findAdminOrderDetail(orderId, transaction))?.history).toHaveLength(1);
    });
  });

  it("holds a corrected address to the same rules as the one checkout collected", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction);

      const outcome = await updateAdminOrderShippingAddress(
        { orderId, changedBy: OPERATOR, values: { ...STORED_ADDRESS, pincode: "012345" } },
        transaction,
      );

      expect(outcome).toMatchObject({ kind: "REJECTED", error: "ADDRESS_INVALID" });
      expect((await findAdminOrderDetail(orderId, transaction))?.shippingAddress.pincode).toBe(
        "400050",
      );
    });
  });
});

describe("the two receipt flags", () => {
  it("stamp and clear their own timestamp without touching the other", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction, {
        status: "rto",
        paymentType: "partial_cod",
        amountPrepaid: 300,
      });

      await updateAdminOrderReceipt({ orderId, itemReceivedBack: true }, transaction);

      const afterItem = await findAdminOrderDetail(orderId, transaction);
      expect(afterItem?.itemReceivedBack).toBe(true);
      expect(afterItem?.itemReceivedBackAt).not.toBeNull();
      expect(afterItem?.codAmountCollected).toBe(false);
      expect(afterItem?.codCollectedAt).toBeNull();

      await updateAdminOrderReceipt({ orderId, codAmountCollected: true }, transaction);

      const afterCod = await findAdminOrderDetail(orderId, transaction);
      expect(afterCod?.itemReceivedBack).toBe(true);
      expect(afterCod?.itemReceivedBackAt).not.toBeNull();
      expect(afterCod?.codAmountCollected).toBe(true);
      expect(afterCod?.codCollectedAt).not.toBeNull();

      await updateAdminOrderReceipt({ orderId, itemReceivedBack: false }, transaction);

      const afterUntick = await findAdminOrderDetail(orderId, transaction);
      expect(afterUntick?.itemReceivedBack).toBe(false);
      expect(afterUntick?.itemReceivedBackAt).toBeNull();
      expect(afterUntick?.codAmountCollected).toBe(true);
    });
  });

  it("stay out of the audit table, because the order row already dates them", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction, { status: "returned" });

      await updateAdminOrderReceipt({ orderId, itemReceivedBack: true }, transaction);

      expect((await findAdminOrderDetail(orderId, transaction))?.history).toHaveLength(1);
    });
  });

  it("are refused where the question makes no sense", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const shipped = await createFixtureOrder(transaction, { status: "shipped" });

      expect(
        await updateAdminOrderReceipt({ orderId: shipped, itemReceivedBack: true }, transaction),
      ).toMatchObject({ kind: "REJECTED", error: "ITEM_RETURN_NOT_EXPECTED" });

      expect(
        await updateAdminOrderReceipt({ orderId: shipped, codAmountCollected: true }, transaction),
      ).toMatchObject({ kind: "REJECTED", error: "NO_COD_TO_COLLECT" });
    });
  });

  it("are independent of the status change that made them relevant", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await inRolledBackTransaction(async (transaction) => {
      const orderId = await createFixtureOrder(transaction, { status: "shipped" });

      await applyAdminOrderStatusChange(
        {
          orderId,
          changedBy: OPERATOR,
          submission: {
            status: "rto",
            reason: "Consignee unreachable",
            refundAmount: "0",
            refundAcknowledged: false,
          },
        },
        transaction,
      );

      const rightAfterStatusChange = await findAdminOrderDetail(orderId, transaction);
      expect(rightAfterStatusChange?.status).toBe("rto");
      expect(rightAfterStatusChange?.itemReceivedBack).toBe(false);

      await updateAdminOrderReceipt({ orderId, itemReceivedBack: true }, transaction);

      const whenTheParcelArrives = await findAdminOrderDetail(orderId, transaction);
      expect(whenTheParcelArrives?.itemReceivedBack).toBe(true);
      expect(whenTheParcelArrives?.status).toBe("rto");
    });
  });
});

/**
 * The race the two other writers already handled and this one did not.
 *
 * `updateAdminOrderReceipt` read the order, decided from its status whether the toggle was even
 * a question, and then wrote with a bare `update` — which throws `P2025` if the row has gone,
 * and writes regardless if the row has *moved*. A stub client is what makes the window between
 * the read and the write observable at all: no real transaction can be held open across it.
 * ADR-048 aligns it with its siblings.
 */
function receiptRaceClient(updatedRowCount: number): {
  client: AdminOrderWriteClient;
  updates: Array<Record<string, unknown>>;
} {
  const updates: Array<Record<string, unknown>> = [];

  const client = {
    order: {
      findUnique: async () => ({ status: "rto", paymentType: "prepaid" }),
      updateMany: async (args: Record<string, unknown>) => {
        updates.push(args);
        return { count: updatedRowCount };
      },
    },
  } as unknown as AdminOrderWriteClient;

  return { client, updates };
}

describe("a receipt toggle that loses a race", () => {
  it("says CONCURRENT_CHANGE rather than throwing P2025 at the operator", async () => {
    const { client } = receiptRaceClient(0);

    expect(
      await updateAdminOrderReceipt({ orderId: "W2ACEHACUU", itemReceivedBack: true }, client),
    ).toEqual({
      kind: "REJECTED",
      error: "CONCURRENT_CHANGE",
      message: "This order moved while the page was open. Reload it and try again.",
    });
  });

  it("guards the write on the status the two receipt checks were made against", async () => {
    const { client, updates } = receiptRaceClient(1);

    expect(
      await updateAdminOrderReceipt({ orderId: "W2ACEHACUU", itemReceivedBack: true }, client),
    ).toEqual({ kind: "UPDATED" });

    expect(updates).toHaveLength(1);
    expect(updates[0].where).toEqual({ id: "W2ACEHACUU", status: "rto" });
  });
});
