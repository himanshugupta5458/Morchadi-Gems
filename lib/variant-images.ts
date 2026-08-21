import type { SelectedOptions, VariantImages } from "@/types/product";

const VARIANT_KEY_SEPARATOR = ":";

/** `Colour:Golden` — how a per-variant photograph is addressed in `media.variantImages`. */
export function variantImageKey(optionName: string, value: string): string {
  return `${optionName}${VARIANT_KEY_SEPARATOR}${value}`;
}

/**
 * The photograph a selection asks for, or null when nothing in the mapping matches it.
 *
 * A product may map only some of its option values — one plating colour photographed, the
 * other not — and a selection that names an unmapped value is not an error: it falls through
 * to the product's own photograph at the call site. Groups are read in the order the record
 * lists them, so a product mapping two groups has a stated precedence rather than an
 * accidental one.
 *
 * Nothing here reads or returns an amount. A variant image is display data, exactly like the
 * choice that selects it. See [ADR-027](/docs/decisions/ADR-027-product-schema-migration.md).
 */
export function resolveVariantImage(
  variantImages: VariantImages | undefined,
  selectedOptions: SelectedOptions | undefined,
): string | null {
  if (variantImages === undefined || selectedOptions === undefined) return null;

  for (const [optionName, value] of Object.entries(selectedOptions)) {
    const image = variantImages[variantImageKey(optionName, value)];
    if (typeof image === "string" && image.length > 0) return image;
  }

  return null;
}

/**
 * What the main image should be for a given selection: the variant's photograph when there
 * is one, the product's own otherwise. The single expression of that rule, so the gallery,
 * the cart line and the receipt cannot disagree about which picture belongs to a line.
 */
export function selectDisplayImage(
  defaultImage: string | null,
  variantImages: VariantImages | undefined,
  selectedOptions: SelectedOptions | undefined,
): string | null {
  return resolveVariantImage(variantImages, selectedOptions) ?? defaultImage;
}

/** The option group and value a mapped photograph belongs to. */
export interface VariantImageOwner {
  optionName: string;
  value: string;
}

/**
 * The inverse of `variantImageKey`. Returns null for a key that does not carry a separator
 * in a usable position, so a malformed record degrades to "this image belongs to no value"
 * rather than to a group named after half a key.
 */
export function parseVariantImageKey(key: string): VariantImageOwner | null {
  const separatorIndex = key.indexOf(VARIANT_KEY_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex >= key.length - 1) return null;

  return {
    optionName: key.slice(0, separatorIndex),
    value: key.slice(separatorIndex + 1),
  };
}

/** One entry in the gallery strip, and which option value it stands for if it stands for one. */
export interface GalleryImage {
  src: string;
  variant: VariantImageOwner | null;
}

/**
 * Every photograph a product has, in one ordered list: its own images first, in record
 * order, then each mapped variant photograph the list does not already contain.
 *
 * De-duplication is by path, so a product that maps a value to a photograph already in
 * `images` gets one thumbnail rather than two identical ones. The master entry wins that
 * collision and keeps its `variant: null`, because a photograph listed in `images` is a view
 * of the piece that happens to also serve a value, not a value's own portrait.
 *
 * See [ADR-050](/docs/decisions/ADR-050-unified-gallery-strip.md).
 */
export function buildGalleryImages(
  images: string[],
  variantImages: VariantImages | undefined,
): GalleryImage[] {
  const gallery: GalleryImage[] = [];
  const seen = new Set<string>();

  for (const src of images) {
    if (seen.has(src)) continue;
    seen.add(src);
    gallery.push({ src, variant: null });
  }

  for (const [key, src] of Object.entries(variantImages ?? {})) {
    if (typeof src !== "string" || src.length === 0 || seen.has(src)) continue;
    seen.add(src);
    gallery.push({ src, variant: parseVariantImageKey(key) });
  }

  return gallery;
}

/** Where `src` sits in the gallery strip, or 0 when it is not in it at all. */
export function galleryIndexOf(gallery: GalleryImage[], src: string): number {
  const index = gallery.findIndex((entry) => entry.src === src);
  return index === -1 ? 0 : index;
}
