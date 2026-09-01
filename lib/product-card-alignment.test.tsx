/** @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductCardView, ProductOption } from "@/types/product";
import { CartProvider } from "@/lib/cart-context";
import { toCatalogueEntry } from "@/lib/product-view";
import { ToastProvider } from "@/lib/toast-context";
import { ProductCard } from "@/components/ProductCard";

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
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

/**
 * jsdom applies no stylesheet, so this cannot measure a rendered row. The real measurement —
 * a built page, a headless Chromium, `getBoundingClientRect` on every card in a mixed grid row —
 * is `scripts/measure-card-heights.mjs`, and its numbers are recorded in
 * `docs/testing/PLAN-universal-add-to-cart-modal.md`.
 *
 * What this checks is the structure those numbers rest on, which is the part an edit is likely
 * to break: every card renders the same four boxes in the same order whatever the product
 * carries, the name cannot reach a second line, and the one slot whose *content* varies — the
 * options tag — is reserved on the cards that have nothing to put in it. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
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

const BASE: ProductCardView = {
  id: "P900",
  name: "Fixture",
  category: "necklaces",
  pricing: { price: 200, mrp: 300 },
  media: { images: ["/products/P900.webp"] },
  seo: { imageAlt: "A fixture" },
  stock: { inStock: true, quantity: 10 },
  flags: { isNew: false, featured: false, badge: null },
};

const A_NAME_THAT_WOULD_WRAP =
  "Antique Gold Kundan Choker Necklace Set With Matching Jhumka Earrings And Maang Tikka";

const MIXED_ROW: readonly { label: string; product: ProductCardView }[] = [
  { label: "no options", product: { ...BASE, id: "P900" } },
  {
    label: "one short option group",
    product: { ...BASE, id: "P901", options: [SHORT_GROUP] },
  },
  {
    label: "one long option group",
    product: { ...BASE, id: "P902", options: [LONG_GROUP] },
  },
  {
    label: "two option groups",
    product: { ...BASE, id: "P903", options: [LONG_GROUP, SHORT_GROUP] },
  },
  { label: "a name long enough to wrap", product: { ...BASE, id: "P904", name: A_NAME_THAT_WOULD_WRAP } },
  {
    label: "sold out",
    product: { ...BASE, id: "P905", stock: { inStock: false, quantity: 0 } },
  },
];

const CATALOGUE = MIXED_ROW.map((entry) => toCatalogueEntry(entry.product));

const NAME_TRUNCATION_CLASS = "truncate";
const OPTIONS_TAG_CLASS = "h-4";
const ACTION_ROW_CLASS = "h-10";
/** What `fillHeight` puts on the button, and the reason its label cannot change its height. */
const FILL_HEIGHT_CLASS = "h-full";

async function renderCard(product: ProductCardView): Promise<HTMLElement> {
  const view = await act(async () =>
    render(
      <CartProvider catalogue={CATALOGUE}>
        <ToastProvider>
          <ProductCard product={product} />
        </ToastProvider>
      </CartProvider>,
    ),
  );

  const article = view.container.querySelector("article");
  if (!(article instanceof HTMLElement)) throw new Error("Card rendered nothing");
  return article;
}

/** The stack under the photograph: name, price, options tag, action. */
function boxesBelowImage(article: HTMLElement): Element[] {
  const body = article.children[1];
  if (body === undefined) throw new Error("Card has no body below its image");
  return Array.from(body.children);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a mixed grid row keeps one baseline", () => {
  it.each(MIXED_ROW)("renders four boxes below the image for a card with $label", async ({
    product,
  }) => {
    expect(boxesBelowImage(await renderCard(product))).toHaveLength(4);
  });

  it.each(MIXED_ROW)("truncates the name to one line for a card with $label", async ({
    product,
  }) => {
    const [name] = boxesBelowImage(await renderCard(product));

    expect(name.className).toContain(NAME_TRUNCATION_CLASS);
    expect(name.className).not.toContain("line-clamp");
    expect(name.getAttribute("title")).toBe(product.name);
  });

  /**
   * Reserved on the cards that have nothing to say in it, which is the whole reason it is a box
   * rather than a conditional element. 390 of the 449 records carry no options; if the slot
   * appeared only on the 59 that do, those 59 would sit 16px taller than their neighbours.
   */
  it.each(MIXED_ROW)("reserves the options tag row for a card with $label", async ({
    product,
  }) => {
    const [, , tag] = boxesBelowImage(await renderCard(product));

    expect(tag.className).toContain(OPTIONS_TAG_CLASS);
  });

  it.each(MIXED_ROW)("gives the action of a card with $label the reserved height", async ({
    product,
  }) => {
    const boxes = boxesBelowImage(await renderCard(product));
    const action = boxes[3].firstElementChild;

    expect(action?.className).toContain(ACTION_ROW_CLASS);
    expect(action?.firstElementChild?.className).toContain(FILL_HEIGHT_CLASS);
  });

  it("renders the same box structure for every card in the row", async () => {
    const structures: string[][] = [];

    for (const { product } of MIXED_ROW) {
      structures.push(boxesBelowImage(await renderCard(product)).map((box) => box.className));
      cleanup();
    }

    for (const structure of structures) {
      expect(structure).toEqual(structures[0]);
    }
  });

  /**
   * The tag is the only thing on the card that reports anything about the options, and it
   * reports the shape of the question rather than an answer to it. A card that rendered a value
   * would be a card that could record one.
   */
  it("names how many options a card has without naming any of them", async () => {
    const article = await renderCard(MIXED_ROW[1].product);
    const [, , tag] = boxesBelowImage(article);

    expect(tag.textContent).toBe("3 sizes");
    for (const value of SHORT_GROUP.values) {
      expect(article.textContent).not.toContain(value);
    }
  });
});
