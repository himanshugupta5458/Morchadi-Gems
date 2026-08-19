import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateMetadata } from "@/app/product/[id]/page";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/config";
import { getAllProducts, getImageAlts } from "@/lib/products";

const catalogue = getAllProducts();

/**
 * The measured bounds the metadata was written to, restated here so a hand-edit to
 * products.json fails a test as well as the validator. Counted in code points: the rupee sign
 * is one character, and `String.length` would agree only because it sits in the BMP.
 */
const META_TITLE_RANGE = [50, 60] as const;
const META_DESCRIPTION_RANGE = [140, 160] as const;
const OG_TITLE_RANGE = [40, 70] as const;
const OG_DESCRIPTION_MAX = 200;
const IMAGE_ALT_MAX = 125;

/** WhatsApp shows roughly this much of an og:description before it stops. */
const WHATSAPP_PREVIEW_CHARACTERS = 80;

function characters(text: string): number {
  return Array.from(text).length;
}

function metaFields(product: (typeof catalogue)[number]): string[] {
  return [
    product.seo.metaTitle,
    product.seo.metaDescription,
    product.seo.ogTitle,
    product.seo.ogDescription,
    ...getImageAlts(product),
  ];
}

describe("every product's search and social metadata", () => {
  it("is written for all forty-nine pieces", () => {
    expect(catalogue).toHaveLength(49);
    for (const product of catalogue) {
      expect(product.seo, product.id).toBeDefined();
      for (const field of metaFields(product)) {
        expect(field.trim().length, product.id).toBeGreaterThan(0);
      }
    }
  });

  it("sizes each field for the surface it renders on", () => {
    for (const { id, seo } of catalogue) {
      expect(characters(seo.metaTitle), `${id} metaTitle`).toBeGreaterThanOrEqual(
        META_TITLE_RANGE[0],
      );
      expect(characters(seo.metaTitle), `${id} metaTitle`).toBeLessThanOrEqual(
        META_TITLE_RANGE[1],
      );
      expect(
        characters(seo.metaDescription),
        `${id} metaDescription`,
      ).toBeGreaterThanOrEqual(META_DESCRIPTION_RANGE[0]);
      expect(characters(seo.metaDescription), `${id} metaDescription`).toBeLessThanOrEqual(
        META_DESCRIPTION_RANGE[1],
      );
      expect(characters(seo.ogTitle), `${id} ogTitle`).toBeGreaterThanOrEqual(
        OG_TITLE_RANGE[0],
      );
      expect(characters(seo.ogTitle), `${id} ogTitle`).toBeLessThanOrEqual(OG_TITLE_RANGE[1]);
      expect(characters(seo.ogDescription), `${id} ogDescription`).toBeLessThanOrEqual(
        OG_DESCRIPTION_MAX,
      );
    }
  });

  it("gives every photograph its own alt, none of them longer than a screen reader wants", () => {
    for (const product of catalogue) {
      const alts = getImageAlts(product);
      expect(alts, product.id).toHaveLength(product.media.images.length);
      expect(new Set(alts).size, product.id).toBe(alts.length);
      for (const alt of alts) {
        expect(characters(alt), `${product.id}: ${alt}`).toBeLessThanOrEqual(IMAGE_ALT_MAX);
        expect(alt, product.id).not.toMatch(/^(?:image|picture|photo) of/i);
      }
    }
  });

  it("lands the share-card pitch inside what WhatsApp shows", () => {
    for (const { id, seo } of catalogue) {
      const opening = Array.from(seo.ogDescription)
        .slice(0, WHATSAPP_PREVIEW_CHARACTERS)
        .join("");
      expect(opening.trim().length, id).toBeGreaterThan(0);
      expect(opening, id).toMatch(/[.,]/);
    }
  });

  it("collides on no metaTitle and no primary keyword", () => {
    const titles = catalogue.map((product) => product.seo.metaTitle);
    const keywords = catalogue.map((product) => product.seo.primaryKeyword);
    expect(new Set(titles).size).toBe(catalogue.length);
    expect(new Set(keywords).size).toBe(catalogue.length);
  });

  it("phrases each field independently rather than cloning another", () => {
    for (const product of catalogue) {
      const fields = metaFields(product);
      expect(new Set(fields).size, product.id).toBe(fields.length);
    }
  });

  it("points every share card at the product's own photograph", () => {
    for (const product of catalogue) {
      expect(product.seo.ogImage, product.id).toBe(product.media.images[0]);
    }
  });
});

