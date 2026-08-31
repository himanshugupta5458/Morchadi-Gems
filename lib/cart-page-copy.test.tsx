/** @vitest-environment jsdom */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import type { CodEligibilityEntry } from "@/lib/cod";
import {
  DELIVERY_ESTIMATE_LINE,
  FREE_SHIPPING_THRESHOLD,
  LEGAL_CONFIG,
  RETURN_WINDOW_DAYS,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { ToastProvider } from "@/lib/toast-context";
import { CartView } from "@/components/CartView";

/**
 * What the cart page says once the order summary stopped being three rows and a sentence about
 * catalogue pricing.
 *
 * Every figure and every promise here is derived rather than typed: the MRP row from
 * `calculateCartMrpSubtotal`, the shipping threshold from `config/site-facts.mjs`, the returns
 * window and the gateway name from `lib/config.ts`, and the cash-on-delivery sentence from the
 * same eligibility rule `/api/create-order` charges by. See
 * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */

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

const DISCOUNTED_RING: CatalogueEntry = {
  id: "rg-001",
  name: "Temple Gold Ring",
  category: "rings",
  price: 400,
  mrp: 900,
  image: "/products/rg-001.webp",
  inStock: true,
};

const FULL_PRICE_ANKLET: CatalogueEntry = {
  id: "an-001",
  name: "Silver Payal",
  category: "anklets",
  price: 250,
  mrp: 250,
  image: "/products/an-001.webp",
  inStock: true,
};

const CATALOGUE: CatalogueEntry[] = [DISCOUNTED_RING, FULL_PRICE_ANKLET];

const ALL_ELIGIBLE: CodEligibilityEntry[] = CATALOGUE.map((entry) => ({
  id: entry.id,
  minPrepaidAmount: 0,
}));

const ONE_REQUIRES_PREPAYMENT: CodEligibilityEntry[] = [
  { id: DISCOUNTED_RING.id, minPrepaidAmount: 300 },
  { id: FULL_PRICE_ANKLET.id, minPrepaidAmount: 0 },
];

function storedItem(entry: CatalogueEntry, qty: number): CartItem {
  return {
    productId: entry.id,
    name: entry.name,
    price: entry.price,
    image: entry.image ?? "",
    qty,
  };
}

function seedCart(items: CartItem[]): void {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

async function renderCart(
  codCatalogue: readonly CodEligibilityEntry[] = ALL_ELIGIBLE,
): Promise<void> {
  await act(async () => {
    render(
      <CartProvider catalogue={CATALOGUE}>
        <ToastProvider>
          <CartView codCatalogue={codCatalogue} crossSellShortlists={{}} />
        </ToastProvider>
      </CartProvider>,
    );
  });
}

function summary(): HTMLElement {
  const heading = screen.getByText("Order summary");
  const panel = heading.parentElement;
  if (panel === null) throw new Error("the order summary has no panel");
  return panel;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("the order summary's savings breakdown", () => {
  it("states the MRP subtotal and what the shopper saves against it", async () => {
    seedCart([storedItem(DISCOUNTED_RING, 1)]);
    await renderCart();

    const panel = summary();
    expect(within(panel).getByText("Subtotal (MRP)")).toBeTruthy();
    expect(within(panel).getByText(formatRupees(900))).toBeTruthy();
    expect(within(panel).getByText("You save")).toBeTruthy();
    expect(within(panel).getByText(`−${formatRupees(500)}`)).toBeTruthy();
  });

  it("adds the saving up across lines and leaves the total alone", async () => {
    seedCart([storedItem(DISCOUNTED_RING, 2), storedItem(FULL_PRICE_ANKLET, 1)]);
    await renderCart();

    const panel = summary();
    /**
     * 2 × ₹900 MRP + ₹250 = ₹2,050 against 2 × ₹400 + ₹250 = ₹1,050 charged. The compare-at
     * figure is a row, never an input: the total is the charged subtotal, and shipping is free
     * because ₹1,050 clears the threshold on its own.
     */
    expect(within(panel).getByText(formatRupees(2050))).toBeTruthy();
    expect(within(panel).getByText(`−${formatRupees(1000)}`)).toBeTruthy();
    expect(within(panel).getByText(formatRupees(1050))).toBeTruthy();
    expect(within(panel).getByText("FREE")).toBeTruthy();
  });

  it("shows one plain subtotal row when nothing in the cart is discounted", async () => {
    seedCart([storedItem(FULL_PRICE_ANKLET, 1)]);
    await renderCart();

    const panel = summary();
    expect(within(panel).getByText("Subtotal")).toBeTruthy();
    expect(within(panel).queryByText("Subtotal (MRP)")).toBeNull();
    expect(within(panel).queryByText("You save")).toBeNull();
  });
});

describe("what the cart promises under the checkout button", () => {
  it("replaced the catalogue-pricing sentence with the trust points", async () => {
    seedCart([storedItem(FULL_PRICE_ANKLET, 1)]);
    await renderCart();

    expect(document.body.textContent).not.toContain(
      "Prices are confirmed against the catalogue",
    );
    expect(
      screen.getByText(`Secure checkout via ${LEGAL_CONFIG.paymentProvider}`),
    ).toBeTruthy();
    expect(screen.getByText(`${RETURN_WINDOW_DAYS}-day returns`)).toBeTruthy();
    expect(
      screen.getByText(`Delivered across ${LEGAL_CONFIG.shippingScope}`),
    ).toBeTruthy();
  });

  it("states the delivery estimate the rest of checkout states", async () => {
    seedCart([storedItem(FULL_PRICE_ANKLET, 1)]);
    await renderCart();

    expect(screen.getByText(DELIVERY_ESTIMATE_LINE)).toBeTruthy();
  });

  it("demotes Continue shopping to a text link beside the one primary action", async () => {
    seedCart([storedItem(FULL_PRICE_ANKLET, 1)]);
    await renderCart();

    const panel = summary();
    const continueShopping = within(panel).getByRole("link", {
      name: "Continue shopping",
    });

    expect(continueShopping.getAttribute("href")).toBe("/shop");
    expect(continueShopping.className).not.toContain("border-charcoal");
    expect(
      within(panel).getByRole("link", { name: "Proceed to checkout" }).className,
    ).toContain("border-charcoal");
  });
});

describe("what the cart says about paying at the door", () => {
  it("offers it when every piece in the basket qualifies", async () => {
    seedCart([storedItem(FULL_PRICE_ANKLET, 1)]);
    await renderCart(ALL_ELIGIBLE);

    expect(
      screen.getByText("Cash on delivery available on this order, or pay online and save."),
    ).toBeTruthy();
  });

  it("withdraws it for the whole order when one piece requires prepayment", async () => {
    seedCart([storedItem(DISCOUNTED_RING, 1), storedItem(FULL_PRICE_ANKLET, 1)]);
    await renderCart(ONE_REQUIRES_PREPAYMENT);

    expect(
      screen.getByText(
        "This order is paid online. One or more pieces in it are not sold cash on delivery.",
      ),
    ).toBeTruthy();
  });
});

describe("the free-shipping progress", () => {
  it("draws a bar and names the shortfall against the charged subtotal", async () => {
    seedCart([storedItem(DISCOUNTED_RING, 1)]);
    await renderCart();

    const bar = screen.getByRole("progressbar", {
      name: "Progress towards free shipping",
    });

    expect(bar.getAttribute("aria-valuenow")).toBe(
      String(Math.round((400 / FREE_SHIPPING_THRESHOLD) * 100)),
    );
    expect(
      screen.getByText(formatRupees(FREE_SHIPPING_THRESHOLD - 400)),
    ).toBeTruthy();
  });

  it("does not read the shortfall against the MRP subtotal, which already clears it", async () => {
    seedCart([storedItem(DISCOUNTED_RING, 1)]);
    await renderCart();

    expect(document.body.textContent).toContain("for free shipping");
    expect(
      screen.getByRole("progressbar", { name: "Progress towards free shipping" })
        .getAttribute("aria-valuenow"),
    ).not.toBe("100");
  });

  it("says so plainly once the threshold is reached", async () => {
    seedCart([storedItem(DISCOUNTED_RING, 2), storedItem(FULL_PRICE_ANKLET, 1)]);
    await renderCart();

    expect(screen.getByText("Free shipping unlocked.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("for free shipping.");
  });
});
