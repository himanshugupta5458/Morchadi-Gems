/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem, CheckoutData } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { CHECKOUT_STORAGE_KEY, parseCheckoutData } from "@/lib/checkout";
import type { CodEligibilityEntry } from "@/lib/cod";
import { DELIVERY_ESTIMATE_LINE, LEGAL_CONFIG } from "@/lib/config";
import { GIFT_MESSAGE_MAX_LENGTH } from "@/lib/gift-message";
import { PaymentCheckout } from "@/components/PaymentCheckout";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-testid="image">{alt}</span>,
}));

const NECKLACE: CatalogueEntry = {
  id: "nk-001",
  name: "Kundan Rani Haar",
  category: "necklaces",
  price: 1000,
  mrp: 1500,
  image: "/products/nk-001.webp",
  inStock: true,
};

const CATALOGUE: CatalogueEntry[] = [NECKLACE];

const ALL_ELIGIBLE: CodEligibilityEntry[] = [{ id: "nk-001", minPrepaidAmount: 0 }];
const REQUIRES_PREPAYMENT: CodEligibilityEntry[] = [
  { id: "nk-001", minPrepaidAmount: 300 },
];

const STORED_ADDRESS: CheckoutData = {
  cart: [
    {
      productId: "nk-001",
      name: "Kundan Rani Haar",
      price: 1000,
      image: "/products/nk-001.webp",
      qty: 1,
    },
  ],
  address: {
    name: "Ananya Iyer",
    phone: "9876543210",
    email: "ananya@example.com",
    line1: "12 Rosewood Apartments",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
  },
  subtotal: 1000,
  shipping: 0,
  total: 1000,
};

function seedCart(items: Partial<CartItem>[] = [{}]): void {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify(
      items.map((item) => ({
        productId: "nk-001",
        name: "snapshot",
        price: 1,
        image: "",
        qty: 1,
        ...item,
      })),
    ),
  );
}

async function renderPaymentStep(
  codCatalogue: readonly CodEligibilityEntry[],
): Promise<void> {
  await act(async () => {
    render(
      <CartProvider catalogue={CATALOGUE}>
        <PaymentCheckout codCatalogue={codCatalogue} />
      </CartProvider>,
    );
  });
}

function payButton(): HTMLElement {
  return screen.getByRole("button", { name: /Pay|Place order/ });
}

function readRequestBody(): Record<string, unknown> {
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  return JSON.parse(String(fetchMock.mock.calls[0][1].body));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  pushMock.mockClear();
  seedCart();
  window.sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(STORED_ADDRESS));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the payment step for a cart that may be sold on delivery", () => {
  it("offers cash on delivery beside paying in full, and defaults to paying in full", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    expect(screen.getByLabelText(/Cash on delivery/)).toBeDefined();
    expect(screen.getByLabelText(/Pay in full/)).toBeDefined();
    expect(screen.queryByLabelText(/Pay minimum now/)).toBeNull();

    expect((screen.getByLabelText(/Pay in full/) as HTMLInputElement).checked).toBe(true);
    expect(payButton().textContent).toContain("Pay ₹950 with Cashfree");
  });

  it("names what will be collected at the door once cash on delivery is chosen", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    fireEvent.click(screen.getByLabelText(/Cash on delivery/));

    expect(payButton().textContent).toContain("Place order and pay ₹1,000 on delivery");
  });

  it("shows a 'Save 5%' note and the discounted amount on paying in full, on a cash-on-delivery-eligible cart", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    const payInFullRow = screen.getByLabelText(/Pay in full/).closest("div");
    expect(payInFullRow?.textContent).toContain("Save 5%");
    expect(payInFullRow?.textContent).toContain("₹950");
  });

  it("reflects the online discount live in the Order Summary, and drops it the instant cash on delivery is chosen", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    expect(screen.getByText("Online payment discount (5%)")).toBeDefined();
    expect(screen.getByText("−₹50")).toBeDefined();

    fireEvent.click(screen.getByLabelText(/Cash on delivery/));

    expect(screen.queryByText("Online payment discount (5%)")).toBeNull();
    expect(screen.queryByText("−₹50")).toBeNull();
  });

  it("sends the chosen path and goes straight to confirmation without loading Cashfree", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        paymentType: "cod",
        codOrderReference: "COD_1787000000000_abcdefgh",
        trackingId: "W2ACEHACUU",
        amountPrepaid: 0,
        amountDue: 1000,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderPaymentStep(ALL_ELIGIBLE);
    fireEvent.click(screen.getByLabelText(/Cash on delivery/));
    await act(async () => {
      fireEvent.click(payButton());
    });

    expect(readRequestBody().paymentPath).toBe("cod");
    expect(pushMock).toHaveBeenCalledWith(
      "/order-confirmation?order_id=COD_1787000000000_abcdefgh",
    );

    const stamped = parseCheckoutData(
      window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY),
    );
    expect(stamped?.orderId).toBe("COD_1787000000000_abcdefgh");
    expect(stamped?.trackingId).toBe("W2ACEHACUU");
    expect(stamped?.amountDue).toBe(1000);
  });
});

