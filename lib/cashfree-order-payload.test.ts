import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CaptureOrderInput } from "@/lib/order-capture";

/**
 * What leaves the building, and what stays in it.
 *
 * Cashfree support confirmed on ticket 8314128 (2026-09-01) that `customer_id` and
 * `customer_phone` are the only mandatory members of `customer_details`, and that
 * `customer_email` changes neither the payment methods offered nor the fraud scoring. The
 * outbound payload was cut to that minimum, and the campaign tags went with it
 * ([ADR-075](/docs/decisions/ADR-075-minimal-cashfree-customer-payload.md)).
 *
 * A payload can only be *narrowed* safely if the order record is not, so these tests read both
 * halves of the same checkout: the body handed to `fetch`, and the input handed to
 * `captureOrder`. `captureOrder` is mocked rather than the Prisma client, because what matters
 * here is that the route still passes it the shopper's name, inbox, full address and campaign —
 * not what Postgres then does with them, which `checkout-capture-route.test.ts` owns.
 */
const capturedInputs: CaptureOrderInput[] = [];

vi.mock("@/lib/order-capture", async () => {
  const actual = await vi.importActual<typeof import("@/lib/order-capture")>(
    "@/lib/order-capture",
  );

  return {
    ...actual,
    captureOrder: vi.fn(async (input: CaptureOrderInput) => {
      capturedInputs.push(input);
      return {
        kind: "CAPTURED" as const,
        orderId: "W2ACEHACUU",
        customerId: "cus_payload_test",
        customerCreated: true,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
      };
    }),
  };
});

const PAYLOAD_TEST_ADDRESS = {
  name: "Ananya Sharma",
  phone: "9876500033",
  email: "ananya.sharma@example.com",
  line1: "12 Amber Fort Road",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302001",
};

const PAYLOAD_TEST_UTM = {
  source: "instagram",
  medium: "paid_social",
  campaign: "rakhi_2026",
};

let silencedLogs: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  vi.stubEnv("CASHFREE_APP_ID", "TEST_PAYLOAD_APP_ID");
  vi.stubEnv("CASHFREE_SECRET_KEY", "TEST_PAYLOAD_SECRET_KEY");
  silencedLogs = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  capturedInputs.length = 0;
});

afterAll(() => {
  silencedLogs.mockRestore();
  vi.unstubAllEnvs();
});

async function checkout(
  body: unknown,
): Promise<{ sent: Record<string, unknown>; response: Response }> {
  const sentBodies: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
      sentBodies.push(sent);
      return new Response(
        JSON.stringify({
          order_id: sent.order_id,
          order_status: "ACTIVE",
          payment_session_id: "session_payload_test",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );

  const { POST } = await import("@/app/api/create-order/route");
  const response = await POST(
    new Request("http://localhost:3000/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

  expect(sentBodies).toHaveLength(1);
  return { sent: sentBodies[0], response };
}

function checkoutBody(): Record<string, unknown> {
  return {
    items: [{ productId: "P001", qty: 1, selectedOptions: { Letter: "A" } }],
    address: PAYLOAD_TEST_ADDRESS,
    utm: PAYLOAD_TEST_UTM,
  };
}

describe("the customer details sent to Cashfree", () => {
  it("names the guest id and the phone number, and nothing else", async () => {
    const { sent } = await checkout(checkoutBody());
    const customerDetails = sent.customer_details as Record<string, unknown>;

    expect(Object.keys(customerDetails).sort()).toEqual([
      "customer_id",
      "customer_phone",
    ]);
    expect(customerDetails.customer_id).toMatch(/^guest_[0-9a-z]{12}$/);
    expect(customerDetails.customer_phone).toBe(`+91${PAYLOAD_TEST_ADDRESS.phone}`);
  });

  it("carries neither the shopper's name nor their inbox anywhere in the request", async () => {
    const { sent } = await checkout(checkoutBody());
    const rawBody = JSON.stringify(sent);

    expect(rawBody).not.toContain(PAYLOAD_TEST_ADDRESS.name);
    expect(rawBody).not.toContain(PAYLOAD_TEST_ADDRESS.email);
    expect(rawBody).not.toContain(PAYLOAD_TEST_ADDRESS.line1);
    expect(rawBody).not.toContain(PAYLOAD_TEST_ADDRESS.pincode);
  });
});

describe("the order tags sent to Cashfree", () => {
  it("keeps the engraving choice a packer reads off the payment record", async () => {
    const { sent } = await checkout(checkoutBody());

    expect(sent.order_tags).toEqual({ options: "P001:Letter=A" });
  });

  it("carries no campaign, under any of the three utm keys", async () => {
    const { sent } = await checkout(checkoutBody());
    const rawBody = JSON.stringify(sent);

    for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
      expect(rawBody).not.toContain(key);
    }
    for (const value of Object.values(PAYLOAD_TEST_UTM)) {
      expect(rawBody).not.toContain(value);
    }
  });

  it("omits order_tags entirely when there is no option to record", async () => {
    const { sent } = await checkout({
      items: [{ productId: "P002", qty: 1 }],
      address: PAYLOAD_TEST_ADDRESS,
      utm: PAYLOAD_TEST_UTM,
    });

    expect(sent).not.toHaveProperty("order_tags");
  });
});

describe("the order record behind that narrowed payload", () => {
  it("still receives the name, the inbox, the whole address and the campaign", async () => {
    await checkout(checkoutBody());

    expect(capturedInputs).toHaveLength(1);
    expect(capturedInputs[0].address).toMatchObject(PAYLOAD_TEST_ADDRESS);
    expect(capturedInputs[0].utm).toMatchObject(PAYLOAD_TEST_UTM);
  });

  it("still records the engraving choice on the line it belongs to", async () => {
    await checkout(checkoutBody());

    expect(capturedInputs[0].lines[0].selectedOptions).toEqual({ Letter: "A" });
  });
});

describe("everything the payload never stopped sending", () => {
  it("keeps the order id, the amount, the currency and the return url", async () => {
    const { sent, response } = await checkout(checkoutBody());
    const body = await response.json();

    expect(sent.order_id).toMatch(/^MG_\d{13}_[0-9a-z]{8}$/);
    expect(sent.order_id).toBe(body.cashfreeOrderId);
    expect(sent.order_amount).toBe(body.amountPrepaid);
    expect(sent.order_amount).toBeGreaterThan(0);
    expect(sent.order_currency).toBe("INR");
    expect(
      (sent.order_meta as Record<string, unknown>).return_url,
    ).toContain(String(sent.order_id));
  });
});
