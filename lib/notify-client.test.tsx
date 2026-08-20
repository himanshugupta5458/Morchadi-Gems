/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutData } from "@/types/cart";
import type { CashfreePaymentSummary } from "@/types/order";
import { NOTIFY_ADMIN_API_PATH } from "@/lib/navigation";
import {
  buildNotifiedFlagKey,
  hasNotifiedAdmin,
  markAdminNotified,
  notifyAdminOfPaidOrder,
} from "@/lib/notify-client";

const ORDER_ID = "MG_1786968394909_v8j3wggq";
const OTHER_ORDER_ID = "MG_1786968300000_aaaaaaaa";

const PAID: CashfreePaymentSummary = { orderId: ORDER_ID, status: "PAID", amount: 746 };

const BUNDLE: CheckoutData = {
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
  address: {
    name: "Ananya Iyer",
    phone: "9876543210",
    email: "ananya@example.com",
    line1: "12 Rani Bagh",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
  },
  subtotal: 398,
  shipping: 99,
  total: 497,
};

const fetchMock = vi.fn();

function sentBody(callIndex = 0): Record<string, unknown> {
  const requestInit = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(String(requestInit.body)) as Record<string, unknown>;
}

beforeEach(() => {
  window.sessionStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the notified flag", () => {
  it("is keyed per order, so a second order in the same tab still notifies", () => {
    markAdminNotified(ORDER_ID);

    expect(hasNotifiedAdmin(ORDER_ID)).toBe(true);
    expect(hasNotifiedAdmin(OTHER_ORDER_ID)).toBe(false);
    expect(buildNotifiedFlagKey(ORDER_ID)).not.toBe(buildNotifiedFlagKey(OTHER_ORDER_ID));
  });

  it("reads false when nothing has been recorded", () => {
    expect(hasNotifiedAdmin(ORDER_ID)).toBe(false);
  });
});

describe("notifying the admin of a paid order", () => {
  it("posts the order id and the summary to our own route", () => {
    notifyAdminOfPaidOrder(PAID, BUNDLE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(NOTIFY_ADMIN_API_PATH);

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(requestInit.method).toBe("POST");
    expect(sentBody()).toEqual({ orderId: ORDER_ID, summary: BUNDLE });
  });

  it("carries the chosen variant through to the server", () => {
    notifyAdminOfPaidOrder(PAID, BUNDLE);

    const summary = sentBody().summary as CheckoutData;
    expect(summary.cart[0].selectedOptions).toEqual({ Letter: "A" });
  });

  it("still reports the order when no summary survived", () => {
    notifyAdminOfPaidOrder(PAID, null);

    expect(sentBody()).toEqual({ orderId: ORDER_ID });
  });

  it("sends once, however many times a confirmed order is re-rendered", () => {
    notifyAdminOfPaidOrder(PAID, BUNDLE);
    notifyAdminOfPaidOrder(PAID, BUNDLE);
    notifyAdminOfPaidOrder(PAID, BUNDLE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send again after a refresh, because the flag outlives the bundle", () => {
    notifyAdminOfPaidOrder(PAID, BUNDLE);
    fetchMock.mockClear();

    notifyAdminOfPaidOrder(PAID, null);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the order before the request goes out, not after it succeeds", () => {
    fetchMock.mockImplementation(() => {
      expect(hasNotifiedAdmin(ORDER_ID)).toBe(true);
      return Promise.resolve({ ok: true, status: 200 });
    });

    notifyAdminOfPaidOrder(PAID, BUNDLE);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("notifies separately for a different order", () => {
    notifyAdminOfPaidOrder(PAID, BUNDLE);
    notifyAdminOfPaidOrder({ ...PAID, orderId: OTHER_ORDER_ID }, BUNDLE);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends nothing for an order the server did not confirm as paid", () => {
    for (const status of ["PENDING", "FAILED", "NOT_FOUND"] as const) {
      notifyAdminOfPaidOrder({ ...PAID, status }, BUNDLE);
    }

    expect(fetchMock).not.toHaveBeenCalled();
    expect(hasNotifiedAdmin(ORDER_ID)).toBe(false);
  });
});

describe("the notification never reaching the customer", () => {
  it("returns undefined, so no caller can await it", () => {
    expect(notifyAdminOfPaidOrder(PAID, BUNDLE)).toBeUndefined();
  });

  it("does not throw when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    expect(() => notifyAdminOfPaidOrder(PAID, BUNDLE)).not.toThrow();
    await Promise.resolve();
  });

  it("does not throw when fetch throws synchronously", () => {
    fetchMock.mockImplementation(() => {
      throw new Error("blocked by an extension");
    });

    expect(() => notifyAdminOfPaidOrder(PAID, BUNDLE)).not.toThrow();
  });

  it("does not throw when sessionStorage is unavailable", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });

    expect(() => notifyAdminOfPaidOrder(PAID, BUNDLE)).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