describe("the payment step for a cart holding a piece that requires prepayment", () => {
  it("offers the minimum against the full amount, and never cash on delivery", async () => {
    await renderPaymentStep(REQUIRES_PREPAYMENT);

    expect(screen.getByLabelText(/Pay minimum now/)).toBeDefined();
    expect(screen.getByLabelText(/Pay in full/)).toBeDefined();
    expect(screen.queryByLabelText(/Cash on delivery/)).toBeNull();
  });

  /**
   * The online-payment discount is completely unaffected by the partial-payment path — the
   * regression this test exists to pin down. "Pay in full" here means "pay the whole amount
   * online instead of paying the minimum", not "the simple cash-on-delivery-vs-online choice",
   * and it never earns the 5% ([ADR-063](/docs/decisions/ADR-063-online-payment-discount.md)).
   */
  it("never discounts paying in full on a cart that requires prepayment", async () => {
    await renderPaymentStep(REQUIRES_PREPAYMENT);

    const payInFullRow = screen.getByLabelText(/Pay in full/).closest("div");
    expect(payInFullRow?.textContent).not.toContain("Save");
    expect(payInFullRow?.textContent).toContain("₹1,000");

    expect(screen.queryByText(/Online payment discount/)).toBeNull();

    fireEvent.click(screen.getByLabelText(/Pay in full/));
    expect(payButton().textContent).toContain("Pay ₹1,000 with Cashfree");
  });

  it("quotes the floor as the amount now and says the balance is collected separately", async () => {
    await renderPaymentStep(REQUIRES_PREPAYMENT);

    const minimum = screen.getByLabelText(/Pay minimum now/);
    expect(minimum.parentElement?.textContent).toContain("₹300");
    expect(minimum.parentElement?.textContent).toContain(
      "The remaining ₹700 is due before delivery and is collected separately",
    );

    fireEvent.click(minimum);
    expect(payButton().textContent).toContain("Pay ₹300 with Cashfree");
  });

  it("multiplies the floor by the quantity, because the field is per unit", async () => {
    cleanup();
    seedCart([{ qty: 3 }]);
    await renderPaymentStep(REQUIRES_PREPAYMENT);

    fireEvent.click(screen.getByLabelText(/Pay minimum now/));
    expect(payButton().textContent).toContain("Pay ₹900 with Cashfree");
  });

  it("still hands a part payment to Cashfree rather than skipping it", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        paymentType: "partial_cod",
        cashfreeOrderId: "MG_1787000000000_abcdefgh",
        trackingId: "W2ACEHACUU",
        paymentSessionId: "session_partial",
        amountPrepaid: 300,
        amountDue: 700,
        mode: "sandbox",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderPaymentStep(REQUIRES_PREPAYMENT);
    fireEvent.click(screen.getByLabelText(/Pay minimum now/));
    await act(async () => {
      fireEvent.click(payButton());
    });

    expect(readRequestBody().paymentPath).toBe("partial");
    expect(pushMock).not.toHaveBeenCalled();

    const stamped = parseCheckoutData(
      window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY),
    );
    expect(stamped?.amountPrepaid).toBe(300);
    expect(stamped?.amountDue).toBe(700);
  });
});

/**
 * A floor at or above the total makes the two options charge the same amount, so the choice is
 * withdrawn rather than shown as two identical buttons.
 */
