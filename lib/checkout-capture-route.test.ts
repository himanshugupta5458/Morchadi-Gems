import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const ROUTE_TEST_PHONE = "9876500011";
const INITIAL_RING_ID = "P001";
const WATCH_RING_ID = "P010";

let unavailableReason: string | null = null;
let captureLog: ReturnType<typeof vi.spyOn>;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

const ROUTE_TEST_ADDRESS = {
  name: "Route Capture Test",
  phone: ROUTE_TEST_PHONE,
  email: "route.capture@example.com",
  line1: "12 Amber Fort Road",
  line2: "Near the step well",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302001",
};

/**
 * A Cashfree create-order reply, reduced to the fields this project reads. `ACTIVE` is what
 * Cashfree actually returns for a session that has been minted and not yet paid.
 */
function cashfreeCreated(orderId: string, orderStatus = "ACTIVE"): Response {
  return new Response(
    JSON.stringify({
      order_id: orderId,
      order_status: orderStatus,
      order_amount: 259,
      payment_session_id: "session_route_capture_test",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function cashfreeLookup(orderId: string, orderStatus: string, amount: number): Response {
  return new Response(
    JSON.stringify({ order_id: orderId, order_status: orderStatus, order_amount: amount }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function createOrderRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function postCreateOrder(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/create-order/route");
  return POST(createOrderRequest(body));
}

async function getVerifyOrder(orderId: string): Promise<Response> {
  const { GET } = await import("@/app/api/verify-order/route");
  return GET(
    new Request(
      `http://localhost:3000/api/verify-order?order_id=${encodeURIComponent(orderId)}`,
    ),
  );
}

/**
 * These tests drive the real routes against the real local database, so they cannot roll back
 * through an interactive transaction the way `lib/order-capture.test.ts` does. Everything they
 * write is keyed to one throwaway phone number and removed here instead.
 */
async function removeRouteTestRows(): Promise<void> {
  if (unavailableReason !== null) return;

  const customer = await prisma.customer.findUnique({
    where: { phone: ROUTE_TEST_PHONE },
    select: { id: true },
  });
  if (customer === null) return;

  const orderIds = (
    await prisma.order.findMany({
      where: { customerId: customer.id },
      select: { id: true },
    })
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

  vi.stubEnv("CASHFREE_APP_ID", "TEST_ROUTE_APP_ID");
  vi.stubEnv("CASHFREE_SECRET_KEY", "TEST_ROUTE_SECRET_KEY");
  captureLog = vi.spyOn(console, "log").mockImplementation(() => {});

  await removeRouteTestRows();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await removeRouteTestRows();
});

afterAll(async () => {
  captureLog.mockRestore();
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

describe("POST /api/create-order, once there is somewhere to put an order", () => {
  it("answers the browser exactly as it always did, and writes the order beside it", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const sentToCashfree: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
        sentToCashfree.push(sent);
        return cashfreeCreated(String(sent.order_id));
      }),
    );

    const response = await postCreateOrder({
      items: [{ productId: INITIAL_RING_ID, qty: 2, selectedOptions: { Letter: "A" } }],
      address: ROUTE_TEST_ADDRESS,
      utm: { source: "instagram", medium: "paid_social", campaign: "rakhi_2026" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orderId).toMatch(/^MG_\d{13}_[0-9a-z]{8}$/);
    expect(body.paymentSessionId).toBe("session_route_capture_test");
    expect(body.mode).toBe("sandbox");

    const written = await prisma.order.findUniqueOrThrow({
      where: { cashfreeOrderId: body.orderId },
      include: { lineItems: true, statusHistory: true, customer: true },
    });

    expect(written.id).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/);
    expect(written.id).not.toBe(body.orderId);
    expect(written.status).toBe("placed");
    expect(written.paymentType).toBe("prepaid");
    expect(written.cashfreePaymentStatus).toBe("PENDING");
    expect(written.amountDue.toString()).toBe("0");
    expect(written.amountPrepaid.toString()).toBe(written.total.toString());
    expect(written.total.toString()).toBe(String(sentToCashfree[0].order_amount));
    expect(written.utmSource).toBe("instagram");
    expect(written.utmCampaign).toBe("rakhi_2026");
    expect(written.shippingAddress).toMatchObject({
      phone: ROUTE_TEST_PHONE,
      city: "Jaipur",
      line2: "Near the step well",
    });

    expect(written.customer.phone).toBe(ROUTE_TEST_PHONE);
    expect(written.customer.firstUtmSource).toBe("instagram");

    expect(written.lineItems).toHaveLength(1);
    expect(written.lineItems[0].productId).toBe(INITIAL_RING_ID);
    expect(written.lineItems[0].quantity).toBe(2);
    expect(written.lineItems[0].selectedOptions).toEqual({ Letter: "A" });
    expect(Number(written.lineItems[0].unitCost)).toBeGreaterThan(0);
    expect(Number(written.lineItems[0].unitCost)).toBeLessThan(
      Number(written.lineItems[0].unitPrice),
    );
    expect(written.totalCost.toString()).toBe(
      (Number(written.lineItems[0].unitCost) * 2).toString(),
    );

    expect(written.statusHistory).toHaveLength(1);
    expect(written.statusHistory[0].changedBy).toBe("system");
    expect(written.statusHistory[0].reason).toBeNull();

    expect(captureLog).toHaveBeenCalledWith(
      `[create-order] ${body.orderId} captured as order ${written.id} for a new customer`,
    );
  });

  it("records the same shopper's second order against the one customer row", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) =>
        cashfreeCreated(String(JSON.parse(String(init.body)).order_id)),
      ),
    );

    const first = await (
      await postCreateOrder({
        items: [{ productId: INITIAL_RING_ID, qty: 1 }],
        address: ROUTE_TEST_ADDRESS,
        utm: { source: "instagram" },
      })
    ).json();

    const second = await (
      await postCreateOrder({
        items: [{ productId: WATCH_RING_ID, qty: 1 }],
        address: ROUTE_TEST_ADDRESS,
        utm: { source: "google" },
      })
    ).json();

    expect(first.orderId).not.toBe(second.orderId);
    expect(await prisma.customer.count({ where: { phone: ROUTE_TEST_PHONE } })).toBe(1);

    const customer = await prisma.customer.findUniqueOrThrow({
      where: { phone: ROUTE_TEST_PHONE },
      include: { orders: true },
    });

    expect(customer.orders).toHaveLength(2);
    expect(customer.firstUtmSource).toBe("instagram");
    expect(
      customer.orders.map((order) => order.utmSource).sort(),
    ).toEqual(["google", "instagram"]);
  });

  it("snapshots the product name and photograph rather than pointing at the catalogue", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) =>
        cashfreeCreated(String(JSON.parse(String(init.body)).order_id)),
      ),
    );

    const { orderId } = await (
      await postCreateOrder({
        items: [{ productId: WATCH_RING_ID, qty: 1 }],
        address: ROUTE_TEST_ADDRESS,
      })
    ).json();

    const { getProductById } = await import("@/lib/products");
    const catalogueProduct = getProductById(WATCH_RING_ID);

    const line = await prisma.orderLineItem.findFirstOrThrow({
      where: { order: { cashfreeOrderId: orderId } },
    });

    expect(line.productName).toBe(catalogueProduct?.name);
    expect(line.productImage).toBe(catalogueProduct?.media.images[0]);
    expect(line.productName.length).toBeGreaterThan(0);
    expect(line.productImage).toMatch(/^\/products\//);
  });
});

