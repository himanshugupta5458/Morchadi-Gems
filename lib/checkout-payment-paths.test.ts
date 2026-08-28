import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CodEligibilityEntry } from "@/lib/cod";
import { prisma } from "@/lib/prisma";
import { getCodEligibilityCatalogue } from "@/lib/products";

/**
 * A prepayment floor is a per-product fact the catalogue may set on any piece at any time, so
 * these tests never name the piece they buy. This override is how they bar one without editing
 * the catalogue: `getCodEligibilityCatalogue` is the one accessor the route consults for
 * eligibility (ADR-058), so replacing what it returns is the whole of what "this shop stopped
 * selling that piece on delivery" means to the code under test. Everything else — pricing,
 * capture, the Cashfree request — runs against the real module.
 */
let codCatalogueOverride: CodEligibilityEntry[] | null = null;

vi.mock("@/lib/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/products")>();
  return {
    ...actual,
    getCodEligibilityCatalogue: (): CodEligibilityEntry[] =>
      codCatalogueOverride ?? actual.getCodEligibilityCatalogue(),
  };
});

/** The real catalogue with one product's prepayment floor raised. */
async function barProduct(productId: string, minPrepaidAmount: number): Promise<void> {
  const { getCodEligibilityCatalogue } = await vi.importActual<
    typeof import("@/lib/products")
  >("@/lib/products");

  codCatalogueOverride = getCodEligibilityCatalogue().map((entry) =>
    entry.id === productId ? { ...entry, minPrepaidAmount } : entry,
  );
}

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const PATH_TEST_PHONE = "9876500022";

/**
 * A piece the catalogue on disk still takes on delivery, found rather than named. Naming one
 * couples every cash-on-delivery assertion below to that product keeping
 * `minPrepaidAmount: 0` forever, and the day it acquires a floor these tests stop testing the
 * cash-on-delivery path and start testing the refusal.
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

let unavailableReason: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

const PATH_TEST_ADDRESS = {
  name: "Payment Path Test",
  phone: PATH_TEST_PHONE,
  email: "payment.path@example.com",
  line1: "9 Johari Bazaar",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302003",
};

function cashfreeCreated(orderId: string): Response {
  return new Response(
    JSON.stringify({
      order_id: orderId,
      order_status: "ACTIVE",
      order_amount: 259,
      payment_session_id: "session_payment_path_test",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

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

async function removePathTestRows(): Promise<void> {
  if (unavailableReason !== null) return;

  const customer = await prisma.customer.findUnique({
    where: { phone: PATH_TEST_PHONE },
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

  vi.stubEnv("CASHFREE_APP_ID", "TEST_PATH_APP_ID");
  vi.stubEnv("CASHFREE_SECRET_KEY", "TEST_PATH_SECRET_KEY");
  vi.spyOn(console, "log").mockImplementation(() => {});

  await removePathTestRows();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  codCatalogueOverride = null;
  await removePathTestRows();
});

afterAll(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

/**
 * The behaviour of the one checkout path that existed before this file did, pinned exactly as
 * it was so that widening the route into three paths cannot quietly move it. Every assertion
 * here passed against the route *before* `paymentPath` existed, and a body that names no path
 * is precisely the body every already-deployed browser sends.
 */
describe("a checkout that names no payment path at all", () => {
  it("sends Cashfree the full order total and writes a prepaid row, exactly as it always did", async (ctx) => {
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
      items: [{ productId: COD_ELIGIBLE_ID, qty: 2 }],
      address: PATH_TEST_ADDRESS,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cashfreeOrderId).toMatch(/^MG_\d{13}_[0-9a-z]{8}$/);
    expect(body.paymentSessionId).toBe("session_payment_path_test");
    expect(body.mode).toBe("sandbox");

    const written = await prisma.order.findUniqueOrThrow({
      where: { cashfreeOrderId: body.cashfreeOrderId },
    });

    expect(sentToCashfree).toHaveLength(1);
    expect(sentToCashfree[0].order_amount).toBe(written.total.toNumber());
    expect(sentToCashfree[0].order_currency).toBe("INR");

    expect(written.paymentType).toBe("prepaid");
    expect(written.amountPrepaid.toString()).toBe(written.total.toString());
    expect(written.amountDue.toString()).toBe("0");
    expect(written.cashfreePaymentStatus).toBe("PENDING");
    expect(written.status).toBe("placed");
  });

  it("charges the whole cart, so nothing is left owing at the door", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) =>
        cashfreeCreated(String(JSON.parse(String(init.body)).order_id)),
      ),
    );

    const body = await (
      await postCreateOrder({
        items: [{ productId: COD_ELIGIBLE_ID, qty: 1 }],
        address: PATH_TEST_ADDRESS,
      })
    ).json();

    const written = await prisma.order.findUniqueOrThrow({
      where: { cashfreeOrderId: body.cashfreeOrderId },
    });

    expect(written.amountDue.toNumber()).toBe(0);
    expect(
      written.amountPrepaid.toNumber() + written.amountDue.toNumber(),
    ).toBe(written.total.toNumber());
  });
});

