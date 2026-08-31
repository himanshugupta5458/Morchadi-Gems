/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { TOAST_ACTION_DURATION_MS, ToastProvider } from "@/lib/toast-context";
import { CartView, ITEM_REMOVED_MESSAGE, UNDO_REMOVAL_LABEL } from "@/components/CartView";

/**
 * Removing a cart line used to be final: the × deleted it, and the only way back was to find the
 * piece again and re-choose whatever options it carried. The toast that replaces that is only
 * worth having if Undo restores what was actually there, so this file checks the three things
 * that make the difference — the offer appears, taking it puts the *exact* line back, and
 * letting it lapse really does remove it. See
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

const ENGRAVED_RING: CatalogueEntry = {
  id: "rg-001",
  name: "Engraved Signet Ring",
  category: "rings",
  price: 499,
  mrp: 899,
  image: "/products/rg-001.webp",
  inStock: true,
  options: [
    { name: "Letter", type: "dropdown", values: ["A", "B", "C"], default: "A" },
  ],
};

const NECKLACE: CatalogueEntry = {
  id: "nk-001",
  name: "Kundan Rani Haar",
  category: "necklaces",
  price: 1200,
  mrp: 1600,
  image: "/products/nk-001.webp",
  inStock: true,
};

const CATALOGUE: CatalogueEntry[] = [ENGRAVED_RING, NECKLACE];

const STORED_CART: CartItem[] = [
  {
    productId: "rg-001",
    name: ENGRAVED_RING.name,
    price: ENGRAVED_RING.price,
    image: ENGRAVED_RING.image ?? "",
    qty: 3,
    selectedOptions: { Letter: "B" },
  },
  {
    productId: "nk-001",
    name: NECKLACE.name,
    price: NECKLACE.price,
    image: NECKLACE.image ?? "",
    qty: 1,
  },
];

async function renderCart(): Promise<void> {
  await act(async () => {
    render(
      <CartProvider catalogue={CATALOGUE}>
        <ToastProvider>
          <CartView codCatalogue={[]} crossSellShortlists={{}} />
        </ToastProvider>
      </CartProvider>,
    );
  });
}

function cartLines(): HTMLElement[] {
  return within(
    screen.getByRole("list", { name: "Pieces in your cart" }),
  ).getAllByRole("listitem");
}

function removeTheRing(): void {
  fireEvent.click(
    screen.getByRole("button", {
      name: `Remove ${ENGRAVED_RING.name} (Letter: B) from cart`,
    }),
  );
}

function storedCart(): CartItem[] {
  return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(STORED_CART));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("removing a line from the cart", () => {
  it("offers a way back", async () => {
    await renderCart();
    expect(cartLines()).toHaveLength(2);

    await act(async () => removeTheRing());

    expect(cartLines()).toHaveLength(1);
    expect(screen.getByText(ITEM_REMOVED_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: UNDO_REMOVAL_LABEL })).toBeTruthy();
  });

  it("restores the exact line, with its quantity, its choices and its place in the list", async () => {
    await renderCart();
    await act(async () => removeTheRing());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: UNDO_REMOVAL_LABEL }));
    });

    const restored = storedCart();
    expect(restored).toHaveLength(2);
    expect(restored[0]).toMatchObject({
      productId: "rg-001",
      qty: 3,
      selectedOptions: { Letter: "B" },
    });
    expect(restored[1].productId).toBe("nk-001");

    const lines = cartLines();
    expect(lines).toHaveLength(2);
    expect(within(lines[0]).getByText("Letter: B")).toBeTruthy();
  });

  it("takes the toast down once the offer is taken", async () => {
    await renderCart();
    await act(async () => removeTheRing());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: UNDO_REMOVAL_LABEL }));
    });

    expect(screen.queryByText(ITEM_REMOVED_MESSAGE)).toBeNull();
    expect(screen.queryByRole("button", { name: UNDO_REMOVAL_LABEL })).toBeNull();
  });

  it("genuinely removes the line when the offer is left to expire", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderCart();

    await act(async () => removeTheRing());
    expect(screen.getByRole("button", { name: UNDO_REMOVAL_LABEL })).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(TOAST_ACTION_DURATION_MS + 1);
    });

    expect(screen.queryByRole("button", { name: UNDO_REMOVAL_LABEL })).toBeNull();
    expect(cartLines()).toHaveLength(1);
    expect(storedCart().map((item) => item.productId)).toEqual(["nk-001"]);
  });
});
