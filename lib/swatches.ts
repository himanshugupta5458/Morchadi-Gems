/**
 * The ink a colour swatch is painted with. Hand-kept rather than derived, because the
 * catalogue's colour names are finishes — "Antique Gold", "Lilac Shimmer" — and no algorithm
 * turns a finish into a hex code.
 *
 * A colour with no entry here is not a fault: the swatch control always writes the value out
 * as text beside the dot, so an unmapped finish still reads correctly and simply shows no
 * dot. See [ADR-027](/docs/decisions/ADR-027-product-schema-migration.md).
 */
const SWATCH_INK: Record<string, string> = {
  silver: "#C7CBCE",
  golden: "#C6A24C",
  gold: "#C6A24C",
  "rose gold": "#D9A6A0",
  "antique gold": "#AE8843",
  "ivory white": "#F6F1E7",
  "cream shimmer": "#EFE1C7",
  "lilac shimmer": "#CBBBDB",
  black: "#1C1C1C",
  white: "#FFFFFF",
};

export function getSwatchInk(value: string): string | null {
  return SWATCH_INK[value.trim().toLowerCase()] ?? null;
}
