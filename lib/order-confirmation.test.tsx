/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem, CheckoutData } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { CHECKOUT_STORAGE_KEY } from "@/lib/checkout";
import { NOTIFY_ADMIN_API_PATH } from "@/lib/navigation";
import { UTM_STORAGE_KEY } from "@/lib/utm";
import { MAX_VERIFY_ATTEMPTS, PENDING_POLL_INTERVAL_MS } from "@/lib/verify";
import { OrderConfirmation } from "@/components/OrderConfirmation";

let currentSearch = "";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...anchorProps
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...anchorProps}>
      {children}
    </a>
  ),
}));

const ORDER_ID = "MG_1786968394909_v8j3wggq";
const OTHER_ORDER_ID = "MG_1786968300000_aaaaaaaa";

/** The ten-character `orders.id` the shopper is shown, and one belonging to another order. */
const TRACKING_ID = "W2ACEHACUU";
const OTHER_TRACKING_ID = "4KQPMR7TDX";

const NECKLACE: CatalogueEntry = {
  id: "nk-001",
  name: "Kundan Rani Haar",
  price: 1000,
  mrp: 1500,
  image: "/products/nk-001.webp",
  inStock: true,
};

const CATALOGUE: CatalogueEntry[] = [NECKLACE];

const CART_ITEM: CartItem = {
  productId: NECKLACE.id,
  name: NECKLACE.name,
  price: NECKLACE.price,
  image: NECKLACE.image ?? "",
  qty: 2,
};

function makeBundle(overrides: Partial<CheckoutData> = {}): CheckoutData {
  return {
    cart: [CART_ITEM],
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

function seedCart(): void {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([CART_ITEM]));
}

function seedBundle(bundle: CheckoutData): void {
  window.sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(bundle));
}

function storedCartItemCount(): number {
  const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
  return rawCart === null ? 0 : (JSON.parse(rawCart) as CartItem[]).length;
}

/**
 * A hand-built stand-in rather than a real `Response`: reading a real body is asynchronous in a
 * way fake timers cannot drive, which is what the bounded-poll test needs.
 */
interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

const fetchMock = vi.fn<(input: string) => Promise<FakeResponse>>();

function respondWith(...responses: FakeResponse[]): void {
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
}

