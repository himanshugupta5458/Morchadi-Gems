import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutData } from "@/types/cart";
import { LEGAL_CONFIG, SITE_CONFIG } from "@/lib/config";
import { composeAdminOrderMessage } from "@/lib/notify-message";
import {
  CALLMEBOT_ENDPOINT,
  CALLMEBOT_TIMEOUT_MS,
  buildCallMeBotUrl,
  dispatchAdminNotification,
  readCallMeBotCredentials,
  type CallMeBotCredentials,
} from "@/lib/notify";

const ORDER_ID = "MG_1786968394909_v8j3wggq";

const CREDENTIALS: CallMeBotCredentials = {
  phone: "910000000000",
  apiKey: "123456",
};

function makeBundle(overrides: Partial<CheckoutData> = {}): CheckoutData {
  return {
    cart: [
      {
        productId: "P001",
        name: "Wave Band Initial Ring",
        price: 199,
        image: "/products/P001.webp",
        qty: 2,
        selectedOptions: { Letter: "A" },
      },
      {
        productId: "P020",
        name: "Pearl Drop Earrings",
        price: 249,
        image: "/products/P020.webp",
        qty: 1,
      },
    ],
    address: {
      name: "Ananya Iyer",
      phone: "9876543210",
      email: "ananya@example.com",
      line1: "12 Rani Bagh",
      line2: "Near Amber Fort Road",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
    },
    subtotal: 647,
    shipping: 99,
    total: 746,
    ...overrides,
  };
}

