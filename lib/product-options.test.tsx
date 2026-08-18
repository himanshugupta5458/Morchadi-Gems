/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { formatRupees } from "@/lib/format";
import { ProductSelectionProvider } from "@/lib/product-selection";
import { ToastProvider } from "@/lib/toast-context";
import { CartView } from "@/components/CartView";
import { ProductPurchaseActions } from "@/components/ProductPurchaseActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const INITIAL_RING: CatalogueEntry = {
  id: "P001",
  name: "Wave Band Initial Ring",
  price: 400,
  mrp: 600,
  image: "/products/P001.webp",
  inStock: true,
  options: [{ name: "Letter", type: "dropdown", values: LETTERS, default: "A" }],
};

const WATCH_RING: CatalogueEntry = {
  id: "P010",
  name: "Mini Watch Ring",
  price: 300,
  mrp: 500,
  image: "/products/P010.webp",
  inStock: true,
  options: [
    { name: "Colour", type: "swatch", values: ["Silver", "Golden"], default: "Silver" },
  ],
};

const NECKLACE: CatalogueEntry = {
  id: "nk-001",
  name: "Kundan Rani Haar",
  price: 1000,
  mrp: 1500,
  image: "/products/nk-001.webp",
  inStock: true,
};

const CATALOGUE: CatalogueEntry[] = [INITIAL_RING, WATCH_RING, NECKLACE];

function ProductAndCart({ item }: { item: CatalogueEntry }): JSX.Element {
  return (
    <CartProvider catalogue={CATALOGUE}>
      <ToastProvider>
        <ProductSelectionProvider options={item.options}>
          <ProductPurchaseActions item={item} />
        </ProductSelectionProvider>
        <CartView />
      </ToastProvider>
    </CartProvider>
  );
}

async function showProduct(item: CatalogueEntry): Promise<void> {
  await act(async () => {
    render(<ProductAndCart item={item} />);
  });
}

function addToCart(): void {
  fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
}

function cartLines(): HTMLElement[] {
  return screen.getAllByRole("listitem");
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the selectors on a product page", () => {
  it("renders a select for a long list of values, defaulted to the first", () => {
    render(<ProductAndCart item={INITIAL_RING} />);

    const letterSelect = screen.getByLabelText("Letter") as HTMLSelectElement;

    expect(letterSelect.tagName).toBe("SELECT");
    expect(letterSelect.value).toBe("A");
    expect(within(letterSelect).getAllByRole("option")).toHaveLength(LETTERS.length);
  });

  it("renders keyboard-navigable radios for a short list of values", () => {
    render(<ProductAndCart item={WATCH_RING} />);

    const silver = screen.getByRole("radio", { name: "Silver" }) as HTMLInputElement;
    const golden = screen.getByRole("radio", { name: "Golden" }) as HTMLInputElement;

    expect(silver.checked).toBe(true);
    expect(golden.checked).toBe(false);
  });

  it("shows the default selection without the shopper choosing anything", () => {
    render(<ProductAndCart item={INITIAL_RING} />);

    expect(screen.getByText("Letter: A")).toBeDefined();
  });

  it("echoes a changed selection next to the buy actions", () => {
    render(<ProductAndCart item={INITIAL_RING} />);

    fireEvent.change(screen.getByLabelText("Letter"), { target: { value: "C" } });

    expect(screen.getByText("Letter: C")).toBeDefined();
  });

  it("carries the personalized note and its link to the refund policy", () => {
    render(<ProductAndCart item={INITIAL_RING} />);

    expect(screen.getAllByText("Personalized · non-returnable").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Refund policy" }).getAttribute("href")).toBe(
      "/refund",
    );
  });

  it("leaves a product without options exactly as it was", () => {
    render(<ProductAndCart item={NECKLACE} />);

    expect(screen.queryByLabelText("Letter")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByText("Personalized · non-returnable")).toBeNull();
  });
});

describe("adding a personalized piece to the cart", () => {
  it("adds the defaults when no selector was touched", async () => {
    await showProduct(INITIAL_RING);
    addToCart();

    expect(cartLines()).toHaveLength(1);
    expect(within(cartLines()[0]).getByText("Letter: A")).toBeDefined();
  });

  it("makes two selections of one product two cart lines", async () => {
    await showProduct(INITIAL_RING);
    addToCart();

    fireEvent.change(screen.getByLabelText("Letter"), { target: { value: "D" } });
    addToCart();

    const lines = cartLines();
    expect(lines).toHaveLength(2);
    expect(within(lines[0]).getByText("Letter: A")).toBeDefined();
    expect(within(lines[1]).getByText("Letter: D")).toBeDefined();
  });

  it("increments the one line when the same selection is added twice", async () => {
    await showProduct(INITIAL_RING);
    addToCart();
    addToCart();

    expect(cartLines()).toHaveLength(1);
    expect(screen.getByText("2 pieces in your cart")).toBeDefined();
  });

  it("charges the same for two selections as for two of one", async () => {
    await showProduct(INITIAL_RING);
    addToCart();
    fireEvent.change(screen.getByLabelText("Letter"), { target: { value: "B" } });
    addToCart();

    expect(screen.getByText("2 pieces in your cart")).toBeDefined();
    expect(screen.getAllByText(formatRupees(INITIAL_RING.price * 2)).length).toBeGreaterThan(
      0,
    );
  });

  it("shows the personalized note on the cart line", async () => {
    await showProduct(INITIAL_RING);
    addToCart();

    expect(
      within(cartLines()[0]).getByText("Personalized · non-returnable"),
    ).toBeDefined();
  });

  it("removes only the line that was asked for", async () => {
    await showProduct(INITIAL_RING);
    addToCart();
    fireEvent.change(screen.getByLabelText("Letter"), { target: { value: "B" } });
    addToCart();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Wave Band Initial Ring (Letter: A) from cart",
      }),
    );

    const lines = cartLines();
    expect(lines).toHaveLength(1);
    expect(within(lines[0]).getByText("Letter: B")).toBeDefined();
  });

  it("edits the quantity of only the line that was asked for", async () => {
    await showProduct(INITIAL_RING);
    addToCart();
    fireEvent.change(screen.getByLabelText("Letter"), { target: { value: "B" } });
    addToCart();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Increase quantity, Wave Band Initial Ring, Letter: B",
      }),
    );

    expect(screen.getByText("3 pieces in your cart")).toBeDefined();
  });

  it("persists each line's selection separately", async () => {
    await showProduct(INITIAL_RING);
    addToCart();
    fireEvent.change(screen.getByLabelText("Letter"), { target: { value: "E" } });
    addToCart();

    const stored = JSON.parse(
      window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]",
    ) as { productId: string; selectedOptions?: Record<string, string> }[];

    expect(stored.map((item) => item.selectedOptions)).toEqual([
      { Letter: "A" },
      { Letter: "E" },
    ]);
  });

  it("leaves an option-less cart line without a choice or a note", async () => {
    await showProduct(NECKLACE);
    addToCart();

    expect(within(cartLines()[0]).queryByText(/Letter:/)).toBeNull();
    expect(
      within(cartLines()[0]).queryByText("Personalized · non-returnable"),
    ).toBeNull();
  });
});
