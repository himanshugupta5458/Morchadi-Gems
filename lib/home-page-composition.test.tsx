/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HOME_CATEGORIES,
  HOME_CATEGORY_LIMIT,
  HOME_HIDDEN_CATEGORIES,
  SURFACED_CATEGORIES,
  selectHomeCategories,
  type CategoryOption,
} from "@/types/product";
import { HOME_MOBILE_PRODUCT_COUNT, HOME_NEW_ARRIVALS_COUNT } from "@/lib/home-page";
import { getAllProducts, getNewArrivals, getSecondaryImage } from "@/lib/products";
import { getCollectionCovers } from "@/lib/collection-cover";
import { getAllSocialProof, getSocialProof } from "@/lib/social-proof";
import { isProductInCollection } from "@/lib/shop";
import { CategoryGrid } from "@/components/CategoryGrid";
import { SocialProofSection } from "@/components/SocialProofSection";
import { TrustStrip, TrustStripCompact } from "@/components/TrustStrip";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

afterEach(cleanup);

const HOME_PAGE_SOURCE = readFileSync("app/(storefront)/page.tsx", "utf8");

describe("the home page's category grid", () => {
  it("shows exactly ten tiles", () => {
    expect(HOME_CATEGORIES).toHaveLength(10);
    expect(HOME_CATEGORY_LIMIT).toBe(10);
  });

  it("gets to ten by holding gift hampers back, not by truncating the eleventh", () => {
    expect(SURFACED_CATEGORIES).toHaveLength(11);
    expect(HOME_HIDDEN_CATEGORIES).toEqual(["gift-hampers"]);
    expect(HOME_CATEGORIES.map((category) => category.slug)).not.toContain("gift-hampers");
    expect(HOME_CATEGORIES.map((category) => category.slug)).toContain("hair-accessories");
  });

  /**
   * Held back from one grid, not withdrawn from the shop. Gift hampers is still `surfaced`, so
   * the nav, the shop facets and the sitemap all still list it — the tile grid is the only
   * surface that leaves it out.
   */
  it("leaves gift hampers browsable everywhere else", () => {
    const giftHampers = SURFACED_CATEGORIES.find(
      (category) => category.slug === "gift-hampers",
    );

    expect(giftHampers?.status).toBe("surfaced");
  });

  it("keeps the surfaced order rather than resorting them", () => {
    const expected = SURFACED_CATEGORIES.filter(
      (category) => category.slug !== "gift-hampers",
    ).map((category) => category.slug);

    expect(HOME_CATEGORIES.map((category) => category.slug)).toEqual(expected);
  });

  /**
   * The rule tested over categories that do not exist, the way `selectSurfacedCategories` is —
   * so this checks the cap and the exclusion rather than the one category held back today.
   */
  it("applies the cap independently of the exclusion", () => {
    const twelve: CategoryOption[] = Array.from({ length: 12 }, (_unused, index) => ({
      slug: "rings",
      label: `Category ${index}`,
      status: "surfaced",
    }));

    expect(selectHomeCategories(twelve)).toHaveLength(HOME_CATEGORY_LIMIT);
    expect(selectHomeCategories(twelve, 3)).toHaveLength(3);
  });

  it("renders one tile per home category and links none of them to gift hampers", () => {
    const { container } = render(<CategoryGrid />);
    const links = Array.from(container.querySelectorAll("a"));

    expect(links).toHaveLength(10);
    expect(links.map((link) => link.getAttribute("href"))).not.toContain(
      "/shop?category=gift-hampers",
    );
  });
});

describe("the new arrivals strip", () => {
  it("previews eight pieces", () => {
    expect(HOME_NEW_ARRIVALS_COUNT).toBe(8);
    expect(getNewArrivals(HOME_NEW_ARRIVALS_COUNT)).toHaveLength(8);
  });

  it("is a cap rather than the whole flagged catalogue", () => {
    const everyFlagged = getAllProducts().filter((product) => product.flags.isNew);

    expect(everyFlagged.length).toBeGreaterThan(HOME_NEW_ARRIVALS_COUNT);
  });

  it("shows fewer than that on a phone, with the rest revealed at the breakpoint", () => {
    expect(HOME_MOBILE_PRODUCT_COUNT).toBeLessThan(HOME_NEW_ARRIVALS_COUNT);
  });

  it("offers a see-all link beside the heading and a full-width one on a phone", () => {
    expect(HOME_PAGE_SOURCE).toContain('label="See all"');
    expect(HOME_PAGE_SOURCE).toContain(
      '<ButtonLink href={buildCollectionHref("new-arrivals")}',
    );
  });
});

