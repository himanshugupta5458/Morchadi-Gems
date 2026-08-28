import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getCodEligibilityCatalogue } from "@/lib/products";

/**
 * Every checkout database write, refused.
 *
 * The point of these tests is not that the write fails — it is that nothing a shopper sees
 * changes when it does. Postgres is mocked at the module boundary rather than stopped, so the
 * real `captureOrder` and `recordVerifiedPaymentStatus` run against a client that rejects
 * everything, exactly as they would against a database that is down, out of connections, or
 * mid-migration. See ADR-042.
 */
const DATABASE_DOWN = new Error("Can't reach database server at localhost:5432");

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findUnique: vi.fn().mockRejectedValue(DATABASE_DOWN),
      create: vi.fn().mockRejectedValue(DATABASE_DOWN),
    },
    order: {
      findUnique: vi.fn().mockRejectedValue(DATABASE_DOWN),
      create: vi.fn().mockRejectedValue(DATABASE_DOWN),
      updateMany: vi.fn().mockRejectedValue(DATABASE_DOWN),
    },
  },
}));

/**
 * A piece the catalogue on disk still takes on delivery, found rather than named, so that a
 * prepayment floor appearing on any one product cannot turn the cash-on-delivery test below
 * into a test of the eligibility refusal. The prepaid tests stay on `P001` deliberately: they
 * assert against its own options and pricing, and no floor changes what a prepaid checkout does.
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

const FAILURE_TEST_ADDRESS = {
  name: "Database Down Test",
  phone: "9876500022",
  email: "database.down@example.com",
  line1: "12 Amber Fort Road",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302001",
};

let silencedErrors: ReturnType<typeof vi.spyOn>;
let silencedLogs: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  vi.stubEnv("CASHFREE_APP_ID", "TEST_ROUTE_APP_ID");
  vi.stubEnv("CASHFREE_SECRET_KEY", "TEST_ROUTE_SECRET_KEY");
  silencedErrors = vi.spyOn(console, "error").mockImplementation(() => {});
  silencedLogs = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  silencedErrors.mockClear();
});

afterAll(() => {
  silencedErrors.mockRestore();
  silencedLogs.mockRestore();
  vi.unstubAllEnvs();
});

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

describe("POST /api/create-order with Postgres unreachable", () => {
  it("still returns the payment session, so the shopper reaches Cashfree", async () => {
    let cashfreeCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        cashfreeCalls += 1;
        return new Response(
          JSON.stringify({
            order_id: JSON.parse(String(init.body)).order_id,
            order_status: "ACTIVE",
            payment_session_id: "session_database_down",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const response = await postCreateOrder({
      items: [{ productId: "P001", qty: 1 }],
      address: FAILURE_TEST_ADDRESS,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.paymentSessionId).toBe("session_database_down");
    expect(body.cashfreeOrderId).toMatch(/^MG_\d{13}_[0-9a-z]{8}$/);
    expect(body.mode).toBe("sandbox");
    expect(Object.keys(body).sort()).toEqual([
      "amountDue",
      "amountPrepaid",
      "cashfreeOrderId",
      "mode",
      "paymentSessionId",
      "paymentType",
      "trackingId",
    ]);

    expect(cashfreeCalls).toBe(1);
  });

  it("returns a null order number rather than inventing one the database never issued", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (_url: string, init: RequestInit) =>
          new Response(
            JSON.stringify({
              order_id: JSON.parse(String(init.body)).order_id,
              order_status: "ACTIVE",
              payment_session_id: "session_database_down",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const body = await (
      await postCreateOrder({
        items: [{ productId: "P001", qty: 1 }],
        address: FAILURE_TEST_ADDRESS,
      })
    ).json();

    expect(body.trackingId).toBeNull();
  });

  it("says nothing about the database in the response, and everything about it in the log", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              order_id: "MG_1787000000000_abcdefgh",
              order_status: "ACTIVE",
              payment_session_id: "session_neutral_fixture",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const response = await postCreateOrder({
      items: [{ productId: "P001", qty: 1 }],
      address: FAILURE_TEST_ADDRESS,
    });
    const rawBody = await response.text();

    expect(response.status).toBe(200);
    expect(rawBody).not.toContain("database");
    expect(rawBody).not.toContain("Postgres");
    expect(rawBody).not.toContain("prisma");
    expect(rawBody).not.toContain("localhost:5432");

    const loggedText = silencedErrors.mock.calls.flat().map(String).join(" ");
    expect(loggedText).toContain("[order-capture]");
    expect(loggedText).toContain("could not be written to Postgres");
  });

  it("prices the order identically to a run where the write succeeds", async () => {
    const sentBodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(String(init.body));
        sentBodies.push(sent);
        return new Response(
          JSON.stringify({
            order_id: sent.order_id,
            order_status: "ACTIVE",
            payment_session_id: "session_database_down",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    await postCreateOrder({
      items: [{ productId: "P001", qty: 2, selectedOptions: { Letter: "A" } }],
      address: FAILURE_TEST_ADDRESS,
      utm: { source: "instagram" },
    });

    const { buildOrderFromCart } = await import("@/lib/order");
    const { getOrderPricingCatalogue } = await import("@/lib/products");
    const priced = buildOrderFromCart(
      [{ productId: "P001", qty: 2 }],
      getOrderPricingCatalogue(),
    );

    expect(sentBodies).toHaveLength(1);
    expect(sentBodies[0].order_amount).toBe(priced.total);
    expect(sentBodies[0].order_tags).toMatchObject({
      options: "P001:Letter=A",
      utm_source: "instagram",
    });
  });
});

describe("GET /api/verify-order with Postgres unreachable", () => {
  it("returns the verified payment exactly as it would with a healthy database", async () => {
    const orderId = "MG_1787000000000_abcdefgh";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ order_id: orderId, order_status: "PAID", order_amount: 419 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const { GET } = await import("@/app/api/verify-order/route");
    const response = await GET(
      new Request(`http://localhost:3000/api/verify-order?order_id=${orderId}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      orderId,
      status: "PAID",
      amount: 419,
      trackingId: null,
      amountDue: null,
    });

    const loggedText = silencedErrors.mock.calls.flat().map(String).join(" ");
    expect(loggedText).toContain("the Postgres update failed");
  });
});

/**
 * The one place a failed capture is fatal, and the asymmetry it makes with the tests above.
 *
 * ADR-042's rule — a capture may fail without failing the checkout — rests entirely on the
 * money being at Cashfree and the order being recoverable from their dashboard. A
 * cash-on-delivery order has no such second copy. If its row is not written it exists nowhere,
 * so a confirmation screen over it would be a promise nothing in this shop could keep, and the
 * honest answer is that the order was not placed.
 */
