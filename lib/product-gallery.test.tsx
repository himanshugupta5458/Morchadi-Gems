/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY, buildCartLines } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { ProductSelectionProvider } from "@/lib/product-selection";
import { ToastProvider } from "@/lib/toast-context";
import { resolveVariantImage, selectDisplayImage } from "@/lib/variant-images";
import { CartView } from "@/components/CartView";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductPurchaseActions } from "@/components/ProductPurchaseActions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

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

const NECKLACE_IMAGES = ["/products/P002.webp", "/products/P002-2.webp"];

const WATCH_RING: CatalogueEntry = {
  id: "P010",
  name: "Mini Watch Ring",
  price: 300,
  mrp: 500,
  image: "/products/P010.webp",
  inStock: true,
  options: [
    { name: "Colour", type: "swatch", values: ["Silver", "Golden"], default: "Silver" },
  ],
  variantImages: { "Colour:Golden": "/products/P010-golden.webp" },
};

const NECKLACE: CatalogueEntry = {
  id: "P002",
  name: "Teardrop Glass Locket Necklace",
  price: 450,
  mrp: 999,
  image: NECKLACE_IMAGES[0],
  inStock: true,
};

/**
 * A product carrying both features at once. No catalogued piece does today, and the ranking
 * between a chosen finish and a clicked thumbnail is exactly the part that cannot be checked
 * against a product that has only one of the two.
 */
const BOTH: CatalogueEntry = {
  id: "P900",
  name: "Fixture With Both",
  price: 500,
  mrp: 700,
  image: "/products/P900.webp",
  inStock: true,
  options: [
    { name: "Colour", type: "swatch", values: ["Silver", "Golden"], default: "Silver" },
  ],
  variantImages: { "Colour:Golden": "/products/P900-golden.webp" },
};

const BOTH_IMAGES = ["/products/P900.webp", "/products/P900-2.webp"];

const CATALOGUE: CatalogueEntry[] = [WATCH_RING, NECKLACE, BOTH];

function Gallery({
  item,
  images,
}: {
  item: CatalogueEntry;
  images: string[];
}): JSX.Element {
  return (
    <CartProvider catalogue={CATALOGUE}>
      <ToastProvider>
        <ProductSelectionProvider options={item.options}>
          <ProductGallery
            images={images}
            variantImages={item.variantImages}
            productName={item.name}
          />
          <ProductPurchaseActions item={item} />
        </ProductSelectionProvider>
        <CartView />
      </ToastProvider>
    </CartProvider>
  );
}

function mainImageSrc(): string {
  const images = screen.getAllByRole("img") as HTMLImageElement[];
  return decodeURIComponent(images[0].getAttribute("src") ?? "");
}

function chooseColour(value: string): void {
  fireEvent.click(screen.getByRole("radio", { name: value }));
}

function thumbnails(): HTMLElement[] {
  return screen.queryAllByRole("button", { name: /^Show image / });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the thumbnail strip", () => {
  it("appears when a product carries more than one image", () => {
    render(<Gallery item={NECKLACE} images={NECKLACE_IMAGES} />);

    expect(thumbnails()).toHaveLength(2);
    expect(mainImageSrc()).toContain("P002.webp");
  });

  it("swaps the main image when a thumbnail is clicked", () => {
    render(<Gallery item={NECKLACE} images={NECKLACE_IMAGES} />);

    fireEvent.click(thumbnails()[1]);

    expect(mainImageSrc()).toContain("P002-2.webp");
  });

  it("marks the shown image as current, and only that one", () => {
    render(<Gallery item={NECKLACE} images={NECKLACE_IMAGES} />);

    expect(thumbnails()[0].getAttribute("aria-current")).toBe("true");
    fireEvent.click(thumbnails()[1]);
    expect(thumbnails()[0].getAttribute("aria-current")).toBe("false");
    expect(thumbnails()[1].getAttribute("aria-current")).toBe("true");
  });

  it("is not faked for a product with a single image", () => {
    render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);

    expect(thumbnails()).toHaveLength(0);
  });

  it("is reachable from the keyboard and labelled by position", () => {
    render(<Gallery item={NECKLACE} images={NECKLACE_IMAGES} />);
    const second = thumbnails()[1];

    second.focus();
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute("aria-label")).toBe("Show image 2 of 2");
  });
});

