import { describe, expect, it } from "vitest";
import type { CheckoutData, CartItem } from "@/types/cart";
import type { VerifyOrderResult } from "@/types/order";
import {
  MAX_VERIFY_ATTEMPTS,
  PENDING_POLL_INTERVAL_MS,
  canDisplayBundleForOrder,
  describeVerificationFailure,
  isMorchadiOrderId,
  normaliseCashfreeOrder,
  normaliseCashfreeOrderStatus,
  parseVerifyOrderResult,
  readCashfreeOrderAmount,
} from "@/lib/verify";

const PAID_ORDER_ID = "MG_1786968394909_v8j3wggq";

function makeBundle(overrides: Partial<CheckoutData> = {}): CheckoutData {
  const item: CartItem = {
    productId: "nk-001",
    name: "Kundan Rani Haar",
    price: 1000,
    image: "/products/nk-001.webp",
    qty: 2,
  };

  return {
    cart: [item],
    address: {
      name: "Ananya Iyer",
      phone: "9876543210",
      email: "ananya@example.com",
      line1: "12 Rani Bagh",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
    },
    subtotal: 2000,
    shipping: 99,
    total: 2099,
    ...overrides,
  };
}

function makeVerified(overrides: Partial<VerifyOrderResult> = {}): VerifyOrderResult {
  return { orderId: PAID_ORDER_ID, status: "PAID", amount: 2099, ...overrides };
}

describe("normaliseCashfreeOrderStatus — the known Cashfree statuses", () => {
  it("maps PAID to PAID, the only success", () => {
    expect(normaliseCashfreeOrderStatus("PAID")).toBe("PAID");
  });

  it("maps ACTIVE to PENDING, because the order is still open", () => {
    expect(normaliseCashfreeOrderStatus("ACTIVE")).toBe("PENDING");
  });

  it("maps EXPIRED to FAILED", () => {
    expect(normaliseCashfreeOrderStatus("EXPIRED")).toBe("FAILED");
  });

  it("maps TERMINATED to FAILED", () => {
    expect(normaliseCashfreeOrderStatus("TERMINATED")).toBe("FAILED");
  });

  it("maps TERMINATION_REQUESTED to FAILED", () => {
    expect(normaliseCashfreeOrderStatus("TERMINATION_REQUESTED")).toBe("FAILED");
  });

  it("accepts a status in any case, with surrounding whitespace", () => {
    expect(normaliseCashfreeOrderStatus("paid")).toBe("PAID");
    expect(normaliseCashfreeOrderStatus(" PAID ")).toBe("PAID");
    expect(normaliseCashfreeOrderStatus("Active")).toBe("PENDING");
  });
});

describe("normaliseCashfreeOrderStatus — anything unrecognised fails closed", () => {
  it("treats a status Cashfree has not documented as FAILED", () => {
    expect(normaliseCashfreeOrderStatus("SETTLED")).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus("SUCCESS")).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus("USER_DROPPED")).toBe("FAILED");
  });

  it("treats a missing status as FAILED", () => {
    expect(normaliseCashfreeOrderStatus(undefined)).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus(null)).toBe("FAILED");
  });

  it("treats an empty or whitespace status as FAILED", () => {
    expect(normaliseCashfreeOrderStatus("")).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus("   ")).toBe("FAILED");
  });

  it("treats a non-string status as FAILED", () => {
    expect(normaliseCashfreeOrderStatus(1)).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus(true)).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus({ order_status: "PAID" })).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus(["PAID"])).toBe("FAILED");
  });

  it("does not accept a status that merely contains PAID", () => {
    expect(normaliseCashfreeOrderStatus("UNPAID")).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus("NOT_PAID")).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus("PAID_PARTIALLY")).toBe("FAILED");
  });

  it("cannot be tricked by a prototype key", () => {
    expect(normaliseCashfreeOrderStatus("constructor")).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus("toString")).toBe("FAILED");
    expect(normaliseCashfreeOrderStatus("__proto__")).toBe("FAILED");
  });
});

describe("readCashfreeOrderAmount", () => {
  it("reads a numeric order_amount", () => {
    expect(readCashfreeOrderAmount({ order_amount: 2099 })).toBe(2099);
    expect(readCashfreeOrderAmount({ order_amount: 2099.5 })).toBe(2099.5);
  });

  it("reads an order_amount sent as a string", () => {
    expect(readCashfreeOrderAmount({ order_amount: "2099" })).toBe(2099);
    expect(readCashfreeOrderAmount({ order_amount: "2099.00" })).toBe(2099);
  });

  it("returns null for an unreadable, absent or negative amount", () => {
    expect(readCashfreeOrderAmount({ order_amount: "free" })).toBeNull();
    expect(readCashfreeOrderAmount({ order_amount: "" })).toBeNull();
    expect(readCashfreeOrderAmount({ order_amount: null })).toBeNull();
    expect(readCashfreeOrderAmount({ order_amount: Number.NaN })).toBeNull();
    expect(readCashfreeOrderAmount({ order_amount: Number.POSITIVE_INFINITY })).toBeNull();
    expect(readCashfreeOrderAmount({ order_amount: -2099 })).toBeNull();
    expect(readCashfreeOrderAmount({})).toBeNull();
    expect(readCashfreeOrderAmount(null)).toBeNull();
    expect(readCashfreeOrderAmount("PAID")).toBeNull();
  });
});