describe("the payment step when the floor has reached the order total", () => {
  it("offers no choice at all and behaves exactly as it did before choices existed", async () => {
    await renderPaymentStep([{ id: "nk-001", minPrepaidAmount: 5000 }]);

    expect(screen.queryByLabelText(/Pay minimum now/)).toBeNull();
    expect(screen.queryByLabelText(/Cash on delivery/)).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(payButton().textContent).toContain("Pay ₹1,000 with Cashfree");
  });
});

/**
 * What the payment step says, as distinct from what it charges.
 *
 * Three of these are removals, and removals are what a test suite is worst at noticing: the
 * second sentence of the security paragraph, the free-shipping nudge, and the full-width
 * "Continue shopping" twin of the pay button. The fourth is the saving line, which is a second
 * *rendering* of `onlineDiscount` and must never become a second computation of it — so it is
 * checked against the same figure the summary's discount row shows. See
 * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */
describe("what the payment step tells a shopper", () => {
  it("keeps the short security sentence and drops the explanation that followed it", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    expect(
      screen.getByText(
        "Payment is handled by Cashfree on their secure page. We never see your card or UPI details.",
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain(
      "every amount below is confirmed by our server",
    );
  });

  it("carries no free-shipping nudge, this late in the funnel", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    expect(document.body.textContent).not.toContain("for free shipping");
  });

  it("reinforces the online saving with the same figure the discount row shows", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    expect(screen.getByText("Online payment discount (5%)")).toBeTruthy();
    expect(screen.getByText("−₹50")).toBeTruthy();
    expect(
      screen.getByText("You are saving ₹50 on this order by paying online."),
    ).toBeTruthy();
  });

  it("withdraws the saving line the moment cash on delivery is chosen", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    fireEvent.click(screen.getByLabelText(/Cash on delivery/));

    expect(document.body.textContent).not.toContain("by paying online");
  });

  it("says nothing about saving on a cart that earns no discount", async () => {
    await renderPaymentStep(REQUIRES_PREPAYMENT);

    expect(document.body.textContent).not.toContain("by paying online");
  });

  it("states the delivery estimate and the trust points, and names no logo it does not have", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    expect(screen.getByText(DELIVERY_ESTIMATE_LINE)).toBeTruthy();
    expect(screen.getByText("UPI")).toBeTruthy();
    expect(screen.getByText("Cards")).toBeTruthy();
    expect(
      screen.getByText(`Secure checkout via ${LEGAL_CONFIG.paymentProvider}`),
    ).toBeTruthy();
  });
});

describe("the gift note", () => {
  it("offers a free-text field, capped at the length the column holds", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    const field = screen.getByLabelText(/Gift message or note for us/) as HTMLTextAreaElement;

    expect(field.maxLength).toBe(GIFT_MESSAGE_MAX_LENGTH);
    expect(document.body.textContent).toContain(
      `${GIFT_MESSAGE_MAX_LENGTH} characters left`,
    );
  });

  it("travels in the create-order request, and changes no amount in it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        paymentType: "prepaid",
        cashfreeOrderId: "MG_1786968394909_v8j3wggq",
        trackingId: "W2ACEHACUU",
        paymentSessionId: "session_gift",
        amountPrepaid: 950,
        amountDue: 0,
        mode: "sandbox",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderPaymentStep(ALL_ELIGIBLE);

    fireEvent.change(screen.getByLabelText(/Gift message or note for us/), {
      target: { value: "Please gift wrap it." },
    });

    await act(async () => {
      fireEvent.click(payButton());
    });

    const body = readRequestBody();
    expect(body.giftMessage).toBe("Please gift wrap it.");
    expect(body).not.toHaveProperty("total");
    expect(body).not.toHaveProperty("subtotal");
    expect(body).not.toHaveProperty("amount");
    expect(body.items).toEqual([{ productId: "nk-001", qty: 1 }]);
  });

  it("is left out of the request entirely when nothing was typed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        paymentType: "prepaid",
        cashfreeOrderId: "MG_1786968394909_v8j3wggq",
        trackingId: "W2ACEHACUU",
        paymentSessionId: "session_no_gift",
        amountPrepaid: 950,
        amountDue: 0,
        mode: "sandbox",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await renderPaymentStep(ALL_ELIGIBLE);

    await act(async () => {
      fireEvent.click(payButton());
    });

    expect(readRequestBody()).not.toHaveProperty("giftMessage");
  });
});