describe("the per-variant image", () => {
  it("swaps the main image when the mapped value is chosen", () => {
    render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);

    expect(mainImageSrc()).toContain("P010.webp");
    chooseColour("Golden");
    expect(mainImageSrc()).toContain("P010-golden.webp");
  });

  it("falls back to the product's own image for an unmapped value", () => {
    render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);

    chooseColour("Golden");
    chooseColour("Silver");

    expect(mainImageSrc()).toContain("P010.webp");
    expect(mainImageSrc()).not.toContain("golden");
  });

  it("overrides a thumbnail the shopper had clicked", () => {
    render(<Gallery item={BOTH} images={BOTH_IMAGES} />);

    fireEvent.click(thumbnails()[1]);
    expect(mainImageSrc()).toContain("P900-2.webp");

    chooseColour("Golden");
    expect(mainImageSrc()).toContain("P900-golden.webp");
  });

  it("lets a thumbnail win again after the choice is made", () => {
    render(<Gallery item={BOTH} images={BOTH_IMAGES} />);

    chooseColour("Golden");
    fireEvent.click(thumbnails()[0]);

    expect(mainImageSrc()).toContain("P900.webp");
    expect(mainImageSrc()).not.toContain("golden");
  });
});

describe("resolveVariantImage", () => {
  it("is null when there is nothing mapped, nothing selected, or no match", () => {
    expect(resolveVariantImage(undefined, { Colour: "Golden" })).toBeNull();
    expect(resolveVariantImage(WATCH_RING.variantImages, undefined)).toBeNull();
    expect(resolveVariantImage(WATCH_RING.variantImages, { Colour: "Silver" })).toBeNull();
  });

  it("falls through to the default image at the call site", () => {
    expect(
      selectDisplayImage("/products/P010.webp", WATCH_RING.variantImages, {
        Colour: "Silver",
      }),
    ).toBe("/products/P010.webp");
    expect(
      selectDisplayImage("/products/P010.webp", WATCH_RING.variantImages, {
        Colour: "Golden",
      }),
    ).toBe("/products/P010-golden.webp");
  });
});

describe("the cart line's thumbnail", () => {
  it("shows the photograph of the variant the line records", () => {
    const lines = buildCartLines(
      [
        { productId: "P010", name: "Mini Watch Ring", price: 300, image: "", qty: 1,
          selectedOptions: { Colour: "Golden" } },
        { productId: "P010", name: "Mini Watch Ring", price: 300, image: "", qty: 1,
          selectedOptions: { Colour: "Silver" } },
      ],
      CATALOGUE,
    );

    expect(lines[0].image).toBe("/products/P010-golden.webp");
    expect(lines[1].image).toBe("/products/P010.webp");
  });

  it("shows the product's own photograph when nothing is mapped", () => {
    const lines = buildCartLines(
      [{ productId: "P002", name: NECKLACE.name, price: 450, image: "", qty: 1 }],
      CATALOGUE,
    );

    expect(lines[0].image).toBe("/products/P002.webp");
  });

  it("reaches the rendered cart line, one line per finish", async () => {
    await act(async () => {
      render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);
    });

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    chooseColour("Golden");
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    const lines = screen.getAllByRole("listitem");
    expect(lines).toHaveLength(2);

    const sources = lines.map((line) => {
      const image = line.querySelector("img");
      return decodeURIComponent(image?.getAttribute("src") ?? "");
    });

    expect(sources[0]).toContain("P010.webp");
    expect(sources[1]).toContain("P010-golden.webp");
  });

  it("stores the variant photograph on the persisted line", async () => {
    await act(async () => {
      render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);
    });

    chooseColour("Golden");
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    const stored = JSON.parse(
      window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]",
    ) as { image: string }[];

    expect(stored[0].image).toBe("/products/P010-golden.webp");
  });
});
