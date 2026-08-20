import { describe, expect, it } from "vitest";
import type { OrderStatus, PaymentType } from "@prisma/client";
import { ORDER_STATUSES } from "@/lib/order-status";
import {
  parseRupeeAmount,
  planOrderStatusChange,
  type OrderStatusChangeSubmission,
} from "@/lib/order-status-change";
import { MAX_STATUS_CHANGE_REASON_LENGTH } from "@/lib/order-transitions";

const PREPAID_TOTAL = 1200;

function submission(
  overrides: Partial<OrderStatusChangeSubmission> = {},
): OrderStatusChangeSubmission {
  return {
    status: "packed",
    reason: "",
    refundAmount: "",
    refundAcknowledged: false,
    ...overrides,
  };
}

function plan(
  currentStatus: OrderStatus,
  paymentType: PaymentType,
  amountPrepaid: number,
  overrides: Partial<OrderStatusChangeSubmission>,
) {
  return planOrderStatusChange(
    currentStatus,
    { paymentType, amountPrepaid },
    submission(overrides),
  );
}

describe("parseRupeeAmount", () => {
  it("accepts whole rupees and up to two decimals", () => {
    expect(parseRupeeAmount("0")).toBe(0);
    expect(parseRupeeAmount(" 1200 ")).toBe(1200);
    expect(parseRupeeAmount("99.5")).toBe(99.5);
    expect(parseRupeeAmount("99.55")).toBe(99.55);
  });

  it("rejects anything a Decimal(10, 2) column could not hold exactly", () => {
    for (const raw of ["", "-1", "1.005", "1,200", "₹500", "1e3", "abc", "NaN", "."]) {
      expect(parseRupeeAmount(raw)).toBeNull();
    }
  });
});

describe("the transition a submission asks for", () => {
  it("accepts a step the lifecycle allows", () => {
    const result = plan("placed", "prepaid", PREPAID_TOTAL, { status: "packed" });

    expect(result).toEqual({
      ok: true,
      plan: { status: "packed", reason: null, refund: null },
    });
  });

  it("refuses a step it does not, and says which two statuses were involved", () => {
    const result = plan("placed", "prepaid", PREPAID_TOTAL, { status: "delivered" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("INVALID_TRANSITION");
    expect(result.message).toContain("Placed");
    expect(result.message).toContain("Delivered");
  });

  it("refuses a status that is not one of the seven", () => {
    for (const raw of ["", "shipping", "PACKED", "  "]) {
      const result = plan("placed", "prepaid", PREPAID_TOTAL, { status: raw });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("UNKNOWN_STATUS");
    }
  });

  it("recognises a padded status name and judges it on the lifecycle instead", () => {
    const result = plan("placed", "prepaid", PREPAID_TOTAL, { status: " packed " });
    expect(result.ok).toBe(true);
  });

  /**
   * The whole state machine, exercised through the validator rather than only through the table
   * it reads — the UI and the route handler both go through this function, so this is the layer
   * the guarantee has to hold at.
   */
  it("agrees with the lifecycle for all forty-nine pairs", () => {
    const allowed: Record<OrderStatus, readonly OrderStatus[]> = {
      placed: ["packed", "cancelled"],
      packed: ["shipped", "cancelled"],
      shipped: ["delivered", "rto", "cancelled"],
      delivered: ["returned"],
      rto: [],
      returned: [],
      cancelled: [],
    };

    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const attempt = planOrderStatusChange(
          from,
          { paymentType: "prepaid", amountPrepaid: PREPAID_TOTAL },
          submission({
            status: to,
            reason: "Recorded for the test",
            refundAmount: "0",
            refundAcknowledged: true,
          }),
        );

        expect(attempt.ok).toBe(allowed[from].includes(to));
      }
    }
  });
});

