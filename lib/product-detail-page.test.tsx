/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DESCRIPTION_PREVIEW_WORDS,
  countWords,
  splitDescriptionForPreview,
} from "@/lib/product-description";
import { describeProductCodAvailability } from "@/lib/cod";
import { LOW_STOCK_THRESHOLD, selectProductBadge } from "@/lib/product-badge";
import { getAllProducts, getDescriptionParagraphs } from "@/lib/products";
import { ProductBadgeTag } from "@/components/ProductBadgeTag";
import { ProductDescription } from "@/components/ProductDescription";
import { ProductCard } from "@/components/ProductCard";
import { CartProvider } from "@/lib/cart-context";
import { ToastProvider } from "@/lib/toast-context";
import { getCatalogueIndex } from "@/lib/products";

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

function paragraphsOf(wordsEach: readonly number[]): string[] {
  return wordsEach.map((words, index) =>
    Array.from({ length: words }, (_word, position) => `w${index}x${position}`).join(" "),
  );
}

describe("where a long description is cut", () => {
  /**
   * The threshold is the floor of the house range the catalogue gate enforces, so it is not a
   * number picked for this component — it is the one every published description already clears.
   */
  it("is the house range's floor", () => {
    expect(DESCRIPTION_PREVIEW_WORDS).toBe(150);
  });

  it("shows a short description whole, with no control to expand", () => {
    const paragraphs = paragraphsOf([40, 40]);

    const split = splitDescriptionForPreview(paragraphs);

    expect(split.isTruncated).toBe(false);
    expect(split.preview).toEqual(paragraphs);
    expect(split.rest).toEqual([]);
  });

  it("holds back the paragraphs past the budget", () => {
    const split = splitDescriptionForPreview(paragraphsOf([80, 80, 80, 80]));

    expect(split.preview).toHaveLength(2);
    expect(split.rest).toHaveLength(2);
    expect(split.isTruncated).toBe(true);
  });

  /**
   * Cut at a paragraph boundary, never at the 150th word — so the preview always ends on a full
   * stop and never needs an ellipsis to admit it stopped mid-clause.
   */
  it("cuts between paragraphs, so the preview is whole sentences", () => {
    const paragraphs = paragraphsOf([90, 90, 90]);
    const split = splitDescriptionForPreview(paragraphs);

    for (const shown of split.preview) expect(paragraphs).toContain(shown);
    expect([...split.preview, ...split.rest]).toEqual(paragraphs);
    expect(countWords(split.preview.join(" "))).toBeGreaterThanOrEqual(
      DESCRIPTION_PREVIEW_WORDS,
    );
  });

  it("always shows the first paragraph, however long it is", () => {
    const split = splitDescriptionForPreview(paragraphsOf([400, 20]));

    expect(split.preview).toHaveLength(1);
    expect(split.rest).toHaveLength(1);
  });

  it("does not truncate when there would be nothing behind the control", () => {
    const split = splitDescriptionForPreview(paragraphsOf([400]));

    expect(split.isTruncated).toBe(false);
    expect(split.rest).toEqual([]);
  });

  it("handles a product with no description at all", () => {
    expect(splitDescriptionForPreview([])).toEqual({
      preview: [],
      rest: [],
      isTruncated: false,
    });
  });

  /**
   * Over the real catalogue: the longest descriptions truncate and the shortest do not, which is
   * what choosing the floor of the range rather than its middle buys.
   */
  it("truncates the long half of the real catalogue and leaves the short half whole", () => {
    const splits = getAllProducts().map((product) =>
      splitDescriptionForPreview(getDescriptionParagraphs(product.description)),
    );

    expect(splits.some((split) => split.isTruncated)).toBe(true);
    expect(splits.some((split) => !split.isTruncated)).toBe(true);
  });
});

