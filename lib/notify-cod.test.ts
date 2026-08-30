import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "@/types/cart";
import { LEGAL_CONFIG, SITE_CONFIG } from "@/lib/config";
import { notifyOwnerOfCodOrder } from "@/lib/notify-cod";
import {
  composeCodOrderMessage,
  type CodOrderMessageInput,
} from "@/lib/notify-message";
import { CALLMEBOT_ENDPOINT, type CallMeBotCredentials } from "@/lib/notify";

const TRACKING_ID = "K7M2QPX9RJ";
const COD_REFERENCE = "COD_1786968394909_v8j3wggq";

const CREDENTIALS: CallMeBotCredentials = {
  phone: "910000000000",
  apiKey: "123456",
};

const ADDRESS: Address = {
  name: "Ananya Iyer",
  phone: "9876543210",
  email: "ananya@example.com",
  line1: "12 Rani Bagh",
  line2: "Near Amber Fort Road",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302001",
};

function makeOrder(overrides: Partial<CodOrderMessageInput> = {}): CodOrderMessageInput {
  return {
    trackingId: TRACKING_ID,
    codOrderReference: COD_REFERENCE,
    amountDue: 746,
    subtotal: 647,
    shipping: 99,
    total: 746,
    items: [
      { name: "Wave Band Initial Ring", qty: 2, selectedOptions: { Letter: "A" } },
      { name: "Pearl Drop Earrings", qty: 1 },
    ],
    address: ADDRESS,
    ...overrides,
  };
}

describe("the cash-on-delivery order message", () => {
  it("says on its first line that this is a cash-on-delivery order", () => {
    const message = composeCodOrderMessage(makeOrder());

    expect(message.startsWith(`*New Cash on Delivery Order - ${SITE_CONFIG.brandName}*`)).toBe(
      true,
    );
  });

  /**
   * The whole reason this message is composed separately from the paid one. Nothing has been
   * collected at the point it is sent, and a figure printed beside anything reading as "paid"
   * would be a claim about money that has not moved.
   */
  it("never states or implies that anything has been paid", () => {
    const message = composeCodOrderMessage(makeOrder());

    expect(message).not.toContain("*Paid:*");
    expect(message).not.toContain("Payment received");
    expect(message).not.toContain("payment received");
    expect(message).toContain("*Payment:* Cash on delivery. Nothing has been paid yet.");
  });

  it("gives the amount owed at the door rather than an amount charged", () => {
    const message = composeCodOrderMessage(makeOrder({ amountDue: 746 }));

    expect(message).toContain("*Due on delivery:* ₹746");
  });

  it("names both identifiers, so the order can be found in the panel and in the log", () => {
    const message = composeCodOrderMessage(makeOrder());

    expect(message).toContain(`*Order:* ${TRACKING_ID}`);
    expect(message).toContain(`*Reference:* ${COD_REFERENCE}`);
  });

  it("lists every item with its quantity and its chosen option", () => {
    const message = composeCodOrderMessage(makeOrder());
    const lines = message.split("\n");
    const itemIndex = lines.findIndex((line) => line.includes("Wave Band Initial Ring"));

    expect(lines[itemIndex]).toBe("1. Wave Band Initial Ring x2");
    expect(lines[itemIndex + 1].trim()).toBe("Letter: A");
    expect(message).toContain("2. Pearl Drop Earrings x1");
  });

  it("gives the full delivery address, phone and email", () => {
    const message = composeCodOrderMessage(makeOrder());

    expect(message).toContain("*Deliver to*");
    expect(message).toContain("Ananya Iyer");
    expect(message).toContain("12 Rani Bagh");
    expect(message).toContain("Near Amber Fort Road");
    expect(message).toContain("Jaipur, Rajasthan 302001");
    expect(message).toContain("Phone: 9876543210");
    expect(message).toContain("Email: ananya@example.com");
  });

  it("breaks down the server's own subtotal, shipping and total", () => {
    const message = composeCodOrderMessage(makeOrder());

    expect(message).toContain("*Subtotal:* ₹647");
    expect(message).toContain("*Shipping:* ₹99");
    expect(message).toContain("*Total:* ₹746");
  });

  it("asks for the cash to be collected rather than for a payment to be confirmed", () => {
    const message = composeCodOrderMessage(makeOrder());

    expect(message).toContain(`Dispatch within ${LEGAL_CONFIG.dispatchWindow}`);
    expect(message).toContain("Collect ₹746 in cash at delivery");
    expect(message).toContain(TRACKING_ID);
    expect(message).not.toContain("Cashfree");
  });

  it("names the campaign an order came from, under the order it belongs to", () => {
    const message = composeCodOrderMessage(
      makeOrder({
        utm: {
          source: "instagram",
          medium: "paid_social",
          campaign: "rakhi_2026",
          term: "anti tarnish rings",
          content: "carousel_2",
        },
      }),
    );

    const lines = message.split("\n");
    const headingIndex = lines.indexOf("*Came from*");

    expect(headingIndex).toBeGreaterThan(lines.indexOf(`*Order:* ${TRACKING_ID}`));
    expect(headingIndex).toBeLessThan(lines.indexOf("*Items*"));
    expect(lines[headingIndex + 1]).toBe("Source: instagram");
    expect(lines[headingIndex + 2]).toBe("Medium: paid_social");
    expect(lines[headingIndex + 3]).toBe("Campaign: rakhi_2026");
  });

  it("says nothing about a campaign on the ordinary order that has none", () => {
    for (const utm of [undefined, null, { term: "rings" }]) {
      expect(composeCodOrderMessage(makeOrder({ utm }))).not.toContain("Came from");
    }
  });

  it("uses real newlines, which become %0A once encoded", () => {
    const message = composeCodOrderMessage(makeOrder());

    expect(message).toContain("\n");
    expect(encodeURIComponent(message)).toContain("%0A");
  });
});

describe("notifying the owner of a cash-on-delivery order", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function notify(
    overrides: Partial<CodOrderMessageInput> = {},
    credentials: CallMeBotCredentials | null = CREDENTIALS,
  ) {
    return notifyOwnerOfCodOrder(makeOrder(overrides), {
      credentials,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
  }

  it("makes exactly one attempt, carrying the cash-on-delivery message", async () => {
    await expect(notify()).resolves.toBe("SENT");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(`${url.origin}${url.pathname}`).toBe(CALLMEBOT_ENDPOINT);
    expect(url.searchParams.get("text")).toBe(composeCodOrderMessage(makeOrder()));
  });

  it("sends the amount due, and never an amount paid", async () => {
    await notify({ amountDue: 1299, total: 1299 });

    const text = new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("text") ?? "";

    expect(text).toContain("*Due on delivery:* ₹1,299");
    expect(text).not.toContain("*Paid:*");
  });

  it("skips silently when the keys are not configured", async () => {
    await expect(notify({}, null)).resolves.toBe("SKIPPED_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a non-200 from CallMeBot as a failure, without throwing", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(notify()).resolves.toBe("FAILED");
  });

  it("swallows a network error rather than rejecting", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(notify()).resolves.toBe("FAILED");
  });

  it("swallows a timeout rather than rejecting", async () => {
    fetchMock.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));

    await expect(notify()).resolves.toBe("FAILED");
  });

  it("gives CallMeBot the same short leash a paid order's message gets", async () => {
    await notify();

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(requestInit.signal).toBeDefined();
    expect(requestInit.method).toBe("GET");
  });
});