describe("the admin order message", () => {
  it("opens with the brand and names the order and the amount Cashfree charged", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle(),
    });

    expect(message.startsWith(`*New Order - ${SITE_CONFIG.brandName}*`)).toBe(true);
    expect(message).toContain(`*Order:* ${ORDER_ID}`);
    expect(message).toContain("*Paid:* ₹746");
  });

  it("lists every item with its quantity", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle(),
    });

    expect(message).toContain("1. Wave Band Initial Ring x2");
    expect(message).toContain("2. Pearl Drop Earrings x1");
  });

  it("carries the chosen variant on the line it belongs to", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle(),
    });

    expect(message).toContain("Letter: A");

    const lines = message.split("\n");
    const itemIndex = lines.findIndex((line) => line.includes("Wave Band Initial Ring"));
    expect(lines[itemIndex + 1].trim()).toBe("Letter: A");
  });

  it("carries several choices on one line", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle({
        cart: [
          {
            productId: "P010",
            name: "Mini Watch Ring",
            price: 299,
            image: "/products/P010.webp",
            qty: 1,
            selectedOptions: { Letter: "S", Colour: "Golden" },
          },
        ],
      }),
    });

    expect(message).toContain("Letter: S");
    expect(message).toContain("Colour: Golden");
  });

  it("prints a plain line for a product sold in one configuration", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 249,
      bundle: makeBundle({
        cart: [
          {
            productId: "P020",
            name: "Pearl Drop Earrings",
            price: 249,
            image: "/products/P020.webp",
            qty: 1,
          },
        ],
      }),
    });

    const lines = message.split("\n");
    const itemIndex = lines.findIndex((line) => line.includes("Pearl Drop Earrings"));

    expect(lines[itemIndex]).toBe("1. Pearl Drop Earrings x1");
    expect(lines[itemIndex + 1]).toBe("");
  });

  it("gives the full delivery address, phone and email", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle(),
    });

    expect(message).toContain("*Deliver to*");
    expect(message).toContain("Ananya Iyer");
    expect(message).toContain("12 Rani Bagh");
    expect(message).toContain("Near Amber Fort Road");
    expect(message).toContain("Jaipur, Rajasthan 302001");
    expect(message).toContain("Phone: 9876543210");
    expect(message).toContain("Email: ananya@example.com");
  });

  it("omits an absent second address line rather than printing a blank", () => {
    const bundle = makeBundle();
    const withoutLine2 = makeBundle({
      address: { ...bundle.address, line2: undefined },
    });

    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: withoutLine2,
    });

    const lines = message.split("\n");
    const nameIndex = lines.indexOf("Ananya Iyer");

    expect(lines[nameIndex + 1]).toBe("12 Rani Bagh");
    expect(lines[nameIndex + 2]).toBe("Jaipur, Rajasthan 302001");
  });

  it("breaks down the shopper's own subtotal and shipping", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle(),
    });

    expect(message).toContain("*Subtotal:* ₹647");
    expect(message).toContain("*Shipping:* ₹99");
    expect(message).toContain("*Total:* ₹746");
  });

  it("names the campaign an order came from, under the order it belongs to", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle(),
      utm: {
        source: "instagram",
        medium: "paid_social",
        campaign: "rakhi_2026",
        term: "anti tarnish rings",
        content: "carousel_2",
      },
    });

    const lines = message.split("\n");
    const headingIndex = lines.indexOf("*Came from*");

    expect(headingIndex).toBeGreaterThan(lines.indexOf(`*Order:* ${ORDER_ID}`));
    expect(headingIndex).toBeLessThan(lines.indexOf("*Items*"));
    expect(lines[headingIndex + 1]).toBe("Source: instagram");
    expect(lines[headingIndex + 2]).toBe("Medium: paid_social");
    expect(lines[headingIndex + 3]).toBe("Campaign: rakhi_2026");
  });

  it("prints only the campaign fields that are there", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle(),
      utm: { source: "whatsapp" },
    });

    expect(message).toContain("Source: whatsapp");
    expect(message).not.toContain("Medium:");
    expect(message).not.toContain("Campaign:");
  });

  it("says nothing about a campaign on the ordinary order that has none", () => {
    for (const utm of [undefined, null, { term: "rings" }]) {
      const message = composeAdminOrderMessage({
        orderId: ORDER_ID,
        amountPaid: 746,
        bundle: makeBundle(),
        utm,
      });

      expect(message, JSON.stringify(utm)).not.toContain("Came from");
      expect(message).toBe(
        composeAdminOrderMessage({
          orderId: ORDER_ID,
          amountPaid: 746,
          bundle: makeBundle(),
        }),
      );
    }
  });

  it("still names the campaign when no summary survived the trip", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: null,
      utm: { source: "instagram" },
    });

    expect(message).toContain("*Came from*");
    expect(message).toContain("Source: instagram");
    expect(message).toContain("No item or delivery summary");
  });

  it("points at the Cashfree dashboard and states the dispatch window", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle(),
    });

    expect(message).toContain("Cashfree dashboard");
    expect(message).toContain(LEGAL_CONFIG.dispatchWindow);
  });

  it("prints the amount Cashfree reported, never the bundle's own total", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 999,
      bundle: makeBundle({ total: 1 }),
    });

    expect(message).toContain("*Paid:* ₹999");
  });

  it("still identifies the order when no summary survived", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: null,
    });

    expect(message).toContain(ORDER_ID);
    expect(message).toContain("*Paid:* ₹746");
    expect(message).toContain("Cashfree dashboard");
    expect(message).not.toContain("*Deliver to*");
  });

  it("says so rather than inventing a figure when Cashfree reported no amount", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: null,
      bundle: makeBundle(),
    });

    expect(message).toContain("*Paid:* amount unavailable");
  });

  it("uses real newlines, which become %0A once encoded", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle(),
    });

    expect(message).toContain("\n");
    expect(encodeURIComponent(message)).toContain("%0A");
  });
});

