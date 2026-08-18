import type { ProductSpecs } from "@/types/product";

export interface SpecRow {
  key: string;
  label: string;
  value: string;
}

/**
 * The order the familiar specs read in, whichever order a product record happens to list
 * them. What a piece is made of comes before how it fastens, which comes before how big it
 * is; anything a product carries beyond these follows in the order it was written.
 */
const PREFERRED_SPEC_ORDER = [
  "material",
  "weight",
  "closure",
  "type",
  "stone",
  "size",
  "colour",
];

/**
 * `specs` is open-ended by design (ADR-027), so a spec's display label cannot come from a
 * fixed table — an unmapped key is a spec the catalogue gained, not a mistake. Keys are
 * lower-case words, and capitalising the first letter is the whole transformation.
 */
function toSpecLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function specRank(key: string): number {
  const index = PREFERRED_SPEC_ORDER.indexOf(key);
  return index === -1 ? PREFERRED_SPEC_ORDER.length : index;
}

export function toSpecRows(specs: ProductSpecs): SpecRow[] {
  return Object.entries(specs)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value], position) => ({ key, label: toSpecLabel(key), value, position }))
    .sort(
      (left, right) =>
        specRank(left.key) - specRank(right.key) || left.position - right.position,
    )
    .map(({ key, label, value }) => ({ key, label, value }));
}