describe("normaliseCashfreeOrder", () => {
  it("reduces a paid Cashfree order to id, status and amount", () => {
    const result = normaliseCashfreeOrder(
      {
        order_id: PAID_ORDER_ID,
        order_status: "PAID",
        order_amount: 2099,
        order_currency: "INR",
        customer_details: { customer_email: "ananya@example.com" },
        payment_session_id: "session_should_not_travel",
      },
      PAID_ORDER_ID,
    );

    expect(result).toEqual({ orderId: PAID_ORDER_ID, status: "PAID", amount: 2099 });
  });

  it("reduces an open order to PENDING while keeping its amount", () => {
    const result = normaliseCashfreeOrder(
      { order_id: PAID_ORDER_ID, order_status: "ACTIVE", order_amount: 2099 },
      PAID_ORDER_ID,
    );

    expect(result).toEqual({ orderId: PAID_ORDER_ID, status: "PENDING", amount: 2099 });
  });

  it("falls back to the requested order id when Cashfree omits one", () => {
    const result = normaliseCashfreeOrder({ order_status: "PAID", order_amount: 2099 }, PAID_ORDER_ID);

    expect(result.orderId).toBe(PAID_ORDER_ID);
  });

  it("fails closed on a body with no status, even when it carries an amount", () => {
    const result = normaliseCashfreeOrder({ order_amount: 2099 }, PAID_ORDER_ID);

    expect(result).toEqual({ orderId: PAID_ORDER_ID, status: "FAILED", amount: 2099 });
  });

  it("fails closed on a body that is not an object", () => {
    expect(normaliseCashfreeOrder("PAID", PAID_ORDER_ID)).toEqual({
      orderId: PAID_ORDER_ID,
      status: "FAILED",
      amount: null,
    });
    expect(normaliseCashfreeOrder(null, PAID_ORDER_ID)).toEqual({
      orderId: PAID_ORDER_ID,
      status: "FAILED",
      amount: null,
    });
  });
});

describe("isMorchadiOrderId", () => {
  it("accepts an id this project minted", () => {
    expect(isMorchadiOrderId(PAID_ORDER_ID)).toBe(true);
    expect(isMorchadiOrderId("MG_1786968394909_00000000")).toBe(true);
  });

  it("rejects an id of the wrong shape", () => {
    expect(isMorchadiOrderId("")).toBe(false);
    expect(isMorchadiOrderId("MG_")).toBe(false);
    expect(isMorchadiOrderId("1786968394909_v8j3wggq")).toBe(false);
    expect(isMorchadiOrderId("XX_1786968394909_v8j3wggq")).toBe(false);
    expect(isMorchadiOrderId("mg_1786968394909_v8j3wggq")).toBe(false);
    expect(isMorchadiOrderId("MG_178696839_v8j3wggq")).toBe(false);
    expect(isMorchadiOrderId("MG_1786968394909_V8J3WGGQ")).toBe(false);
    expect(isMorchadiOrderId("MG_1786968394909_v8j3wggqx")).toBe(false);
    expect(isMorchadiOrderId(`${PAID_ORDER_ID} `)).toBe(false);
    expect(isMorchadiOrderId(`${PAID_ORDER_ID}\n`)).toBe(false);
  });

  it("rejects an id carrying path or query characters", () => {
    expect(isMorchadiOrderId("MG_1786968394909_v8j3wggq/../settlements")).toBe(false);
    expect(isMorchadiOrderId("MG_1786968394909_v8j3wggq?x=1")).toBe(false);
    expect(isMorchadiOrderId("../../pg/orders")).toBe(false);
    expect(isMorchadiOrderId("MG_1786968394909_v8j3wggq#frag")).toBe(false);
  });
});

describe("parseVerifyOrderResult", () => {
  it("accepts every state the route can return", () => {
    for (const status of ["PAID", "PENDING", "FAILED", "NOT_FOUND"] as const) {
      expect(parseVerifyOrderResult({ orderId: PAID_ORDER_ID, status, amount: 2099 })).toEqual({
        orderId: PAID_ORDER_ID,
        status,
        amount: 2099,
      });
    }
  });

  it("accepts a null amount", () => {
    expect(
      parseVerifyOrderResult({ orderId: PAID_ORDER_ID, status: "NOT_FOUND", amount: null }),
    ).toEqual({ orderId: PAID_ORDER_ID, status: "NOT_FOUND", amount: null });
  });

  it("rejects a body it cannot fully recognise", () => {
    expect(parseVerifyOrderResult(null)).toBeNull();
    expect(parseVerifyOrderResult("PAID")).toBeNull();
    expect(parseVerifyOrderResult({})).toBeNull();
    expect(parseVerifyOrderResult({ orderId: "", status: "PAID", amount: 1 })).toBeNull();
    expect(parseVerifyOrderResult({ orderId: PAID_ORDER_ID, amount: 1 })).toBeNull();
    expect(
      parseVerifyOrderResult({ orderId: PAID_ORDER_ID, status: "paid", amount: 1 }),
    ).toBeNull();
    expect(
      parseVerifyOrderResult({ orderId: PAID_ORDER_ID, status: "SETTLED", amount: 1 }),
    ).toBeNull();
    expect(
      parseVerifyOrderResult({ orderId: PAID_ORDER_ID, status: "PAID", amount: "2099" }),
    ).toBeNull();
  });
});