describe("the See more control", () => {
  const LONG = splitDescriptionForPreview(paragraphsOf([90, 90, 90]));

  it("keeps every paragraph in the markup while collapsed, hidden rather than dropped", () => {
    const { container } = render(<ProductDescription description={LONG} />);

    expect(container.querySelectorAll("p")).toHaveLength(3);
    expect(container.querySelectorAll("p[hidden]")).toHaveLength(1);
  });

  it("reveals the rest on click and puts them back on a second click", () => {
    const { container } = render(<ProductDescription description={LONG} />);
    const control = screen.getByRole("button", { name: "See more" });

    expect(control.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(control);

    expect(container.querySelectorAll("p[hidden]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "See less" }).getAttribute("aria-expanded")).toBe(
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "See less" }));

    expect(container.querySelectorAll("p[hidden]")).toHaveLength(1);
  });

  it("renders no control for a description that fits", () => {
    render(
      <ProductDescription description={splitDescriptionForPreview(paragraphsOf([40]))} />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the stock indicator on a product page", () => {
  /**
   * The page and the card run **the same** cascade through the same component. This is a
   * shared-logic test rather than a second copy of the rules: it asserts the two surfaces agree
   * for every product in the catalogue, so a rule changed in `selectProductBadge` moves both.
   */
  it("says exactly what the card says, for every product in the catalogue", () => {
    for (const product of getAllProducts()) {
      const expected = selectProductBadge(product.stock, product.flags);

      const { container } = render(
        <ProductBadgeTag stock={product.stock} flags={product.flags} />,
      );
      const rendered = container.textContent ?? "";
      cleanup();

      if (expected === null) {
        expect(rendered, product.id).toBe("");
      } else {
        expect(rendered, product.id).toBe(expected.label);
      }
    }
  });

  it("shows the same badge on the card and on the page for a sold-out piece", () => {
    const soldOut = getAllProducts().find(
      (product) => !product.stock.inStock || product.stock.quantity === 0,
    );
    if (soldOut === undefined) throw new Error("No sold-out product in the catalogue");

    const pageBadge = render(
      <ProductBadgeTag stock={soldOut.stock} flags={soldOut.flags} />,
    ).container.textContent;
    cleanup();

    const card = render(
      <CartProvider catalogue={getCatalogueIndex()}>
        <ToastProvider>
          <ProductCard product={soldOut} />
        </ToastProvider>
      </CartProvider>,
    );

    expect(pageBadge).toBe("Sold Out");
    expect(card.container.textContent).toContain("Sold Out");
  });

  it("counts down rather than merchandising once the shelf is low", () => {
    const stock = { inStock: true, quantity: LOW_STOCK_THRESHOLD };
    const flags = { featured: true, isNew: true, badge: "trending" as const };

    const { container } = render(<ProductBadgeTag stock={stock} flags={flags} />);

    expect(container.textContent).toBe(`Only ${LOW_STOCK_THRESHOLD} left`);
  });

  it("renders no element at all when the cascade chooses nothing", () => {
    const { container } = render(
      <ProductBadgeTag
        stock={{ inStock: true, quantity: 9 }}
        flags={{ featured: false, isNew: false, badge: null }}
      />,
    );

    expect(container.innerHTML).toBe("");
  });
});

describe("what the page says about paying", () => {
  it("offers cash on delivery on a piece with no prepayment floor", () => {
    expect(describeProductCodAvailability(0)).toContain("Cash on delivery available");
  });

  it("quotes the floor rather than promising cash on delivery when there is one", () => {
    const line = describeProductCodAvailability(500);

    expect(line).not.toContain("Cash on delivery available");
    expect(line).toContain("₹500");
  });

  /**
   * Derived from the field the checkout's own rule reads, so a product page cannot promise
   * cash on delivery on a piece `isCartCodEligible` would refuse it on.
   */
  it("agrees with the eligibility rule for every product in the catalogue", () => {
    for (const product of getAllProducts()) {
      const line = describeProductCodAvailability(product.pricing.minPrepaidAmount);
      const isEligible = product.pricing.minPrepaidAmount === 0;

      expect(line.includes("Cash on delivery available"), product.id).toBe(isEligible);
    }
  });
});
