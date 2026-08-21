/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY, buildCartLines } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { ProductSelectionProvider } from "@/lib/product-selection";
import { ToastProvider } from "@/lib/toast-context";
import {
  buildGalleryImages,
  resolveVariantImage,
  selectDisplayImage,
} from "@/lib/variant-images";
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

/** Every value mapped, so both directions of the swatch have a thumbnail to reach. */
const FULLY_MAPPED: CatalogueEntry = {
  id: "P901",
  name: "Fixture Fully Mapped",
  price: 500,
  mrp: 700,
  image: "/products/P901.webp",
  inStock: true,
  options: [
    { name: "Colour", type: "swatch", values: ["Silver", "Golden"], default: "Silver" },
  ],
  variantImages: {
    "Colour:Golden": "/products/P901-golden.webp",
    "Colour:Silver": "/products/P901-silver.webp",
  },
};

/** A mapping that points at a photograph already listed in `images`. */
const SELF_MAPPED: CatalogueEntry = {
  id: "P902",
  name: "Fixture Mapped To Its Own Image",
  price: 500,
  mrp: 700,
  image: "/products/P902.webp",
  inStock: true,
  options: [
    { name: "Colour", type: "swatch", values: ["Silver", "Golden"], default: "Silver" },
  ],
  variantImages: { "Colour:Golden": "/products/P902-2.webp" },
};

const SELF_MAPPED_IMAGES = ["/products/P902.webp", "/products/P902-2.webp"];

/** Enough photographs that the strip cannot show them all at once. */
const MANY: CatalogueEntry = {
  id: "P903",
  name: "Fixture With Many Images",
  price: 500,
  mrp: 700,
  image: "/products/P903.webp",
  inStock: true,
  options: [
    { name: "Shape", type: "chips", values: ["Round", "Oval"], default: "Round" },
  ],
  variantImages: { "Shape:Oval": "/products/P903-oval.webp" },
};

const MANY_IMAGES = [
  "/products/P903.webp",
  "/products/P903-2.webp",
  "/products/P903-3.webp",
  "/products/P903-4.webp",
  "/products/P903-5.webp",
  "/products/P903-6.webp",
];

const SINGLE: CatalogueEntry = {
  id: "P904",
  name: "Fixture With One Image",
  price: 500,
  mrp: 700,
  image: "/products/P904.webp",
  inStock: true,
};

const CATALOGUE: CatalogueEntry[] = [
  WATCH_RING,
  NECKLACE,
  BOTH,
  FULLY_MAPPED,
  SELF_MAPPED,
  MANY,
  SINGLE,
];

function Gallery({
  item,
  images,
}: {
  item: CatalogueEntry;
  images: string[];
}): JSX.Element {
  const imageAlts = images.map((_image, index) => `${item.name}, view ${index + 1}`);

  return (
    <CartProvider catalogue={CATALOGUE}>
      <ToastProvider>
        <ProductSelectionProvider options={item.options}>
          <ProductGallery
            images={images}
            imageAlts={imageAlts}
            variantImages={item.variantImages}
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

function isChosen(value: string): boolean {
  return (screen.getByRole("radio", { name: value }) as HTMLInputElement).checked;
}

function thumbnails(): HTMLElement[] {
  return screen.queryAllByRole("button", { name: /^Show image / });
}

function thumbnailFor(label: string | RegExp): HTMLElement {
  return screen.getByRole("button", { name: label });
}

function currentThumbnailLabel(): string | null {
  const current = thumbnails().find(
    (thumbnail) => thumbnail.getAttribute("aria-current") === "true",
  );
  return current?.getAttribute("aria-label") ?? null;
}

function earlierArrow(): HTMLElement | null {
  return screen.queryByRole("button", { name: "Show earlier thumbnails" });
}

function laterArrow(): HTMLElement | null {
  return screen.queryByRole("button", { name: "Show later thumbnails" });
}

function cartLines(): HTMLElement[] {
  return screen
    .getAllByRole("listitem")
    .filter((line) => line.querySelector('[aria-label^="Remove "]') !== null);
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

  it("is not faked for a product with one image and no mapping", () => {
    render(<Gallery item={SINGLE} images={["/products/P904.webp"]} />);

    expect(thumbnails()).toHaveLength(0);
    expect(earlierArrow()).toBeNull();
    expect(laterArrow()).toBeNull();
  });

  it("is reachable from the keyboard and labelled by position", () => {
    render(<Gallery item={NECKLACE} images={NECKLACE_IMAGES} />);
    const second = thumbnails()[1];

    second.focus();
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute("aria-label")).toBe("Show image 2 of 2");
  });
});

