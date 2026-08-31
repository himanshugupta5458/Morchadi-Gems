/** @vitest-environment jsdom */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem, CheckoutData } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { CHECKOUT_STORAGE_KEY } from "@/lib/checkout";
import { CONTACT_CONFIG } from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { OrderConfirmation } from "@/components/OrderConfirmation";

/**
 * The two identifiers in the fine print of the two confirmation screens, and why exactly one of
 * them was removed.
 *
 * The `COD_…` reference is ours. No gateway minted it, no bank statement carries it, and nothing
 * outside this repository can be looked up by it — it is the join key `orders.cashfree_order_id`
 * holds for an order the gateway never saw. Printed under a ten-character order number set in
 * heading type, its only effect was to offer a second thing to quote.
 *
 * The `MG_…` payment reference is Cashfree's. It is what their dashboard is searched by and what
 * a bank dispute is raised against, and on an order whose Postgres capture failed it is the only
 * identifier the shopper has at all (ADR-042). It stays.
 *
 * Both directions are asserted here, in one file, because the risk this change carried was
 * removing the wrong one — or both. See
 * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */

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

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span role="img" aria-label={alt} data-src={src} />
  ),
}));

const COD_REFERENCE = "COD_1786968394909_v8j3wggq";
const PAYMENT_REFERENCE = "MG_1786968394909_v8j3wggq";
const TRACKING_ID = "W2ACEHACUU";
const CUSTOMER_EMAIL = "ananya@example.com";

const NECKLACE: CatalogueEntry = {
  id: "nk-001",
  name: "Kundan Rani Haar",
  category: "necklaces",
  price: 1000,
  mrp: 1500,
  image: "/products/nk-001.webp",
  inStock: true,
};

const CART_ITEM: CartItem = {
  productId: NECKLACE.id,
  name: NECKLACE.name,
  price: NECKLACE.price,
  image: NECKLACE.image ?? "",
  qty: 2,
};

function makeBundle(orderId: string, email = CUSTOMER_EMAIL): CheckoutData {
  return {
    cart: [CART_ITEM],
    address: {
      name: "Ananya Iyer",
      phone: "9876543210",
      email,
      line1: "12 Rani Bagh",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
    },
    subtotal: 2000,
    shipping: 99,
    total: 2099,
    orderId,
    trackingId: TRACKING_ID,
    amountPrepaid: 0,
    amountDue: 2099,
  };
}

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

const fetchMock = vi.fn<(input: string) => Promise<FakeResponse>>();

function jsonResponse(status: number, body: unknown): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

async function renderConfirmation(search: string): Promise<void> {
  currentSearch = search;
  await act(async () => {
    render(
      <CartProvider catalogue={[NECKLACE]}>
        <OrderConfirmation crossSellShortlists={{}} />
      </CartProvider>,
    );
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([CART_ITEM]));
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the cash-on-delivery confirmation screen", () => {
  beforeEach(() => {
    window.sessionStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify(makeBundle(COD_REFERENCE)),
    );
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        codOrderReference: COD_REFERENCE,
        trackingId: TRACKING_ID,
        total: 2099,
        amountDue: 2099,
      }),
    );
  });

  it("shows the order number in full", async () => {
    await renderConfirmation(`order_id=${COD_REFERENCE}`);

    expect(screen.getByText("Your order is placed")).toBeTruthy();
    expect(screen.getByText(TRACKING_ID)).toBeTruthy();
  });

  it("no longer prints the internal COD reference anywhere on the placed screen", async () => {
    await renderConfirmation(`order_id=${COD_REFERENCE}`);

    expect(screen.queryByText(`Order reference ${COD_REFERENCE}`)).toBeNull();
    expect(document.body.textContent).not.toContain(COD_REFERENCE);
  });

  it("still quotes it while the order is being looked up, where it is the only identifier there is", async () => {
    fetchMock.mockReturnValue(new Promise<FakeResponse>(() => {}));

    await renderConfirmation(`order_id=${COD_REFERENCE}`);

    expect(screen.getByText("Confirming your order")).toBeTruthy();
    expect(screen.getByText(`Order reference ${COD_REFERENCE}`)).toBeTruthy();
  });

  it("sets the expectation for the door, with the real amount due", async () => {
    await renderConfirmation(`order_id=${COD_REFERENCE}`);

    expect(
      screen.getByText(
        `Our courier will call before delivery. Please keep ${formatRupees(2099)} in cash ready, and exact change helps.`,
      ),
    ).toBeTruthy();
  });

  it("names the address the confirmation is going to", async () => {
    await renderConfirmation(`order_id=${COD_REFERENCE}`);

    expect(document.body.textContent).toContain(
      `A copy of this order is on its way to ${CUSTOMER_EMAIL}.`,
    );
  });

  it("claims nothing about email when no address travelled with the order", async () => {
    window.sessionStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify(makeBundle(COD_REFERENCE, "")),
    );

    await renderConfirmation(`order_id=${COD_REFERENCE}`);

    expect(document.body.textContent).not.toContain("is on its way to");
  });

  it("says a copy is on its way rather than that one has been sent", async () => {
    await renderConfirmation(`order_id=${COD_REFERENCE}`);

    expect(document.body.textContent).not.toContain("has been sent");
    expect(document.body.textContent).toContain(CONTACT_CONFIG.supportEmail);
  });
});