describe("the honesty rules, applied to the metadata", () => {
  it("claims anti-tarnish only where the product is tagged for it", () => {
    for (const product of catalogue) {
      if ((product.collections ?? []).includes("anti-tarnish")) continue;
      for (const field of metaFields(product)) {
        expect(field, `${product.id}: ${field}`).not.toMatch(/anti-tarnish/i);
      }
    }
  });

  it("never calls a plated piece gold or silver without qualifying it", () => {
    const bareMetal = /\b(?:solid|pure|real|genuine)\s+(?:gold|silver)\b(?!-)/i;
    for (const product of catalogue) {
      for (const field of metaFields(product)) {
        expect(field, `${product.id}: ${field}`).not.toMatch(bareMetal);
      }
    }
  });

  it("uses no promotional adjective the copy rules bar", () => {
    const banned =
      /\b(?:stunning|exquisite|gorgeous|breathtaking|must-have|elevate\w*|effortless\w*|timeless|versatile|luxurious|radiant|captivating|dainty|charming|graceful)\b/i;
    for (const product of catalogue) {
      for (const field of metaFields(product)) {
        expect(field, `${product.id}: ${field}`).not.toMatch(banned);
      }
    }
  });

  it("quotes only the product's own price or the free-shipping threshold", () => {
    for (const product of catalogue) {
      const amounts = Array.from(metaFields(product).join(" ").matchAll(/₹(\d+)/g)).map(
        (match) => Number(match[1]),
      );
      for (const amount of amounts) {
        expect([product.pricing.price, FREE_SHIPPING_THRESHOLD], product.id).toContain(amount);
      }
    }
  });

  it("keeps the validator's copy of the free-shipping threshold in step with the real one", () => {
    const validator = readFileSync("scripts/validate-products.mjs", "utf8");
    expect(validator).toContain(`const FREE_SHIPPING_THRESHOLD = ${FREE_SHIPPING_THRESHOLD};`);
  });
});

describe("what a product page publishes", () => {
  it("takes its title, description and canonical from the product's own record", () => {
    for (const product of catalogue) {
      const metadata = generateMetadata({ params: { id: product.id } });

      expect(metadata.title, product.id).toEqual({ absolute: product.seo.metaTitle });
      expect(metadata.description, product.id).toBe(product.seo.metaDescription);
      expect(metadata.alternates?.canonical, product.id).toBe(`/product/${product.id}`);
    }
  });

  it("gives the share card the product's photograph, sized for an unfurler", () => {
    const [product] = catalogue;
    const metadata = generateMetadata({ params: { id: product.id } });
    const images = metadata.openGraph?.images;

    expect(images).toEqual([
      {
        url: product.seo.ogImage,
        width: 1200,
        height: 630,
        alt: product.seo.imageAlt,
      },
    ]);
  });

  it("mirrors the Open Graph card into the Twitter card", () => {
    for (const product of catalogue) {
      const metadata = generateMetadata({ params: { id: product.id } });

      expect(metadata.openGraph?.title, product.id).toBe(product.seo.ogTitle);
      expect(metadata.openGraph?.description, product.id).toBe(product.seo.ogDescription);
      expect(metadata.twitter?.title, product.id).toBe(metadata.openGraph?.title);
      expect(metadata.twitter?.description, product.id).toBe(
        metadata.openGraph?.description,
      );
      expect(metadata.twitter?.images).toEqual([product.seo.ogImage]);
    }
  });

  it("opts out of the layout's brand template so no title carries the brand twice", () => {
    for (const product of catalogue) {
      const metadata = generateMetadata({ params: { id: product.id } });
      const title = metadata.title as { absolute: string };

      expect(title.absolute, product.id).toBe(product.seo.metaTitle);
      expect(title.absolute, product.id).not.toContain("· Morchadi Gems");
    }
  });

  it("declares the product Open Graph type rather than the site default", () => {
    const metadata = generateMetadata({ params: { id: catalogue[0].id } });
    expect(metadata.other?.["og:type"]).toBe("product");
  });

  it("refuses to index a product id the catalogue does not hold", () => {
    const metadata = generateMetadata({ params: { id: "P999" } });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