describe("the unified strip", () => {
  it("gives every mapped photograph a thumbnail of its own", () => {
    render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);

    expect(thumbnails()).toHaveLength(2);
    expect(thumbnailFor("Show image 2 of 2, Colour Golden")).toBeTruthy();
  });

  it("lists master images before mapped ones, in record order", () => {
    render(<Gallery item={BOTH} images={BOTH_IMAGES} />);

    expect(thumbnails().map((thumbnail) => thumbnail.getAttribute("aria-label"))).toEqual([
      "Show image 1 of 3",
      "Show image 2 of 3",
      "Show image 3 of 3, Colour Golden",
    ]);
  });

  it("shows a mapped photograph when its own thumbnail is clicked", () => {
    render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);

    fireEvent.click(thumbnailFor(/Colour Golden$/));

    expect(mainImageSrc()).toContain("P010-golden.webp");
  });

  it("records the option value that a clicked mapped thumbnail stands for", () => {
    render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);

    expect(isChosen("Silver")).toBe(true);
    fireEvent.click(thumbnailFor(/Colour Golden$/));

    expect(isChosen("Golden")).toBe(true);
    expect(isChosen("Silver")).toBe(false);
  });

  it("keeps the swatch and the picture agreeing in both directions", () => {
    render(<Gallery item={FULLY_MAPPED} images={["/products/P901.webp"]} />);

    fireEvent.click(thumbnailFor(/Colour Golden$/));
    expect(mainImageSrc()).toContain("P901-golden.webp");
    expect(isChosen("Golden")).toBe(true);

    chooseColour("Silver");
    expect(mainImageSrc()).toContain("P901-silver.webp");
    expect(isChosen("Silver")).toBe(true);
    expect(currentThumbnailLabel()).toBe("Show image 3 of 3, Colour Silver");
  });

  it("leaves the recorded choice alone when a master image is clicked", () => {
    render(<Gallery item={BOTH} images={BOTH_IMAGES} />);

    chooseColour("Golden");
    fireEvent.click(thumbnails()[0]);

    expect(mainImageSrc()).toContain("P900.webp");
    expect(isChosen("Golden")).toBe(true);
  });

  it("always marks exactly one thumbnail as current, including on a mapped image", () => {
    render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);

    chooseColour("Golden");

    const current = thumbnails().filter(
      (thumbnail) => thumbnail.getAttribute("aria-current") === "true",
    );
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute("aria-label")).toBe("Show image 2 of 2, Colour Golden");
  });

  it("does not list a photograph twice when a mapping points at a master image", () => {
    render(<Gallery item={SELF_MAPPED} images={SELF_MAPPED_IMAGES} />);

    expect(thumbnails()).toHaveLength(2);
    expect(buildGalleryImages(SELF_MAPPED_IMAGES, SELF_MAPPED.variantImages)).toEqual([
      { src: "/products/P902.webp", variant: null },
      { src: "/products/P902-2.webp", variant: null },
    ]);
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

describe("the strip's navigation arrows", () => {
  it("stay away until there are more photographs than the strip shows", () => {
    render(<Gallery item={NECKLACE} images={NECKLACE_IMAGES} />);
    expect(earlierArrow()).toBeNull();
    expect(laterArrow()).toBeNull();

    cleanup();
    render(<Gallery item={MANY} images={MANY_IMAGES.slice(0, 4)} />);
    expect(thumbnails()).toHaveLength(5);
    expect(earlierArrow()).toBeNull();
    expect(laterArrow()).toBeNull();
  });

  it("appear once the photographs outnumber the strip", () => {
    render(<Gallery item={MANY} images={MANY_IMAGES} />);

    expect(thumbnails()).toHaveLength(5);
    expect(earlierArrow()).toBeTruthy();
    expect(laterArrow()).toBeTruthy();
  });

  it("keep the window full rather than ending on a half-empty page", () => {
    render(<Gallery item={MANY} images={MANY_IMAGES} />);

    fireEvent.click(laterArrow() as HTMLElement);

    expect(thumbnails()).toHaveLength(5);
  });

  it("page forward and back through the photographs", () => {
    render(<Gallery item={MANY} images={MANY_IMAGES} />);

    expect(thumbnails()[0].getAttribute("aria-label")).toBe("Show image 1 of 7");
    expect(earlierArrow()?.hasAttribute("disabled")).toBe(true);

    fireEvent.click(laterArrow() as HTMLElement);
    expect(thumbnails().map((thumbnail) => thumbnail.getAttribute("aria-label"))).toEqual([
      "Show image 3 of 7",
      "Show image 4 of 7",
      "Show image 5 of 7",
      "Show image 6 of 7",
      "Show image 7 of 7, Shape Oval",
    ]);
    expect(laterArrow()?.hasAttribute("disabled")).toBe(true);

    fireEvent.click(earlierArrow() as HTMLElement);
    expect(thumbnails()[0].getAttribute("aria-label")).toBe("Show image 1 of 7");
  });

  it("open on a window that already contains a mapped default value's photograph", () => {
    render(<Gallery item={MANY} images={MANY_IMAGES.slice(0, 5)} />);

    expect(currentThumbnailLabel()).toBe("Show image 1 of 6");

    cleanup();
    render(<Gallery item={FULLY_MAPPED} images={MANY_IMAGES} />);

    expect(mainImageSrc()).toContain("P901-silver.webp");
    expect(currentThumbnailLabel()).toBe("Show image 8 of 8, Colour Silver");
  });

  it("bring the shown photograph into view when a choice moves it out of the window", () => {
    render(<Gallery item={MANY} images={MANY_IMAGES} />);

    expect(screen.queryByRole("button", { name: /Shape Oval$/ })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Oval" }));

    expect(mainImageSrc()).toContain("P903-oval.webp");
    expect(currentThumbnailLabel()).toBe("Show image 7 of 7, Shape Oval");
  });
});

describe("the strip's arrow keys", () => {
  it("step the shown photograph forward and back", () => {
    render(<Gallery item={BOTH} images={BOTH_IMAGES} />);
    const strip = thumbnails()[0].closest("ul") as HTMLUListElement;

    fireEvent.keyDown(strip, { key: "ArrowRight" });
    expect(mainImageSrc()).toContain("P900-2.webp");

    fireEvent.keyDown(strip, { key: "ArrowLeft" });
    expect(mainImageSrc()).toContain("P900.webp");
  });

  it("record the option value when they land on a mapped photograph", () => {
    render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);
    const strip = thumbnails()[0].closest("ul") as HTMLUListElement;

    fireEvent.keyDown(strip, { key: "ArrowRight" });

    expect(mainImageSrc()).toContain("P010-golden.webp");
    expect(isChosen("Golden")).toBe(true);
  });

  it("stop at the ends rather than wrapping", () => {
    render(<Gallery item={BOTH} images={BOTH_IMAGES} />);
    const strip = thumbnails()[0].closest("ul") as HTMLUListElement;

    fireEvent.keyDown(strip, { key: "ArrowLeft" });
    expect(mainImageSrc()).toContain("P900.webp");

    fireEvent.keyDown(strip, { key: "ArrowRight" });
    fireEvent.keyDown(strip, { key: "ArrowRight" });
    fireEvent.keyDown(strip, { key: "ArrowRight" });
    expect(mainImageSrc()).toContain("P900-golden.webp");
  });

  it("move focus onto the thumbnail they land on", () => {
    render(<Gallery item={BOTH} images={BOTH_IMAGES} />);
    const strip = thumbnails()[0].closest("ul") as HTMLUListElement;

    thumbnails()[0].focus();
    fireEvent.keyDown(strip, { key: "ArrowRight" });

    expect(document.activeElement).toBe(thumbnails()[1]);
  });

  it("leave other keys to the browser", () => {
    render(<Gallery item={BOTH} images={BOTH_IMAGES} />);
    const strip = thumbnails()[0].closest("ul") as HTMLUListElement;

    fireEvent.keyDown(strip, { key: "ArrowDown" });

    expect(mainImageSrc()).toContain("P900.webp");
  });
});

describe("buildGalleryImages", () => {
  it("is just the images for a product that maps nothing", () => {
    expect(buildGalleryImages(NECKLACE_IMAGES, undefined)).toEqual([
      { src: "/products/P002.webp", variant: null },
      { src: "/products/P002-2.webp", variant: null },
    ]);
  });

  it("carries the option and value each mapped photograph stands for", () => {
    expect(buildGalleryImages(["/products/P901.webp"], FULLY_MAPPED.variantImages)).toEqual([
      { src: "/products/P901.webp", variant: null },
      {
        src: "/products/P901-golden.webp",
        variant: { optionName: "Colour", value: "Golden" },
      },
      {
        src: "/products/P901-silver.webp",
        variant: { optionName: "Colour", value: "Silver" },
      },
    ]);
  });

  it("drops a mapping whose key cannot name an option and a value", () => {
    expect(buildGalleryImages(["/products/P905.webp"], { Colour: "/products/P905-2.webp" })).toEqual(
      [
        { src: "/products/P905.webp", variant: null },
        { src: "/products/P905-2.webp", variant: null },
      ],
    );
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

    const lines = cartLines();
    expect(lines).toHaveLength(2);

    const sources = lines.map((line) => {
      const image = line.querySelector("img");
      return decodeURIComponent(image?.getAttribute("src") ?? "");
    });

    expect(sources[0]).toContain("P010.webp");
    expect(sources[1]).toContain("P010-golden.webp");
  });

  it("records the finish a clicked thumbnail stands for", async () => {
    await act(async () => {
      render(<Gallery item={WATCH_RING} images={["/products/P010.webp"]} />);
    });

    fireEvent.click(thumbnailFor(/Colour Golden$/));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    const stored = JSON.parse(
      window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]",
    ) as { selectedOptions?: Record<string, string> }[];

    expect(stored[0].selectedOptions).toEqual({ Colour: "Golden" });
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