describe("the promise band", () => {
  it("claims top notch quality rather than anti-tarnish on every order", () => {
    const { container } = render(<TrustStrip />);

    expect(container.textContent).toContain("Top notch quality");
    expect(container.textContent).not.toContain("Anti-Tarnish Quality");
  });

  /**
   * The compact strip is a second rendering of the same four promises, never a second copy of
   * them: it reads the same array, so the free-shipping threshold and the returns window cannot
   * differ between the top of the page and the bottom.
   */
  it("says the same four things in its compact form", () => {
    const full = render(<TrustStrip />).container.textContent ?? "";
    cleanup();
    const compact = render(<TrustStripCompact />).container.textContent ?? "";

    for (const promise of ["Secure Payments", "Free Shipping Over", "Returns", "Top notch quality"]) {
      expect(full).toContain(promise);
      expect(compact).toContain(promise);
    }
  });

  /**
   * The compact form is *inside* the hero now, under its two calls to action, rather than in a
   * band below it — it answers the question the buttons raise, and a shopper who has to scroll
   * past the fold to find it has already decided without it. The full band stays where it was
   * for anyone reading the page top to bottom. See
   * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
   */
  it("puts the compact form inside the hero and keeps the full one further down", () => {
    const heroSource = readFileSync("components/Hero.tsx", "utf8");
    const ctaAt = heroSource.indexOf("Explore Categories");
    const compactAt = heroSource.indexOf("<TrustStripCompact />");

    expect(compactAt).toBeGreaterThan(ctaAt);
    expect(HOME_PAGE_SOURCE).not.toContain("<TrustStripCompact />");

    const fullAt = HOME_PAGE_SOURCE.indexOf("<TrustStrip />");
    const categoriesAt = HOME_PAGE_SOURCE.indexOf("<CategoryGrid />");
    expect(fullAt).toBeGreaterThan(categoriesAt);
  });

  /**
   * The search box left the home page for the header, so it is on every shop page rather than
   * only on `/`. The header is where this is now asserted; what matters here is that the band it
   * used to live in is gone rather than duplicated.
   */
  it("no longer carries a search box of its own", () => {
    expect(HOME_PAGE_SOURCE).not.toContain("<ProductSearch");
    expect(readFileSync("components/Header.tsx", "utf8")).toContain("<ProductSearch");
  });
});

describe("the collection tiles", () => {
  it("gives every collection a photograph of a piece that collection actually holds", () => {
    const products = getAllProducts();

    for (const cover of getCollectionCovers()) {
      expect(cover.image, `${cover.slug} has no cover`).not.toBeNull();

      const owner = products.find(
        (product) => product.media.images[0] === cover.image,
      );
      expect(owner, `${cover.slug}'s cover belongs to no product`).toBeDefined();
      expect(
        isProductInCollection(owner as NonNullable<typeof owner>, cover.slug),
        `${cover.slug} is represented by a piece that is not in it`,
      ).toBe(true);
    }
  });

  it("links each tile at the collection it depicts", () => {
    for (const cover of getCollectionCovers()) {
      expect(cover.href).toBe(`/shop?collection=${cover.slug}`);
    }
  });
});

describe("the hover photograph on a product card", () => {
  it("is offered only by the products that have a second photograph", () => {
    const withSecond = getAllProducts().filter(
      (product) => getSecondaryImage(product) !== null,
    );

    expect(withSecond.length).toBeGreaterThan(0);
    expect(withSecond.length).toBeLessThan(getAllProducts().length);

    for (const product of withSecond) {
      expect(getSecondaryImage(product)).toBe(product.media.images[1]);
    }
  });

  it("is null for a product photographed once, so no swap and no placeholder", () => {
    const single = getAllProducts().find((product) => product.media.images.length === 1);

    expect(single).toBeDefined();
    expect(getSecondaryImage(single as NonNullable<typeof single>)).toBeNull();
  });
});

describe("the curated social proof", () => {
  /**
   * It ships empty, and empty is the finished state: this shop has substantiated no customer
   * quote and licensed no customer photograph, and a band of invented ones is the thing
   * ADR-034 removed. The mechanism is here; the content is the owner's to supply.
   */
  it("holds nothing until somebody curates something real", () => {
    expect(getAllSocialProof()).toEqual([]);
  });

  it("renders nothing at all rather than an empty band with a heading over it", () => {
    const { container } = render(<SocialProofSection entries={getSocialProof()} />);

    expect(container.innerHTML).toBe("");
  });

  it("renders the photograph, the words and the attribution once there is an entry", () => {
    const { container } = render(
      <SocialProofSection
        entries={[
          {
            id: "one",
            image: "/social/one.webp",
            alt: "A gold anklet on a wrist",
            quote: "It has not tarnished once.",
            attribution: "Meera",
          },
        ]}
      />,
    );

    expect(container.textContent).toContain("It has not tarnished once.");
    expect(container.textContent).toContain("Meera");
    expect(container.querySelector("img")?.getAttribute("alt")).toBe(
      "A gold anklet on a wrist",
    );
  });
});

describe("the vertical rhythm between home sections", () => {
  /**
   * The two gaps measured at close to a full empty screen. Roughly a third off each step, which
   * is the reduction that was asked for; asserted as the exact class strings because Tailwind
   * generates the utilities by reading these literals.
   */
  it("tightens the bands above the collection tiles and above the promise", () => {
    const source = readFileSync("lib/home-page.ts", "utf8");

    expect(source).toContain('"py-7 sm:py-11 lg:py-16"');
    expect(source).toContain('"py-10 sm:py-16 lg:py-24"');
    expect(HOME_PAGE_SOURCE.match(/\$\{HOME_TIGHT_SECTION_PADDING\}/g)).toHaveLength(2);
  });
});
