/** @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueEntry, ProductOption } from "@/types/product";
import { CartProvider } from "@/lib/cart-context";
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

/**
 * jsdom applies no stylesheet, so this cannot measure a rendered row — the manual pass
 * recorded in `docs/testing/PLAN-card-variant-selection.md` is what does that.
 *
 * What it can check is the structure the alignment rests on, which is the part an edit is
 * likely to break: every card, in every mode, renders the same two fixed-height boxes in the
 * same order. A card that stopped reserving the chip row when it had no chips to put in it, or
 * a button that went back to standing up out of its own padding, would pass every behavioural
 * test in this suite and misalign a real grid row. See
 * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
 */
const SHORT_GROUP: ProductOption = {
  name: "Size for bangles",
  type: "pills",
  values: ["2.4", "2.6", "2.8"],
  default: "2.4",
};

const LONG_GROUP: ProductOption = {
  name: "Letter",
  type: "dropdown",
  values: ["A", "B", "C", "D", "E"],
  default: "A",
};

const BASE: CatalogueEntry = {
  id: "P900",
  name: "Fixture",
  price: 200,
  mrp: 300,
  image: "/products/P900.webp",
  inStock: true,
};

const MIXED_ROW: readonly { label: string; item: CatalogueEntry }[] = [
  { label: "no options", item: { ...BASE, id: "P900" } },
  { label: "chips on the card", item: { ...BASE, id: "P901", options: [SHORT_GROUP] } },
  { label: "the long button label", item: { ...BASE, id: "P902", options: [LONG_GROUP] } },
  { label: "sold out", item: { ...BASE, id: "P903", inStock: false } },
];

const CATALOGUE = MIXED_ROW.map((entry) => entry.item);

const CHIP_ROW_CLASS = "h-8";
const ACTION_ROW_CLASS = "h-11";
/** What `fillHeight` puts on the button, and the reason the two modes share a height. */
const FILL_HEIGHT_CLASS = "h-full";

async function renderCardBottom(item: CatalogueEntry): Promise<HTMLElement> {
  const view = await act(async () =>
    render(
      <CartProvider catalogue={CATALOGUE}>
        <ToastProvider>
          <ProductCardPurchase item={item} />
        </ToastProvider>
      </CartProvider>,
    ),
  );

  const root = view.container.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error("Card rendered nothing");
  return root;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a mixed grid row keeps one baseline", () => {
  it.each(MIXED_ROW)("reserves the chip row for a card with $label", async ({ item }) => {
    const root = await renderCardBottom(item);
    const boxes = Array.from(root.children);

    expect(boxes).toHaveLength(2);
    expect(boxes[0].className).toContain(CHIP_ROW_CLASS);
    expect(boxes[1].className).toContain(ACTION_ROW_CLASS);
  });

  it.each(MIXED_ROW)("gives the action of a card with $label the reserved height", async ({
    item,
  }) => {
    const root = await renderCardBottom(item);
    const action = root.children[1].firstElementChild;

    expect(action).not.toBeNull();
    expect(action?.className).toContain(FILL_HEIGHT_CLASS);
  });

  it("renders the same box structure for every mode in the row", async () => {
    const structures: string[][] = [];

    for (const { item } of MIXED_ROW) {
      const root = await renderCardBottom(item);
      structures.push(Array.from(root.children).map((box) => box.className));
      cleanup();
    }

    for (const structure of structures) {
      expect(structure).toEqual(structures[0]);
    }
  });
});