describe("GET /api/verify-order, once there is an order to update", () => {
  it("brings the payment status into line without moving the order out of placed", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) =>
        cashfreeCreated(String(JSON.parse(String(init.body)).order_id)),
      ),
    );

    const { orderId } = await (
      await postCreateOrder({
        items: [{ productId: INITIAL_RING_ID, qty: 1 }],
        address: ROUTE_TEST_ADDRESS,
      })
    ).json();

    const beforeVerification = await prisma.order.findUniqueOrThrow({
      where: { cashfreeOrderId: orderId },
    });
    expect(beforeVerification.cashfreePaymentStatus).toBe("PENDING");

    vi.stubGlobal("fetch", vi.fn(async () => cashfreeLookup(orderId, "PAID", 259)));

    const response = await getVerifyOrder(orderId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ orderId, status: "PAID", amount: 259 });

    const afterVerification = await prisma.order.findUniqueOrThrow({
      where: { cashfreeOrderId: orderId },
    });

    expect(afterVerification.cashfreePaymentStatus).toBe("PAID");
    expect(afterVerification.status).toBe("placed");
    expect(afterVerification.id).toBe(beforeVerification.id);
  });

  it("answers normally about an order that predates this table", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const strangerOrderId = "MG_1786968394909_v8j3wggq";
    vi.stubGlobal("fetch", vi.fn(async () => cashfreeLookup(strangerOrderId, "PAID", 999)));

    const response = await getVerifyOrder(strangerOrderId);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      orderId: strangerOrderId,
      status: "PAID",
      amount: 999,
    });
  });
});
