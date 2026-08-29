import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, CheckoutData } from "@/types/cart";
import type { CodOrderMessageInput } from "@/lib/notify-message";
import {
  RESEND_TIMEOUT_MS,
  dispatchOrderConfirmationEmail,
  sendCodOrderConfirmationEmail,
  sendCustomerEmail,
  type ResendSendFn,
  type ResendSendResult,
} from "@/lib/notify-customer-email";

const TRACKING_ID = "K7M2QPX9RJ";
const COD_REFERENCE = "COD_1786968394909_v8j3wggq";
const CASHFREE_ORDER_ID = "MG_1786968394909_v8j3wggq";
const TRACKING_URL = "https://morchadigems.com/track?order_id=K7M2QPX9RJ";
const API_KEY = "re_test_key";
const CREATED_AT = new Date("2026-08-25T10:00:00Z");

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

function makeCodOrder(overrides: Partial<CodOrderMessageInput> = {}): CodOrderMessageInput {
  return {
    trackingId: TRACKING_ID,
    codOrderReference: COD_REFERENCE,
    amountDue: 746,
    subtotal: 647,
    shipping: 99,
    total: 746,
    items: [{ name: "Wave Band Initial Ring", qty: 2, selectedOptions: { Letter: "A" } }],
    address: ADDRESS,
    ...overrides,
  };
}

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
    ],
    address: ADDRESS,
    subtotal: 647,
    shipping: 99,
    total: 746,
    ...overrides,
  };
}

function okSendResult(): ResendSendResult {
  return { data: { id: "email_123" }, error: null };
}

describe("sending a customer email", () => {
  let sendImpl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendImpl = vi.fn().mockResolvedValue(okSendResult());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("sends exactly once, from the shop's verified address", async () => {
    await expect(
      sendCustomerEmail({
        to: "ananya@example.com",
        subject: "Your order is confirmed",
        html: "<p>hi</p>",
        apiKey: API_KEY,
        sendImpl: sendImpl as unknown as ResendSendFn,
      }),
    ).resolves.toBe("SENT");

    expect(sendImpl).toHaveBeenCalledTimes(1);
    const payload = sendImpl.mock.calls[0][0];
    expect(payload.to).toBe("ananya@example.com");
    expect(payload.from).toContain("orders@updates.morchadijewels.com");
  });

  it("skips silently when there is no Resend key configured", async () => {
    await expect(
      sendCustomerEmail({
        to: "ananya@example.com",
        subject: "s",
        html: "h",
        apiKey: null,
        sendImpl: sendImpl as unknown as ResendSendFn,
      }),
    ).resolves.toBe("SKIPPED_NOT_CONFIGURED");

    expect(sendImpl).not.toHaveBeenCalled();
  });

  it("skips, rather than errors, when there is no address to send to", async () => {
    for (const to of ["", "   "]) {
      await expect(
        sendCustomerEmail({
          to,
          subject: "s",
          html: "h",
          apiKey: API_KEY,
          sendImpl: sendImpl as unknown as ResendSendFn,
        }),
      ).resolves.toBe("SKIPPED_NO_EMAIL");
    }

    expect(sendImpl).not.toHaveBeenCalled();
  });

  it("reports an error Resend returns as a failure, without throwing", async () => {
    sendImpl.mockResolvedValue({ data: null, error: { message: "invalid domain" } });

    await expect(
      sendCustomerEmail({
        to: "ananya@example.com",
        subject: "s",
        html: "h",
        apiKey: API_KEY,
        sendImpl: sendImpl as unknown as ResendSendFn,
      }),
    ).resolves.toBe("FAILED");
  });

  it("swallows a rejected send rather than throwing", async () => {
    sendImpl.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      sendCustomerEmail({
        to: "ananya@example.com",
        subject: "s",
        html: "h",
        apiKey: API_KEY,
        sendImpl: sendImpl as unknown as ResendSendFn,
      }),
    ).resolves.toBe("FAILED");
  });

  it("gives Resend a short, finite leash rather than waiting forever", async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<ResendSendResult>(() => undefined);
    sendImpl.mockReturnValue(neverResolves);

    const outcome = sendCustomerEmail({
      to: "ananya@example.com",
      subject: "s",
      html: "h",
      apiKey: API_KEY,
      sendImpl: sendImpl as unknown as ResendSendFn,
    });

    await vi.advanceTimersByTimeAsync(RESEND_TIMEOUT_MS);
    await expect(outcome).resolves.toBe("FAILED");
  });
});

