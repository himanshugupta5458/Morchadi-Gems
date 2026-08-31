/** @vitest-environment jsdom */

import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { ToastProvider } from "@/lib/toast-context";
import { AddToCartButton } from "@/components/AddToCartButton";
import { CartLink } from "@/components/CartLink";
import { CartView } from "@/components/CartView";

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

const NECKLACE: CatalogueEntry = {
  id: "nk-001",
  name: "Kundan Rani Haar",
  category: "necklaces",
  price: 1000,
  mrp: 1500,
  image: "/products/nk-001.webp",
  inStock: true,
};

const SOLD_OUT_RING: CatalogueEntry = {
  id: "rg-001",
  name: "Temple Gold Ring",
  category: "necklaces",
  price: 700,
  mrp: 900,
  image: "/products/rg-001.webp",
  inStock: false,
};

const CATALOGUE: CatalogueEntry[] = [NECKLACE, SOLD_OUT_RING];

function Storefront(): JSX.Element {
  return (
    <CartProvider catalogue={CATALOGUE}>
      <ToastProvider>
        <CartLink />
        <AddToCartButton item={NECKLACE} />
      </ToastProvider>
    </CartProvider>
  );
}

function CartPage(): JSX.Element {
  return (
    <CartProvider catalogue={CATALOGUE}>
      <ToastProvider>
        <CartView codCatalogue={[]} crossSellShortlists={{}} />
      </ToastProvider>
    </CartProvider>
  );
}

async function hydrate(tree: JSX.Element): Promise<ReturnType<typeof vi.spyOn>> {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElement("div");
  container.innerHTML = renderToString(tree);
  document.body.appendChild(container);

  await act(async () => {
    render(tree, { container, hydrate: true });
  });

  return consoleError;
}

function readBadgeLabel(): string {
  const cartLink = screen.getByRole("link", { name: /^Cart,/ });
  return cartLink.getAttribute("aria-label") ?? "";
}

function readStoredQuantities(): Record<string, number> {
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (raw === null) return {};

  const items = JSON.parse(raw) as { productId: string; qty: number }[];
  return Object.fromEntries(items.map((item) => [item.productId, item.qty]));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("server render", () => {
  it("renders the empty badge regardless of what is in storage", () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([{ productId: "nk-001", name: "x", price: 1, image: "", qty: 3 }]),
    );

    const serverHtml = renderToString(<Storefront />);

    expect(serverHtml).toContain('aria-label="Cart, empty"');
    expect(serverHtml).not.toContain("Cart, 3 items");
  });
});

describe("hydration", () => {
  it("hydrates a persisted cart without a mismatch warning", async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        { productId: "nk-001", name: "stale", price: 1, image: "", qty: 40 },
        { productId: "gone-999", name: "removed", price: 500, image: "", qty: 2 },
        { productId: "rg-001", name: "sold out", price: 700, image: "", qty: 1 },
      ]),
    );

    const consoleError = await hydrate(<Storefront />);

    expect(consoleError).not.toHaveBeenCalled();
    expect(readBadgeLabel()).toBe("Cart, 11 items");
    expect(readStoredQuantities()).toEqual({ "nk-001": 10, "rg-001": 1 });
  });

  it("hydrates an empty cart without a mismatch warning", async () => {
    const consoleError = await hydrate(<Storefront />);

    expect(consoleError).not.toHaveBeenCalled();
    expect(readBadgeLabel()).toBe("Cart, empty");
  });
});

describe("adding to cart", () => {
  it("increments the header badge and writes the cart to storage", async () => {
    render(<Storefront />);
    await act(async () => {});

    expect(readBadgeLabel()).toBe("Cart, empty");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    });
    expect(readBadgeLabel()).toBe("Cart, 1 items");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    });
    expect(readBadgeLabel()).toBe("Cart, 2 items");
    expect(readStoredQuantities()).toEqual({ "nk-001": 2 });
  });

  it("raises the toast", async () => {
    render(<Storefront />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    });

    expect(screen.getByRole("status").textContent).toContain("Added to cart");
  });

  it("keeps the badge across a reload", async () => {
    render(<Storefront />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    });
    expect(readStoredQuantities()).toEqual({ "nk-001": 1 });

    cleanup();

    render(<Storefront />);
    await act(async () => {});

    expect(readBadgeLabel()).toBe("Cart, 1 items");
  });
});

describe("cart page", () => {
  it("hydrates a populated cart without a mismatch warning", async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([{ productId: "nk-001", name: "x", price: 1, image: "", qty: 2 }]),
    );

    const consoleError = await hydrate(<CartPage />);

    expect(consoleError).not.toHaveBeenCalled();
    expect(screen.getByText("Kundan Rani Haar")).toBeDefined();
    expect(screen.getAllByText("₹2,000")).toHaveLength(3);
    expect(screen.getByText("FREE")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Proceed to checkout" }).getAttribute("href"),
    ).toBe("/address");
  });

  it("hydrates an empty cart into the empty state", async () => {
    const consoleError = await hydrate(<CartPage />);

    expect(consoleError).not.toHaveBeenCalled();
    expect(screen.getByText("empty")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Proceed to checkout" })).toBeNull();
  });

  it("blocks checkout while an out-of-stock line is present", async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        { productId: "nk-001", name: "x", price: 1, image: "", qty: 1 },
        { productId: "rg-001", name: "x", price: 1, image: "", qty: 1 },
      ]),
    );

    await hydrate(<CartPage />);

    expect(screen.getByText("Out of stock")).toBeDefined();
    expect(screen.getAllByText("₹1,000").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("FREE")).toBeDefined();
    expect(screen.queryByText("₹1,099")).toBeNull();
    const checkoutButton = screen.getByRole("button", { name: "Proceed to checkout" });
    expect(checkoutButton.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Remove Temple Gold Ring from cart" }),
      );
    });

    expect(screen.queryByText("Out of stock")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Proceed to checkout" }).getAttribute("href"),
    ).toBe("/address");
  });

  it("updates the line total and the summary from the stepper", async () => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([{ productId: "nk-001", name: "x", price: 1, image: "", qty: 1 }]),
    );

    await hydrate(<CartPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Increase quantity, Kundan Rani Haar" }),
      );
    });

    expect(screen.getAllByText("₹2,000")).toHaveLength(3);
    expect(screen.getByText("FREE")).toBeDefined();
    expect(readStoredQuantities()).toEqual({ "nk-001": 2 });
  });
});