describe("POST /api/create-order for cash on delivery with Postgres unreachable", () => {
  it("fails the checkout rather than confirming an order that exists nowhere", async () => {
    const outboundFetch = vi.fn();
    vi.stubGlobal("fetch", outboundFetch);

    const response = await postCreateOrder({
      items: [{ productId: COD_ELIGIBLE_ID, qty: 1 }],
      address: FAILURE_TEST_ADDRESS,
      paymentPath: "cod",
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("ORDER_NOT_RECORDED");
    expect(body.retryable).toBe(true);
    expect(body.message).not.toContain("Postgres");
    expect(body.message).not.toContain("database");

    expect(body.trackingId).toBeUndefined();
    expect(body.codOrderReference).toBeUndefined();
    expect(outboundFetch).not.toHaveBeenCalled();
  });

  /**
   * The contrast, asserted in the same file so the two rules are read together rather than
   * inferred from each other's absence.
   */
  it("still lets a prepaid checkout through, because that order is at Cashfree", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            order_id: sent.order_id,
            order_status: "ACTIVE",
            order_amount: sent.order_amount,
            payment_session_id: "session_database_down_test",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const response = await postCreateOrder({
      items: [{ productId: "P001", qty: 1 }],
      address: FAILURE_TEST_ADDRESS,
      paymentPath: "full",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.paymentType).toBe("prepaid");
    expect(body.trackingId).toBeNull();
    expect(body.paymentSessionId).toBe("session_database_down_test");
  });
});
