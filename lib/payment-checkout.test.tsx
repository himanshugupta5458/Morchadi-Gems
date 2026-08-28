/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem, CheckoutData } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { CHECKOUT_STORAGE_KEY, parseCheckoutData } from "@/lib/checkout";
import type { CodEligibilityEntry } from "@/lib/cod";
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
    expect(payButton().textContent).toContain("Pay ₹1,000 with Cashfree");
  });

  it("names what will be collected at the door once cash on delivery is chosen", async () => {
    await renderPaymentStep(ALL_ELIGIBLE);

    fireEvent.click(screen.getByLabelText(/Cash on delivery/));

    expect(payButton().textContent).toContain("Place order and pay ₹1,000 on delivery");
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
