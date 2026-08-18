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