describe("the prepaid confirmation screen", () => {
  beforeEach(() => {
    window.sessionStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({ ...makeBundle(PAYMENT_REFERENCE), amountPrepaid: 2099, amountDue: 0 }),
    );
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        orderId: PAYMENT_REFERENCE,
        status: "PAID",
        amount: 2099,
        trackingId: TRACKING_ID,
        amountDue: 0,
      }),
    );
  });

  it("keeps its payment-reference fine print exactly as it was", async () => {
    await renderConfirmation(`order_id=${PAYMENT_REFERENCE}`);

    expect(screen.getByText("Your order is confirmed")).toBeTruthy();
    expect(screen.getByText(`Payment reference ${PAYMENT_REFERENCE}`)).toBeTruthy();
  });

  it("shows the order number beside it, so both are available", async () => {
    await renderConfirmation(`order_id=${PAYMENT_REFERENCE}`);

    expect(screen.getByText(TRACKING_ID)).toBeTruthy();
  });

  it("offers a one-click copy of the order number", async () => {
    await renderConfirmation(`order_id=${PAYMENT_REFERENCE}`);

    expect(
      screen.getByRole("button", { name: `Copy order number ${TRACKING_ID}` }),
    ).toBeTruthy();
  });

  it("names the address the confirmation is going to", async () => {
    await renderConfirmation(`order_id=${PAYMENT_REFERENCE}`);

    expect(document.body.textContent).toContain(
      `A copy of this order is on its way to ${CUSTOMER_EMAIL}.`,
    );
  });

  it("carries no free-shipping nudge, because the order is already placed", async () => {
    await renderConfirmation(`order_id=${PAYMENT_REFERENCE}`);

    expect(document.body.textContent).not.toContain("for free shipping");
  });
});

/**
 * The receipt's Total, against what was actually charged.
 *
 * The bundle is written at `/address`, one step before a payment path exists, so its `total` is
 * the cart's worth and not the amount charged — and on an order that earned the online-payment
 * discount the confirmation screen printed both: "Amount paid ₹526" directly above a receipt
 * totalling ₹549, with nothing saying why they differ. `readBundleReceiptTotals` corrects it
 * from the two figures the server stamped, which are the same ones `canDisplayBundleForOrder`
 * already reconciles against Cashfree before any of this renders.
 */
describe("the receipt on a discounted prepaid order", () => {
  const DISCOUNTED_BUNDLE: CheckoutData = {
    ...makeBundle(PAYMENT_REFERENCE),
    subtotal: 450,
    shipping: 99,
    total: 549,
    amountPrepaid: 526,
    amountDue: 0,
    cart: [{ ...CART_ITEM, price: 450, qty: 1 }],
  };

  beforeEach(() => {
    window.sessionStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify(DISCOUNTED_BUNDLE),
    );
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        orderId: PAYMENT_REFERENCE,
        status: "PAID",
        amount: 526,
        trackingId: TRACKING_ID,
        amountDue: 0,
      }),
    );
  });

  it("totals what was charged, not what the cart was worth", async () => {
    await renderConfirmation(`order_id=${PAYMENT_REFERENCE}`);

    const receipt = screen.getByText("What you ordered").parentElement;
    expect(receipt).not.toBeNull();
    expect(within(receipt as HTMLElement).getByText(formatRupees(526))).toBeTruthy();
    expect(within(receipt as HTMLElement).queryByText(formatRupees(549))).toBeNull();
  });

  it("shows the rebate as its own row, so the two figures do not have to be reconciled", async () => {
    await renderConfirmation(`order_id=${PAYMENT_REFERENCE}`);

    const receipt = screen.getByText("What you ordered").parentElement as HTMLElement;
    expect(within(receipt).getByText("Online payment discount")).toBeTruthy();
    expect(within(receipt).getByText(`−${formatRupees(23)}`)).toBeTruthy();
  });

  it("leaves an undiscounted order's receipt exactly as it was", async () => {
    window.sessionStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({ ...makeBundle(PAYMENT_REFERENCE), amountPrepaid: 2099, amountDue: 0 }),
    );
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        orderId: PAYMENT_REFERENCE,
        status: "PAID",
        amount: 2099,
        trackingId: TRACKING_ID,
        amountDue: 0,
      }),
    );

    await renderConfirmation(`order_id=${PAYMENT_REFERENCE}`);

    const receipt = screen.getByText("What you ordered").parentElement as HTMLElement;
    expect(within(receipt).getByText(formatRupees(2099))).toBeTruthy();
    expect(within(receipt).queryByText("Online payment discount")).toBeNull();
  });
});