describe("the CallMeBot url", () => {
  it("targets the documented endpoint with phone, text and apikey", () => {
    const url = new URL(buildCallMeBotUrl(CREDENTIALS, "hello"));

    expect(`${url.origin}${url.pathname}`).toBe(CALLMEBOT_ENDPOINT);
    expect(url.searchParams.get("phone")).toBe(CREDENTIALS.phone);
    expect(url.searchParams.get("apikey")).toBe(CREDENTIALS.apiKey);
    expect(url.searchParams.get("text")).toBe("hello");
  });

  it("encodes newlines as %0A and round-trips the whole message", () => {
    const message = composeAdminOrderMessage({
      orderId: ORDER_ID,
      amountPaid: 746,
      bundle: makeBundle(),
    });
    const url = buildCallMeBotUrl(CREDENTIALS, message);

    expect(url).toContain("%0A");
    expect(new URL(url).searchParams.get("text")).toBe(message);
  });

  it("escapes the characters that would otherwise start a new parameter", () => {
    const url = buildCallMeBotUrl(CREDENTIALS, "a&apikey=stolen b=1");

    expect(new URL(url).searchParams.get("text")).toBe("a&apikey=stolen b=1");
    expect(new URL(url).searchParams.get("apikey")).toBe(CREDENTIALS.apiKey);
  });
});

describe("reading the CallMeBot credentials", () => {
  const previousPhone = process.env.CALLMEBOT_PHONE;
  const previousKey = process.env.CALLMEBOT_APIKEY;

  afterEach(() => {
    if (previousPhone === undefined) delete process.env.CALLMEBOT_PHONE;
    else process.env.CALLMEBOT_PHONE = previousPhone;

    if (previousKey === undefined) delete process.env.CALLMEBOT_APIKEY;
    else process.env.CALLMEBOT_APIKEY = previousKey;
  });

  it("reads both values when both are set", () => {
    process.env.CALLMEBOT_PHONE = "910000000000";
    process.env.CALLMEBOT_APIKEY = "123456";

    expect(readCallMeBotCredentials()).toEqual(CREDENTIALS);
  });

  it("is null when either is missing, so the feature switches itself off", () => {
    process.env.CALLMEBOT_PHONE = "910000000000";
    delete process.env.CALLMEBOT_APIKEY;
    expect(readCallMeBotCredentials()).toBeNull();

    delete process.env.CALLMEBOT_PHONE;
    process.env.CALLMEBOT_APIKEY = "123456";
    expect(readCallMeBotCredentials()).toBeNull();
  });

  it("treats an empty or whitespace value as unset", () => {
    process.env.CALLMEBOT_PHONE = "   ";
    process.env.CALLMEBOT_APIKEY = "123456";

    expect(readCallMeBotCredentials()).toBeNull();
  });
});

describe("dispatching the admin notification", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
  });

  async function dispatch(
    overrides: Partial<Parameters<typeof dispatchAdminNotification>[0]> = {},
  ) {
    return dispatchAdminNotification({
      verifiedStatus: "PAID",
      message: "hello",
      credentials: CREDENTIALS,
      fetchImpl: fetchMock as unknown as typeof fetch,
      ...overrides,
    });
  }

  it("sends when the server verified the order as PAID", async () => {
    await expect(dispatch()).resolves.toBe("SENT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(CALLMEBOT_ENDPOINT);
  });

  it("sends nothing for any status other than PAID", async () => {
    for (const status of ["PENDING", "FAILED", "NOT_FOUND"] as const) {
      await expect(dispatch({ verifiedStatus: status })).resolves.toBe("SKIPPED_NOT_PAID");
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the status before the credentials, so a spoofed order never reaches CallMeBot", async () => {
    await expect(
      dispatch({ verifiedStatus: "PENDING", credentials: null }),
    ).resolves.toBe("SKIPPED_NOT_PAID");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips silently when the keys are not configured", async () => {
    await expect(dispatch({ credentials: null })).resolves.toBe(
      "SKIPPED_NOT_CONFIGURED",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a non-200 from CallMeBot as a failure, without throwing", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(dispatch()).resolves.toBe("FAILED");
  });

  it("swallows a network error rather than rejecting", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(dispatch()).resolves.toBe("FAILED");
  });

  it("swallows a timeout rather than rejecting", async () => {
    fetchMock.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));

    await expect(dispatch()).resolves.toBe("FAILED");
  });

  it("gives CallMeBot a short leash, well under the gateway timeout", async () => {
    expect(CALLMEBOT_TIMEOUT_MS).toBe(5_000);

    await dispatch();
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(requestInit.signal).toBeDefined();
  });
});
