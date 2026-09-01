/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DESCRIPTION_PREVIEW_CHARACTERS,
  PREVIEW_ELLIPSIS,
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

/** `w0x00 w0x01 …` — a paragraph of whole words, cut to roughly the character count asked for. */
const WORD_LENGTH = "w0x00 ".length;

function charactersOf(charactersEach: readonly number[]): string[] {
  return charactersEach.map((characters, index) =>
    Array.from({ length: Math.ceil(characters / WORD_LENGTH) }, (_word, position) =>
      `w${index}x${String(position).padStart(2, "0")}`,
    ).join(" "),
  );
}

describe("where a long description is cut", () => {
  /**
   * A character budget, not a word budget. 150 words was the floor of the house range the
   * catalogue gate enforces, which meant the *shortest* published descriptions were shown whole
   * — a "preview" the length of the description. About one short paragraph is what a shopper
   * reads before the buy button.
   */
  it("is about one short paragraph", () => {
    expect(DESCRIPTION_PREVIEW_CHARACTERS).toBe(160);
  });

  it("shows a short description whole, with no control to expand", () => {
    const paragraphs = charactersOf([60, 60]);

    const split = splitDescriptionForPreview(paragraphs);

    expect(split.isTruncated).toBe(false);
    expect(split.preview).toBe("");
    expect(split.paragraphs).toEqual(paragraphs);
  });

  it("cuts a long description to the budget and marks it truncated", () => {
    const split = splitDescriptionForPreview(charactersOf([400, 400]));

    expect(split.isTruncated).toBe(true);
    expect(split.preview.length).toBeLessThanOrEqual(
      DESCRIPTION_PREVIEW_CHARACTERS + PREVIEW_ELLIPSIS.length,
    );
    expect(split.preview.endsWith(PREVIEW_ELLIPSIS)).toBe(true);
  });

  /** Cut between words, so a preview never ends mid-word with an ellipsis stuck to a stub. */
  it("cuts at a word boundary", () => {
    const split = splitDescriptionForPreview(charactersOf([600]));
    const shown = split.preview.slice(0, -PREVIEW_ELLIPSIS.length);
    const whole = charactersOf([600])[0];

    expect(whole.startsWith(shown)).toBe(true);
    expect(whole[shown.length]).toBe(" ");
  });

  /**
   * The preview is cut out of the running text of the whole description, not out of its first
   * paragraph. Taking whichever paragraph happens to come first gave a forty-word preview on one
   * piece and a two-hundred-word one on the next, which is what moved the buy button up and down
   * the page as a shopper browsed between them.
   */
  it("is the same length whatever the paragraph lengths are", () => {
    const shortFirst = splitDescriptionForPreview(charactersOf([30, 600]));
    const longFirst = splitDescriptionForPreview(charactersOf([600, 30]));

    expect(shortFirst.isTruncated).toBe(true);
    expect(longFirst.isTruncated).toBe(true);
    expect(
      Math.abs(shortFirst.preview.length - longFirst.preview.length),
    ).toBeLessThanOrEqual(WORD_LENGTH);
  });

  /** Every paragraph comes back whatever the preview holds — this cuts what is shown, not what exists. */
  it("hands back every paragraph, always", () => {
    const paragraphs = charactersOf([400, 400, 400]);

    expect(splitDescriptionForPreview(paragraphs).paragraphs).toEqual(paragraphs);
  });

  it("handles a product with no description at all", () => {
    expect(splitDescriptionForPreview([])).toEqual({
      preview: "",
      paragraphs: [],
      isTruncated: false,
    });
  });

  /**
   * Over the real catalogue: a budget below the house floor of 150 words means nearly every
   * published description truncates, and the handful written short enough to fit are shown
   * whole with no control at all. Both halves are asserted, because a budget that truncated
   * *everything* would be one no description could ever be written under.
   */
  it("truncates nearly every description in the real catalogue, and leaves the short ones whole", () => {
    const splits = getAllProducts().map((product) =>
      splitDescriptionForPreview(getDescriptionParagraphs(product.description)),
    );

    const truncated = splits.filter((split) => split.isTruncated);

    expect(splits.length).toBeGreaterThan(0);
    expect(truncated.length).toBeGreaterThan(splits.length * 0.9);
    expect(splits.some((split) => !split.isTruncated)).toBe(true);
  });

  it("never lets a preview run past the budget", () => {
    for (const product of getAllProducts()) {
      const split = splitDescriptionForPreview(getDescriptionParagraphs(product.description));

      expect(split.preview.length, product.id).toBeLessThanOrEqual(
        DESCRIPTION_PREVIEW_CHARACTERS + PREVIEW_ELLIPSIS.length,
      );
    }
  });
});

describe("the See more control", () => {
  const LONG = splitDescriptionForPreview(charactersOf([400, 400, 400]));

  /**
   * Collapsed, the markup holds the shortened opening *and* all three paragraphs, with the three
   * hidden. A crawler, a reader mode and a browser with JavaScript off all get the whole
   * description; the control shortens the page, never the page's content.
   */
  it("keeps every paragraph in the markup while collapsed, hidden rather than dropped", () => {
    const { container } = render(<ProductDescription description={LONG} />);

    expect(container.querySelectorAll("p")).toHaveLength(4);
    expect(container.querySelectorAll("p[hidden]")).toHaveLength(3);
    expect(container.textContent).toContain(LONG.paragraphs[2]);
  });

  it("shows the preview alone while collapsed", () => {
    const { container } = render(<ProductDescription description={LONG} />);
    const shown = Array.from(container.querySelectorAll("p")).filter(
      (paragraph) => !paragraph.hasAttribute("hidden"),
    );

    expect(shown).toHaveLength(1);
    expect(shown[0].textContent).toBe(LONG.preview);
  });

  it("reveals the rest on click and puts them back on a second click", () => {
    const { container } = render(<ProductDescription description={LONG} />);
    const control = screen.getByRole("button", { name: "See more" });

    expect(control.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(control);

    expect(container.querySelectorAll("p[hidden]")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "See less" }).getAttribute("aria-expanded")).toBe(
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "See less" }));

    expect(container.querySelectorAll("p[hidden]")).toHaveLength(3);
  });

  it("renders no control for a description that fits", () => {
    render(
      <ProductDescription description={splitDescriptionForPreview(charactersOf([60]))} />,
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