/**
 * The path that never touches the payment gateway, checked by watching `fetch` rather than by
 * inspecting the answer: a route that quietly created a Cashfree order and then ignored it
 * would pass every assertion about the response body and still be wrong.
 */
describe("a cash-on-delivery checkout", () => {
  it("makes no request to Cashfree at all, and writes the whole total as owing", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const outboundFetch = vi.fn(async () => cashfreeCreated("should_never_be_called"));
    vi.stubGlobal("fetch", outboundFetch);

    const response = await postCreateOrder({
      items: [{ productId: COD_ELIGIBLE_ID, qty: 2 }],
      address: PATH_TEST_ADDRESS,
      paymentPath: "cod",
    });
    const body = await response.json();

    expect(outboundFetch).not.toHaveBeenCalled();

    expect(response.status).toBe(200);
    expect(body.paymentType).toBe("cod");
    expect(body.codOrderReference).toMatch(/^COD_\d{13}_[0-9a-z]{8}$/);
    expect(body.trackingId).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/);
    expect(body.paymentSessionId).toBeUndefined();
    expect(body.mode).toBeUndefined();
    expect(body.cashfreeOrderId).toBeUndefined();

    const written = await prisma.order.findUniqueOrThrow({
      where: { cashfreeOrderId: body.codOrderReference },
      include: { lineItems: true, statusHistory: true },
    });

    expect(written.id).toBe(body.trackingId);
    expect(written.paymentType).toBe("cod");
    expect(written.amountPrepaid.toNumber()).toBe(0);
    expect(written.amountDue.toNumber()).toBe(written.total.toNumber());
    expect(written.amountDue.toNumber()).toBe(body.amountDue);
    expect(written.cashfreePaymentStatus).toBe("NOT_APPLICABLE");
    expect(written.status).toBe("placed");
    expect(written.codAmountCollected).toBe(false);
    expect(written.lineItems).toHaveLength(1);
    expect(written.statusHistory[0].changedBy).toBe("system");
  });

  it("mints a reference the payment-verification route refuses before it can call Cashfree", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    vi.stubGlobal("fetch", vi.fn(async () => cashfreeCreated("never")));

    const { codOrderReference } = await (
      await postCreateOrder({
        items: [{ productId: COD_ELIGIBLE_ID, qty: 1 }],
        address: PATH_TEST_ADDRESS,
        paymentPath: "cod",
      })
    ).json();

    const gatewayFetch = vi.fn(async () => cashfreeCreated("never"));
    vi.stubGlobal("fetch", gatewayFetch);

    const { GET } = await import("@/app/api/verify-order/route");
    const verify = await GET(
      new Request(
        `http://localhost:3000/api/verify-order?order_id=${encodeURIComponent(codOrderReference)}`,
      ),
    );

    expect(gatewayFetch).not.toHaveBeenCalled();
    expect(verify.status).toBe(400);
    expect((await verify.json()).error).toBe("COD_ORDER_NOT_VERIFIABLE");
  });

  it("is readable back by its own route, which names the order and what is owed", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    vi.stubGlobal("fetch", vi.fn(async () => cashfreeCreated("never")));

    const placed = await (
      await postCreateOrder({
        items: [{ productId: COD_ELIGIBLE_ID, qty: 1 }],
        address: PATH_TEST_ADDRESS,
        paymentPath: "cod",
      })
    ).json();

    const { GET } = await import("@/app/api/cod-order/route");
    const lookup = await GET(
      new Request(
        `http://localhost:3000/api/cod-order?order_id=${encodeURIComponent(placed.codOrderReference)}`,
      ),
    );

    expect(lookup.status).toBe(200);
    expect(await lookup.json()).toEqual({
      codOrderReference: placed.codOrderReference,
      trackingId: placed.trackingId,
      total: placed.amountDue,
      amountDue: placed.amountDue,
    });
  });

  it("refuses a Cashfree reference and an invented one at its own route", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { GET } = await import("@/app/api/cod-order/route");

    const wrongShape = await GET(
      new Request("http://localhost:3000/api/cod-order?order_id=MG_1786968394909_v8j3wggq"),
    );
    expect(wrongShape.status).toBe(400);
    expect((await wrongShape.json()).error).toBe("COD_REFERENCE_MALFORMED");

    const unknown = await GET(
      new Request("http://localhost:3000/api/cod-order?order_id=COD_1786968394909_zzzzzzzz"),
    );
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error).toBe("COD_ORDER_NOT_FOUND");
  });

  it("is refused outright when the cart holds a piece that requires prepayment", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await barProduct(COD_ELIGIBLE_ID, 500);

    const outboundFetch = vi.fn(async () => cashfreeCreated("never"));
    vi.stubGlobal("fetch", outboundFetch);

    const response = await postCreateOrder({
      items: [{ productId: COD_ELIGIBLE_ID, qty: 1 }],
      address: PATH_TEST_ADDRESS,
      paymentPath: "cod",
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("PAYMENT_PATH_UNAVAILABLE");
    expect(outboundFetch).not.toHaveBeenCalled();
    expect(await prisma.customer.count({ where: { phone: PATH_TEST_PHONE } })).toBe(0);
  });
});

