/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "@/types/cart";
import type { CatalogueEntry, ProductOption } from "@/types/product";
import {
  CART_STORAGE_KEY,
  addProductToCart,
  cartItemKey,
  changeCartItemOptions,
} from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { ToastProvider } from "@/lib/toast-context";
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

const SIZE: ProductOption = {
  name: "Size for bangles",
  type: "pills",
  values: ["2.4", "2.6", "2.8"],
  default: "2.4",
};

const BANGLE: CatalogueEntry = {
  id: "P901",
  name: "Kada",
  price: 200,
  mrp: 300,
  image: "/products/P901.webp",
  inStock: true,
  options: [SIZE],
};

const PLAIN: CatalogueEntry = {
  id: "P900",
  name: "Plain Pendant",
  price: 150,
  mrp: 200,
  image: "/products/P900.webp",
  inStock: true,
};

const SOLD_OUT_BANGLE: CatalogueEntry = { ...BANGLE, id: "P902", inStock: false };

const CATALOGUE = [BANGLE, PLAIN, SOLD_OUT_BANGLE];

function cartWith(
  entry: CatalogueEntry,
  selectedOptions?: Record<string, string>,
  quantity = 1,
): CartItem[] {
  return addProductToCart([], entry, quantity, selectedOptions);
}

function keyOf(items: CartItem[], productId: string): string {
  const item = items.find((candidate) => candidate.productId === productId);
  if (item === undefined) throw new Error(`No cart line for ${productId}`);
  return cartItemKey(item);
}

describe("changeCartItemOptions", () => {
  it("applies a valid change and keeps the quantity", () => {
    const items = cartWith(BANGLE, { "Size for bangles": "2.4" }, 3);
    const change = changeCartItemOptions(items, CATALOGUE, keyOf(items, "P901"), {
      "Size for bangles": "2.6",
    });

    expect(change.error).toBeNull();
    expect(change.items).toHaveLength(1);
    expect(change.items[0].selectedOptions).toEqual({ "Size for bangles": "2.6" });
    expect(change.items[0].qty).toBe(3);
  });

  it("refuses a value the catalogue does not offer, in the words checkout would use", () => {
    const items = cartWith(BANGLE, { "Size for bangles": "2.4" });
    const change = changeCartItemOptions(items, CATALOGUE, keyOf(items, "P901"), {
      "Size for bangles": "3.0",
    });

    expect(change.error).toBe("The option you chose for Kada is no longer available.");
    expect(change.items).toBe(items);
  });

  it("refuses a group the product does not have", () => {
    const items = cartWith(BANGLE, { "Size for bangles": "2.4" });
    const change = changeCartItemOptions(items, CATALOGUE, keyOf(items, "P901"), {
      Letter: "A",
    });

    expect(change.error).not.toBeNull();
    expect(change.items).toBe(items);
  });

  it("refuses an edit to a line whose product has sold out", () => {
    const items = cartWith({ ...SOLD_OUT_BANGLE, inStock: true }, {
      "Size for bangles": "2.4",
    });
    const change = changeCartItemOptions(items, CATALOGUE, keyOf(items, "P902"), {
      "Size for bangles": "2.6",
    });

    expect(change.error).not.toBeNull();
    expect(change.items).toBe(items);
  });

  it("refuses a line key that is not in the cart", () => {
    const items = cartWith(BANGLE, { "Size for bangles": "2.4" });
    const change = changeCartItemOptions(items, CATALOGUE, "P901|Nope=1", {
      "Size for bangles": "2.6",
    });

    expect(change.error).not.toBeNull();
    expect(change.items).toBe(items);
  });

  it("keeps the edited line where it was in the list", () => {
    const withPlain = addProductToCart([], PLAIN, 1);
    const items = addProductToCart(withPlain, BANGLE, 1, { "Size for bangles": "2.4" });
    const withTail = addProductToCart(items, PLAIN, 1);

    const change = changeCartItemOptions(withTail, CATALOGUE, keyOf(withTail, "P901"), {
      "Size for bangles": "2.8",
    });

    expect(change.error).toBeNull();
    expect(change.items.map((item) => item.productId)).toEqual(["P900", "P901"]);
    expect(change.items[1].selectedOptions).toEqual({ "Size for bangles": "2.8" });
  });

  it("merges into the line the change lands on, summing the quantities", () => {
    const first = addProductToCart([], BANGLE, 2, { "Size for bangles": "2.4" });
    const items = addProductToCart(first, BANGLE, 3, { "Size for bangles": "2.8" });
    expect(items).toHaveLength(2);

    const change = changeCartItemOptions(
      items,
      CATALOGUE,
      cartItemKey(items[0]),
      { "Size for bangles": "2.8" },
    );

    expect(change.error).toBeNull();
    expect(change.items).toHaveLength(1);
    expect(change.items[0].qty).toBe(5);
    expect(change.items[0].selectedOptions).toEqual({ "Size for bangles": "2.8" });
  });
});

function CartPage(): JSX.Element {
  return (
    <CartProvider catalogue={CATALOGUE}>
      <ToastProvider>
        <CartView />
      </ToastProvider>
    </CartProvider>
  );
}

async function renderCartWith(items: CartItem[]): Promise<void> {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  await act(async () => {
    render(<CartPage />);
  });
}

function readStoredOptions(productId: string): Record<string, string> | undefined {
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  const items = raw === null ? [] : (JSON.parse(raw) as CartItem[]);
  return items.find((item) => item.productId === productId)?.selectedOptions;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("editing a cart line's options on the cart page", () => {
  it("offers no editor at all for a line with nothing to choose", async () => {
    await renderCartWith(cartWith(PLAIN));

    expect(screen.queryByRole("button", { name: /Change/ })).toBeNull();
  });

  it("shows the chosen options with a way to change them", async () => {
    await renderCartWith(cartWith(BANGLE, { "Size for bangles": "2.4" }));

    expect(screen.getByText("Size for bangles: 2.4")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Change the options chosen for Kada/ }))
      .toBeTruthy();
  });

  it("persists a valid edit and closes the editor", async () => {
    await renderCartWith(cartWith(BANGLE, { "Size for bangles": "2.4" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Change/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "2.6" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(readStoredOptions("P901")).toEqual({ "Size for bangles": "2.6" });
    expect(screen.getByText("Size for bangles: 2.6")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("leaves the line alone when the editor is cancelled", async () => {
    await renderCartWith(cartWith(BANGLE, { "Size for bangles": "2.4" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Change/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "2.8" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });

    expect(readStoredOptions("P901")).toEqual({ "Size for bangles": "2.4" });
    expect(screen.getByText("Size for bangles: 2.4")).toBeTruthy();
  });

  it("reopens on the value the line actually holds, not the abandoned draft", async () => {
    await renderCartWith(cartWith(BANGLE, { "Size for bangles": "2.4" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Change/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "2.8" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Change/ }));
    });

    expect((screen.getByRole("radio", { name: "2.4" }) as HTMLInputElement).checked).toBe(
      true,
    );
  });
});