function jsonResponse(status: number, body: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

function verified(status: string, amount: number | null, orderId = ORDER_ID): FakeResponse {
  return jsonResponse(200, { orderId, status, amount });
}

/**
 * A confirmed order makes the page talk to two routes: it verifies, and then it reports the
 * paid order for the admin WhatsApp. Counting them apart keeps the polling assertions about
 * polling — the notification is fire-and-forget and its own tests cover it.
 */
function verifyCalls(): unknown[][] {
  return fetchMock.mock.calls.filter((call) =>
    String(call[0]).startsWith("/api/verify-order"),
  );
}

function notifyCalls(): unknown[][] {
  return fetchMock.mock.calls.filter((call) => String(call[0]) === NOTIFY_ADMIN_API_PATH);
}

async function renderConfirmation(search: string): Promise<void> {
  currentSearch = search;
  await act(async () => {
    render(
      <CartProvider catalogue={CATALOGUE}>
        <OrderConfirmation />
      </CartProvider>,
    );
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("/order-confirmation — an unusable link", () => {
  it("explains rather than crashing when there is no order_id", async () => {
    await renderConfirmation("");

    expect(screen.getByText("That link is missing an order")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an order_id that is not one of ours, without asking the server", async () => {
    await renderConfirmation("order_id=../../pg/orders");

    expect(screen.getByText("That link is missing an order")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers the shop and the cart as ways out", async () => {
    await renderConfirmation("order_id=nonsense");

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs).toContain("/shop");
    expect(hrefs).toContain("/cart");
  });
});

describe("/order-confirmation — while verification is in flight", () => {
  it("shows a verifying state and no outcome", async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {}));
    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Confirming your payment")).toBeTruthy();
    expect(screen.queryByText("Your order is confirmed")).toBeNull();
    expect(screen.queryByText("Your payment was not completed")).toBeNull();
  });
});

describe("/order-confirmation — PAID", () => {
  it("shows the order number, the server's amount, and the delivery estimate", async () => {
    seedCart();
    seedBundle(makeBundle({ orderId: ORDER_ID, trackingId: TRACKING_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(screen.getByText("Your order number")).toBeTruthy();
    expect(screen.getByText(TRACKING_ID)).toBeTruthy();
    expect(screen.getAllByText("₹2,099").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(
        "Dispatch within 2 business days · Delivery within 7 business days",
      ),
    ).toBeTruthy();
  });

  it("shows the amount the server reported, not the amount the bundle stored", async () => {
    seedBundle(makeBundle({ total: 999_999 }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("₹2,099")).toBeTruthy();
    expect(screen.queryByText("₹9,99,999")).toBeNull();
  });

  it("decorates the success with the bundle's items and address", async () => {
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("What you ordered")).toBeTruthy();
    expect(screen.getByText("Kundan Rani Haar")).toBeTruthy();
    expect(screen.getByText("Delivering to")).toBeTruthy();
    expect(screen.getByText("Ananya Iyer")).toBeTruthy();
  });

  it("lists what was chosen on each personalized line", async () => {
    seedBundle(
      makeBundle({
        orderId: ORDER_ID,
        cart: [
          { ...CART_ITEM, productId: "P001", name: "Wave Band Initial Ring", qty: 1, selectedOptions: { Letter: "A" } },
          { ...CART_ITEM, productId: "P001", name: "Wave Band Initial Ring", qty: 1, selectedOptions: { Letter: "B" } },
          CART_ITEM,
        ],
      }),
    );
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Letter: A")).toBeTruthy();
    expect(screen.getByText("Letter: B")).toBeTruthy();
    expect(screen.getAllByText("Wave Band Initial Ring")).toHaveLength(2);
  });

  it("offers no Edit link on the delivered-to address once the order is paid", async () => {
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.queryByText("Edit")).toBeNull();
  });

  it("clears the cart and the bundle", async () => {
    seedCart();
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(storedCartItemCount()).toBe(0);
    expect(window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY)).toBeNull();
  });

  it("shows the same success on a refresh, with the bundle already gone", async () => {
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(screen.getByText(ORDER_ID)).toBeTruthy();
    expect(screen.getByText("Payment reference")).toBeTruthy();
    expect(screen.getByText("₹2,099")).toBeTruthy();
    expect(screen.queryByText("What you ordered")).toBeNull();
    expect(storedCartItemCount()).toBe(0);
  });

  it("succeeds generically when the stored bundle is corrupt", async () => {
    window.sessionStorage.setItem(CHECKOUT_STORAGE_KEY, "{not json");
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(screen.queryByText("What you ordered")).toBeNull();
  });

  it("hides a bundle left over from a different order", async () => {
    seedBundle(makeBundle({ orderId: OTHER_ORDER_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(screen.queryByText("What you ordered")).toBeNull();
    expect(screen.queryByText("Kundan Rani Haar")).toBeNull();
  });

  it("hides a bundle whose total does not reconcile with the amount paid", async () => {
    seedBundle(makeBundle({ total: 4099 }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(screen.queryByText("What you ordered")).toBeNull();
  });

  it("still confirms when Cashfree reported no readable amount", async () => {
    respondWith(verified("PAID", null));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(screen.queryByText("Amount paid")).toBeNull();
  });

  it("points Continue shopping at the shop", async () => {
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Continue shopping").getAttribute("href")).toBe("/shop");
  });
});

describe("/order-confirmation — telling the owner about a paid order", () => {
  function notifiedBody(): Record<string, unknown> {
    const requestInit = notifyCalls()[0][1] as RequestInit;
    return JSON.parse(String(requestInit.body)) as Record<string, unknown>;
  }

  function seedFirstTouch(capturedAt: string): void {
    window.localStorage.setItem(
      UTM_STORAGE_KEY,
      JSON.stringify({
        source: "instagram",
        medium: "paid_social",
        campaign: "rakhi_2026",
        capturedAt,
      }),
    );
  }

  it("carries the stored campaign so the owner sees where the order came from", async () => {
    seedCart();
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    seedFirstTouch(new Date().toISOString());
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(notifiedBody().utm).toEqual({
      source: "instagram",
      medium: "paid_social",
      campaign: "rakhi_2026",
    });
  });

  it("sends no campaign field at all when the browser has no first touch", async () => {
    seedCart();
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(notifiedBody()).not.toHaveProperty("utm");
  });

  it("sends no campaign once the attribution window has passed", async () => {
    seedCart();
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    seedFirstTouch(new Date(Date.now() - 91 * 86_400_000).toISOString());
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(notifiedBody()).not.toHaveProperty("utm");
  });

  it("reports the paid order with the items, their choices and the address", async () => {
    seedCart();
    seedBundle(
      makeBundle({
        orderId: ORDER_ID,
        cart: [{ ...CART_ITEM, selectedOptions: { Letter: "A" } }],
      }),
    );
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(notifyCalls()).toHaveLength(1);

    const body = notifiedBody();
    const summary = body.summary as CheckoutData;
    expect(body.orderId).toBe(ORDER_ID);
    expect(summary.cart[0].selectedOptions).toEqual({ Letter: "A" });
    expect(summary.address.name).toBe("Ananya Iyer");
    expect(summary.address.pincode).toBe("302001");
  });

  it("catches the bundle before it is cleared, not after", async () => {
    seedCart();
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(notifiedBody().summary).toBeDefined();
    expect(window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY)).toBeNull();
  });

  it("tells nobody about an order that was not paid", async () => {
    for (const status of ["PENDING", "FAILED", "NOT_FOUND"]) {
      cleanup();
      fetchMock.mockReset();
      respondWith(verified(status, 2099));

      await renderConfirmation(`order_id=${ORDER_ID}`);

      expect(notifyCalls(), status).toHaveLength(0);
    }
  });

  it("does not report the same order twice on a refresh", async () => {
    respondWith(verified("PAID", 2099));
    await renderConfirmation(`order_id=${ORDER_ID}`);
    expect(notifyCalls()).toHaveLength(1);

    cleanup();
    fetchMock.mockReset();
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(notifyCalls()).toHaveLength(0);
  });

  it("still confirms the order, and still clears the cart, when the notification fails", async () => {
    seedCart();
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("PAID", 2099));
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(screen.getByText(ORDER_ID)).toBeTruthy();
    expect(screen.getByText("What you ordered")).toBeTruthy();
    expect(storedCartItemCount()).toBe(0);
    expect(window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY)).toBeNull();
  });

  it("still confirms the order when the notification route itself errors", async () => {
    seedCart();
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("PAID", 2099));
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(500, { error: "boom" })),
    );

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(storedCartItemCount()).toBe(0);
  });
});

describe("/order-confirmation — the ten-character order number", () => {
  it("is the prominent identifier on a confirmed order", async () => {
    seedBundle(makeBundle({ orderId: ORDER_ID, trackingId: TRACKING_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    const heading = screen.getByText("Your order number");
    const shownNumber = screen.getByText(TRACKING_ID);

    expect(heading).toBeTruthy();
    expect(shownNumber.tagName).toBe("STRONG");
    expect(shownNumber.className).toContain("text-heading");
  });

  it("keeps the Cashfree reference, in fine print rather than as the order's name", async () => {
    seedBundle(makeBundle({ orderId: ORDER_ID, trackingId: TRACKING_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText(`Payment reference ${ORDER_ID}`)).toBeTruthy();
    expect(screen.queryByText("Order number")).toBeNull();
  });

  it("names the order on a pending payment too, which is when it is most worth quoting", async () => {
    seedBundle(makeBundle({ orderId: ORDER_ID, trackingId: TRACKING_ID }));
    respondWith(verified("PENDING", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText(`Order number ${TRACKING_ID}`)).toBeTruthy();
  });

  it("names it on a failed payment as well", async () => {
    seedBundle(makeBundle({ orderId: ORDER_ID, trackingId: TRACKING_ID }));
    respondWith(verified("FAILED", null));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(
      screen.getByText(
        `Order number ${TRACKING_ID}. If your bank shows a charge against it, email us at`,
        { exact: false },
      ),
    ).toBeTruthy();
  });

  it("refuses an order number carried by a bundle from a different checkout", async () => {
    seedBundle(makeBundle({ orderId: OTHER_ORDER_ID, trackingId: OTHER_TRACKING_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.queryByText(OTHER_TRACKING_ID)).toBeNull();
    expect(screen.queryByText("Your order number")).toBeNull();
  });

  it("falls back to the Cashfree reference when there is no order number to show", async () => {
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(screen.getByText("Payment reference")).toBeTruthy();
    expect(screen.getByText(ORDER_ID)).toBeTruthy();
    expect(screen.queryByText("Your order number")).toBeNull();
  });

  it("does the same in a footnote when the payment is still settling", async () => {
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("PENDING", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText(`Payment reference ${ORDER_ID}`)).toBeTruthy();
  });
});

describe("/order-confirmation — PENDING", () => {
  it("waits rather than declaring failure, and keeps the cart", async () => {
    seedCart();
    fetchMock.mockResolvedValue(verified("PENDING", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("We are confirming your payment")).toBeTruthy();
    expect(screen.queryByText("Your payment was not completed")).toBeNull();
    expect(storedCartItemCount()).toBe(1);
  });

  it("flips to success when a later poll comes back PAID", async () => {
    vi.useFakeTimers();
    seedCart();
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("PENDING", 2099), verified("PENDING", 2099), verified("PAID", 2099));

    currentSearch = `order_id=${ORDER_ID}`;
    await act(async () => {
      render(
        <CartProvider catalogue={CATALOGUE}>
          <OrderConfirmation />
        </CartProvider>,
      );
    });

    expect(screen.getByText("We are confirming your payment")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_POLL_INTERVAL_MS * 2);
    });

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(verifyCalls()).toHaveLength(3);
    expect(storedCartItemCount()).toBe(0);
    expect(window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY)).toBeNull();
  });

  it("gives up after a bounded number of attempts and offers a manual re-check", async () => {
    vi.useFakeTimers();
    seedCart();
    fetchMock.mockResolvedValue(verified("PENDING", 2099));

    currentSearch = `order_id=${ORDER_ID}`;
    await act(async () => {
      render(
        <CartProvider catalogue={CATALOGUE}>
          <OrderConfirmation />
        </CartProvider>,
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_POLL_INTERVAL_MS * (MAX_VERIFY_ATTEMPTS + 5));
    });

    expect(fetchMock).toHaveBeenCalledTimes(MAX_VERIFY_ATTEMPTS);
    expect(screen.getByText("Your payment is still processing")).toBeTruthy();
    expect(screen.getByText("Check again")).toBeTruthy();
    expect(screen.getByText("admin@morchadigems.com")).toBeTruthy();
    expect(screen.queryByText("Your payment was not completed")).toBeNull();
    expect(storedCartItemCount()).toBe(1);
  });

  it("restarts the poll budget when the shopper checks again", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(verified("PENDING", 2099));

    currentSearch = `order_id=${ORDER_ID}`;
    await act(async () => {
      render(
        <CartProvider catalogue={CATALOGUE}>
          <OrderConfirmation />
        </CartProvider>,
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PENDING_POLL_INTERVAL_MS * MAX_VERIFY_ATTEMPTS);
    });

    fetchMock.mockResolvedValue(verified("PAID", 2099));
    await act(async () => {
      fireEvent.click(screen.getByText("Check again"));
    });

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
  });
});

describe("/order-confirmation — FAILED and NOT_FOUND", () => {
  it("states plainly that the payment was not completed and keeps everything", async () => {
    seedCart();
    seedBundle(makeBundle({ orderId: ORDER_ID }));
    respondWith(verified("FAILED", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Your payment was not completed")).toBeTruthy();
    expect(storedCartItemCount()).toBe(1);
    expect(window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY)).not.toBeNull();
  });

  it("offers a retry back to /payment and a way back to the cart", async () => {
    respondWith(verified("FAILED", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Retry payment").getAttribute("href")).toBe("/payment");
    expect(screen.getByText("Back to cart").getAttribute("href")).toBe("/cart");
  });

  it("distinguishes an order Cashfree has never heard of", async () => {
    seedCart();
    respondWith(verified("NOT_FOUND", null));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("We could not find that order")).toBeTruthy();
    expect(screen.getByText("Retry payment").getAttribute("href")).toBe("/payment");
    expect(storedCartItemCount()).toBe(1);
  });

  it("shows no success screen for any unpaid state", async () => {
    for (const status of ["FAILED", "NOT_FOUND", "PENDING"]) {
      respondWith(verified(status, 2099));
      await renderConfirmation(`order_id=${ORDER_ID}`);

      expect(screen.queryByText("Your order is confirmed")).toBeNull();
      cleanup();
    }
  });
});

describe("/order-confirmation — when our own verification cannot answer", () => {
  it("says it could not confirm, not that the payment failed, and offers a retry", async () => {
    seedCart();
    respondWith(
      jsonResponse(502, {
        error: "VERIFICATION_UNAVAILABLE",
        message: "We could not reach the payment gateway to confirm this order.",
        retryable: true,
      }),
    );

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("We could not confirm your payment just yet")).toBeTruthy();
    expect(screen.queryByText("Your payment was not completed")).toBeNull();
    expect(screen.getByText("Try again")).toBeTruthy();
    expect(storedCartItemCount()).toBe(1);
  });

  it("confirms on a retry that succeeds", async () => {
    respondWith(
      jsonResponse(502, {
        error: "VERIFICATION_UNAVAILABLE",
        message: "We could not reach the payment gateway to confirm this order.",
        retryable: true,
      }),
      verified("PAID", 2099),
    );

    await renderConfirmation(`order_id=${ORDER_ID}`);
    await act(async () => {
      fireEvent.click(screen.getByText("Try again"));
    });

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
  });

  it("reads a missing configuration as a setup problem with no retry", async () => {
    respondWith(
      jsonResponse(503, {
        error: "PAYMENT_NOT_CONFIGURED",
        message: "We cannot confirm payments right now.",
        retryable: false,
      }),
    );

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("Payment confirmation is not set up")).toBeTruthy();
    expect(screen.queryByText("Try again")).toBeNull();
    expect(screen.queryByText("Your payment was not completed")).toBeNull();
  });

  it("treats a network failure the same way, without inventing a verdict", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.getByText("We could not confirm your payment just yet")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("refuses to confirm from a 200 body it cannot recognise", async () => {
    respondWith(new Response(JSON.stringify({ status: "SUCCESS", paid: true }), { status: 200 }));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    expect(screen.queryByText("Your order is confirmed")).toBeNull();
    expect(screen.getByText("We could not confirm your payment just yet")).toBeTruthy();
  });

  it("asks only its own routes, and only about the order in the URL", async () => {
    respondWith(verified("PAID", 2099));

    await renderConfirmation(`order_id=${ORDER_ID}`);

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0]).startsWith("/api/")).toBe(true);
    }

    expect(verifyCalls()).toHaveLength(1);
    expect(verifyCalls()[0][0]).toBe(`/api/verify-order?order_id=${ORDER_ID}`);
    expect(notifyCalls()).toHaveLength(1);
  });
});
