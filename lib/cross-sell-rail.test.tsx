/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueEntry, ProductCardView, ProductOption } from "@/types/product";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import {
  CROSS_SELL_LIMIT,
  CROSS_SELL_VISIBLE_LIMIT,
  splitCrossSellSuggestions,
  type CrossSellShortlists,
} from "@/lib/cross-sell";
import { formatRupees } from "@/lib/format";
import { toCatalogueEntry } from "@/lib/product-view";
import { ToastProvider } from "@/lib/toast-context";
import { CrossSellRow, buildRevealLabel } from "@/components/CrossSellRow";

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
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

/**
 * The rail on `/cart` and the rail on `/order-confirmation` are one component rendered twice,
 * so this suite drives it once and asserts the properties both screens depend on. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
const SIZE_GROUP: ProductOption = {
  name: "Size for bangles",
  type: "pills",
  values: ["2.4", "2.6", "2.8"],
  default: "2.4",
};

function suggestion(index: number, options?: ProductOption[]): ProductCardView {
  return {
    id: `S90${index}`,
    name: `Suggestion ${index}`,
    category: "bangles",
    pricing: { price: 400 + index, mrp: 900 },
    media: { images: [`/products/S90${index}.webp`] },
    seo: { imageAlt: `Suggestion ${index}` },
    stock: { inStock: true, quantity: 10 },
    ...(options === undefined ? {} : { options }),
  flags: { featured: false, isNew: false, badge: null },
  };
}

const SUGGESTIONS = [
  suggestion(0),
  suggestion(1),
  suggestion(2, [SIZE_GROUP]),
  suggestion(3),
];

const SHORTLISTS: CrossSellShortlists = { bangles: SUGGESTIONS };

const IN_BASKET: CatalogueEntry = {
  id: "P100",
  name: "In the basket",
  category: "bangles",
  price: 1000,
  mrp: 1200,
  image: "/products/P100.webp",
  inStock: true,
};

const CATALOGUE: CatalogueEntry[] = [
  IN_BASKET,
  ...SUGGESTIONS.map((product) => toCatalogueEntry(product)),
];

async function renderRail(): Promise<void> {
  await act(async () => {
    render(
      <CartProvider catalogue={CATALOGUE}>
        <ToastProvider>
          <CrossSellRow
            basket={[{ productId: IN_BASKET.id, amount: 1000 }]}
            shortlists={SHORTLISTS}
            roman="Complete"
            accent="the Set"
          />
        </ToastProvider>
      </CartProvider>,
    );
  });
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

function readStoredCart(): { productId: string; selectedOptions?: Record<string, string> }[] {
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  return raw === null ? [] : JSON.parse(raw);
}

function cards(): HTMLElement[] {
  return screen.getAllByRole("listitem");
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("splitCrossSellSuggestions", () => {
  it("shows two and holds the rest back", () => {
    expect(CROSS_SELL_VISIBLE_LIMIT).toBe(2);
    expect(CROSS_SELL_LIMIT).toBe(4);

    const { shown, hidden } = splitCrossSellSuggestions(SUGGESTIONS);

    expect(shown).toHaveLength(2);
    expect(hidden).toHaveLength(2);
    expect([...shown, ...hidden]).toEqual(SUGGESTIONS);
  });

  it("holds nothing back when there is nothing past the limit", () => {
    expect(splitCrossSellSuggestions(SUGGESTIONS.slice(0, 2)).hidden).toEqual([]);
  });
});

describe("the compact horizontal card", () => {
  it("shows two suggestions, not the whole shortlist", async () => {
    await renderRail();

    expect(cards()).toHaveLength(CROSS_SELL_VISIBLE_LIMIT);
  });

  /**
   * A thumbnail cropped on the piece, a name on one line, and the price alone. No compare-at
   * price and no discount badge: those belong on a shelf where a shopper is comparing pieces,
   * not beside a basket where they are a second sale pitched during the first.
   */
  it("crops the thumbnail on the piece and states the price plainly", async () => {
    await renderRail();

    const [first] = cards();
    const image = first.querySelector("img");

    expect(image?.getAttribute("class")).toContain("object-cover");
    expect(first.textContent).toContain(formatRupees(SUGGESTIONS[0].pricing.price));
    expect(first.textContent).not.toContain(formatRupees(SUGGESTIONS[0].pricing.mrp));
    expect(first.textContent).not.toContain("% off");
    const nameLink = first.querySelector("a[href^='/product/'].truncate");
    expect(nameLink?.textContent).toBe(SUGGESTIONS[0].name);
  });

  it("gives every card the same single action, whatever the product carries", async () => {
    await renderRail();

    for (const card of cards()) {
      const buttons = card.querySelectorAll("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0].getAttribute("aria-label")).toMatch(/^Add .* to cart$/);
    }
    expect(screen.queryByText("Choose Your Options")).toBeNull();
  });
});

describe("the see-more toggle", () => {
  it("names how many are left and reveals them", async () => {
    await renderRail();

    const toggle = screen.getByRole("button", { name: new RegExp(buildRevealLabel(2)) });
    await click(toggle);

    expect(cards()).toHaveLength(SUGGESTIONS.length);
    expect(screen.queryByRole("button", { name: new RegExp(buildRevealLabel(2)) })).toBeNull();
  });
});

describe("the + action", () => {
  it("adds a product with nothing to choose outright", async () => {
    await renderRail();

    await click(screen.getByRole("button", { name: `Add ${SUGGESTIONS[0].name} to cart` }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readStoredCart()).toEqual([
      expect.objectContaining({ productId: SUGGESTIONS[0].id, qty: 1 }),
    ]);
  });

  /**
   * The same modal the product card opens, from the same hook, with nothing pre-selected. The
   * rail has no path of its own for a product with options and is not meant to grow one.
   */
  it("opens the add-to-cart modal for a product that has options", async () => {
    await renderRail();
    await click(screen.getByRole("button", { name: new RegExp(buildRevealLabel(2)) }));

    await click(screen.getByRole("button", { name: `Add ${SUGGESTIONS[2].name} to cart` }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(
      Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
        (radio) => radio.checked,
      ),
    ).toEqual([]);
    expect(readStoredCart()).toEqual([]);

    await click(screen.getByRole("radio", { name: "2.6" }));
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (button) => button.textContent === "Add to cart",
    );
    await click(confirm as HTMLButtonElement);

    expect(readStoredCart()[0].selectedOptions).toEqual({ "Size for bangles": "2.6" });
  });
});
