/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductCardView } from "@/types/product";
import { CartProvider } from "@/lib/cart-context";
import { getAllProducts } from "@/lib/products";
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

afterEach(cleanup);

/**
 * A card name is one line now, clipped with an ellipsis, where it used to be two lines clamped
 * with a reserved second line whether it was needed or not. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 *
 * The risk that buys is real and is the reason for the spot check below: a catalogue whose names
 * share a long prefix would truncate to a column of identical-looking cards, and a shopper
 * scanning a row could not tell two pieces apart. That is a property of *this* catalogue's
 * naming, not of the CSS, so it is asserted against `data/products.json` rather than a fixture.
 */

/** Roughly what fits on one line of `text-body-sm` in a card at the two-abreast phone width. */
const VISIBLE_CHARACTERS = 24;

function truncatedTo(name: string, characters: number): string {
  return name.slice(0, characters);
}

function renderCardFor(product: ProductCardView): HTMLElement {
  const { container } = render(
    <CartProvider catalogue={[]}>
      <ToastProvider>
        <ProductCard product={product} />
      </ToastProvider>
    </CartProvider>,
  );

  const link = container.querySelector("a[href^='/product/']");
  if (!(link instanceof HTMLElement)) throw new Error("Card rendered no name link");
  return link;
}

describe("a card name is one truncated line", () => {
  const A_LONG_NAME =
    "Antique Gold Kundan Choker Necklace Set With Matching Jhumka Earrings And Maang Tikka";

  const LONG_NAMED: ProductCardView = {
    id: "P900",
    name: A_LONG_NAME,
    category: "necklaces",
    pricing: { price: 200, mrp: 300 },
    media: { images: ["/products/P900.webp"] },
    seo: { imageAlt: "A fixture" },
    stock: { inStock: true, quantity: 10 },
    flags: { featured: false, isNew: false, badge: null },
  };

  /**
   * `truncate` is `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` — the three
   * declarations together, which is why the utility is asserted rather than one of them.
   */
  it("clips with an ellipsis rather than wrapping to a second line", () => {
    const name = renderCardFor(LONG_NAMED);

    expect(name.className).toContain("truncate");
    expect(name.className).not.toContain("line-clamp");
    expect(name.className).not.toContain("min-h-");
  });

  /** Clipped in the layout, whole in the DOM: a crawler and a screen reader still get the name. */
  it("keeps the whole name readable to anything that is not laying it out", () => {
    const name = renderCardFor(LONG_NAMED);

    expect(name.textContent).toBe(A_LONG_NAME);
    expect(name.getAttribute("title")).toBe(A_LONG_NAME);
  });
});

describe("the real catalogue's names survive being cut to one line", () => {
  const names = getAllProducts().map((product) => product.name);

  it("has names to check", () => {
    expect(names.length).toBeGreaterThan(400);
  });

  /**
   * The spot check the truncation is worth doing only if it passes: how many pairs of *different*
   * pieces would read as the same card once cut.
   *
   * A handful is tolerable and expected — a shop that sells four colourways of one design will
   * name them alike, and their photographs are what tell them apart on a card. What would not be
   * tolerable is a catalogue where the truncation collapses whole shelves, so this asserts a
   * ceiling rather than zero, and prints the offenders when it trips.
   */
  it("leaves all but a handful of names distinguishable at one line", () => {
    const byPrefix = new Map<string, string[]>();
    for (const name of names) {
      const prefix = truncatedTo(name, VISIBLE_CHARACTERS);
      byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), name]);
    }

    const collided = Array.from(byPrefix.entries()).filter(
      ([, group]) => new Set(group).size > 1,
    );
    const collidedNames = collided.flatMap(([, group]) => group).length;

    expect(
      collidedNames / names.length,
      `names sharing a truncated prefix: ${JSON.stringify(collided.slice(0, 5))}`,
    ).toBeLessThan(0.2);
  });

  /**
   * The first words of a name are what a truncated card shows, so a catalogue where every name
   * opened with the same boilerplate would truncate to one repeated card whatever the ceiling
   * above allows. This checks the opening words are actually varied.
   */
  it("does not open every name with the same words", () => {
    const openings = new Set(names.map((name) => truncatedTo(name, VISIBLE_CHARACTERS)));

    expect(openings.size).toBeGreaterThan(names.length * 0.6);
  });
});