describe("canDisplayBundleForOrder — the stale-bundle guard", () => {
  it("shows a stamped bundle that names this order and reconciles to the amount paid", () => {
    expect(
      canDisplayBundleForOrder(makeBundle({ orderId: PAID_ORDER_ID }), makeVerified()),
    ).toBe(true);
  });

  it("shows an unstamped bundle whose total is the amount paid", () => {
    expect(canDisplayBundleForOrder(makeBundle(), makeVerified())).toBe(true);
  });

  it("hides a bundle stamped with a different order", () => {
    expect(
      canDisplayBundleForOrder(
        makeBundle({ orderId: "MG_1786968300000_aaaaaaaa" }),
        makeVerified(),
      ),
    ).toBe(false);
  });

  it("hides a bundle whose total is not the amount Cashfree says was charged", () => {
    expect(canDisplayBundleForOrder(makeBundle({ total: 5099 }), makeVerified())).toBe(false);
    expect(canDisplayBundleForOrder(makeBundle(), makeVerified({ amount: 5099 }))).toBe(false);
  });

  it("hides a bundle when there is no amount to reconcile against", () => {
    expect(canDisplayBundleForOrder(makeBundle(), makeVerified({ amount: null }))).toBe(false);
  });

  it("hides everything when there is no bundle", () => {
    expect(canDisplayBundleForOrder(null, makeVerified())).toBe(false);
  });

  it("never decorates an order that is not paid", () => {
    for (const status of ["PENDING", "FAILED", "NOT_FOUND"] as const) {
      expect(
        canDisplayBundleForOrder(
          makeBundle({ orderId: PAID_ORDER_ID }),
          makeVerified({ status }),
        ),
      ).toBe(false);
    }
  });
});

describe("describeVerificationFailure", () => {
  it("reads a missing configuration as a setup problem, not a payment failure", () => {
    const failure = describeVerificationFailure({
      error: "PAYMENT_NOT_CONFIGURED",
      message: "We cannot confirm payments right now.",
      retryable: false,
    });

    expect(failure.title).toBe("Payment confirmation is not set up");
    expect(failure.canRetry).toBe(false);
    expect(failure.message).toBe("We cannot confirm payments right now.");
  });

  it("offers a retry when the gateway could not be reached", () => {
    const failure = describeVerificationFailure({
      error: "VERIFICATION_UNAVAILABLE",
      message: "We could not reach the payment gateway to confirm this order.",
      retryable: true,
    });

    expect(failure.canRetry).toBe(true);
    expect(failure.message).toBe("We could not reach the payment gateway to confirm this order.");
  });

  it("does not offer a retry for an unreadable order reference", () => {
    const failure = describeVerificationFailure({
      error: "ORDER_ID_MALFORMED",
      message: "That order reference is not one of ours.",
      retryable: false,
    });

    expect(failure.canRetry).toBe(false);
  });

  it("falls back to the retryable failure for anything it does not recognise", () => {
    expect(describeVerificationFailure(null).canRetry).toBe(true);
    expect(describeVerificationFailure("nope").canRetry).toBe(true);
    expect(describeVerificationFailure({ error: "TEAPOT", message: "hm" }).canRetry).toBe(false);
    expect(
      describeVerificationFailure({ error: "TEAPOT", message: "hm", retryable: true }).canRetry,
    ).toBe(true);
  });

  it("never states that a payment failed", () => {
    const messages = [
      describeVerificationFailure(null),
      describeVerificationFailure({
        error: "VERIFICATION_UNAVAILABLE",
        message: "We could not reach the payment gateway to confirm this order.",
        retryable: true,
      }),
    ];

    for (const failure of messages) {
      expect(`${failure.title} ${failure.message}`.toLowerCase()).not.toContain("payment failed");
    }
  });
});

describe("the poll budget", () => {
  it("is bounded to roughly thirty seconds", () => {
    expect(PENDING_POLL_INTERVAL_MS).toBe(3_000);
    expect(MAX_VERIFY_ATTEMPTS).toBe(10);
    expect(MAX_VERIFY_ATTEMPTS * PENDING_POLL_INTERVAL_MS).toBeLessThanOrEqual(30_000);
  });
});