describe("the reason a status change has to carry", () => {
  it("requires one for rto, returned and cancelled", () => {
    const cases: ReadonlyArray<[OrderStatus, OrderStatus]> = [
      ["shipped", "rto"],
      ["delivered", "returned"],
      ["placed", "cancelled"],
    ];

    for (const [from, to] of cases) {
      const result = plan(from, "prepaid", PREPAID_TOTAL, {
        status: to,
        reason: "   ",
        refundAmount: "0",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("REASON_REQUIRED");
    }
  });

  it("leaves it optional and absent for the four ordinary statuses", () => {
    const cases: ReadonlyArray<[OrderStatus, OrderStatus]> = [
      ["placed", "packed"],
      ["packed", "shipped"],
      ["shipped", "delivered"],
    ];

    for (const [from, to] of cases) {
      const result = plan(from, "prepaid", PREPAID_TOTAL, { status: to });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.reason).toBeNull();
      expect(result.plan.refund).toBeNull();
    }
  });

  it("keeps a reason offered on an ordinary status rather than dropping it", () => {
    const result = plan("placed", "prepaid", PREPAID_TOTAL, {
      status: "packed",
      reason: "  Packed early, courier pickup moved forward  ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.reason).toBe("Packed early, courier pickup moved forward");
  });

  it("refuses a reason longer than the column is meant to hold", () => {
    const result = plan("placed", "prepaid", PREPAID_TOTAL, {
      status: "cancelled",
      reason: "x".repeat(MAX_STATUS_CHANGE_REASON_LENGTH + 1),
      refundAmount: "0",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("REASON_TOO_LONG");
  });
});

describe("the refund decision that comes with a bad ending", () => {
  it("requires a Cash on Delivery order to be acknowledged rather than priced", () => {
    const refused = plan("placed", "cod", 0, {
      status: "cancelled",
      reason: "Customer stopped answering",
      refundAmount: "500",
    });

    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error).toBe("REFUND_NOT_ACKNOWLEDGED");

    const accepted = plan("placed", "cod", 0, {
      status: "cancelled",
      reason: "Customer stopped answering",
      refundAcknowledged: true,
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.plan.refund).toEqual({ isRefunded: false, refundAmount: 0 });
  });

  it("ignores whatever amount a COD submission carried", () => {
    const result = plan("placed", "cod", 0, {
      status: "cancelled",
      reason: "Customer stopped answering",
      refundAmount: "9999",
      refundAcknowledged: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.refund).toEqual({ isRefunded: false, refundAmount: 0 });
  });

  it("requires an amount on a prepaid order and will not take an acknowledgement instead", () => {
    const result = plan("placed", "prepaid", PREPAID_TOTAL, {
      status: "cancelled",
      reason: "Customer changed their mind",
      refundAcknowledged: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("REFUND_AMOUNT_REQUIRED");
  });

  it("refuses an amount that is not money", () => {
    const result = plan("placed", "prepaid", PREPAID_TOTAL, {
      status: "cancelled",
      reason: "Customer changed their mind",
      refundAmount: "half",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("REFUND_AMOUNT_INVALID");
  });

  it("will not give back more than was collected", () => {
    const result = plan("placed", "prepaid", PREPAID_TOTAL, {
      status: "cancelled",
      reason: "Customer changed their mind",
      refundAmount: String(PREPAID_TOTAL + 1),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("REFUND_AMOUNT_TOO_HIGH");
  });

  it("caps a partial-COD refund at the advance, not at the order total", () => {
    const withinAdvance = plan("shipped", "partial_cod", 300, {
      status: "cancelled",
      reason: "Courier lost the parcel",
      refundAmount: "300",
    });
    expect(withinAdvance.ok).toBe(true);

    const beyondAdvance = plan("shipped", "partial_cod", 300, {
      status: "cancelled",
      reason: "Courier lost the parcel",
      refundAmount: "301",
    });
    expect(beyondAdvance.ok).toBe(false);
  });

  /**
   * `isRefunded` is read off the amount and never submitted. An independent flag would allow
   * `isRefunded = true` beside `refundAmount = 0`, which is the contradiction ADR-040's
   * addendum deleted six columns to make unwritable.
   */
  it("derives isRefunded from the amount at the boundary", () => {
    const cases: ReadonlyArray<[string, boolean, number]> = [
      ["0", false, 0],
      ["0.00", false, 0],
      ["0.01", true, 0.01],
      ["1200", true, 1200],
    ];

    for (const [raw, isRefunded, refundAmount] of cases) {
      const result = plan("shipped", "prepaid", PREPAID_TOTAL, {
        status: "rto",
        reason: "Consignee unreachable after three attempts",
        refundAmount: raw,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.refund).toEqual({ isRefunded, refundAmount });
    }
  });

  it("asks the refund question of no other status", () => {
    for (const [from, to] of [
      ["placed", "packed"],
      ["packed", "shipped"],
      ["shipped", "delivered"],
    ] as ReadonlyArray<[OrderStatus, OrderStatus]>) {
      const result = plan(from, "prepaid", PREPAID_TOTAL, { status: to });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.refund).toBeNull();
    }
  });
});
