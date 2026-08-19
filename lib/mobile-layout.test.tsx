/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/types/product";
import { getAllProducts } from "@/lib/products";
import { ProductGrid } from "@/components/ProductGrid";

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
 * What is under test is which grid items the cap hides, not what a card renders. The real
 * card reaches for cart context through `AddToCartButton`, so standing it up here would mean
 * mounting a provider to assert a `className` on the `li` above it.
 */
vi.mock("@/components/ProductCard", () => ({
  ProductCard: ({ product }: { product: Product }) => <div>{product.name}</div>,
}));

afterEach(cleanup);

function eightProducts(): Product[] {
  return getAllProducts().slice(0, 8);
}

function gridItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll("li"));
}

describe("ADR-033 mobile product cap", () => {
  /**
   * The cap is a rendering concern, not a data one. Everything the desktop grid shows has to
   * stay in the markup — a phone that hides four cards and a crawler that never sees them are
   * two different things, and only the first was asked for.
   */
  it("keeps every product in the markup", () => {
    render(<ProductGrid products={eightProducts()} mobileLimit={4} />);

    expect(gridItems()).toHaveLength(8);
  });

  it("hides only the products past the limit, and restores them at sm", () => {
    render(<ProductGrid products={eightProducts()} mobileLimit={4} />);
    const items = gridItems();

    for (const shown of items.slice(0, 4)) {
      expect(shown.className).toBe("h-full");
    }
    for (const capped of items.slice(4)) {
      expect(capped.className).toContain("hidden");
      expect(capped.className).toContain("sm:list-item");
    }
  });

  /**
   * `sm:list-item` rather than `sm:block`: an `li` is a `list-item` by default, so that is the
   * value the desktop grid had before the cap existed and the value it has to get back.
   */
  it("restores the default display of a list item, not a generic block", () => {
    render(<ProductGrid products={eightProducts()} mobileLimit={4} />);

    expect(gridItems()[4].className).not.toContain("sm:block");
  });

  it("hides nothing when no limit is given", () => {
    render(<ProductGrid products={eightProducts()} />);

    for (const item of gridItems()) {
      expect(item.className).toBe("h-full");
    }
  });

  it("hides nothing when the limit covers the whole set", () => {
    render(<ProductGrid products={eightProducts()} mobileLimit={8} />);

    for (const item of gridItems()) {
      expect(item.className).toBe("h-full");
    }
  });

  /**
   * The capped strip is only honest if the rest is one tap away, and the link has to sit after
   * the grid on a phone rather than above it. The header link and the mobile call to action are
   * separate elements with different labels, so a screen reader is not offered the same name
   * twice for the same destination.
   */
  it("gives each capped strip a mobile call to action to the full collection", () => {
    const home = readFileSync("app/page.tsx", "utf8");

    for (const collection of ["new-arrivals", "best-sellers"]) {
      expect(home).toContain(`<ButtonLink href={buildCollectionHref("${collection}")}`);
    }
    expect(home).toContain('<div className="hidden shrink-0 sm:flex">');
    expect(home).toContain('<div className="sm:hidden">');
  });
});

describe("ADR-033 mobile layout", () => {
  it("shows the hero photograph only from sm up", () => {
    const hero = readFileSync("components/Hero.tsx", "utf8");

    expect(hero).toContain("hidden aspect-[2/1] w-full sm:block");
  });

  /**
   * `priority` preloads regardless of `display:none`, so hiding the frame is not by itself
   * enough to stop a phone paying for the photograph. The `sizes` hint is what does it, and it
   * has to keep resolving to `100vw` above the breakpoint.
   */
  it("points the hero preload away from the full-width source below sm", () => {
    expect(readFileSync("components/Hero.tsx", "utf8")).toContain(
      'sizes="(min-width: 640px) 100vw, 1vw"',
    );
  });

  it("scrolls the categories below sm and grids them above", () => {
    const grid = readFileSync("components/CategoryGrid.tsx", "utf8");

    for (const mobile of ["flex", "snap-x", "snap-mandatory", "overflow-x-auto", "w-[40%]", "shrink-0", "snap-start"]) {
      expect(grid).toContain(mobile);
    }
    for (const restored of ["sm:grid", "sm:snap-none", "sm:overflow-x-visible", "sm:w-auto", "sm:shrink", "sm:snap-align-none", "sm:mr-0"]) {
      expect(grid).toContain(restored);
    }
  });

  /**
   * A right-hand bleed only reaches the viewport edge if it matches the container's padding,
   * and that padding is 20px below `sm` and 24px from `sm`. A single -24px bleed overhangs a
   * phone by 4px, which is a horizontally scrolling page. Both carousels pair the two.
   */
  it.each([
    ["components/CategoryGrid.tsx", "-mr-5", "sm:mr-0"],
    ["components/TestimonialCarousel.tsx", "-mr-5", "sm:-mr-6"],
  ])("matches %s's bleed to the container padding at each width", (file, base, up) => {
    const source = readFileSync(file, "utf8");

    expect(source).toContain(base);
    expect(source).toContain(up);
    expect(source).not.toMatch(/["\s]-mr-6 /);
  });

  it("lays the footer out two-up below sm and restores its columns above", () => {
    const footer = readFileSync("components/Footer.tsx", "utf8");

    expect(footer).toContain("grid grid-cols-2");
    expect(footer).toContain("sm:grid-cols-2");
    expect(footer).toContain("lg:grid-cols-7");
    expect(footer).toContain("col-span-2 flex flex-col gap-4 sm:col-span-1 lg:col-span-2");
    expect(footer).toContain("col-span-2 flex flex-col gap-4 sm:col-span-1");
  });

  /**
   * Two columns of links is denser than one, so a footer link stops being a bare 22px line box
   * and becomes a padded block below `sm`. It goes back to an inline box above, because that is
   * what the desktop footer has always been.
   */
  it("gives footer links a real touch target below sm only", () => {
    const footer = readFileSync("components/Footer.tsx", "utf8");

    expect(footer).toContain("block py-1 text-body-sm");
    expect(footer).toContain("sm:inline sm:py-0");
  });
});
