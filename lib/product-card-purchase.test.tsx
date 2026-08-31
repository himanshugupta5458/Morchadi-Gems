/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueEntry, ProductOption } from "@/types/product";
import {
  CARD_OPTION_VALUE_LIMIT,
  CHOOSE_OPTIONS_LABEL,
  selectCardPurchaseMode,
} from "@/lib/card-purchase";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { getAllProducts } from "@/lib/products";
import { ToastProvider } from "@/lib/toast-context";
import { ProductCardPurchase } from "@/components/ProductCardPurchase";

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

const BANGLE_SIZE: ProductOption = {
  name: "Size for bangles",
  type: "pills",
  values: ["2.4", "2.6", "2.8"],
  default: "2.4",
};

const LETTER: ProductOption = {
  name: "Letter",
  type: "dropdown",
  values: ["A", "B", "C", "D", "E"],
  default: "A",
};

const DESIGN: ProductOption = {
  name: "Design Number",
  type: "pills",
  values: ["1", "2"],
  default: "1",
};

const PLAIN: CatalogueEntry = {
  id: "P900",
  name: "Plain Pendant",
  category: "necklaces",
  price: 200,
  mrp: 300,
  image: "/products/P900.webp",
  inStock: true,
};

const BANGLE: CatalogueEntry = { ...PLAIN, id: "P901", name: "Kada", options: [BANGLE_SIZE] };
const LETTER_RING: CatalogueEntry = {
  ...PLAIN,
  id: "P902",
  name: "Initial Ring",
  options: [LETTER],
};
const TWO_GROUPS: CatalogueEntry = {
  ...PLAIN,
  id: "P903",
  name: "Kada Set",
  options: [DESIGN, BANGLE_SIZE],
};
const SOLD_OUT_LETTER_RING: CatalogueEntry = { ...LETTER_RING, id: "P904", inStock: false };

const CATALOGUE = [PLAIN, BANGLE, LETTER_RING, TWO_GROUPS, SOLD_OUT_LETTER_RING];

function Card({ item }: { item: CatalogueEntry }): JSX.Element {
  return (
    <CartProvider catalogue={CATALOGUE}>
      <ToastProvider>
        <ProductCardPurchase item={item} />
      </ToastProvider>
    </CartProvider>
  );
}

async function renderCard(item: CatalogueEntry): Promise<void> {
  await act(async () => {
    render(<Card item={item} />);
  });
}

function readStoredCart(): { productId: string; selectedOptions?: Record<string, string> }[] {
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  return raw === null ? [] : JSON.parse(raw);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("selectCardPurchaseMode", () => {
  it("adds straight away when there are no options", () => {
    expect(selectCardPurchaseMode(undefined).kind).toBe("add");
    expect(selectCardPurchaseMode([]).kind).toBe("add");
  });

  it("shows chips for one group at or below the value limit", () => {
    for (let count = 1; count <= CARD_OPTION_VALUE_LIMIT; count += 1) {
      const option: ProductOption = {
        ...BANGLE_SIZE,
        values: BANGLE_SIZE.values.slice(0, count),
      };
      expect(selectCardPurchaseMode([option])).toEqual({ kind: "choose-on-card", option });
    }
  });

  it("sends one group above the value limit to the product page", () => {
    expect(selectCardPurchaseMode([LETTER]).kind).toBe("choose-on-page");
  });

  it("sends any product with more than one group to the product page, however short", () => {
    expect(selectCardPurchaseMode([DESIGN, BANGLE_SIZE]).kind).toBe("choose-on-page");
  });
});

describe("a product with no options", () => {
  it("adds in one tap, exactly as before", async () => {
    await renderCard(PLAIN);

    expect(screen.queryByRole("radio")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    });

    expect(readStoredCart()).toEqual([
      expect.objectContaining({ productId: "P900", qty: 1 }),
    ]);
    expect(readStoredCart()[0].selectedOptions).toBeUndefined();
  });
});

describe("a product with one short option group", () => {
  it("shows one chip per value with the catalogue default pre-selected", async () => {
    await renderCard(BANGLE);

    const chips = screen.getAllByRole("radio");
    expect(chips.map((chip) => chip.getAttribute("value"))).toEqual(["2.4", "2.6", "2.8"]);
    expect(chips.filter((chip) => (chip as HTMLInputElement).checked)).toHaveLength(1);
    expect((screen.getByRole("radio", { name: "2.4" }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("names the group for a screen reader even though the card does not show it", async () => {
    await renderCard(BANGLE);

    expect(screen.getByRole("group", { name: "Size for bangles" })).toBeTruthy();
  });

  it("adds the default when nothing is tapped", async () => {
    await renderCard(BANGLE);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    });

    expect(readStoredCart()[0].selectedOptions).toEqual({ "Size for bangles": "2.4" });
  });

  it("adds whatever the shopper tapped instead", async () => {
    await renderCard(BANGLE);

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "2.8" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    });

    expect(readStoredCart()[0].selectedOptions).toEqual({ "Size for bangles": "2.8" });
  });
});

describe("a product the card may not ask about", () => {
  it.each([
    ["one group above the value limit", LETTER_RING],
    ["more than one group", TWO_GROUPS],
  ])("links to the product page instead of adding, for %s", async (_label, item) => {
    await renderCard(item);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();

    const link = screen.getByRole("link", { name: CHOOSE_OPTIONS_LABEL });
    expect(link.getAttribute("href")).toBe(`/product/${item.id}`);

    await act(async () => {
      fireEvent.click(link);
    });
    expect(readStoredCart()).toEqual([]);
  });

  it("says sold out rather than offering to choose, when there is nothing to sell", async () => {
    await renderCard(SOLD_OUT_LETTER_RING);

    expect(screen.queryByRole("link")).toBeNull();
    const button = screen.getByRole("button", { name: "Sold out" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe("the real catalogue under the card rule", () => {
  it("never asks a card to render more chips than it has columns for", () => {
    for (const product of getAllProducts()) {
      const mode = selectCardPurchaseMode(product.options);
      if (mode.kind !== "choose-on-card") continue;
      expect(mode.option.values.length).toBeLessThanOrEqual(CARD_OPTION_VALUE_LIMIT);
    }
  });

  it("routes every letter ring to the product page, which is the defect it was named for", () => {
    const letterRings = getAllProducts().filter((product) =>
      (product.options ?? []).some((option) => option.name === "Letter"),
    );

    expect(letterRings.length).toBeGreaterThan(0);
    for (const product of letterRings) {
      expect(selectCardPurchaseMode(product.options).kind).toBe("choose-on-page");
    }
  });

  it("leaves the option-less majority on the unchanged one-tap path", () => {
    const modes = getAllProducts().map((product) =>
      selectCardPurchaseMode(product.options).kind,
    );

    expect(modes.filter((kind) => kind === "add").length).toBeGreaterThan(
      modes.length / 2,
    );
  });
});