describe("emailing the customer for a cash-on-delivery order", () => {
  let sendImpl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendImpl = vi.fn().mockResolvedValue(okSendResult());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  async function send(overrides: Partial<CodOrderMessageInput> = {}) {
    return sendCodOrderConfirmationEmail(makeCodOrder(overrides), {
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
      apiKey: API_KEY,
      sendImpl: sendImpl as unknown as ResendSendFn,
    });
  }

  it("makes exactly one attempt, addressed to the shopper", async () => {
    await expect(send()).resolves.toBe("SENT");

    expect(sendImpl).toHaveBeenCalledTimes(1);
    expect(sendImpl.mock.calls[0][0].to).toBe(ADDRESS.email);
  });

  it("says nothing has been paid, in a message honest about being cash-on-delivery", async () => {
    await send();

    const html = sendImpl.mock.calls[0][0].html as string;
    expect(html).toContain("Nothing has been paid yet");

    const subject = sendImpl.mock.calls[0][0].subject as string;
    expect(subject.toLowerCase()).toContain("cash-on-delivery");
  });

  it("skips gracefully when the address carries no email", async () => {
    await expect(
      sendCodOrderConfirmationEmail(makeCodOrder({ address: { ...ADDRESS, email: "" } }), {
        trackingUrl: TRACKING_URL,
        createdAt: CREATED_AT,
        apiKey: API_KEY,
        sendImpl: sendImpl as unknown as ResendSendFn,
      }),
    ).resolves.toBe("SKIPPED_NO_EMAIL");

    expect(sendImpl).not.toHaveBeenCalled();
  });

  it("does not throw when the send fails, and reports the failure", async () => {
    sendImpl.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(send()).resolves.toBe("FAILED");
  });
});

describe("dispatching the customer email for a paid or partially-paid order", () => {
  let sendImpl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendImpl = vi.fn().mockResolvedValue(okSendResult());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  async function dispatch(
    overrides: Partial<Parameters<typeof dispatchOrderConfirmationEmail>[0]> = {},
  ) {
    return dispatchOrderConfirmationEmail(
      {
        verifiedStatus: "PAID",
        trackingId: TRACKING_ID,
        cashfreeOrderId: CASHFREE_ORDER_ID,
        amountPaid: 746,
        amountDue: 0,
        bundle: makeBundle(),
        ...overrides,
      },
      {
        trackingUrl: TRACKING_URL,
        createdAt: CREATED_AT,
        apiKey: API_KEY,
        sendImpl: sendImpl as unknown as ResendSendFn,
      },
    );
  }

  it("sends when the server verified the order as PAID", async () => {
    await expect(dispatch()).resolves.toBe("SENT");
    expect(sendImpl).toHaveBeenCalledTimes(1);
    expect(sendImpl.mock.calls[0][0].to).toBe(ADDRESS.email);
  });

  it("sends nothing for any status other than PAID, so a spoofed order reaches no inbox", async () => {
    for (const status of ["PENDING", "FAILED", "NOT_FOUND"] as const) {
      await expect(dispatch({ verifiedStatus: status })).resolves.toBe("SKIPPED_NOT_PAID");
    }

    expect(sendImpl).not.toHaveBeenCalled();
  });

  it("skips gracefully when there is no summary to take an address from", async () => {
    await expect(dispatch({ bundle: null })).resolves.toBe("SKIPPED_NO_EMAIL");
    expect(sendImpl).not.toHaveBeenCalled();
  });

  it("does not throw when the send fails, and the order is unaffected", async () => {
    sendImpl.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(dispatch()).resolves.toBe("FAILED");
  });
});