describe("a part-payment checkout", () => {
  it("sends Cashfree the floor rather than the total, and books the rest as owing", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await barProduct(COD_ELIGIBLE_ID, 50);

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
      items: [{ productId: COD_ELIGIBLE_ID, qty: 3 }],
      address: PATH_TEST_ADDRESS,
      paymentPath: "partial",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.paymentType).toBe("partial_cod");
    expect(body.paymentSessionId).toBe("session_payment_path_test");
    expect(body.amountPrepaid).toBe(150);

    const written = await prisma.order.findUniqueOrThrow({
      where: { cashfreeOrderId: body.cashfreeOrderId },
    });

    expect(sentToCashfree[0].order_amount).toBe(150);
    expect(sentToCashfree[0].order_amount).not.toBe(written.total.toNumber());

    expect(written.paymentType).toBe("partial_cod");
    expect(written.amountPrepaid.toNumber()).toBe(150);
    expect(written.amountDue.toNumber()).toBe(written.total.toNumber() - 150);
    expect(written.amountDue.toNumber()).toBeGreaterThan(0);
    expect(written.amountPrepaid.toNumber() + written.amountDue.toNumber()).toBe(
      written.total.toNumber(),
    );
  });

  it("is refused on a cart that has no floor to part-pay", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const outboundFetch = vi.fn(async () => cashfreeCreated("never"));
    vi.stubGlobal("fetch", outboundFetch);

    const response = await postCreateOrder({
      items: [{ productId: COD_ELIGIBLE_ID, qty: 1 }],
      address: PATH_TEST_ADDRESS,
      paymentPath: "partial",
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("PAYMENT_PATH_UNAVAILABLE");
    expect(outboundFetch).not.toHaveBeenCalled();
  });

  /**
   * A floor at or above the total would make "pay the minimum" and "pay in full" charge the
   * same amount, and would write a `partial_cod` row with nothing owing on it.
   */
  it("is refused when the floor has grown to meet the order total", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await barProduct(COD_ELIGIBLE_ID, 100_000);
    vi.stubGlobal("fetch", vi.fn(async () => cashfreeCreated("never")));

    const response = await postCreateOrder({
      items: [{ productId: COD_ELIGIBLE_ID, qty: 1 }],
      address: PATH_TEST_ADDRESS,
      paymentPath: "partial",
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("PAYMENT_PATH_UNAVAILABLE");
  });
});

/**
 * A client that names a path the cart does not permit is the whole threat model here: the
 * browser sends a word, and nothing about which words it may send is enforced in the browser.
 */
describe("a request that lies about which path it may take", () => {
  it("cannot take a barred cart on delivery by asking for it, nor by inventing a word", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await barProduct(COD_ELIGIBLE_ID, 500);

    const sentToCashfree: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
        sentToCashfree.push(sent);
        return cashfreeCreated(String(sent.order_id));
      }),
    );

    expect(
      (
        await postCreateOrder({
          items: [{ productId: COD_ELIGIBLE_ID, qty: 1 }],
          address: PATH_TEST_ADDRESS,
          paymentPath: "cod",
        })
      ).status,
    ).toBe(400);

    const invented = await postCreateOrder({
      items: [{ productId: COD_ELIGIBLE_ID, qty: 1 }],
      address: PATH_TEST_ADDRESS,
      paymentPath: "free",
    });
    const inventedBody = await invented.json();

    expect(invented.status).toBe(200);
    expect(inventedBody.paymentType).toBe("prepaid");

    const written = await prisma.order.findUniqueOrThrow({
      where: { cashfreeOrderId: inventedBody.cashfreeOrderId },
    });
    expect(sentToCashfree[0].order_amount).toBe(written.total.toNumber());
    expect(written.amountDue.toNumber()).toBe(0);
  });

  it("cannot name an amount, because no field of the body is read as one", async (ctx) => {
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

    const body = await (
      await postCreateOrder({
        items: [{ productId: COD_ELIGIBLE_ID, qty: 1, price: 1 }],
        address: PATH_TEST_ADDRESS,
        paymentPath: "full",
        amountPrepaid: 1,
        amountDue: 9_999,
        minPrepaidAmount: 1,
        total: 1,
      })
    ).json();

    const written = await prisma.order.findUniqueOrThrow({
      where: { cashfreeOrderId: body.cashfreeOrderId },
    });

    expect(sentToCashfree[0].order_amount).toBe(written.total.toNumber());
    expect(sentToCashfree[0].order_amount).not.toBe(1);
    expect(written.amountDue.toNumber()).toBe(0);
    expect(written.amountPrepaid.toNumber()).toBe(written.total.toNumber());
  });
});
