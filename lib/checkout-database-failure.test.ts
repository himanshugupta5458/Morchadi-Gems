import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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
      "cashfreeOrderId",
      "mode",
      "paymentSessionId",
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
    expect(body).toEqual({ orderId, status: "PAID", amount: 419, trackingId: null });

    const loggedText = silencedErrors.mock.calls.flat().map(String).join(" ");
    expect(loggedText).toContain("the Postgres update failed");
  });
});
