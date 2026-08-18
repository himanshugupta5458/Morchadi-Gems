import type { ProductDetails } from "@/types/product";

export interface ProductDetailsListProps {
  details: ProductDetails;
}

const DETAIL_ROWS: { key: keyof ProductDetails; label: string }[] = [
  { key: "material", label: "Material" },
  { key: "weight", label: "Weight" },
  { key: "closure", label: "Closure" },
  { key: "type", label: "Type" },
  { key: "stone", label: "Stone" },
  { key: "size", label: "Size" },
];

/**
 * Sits directly under the buy actions rather than in a full-width band further down the
 * page, so the specs a shopper checks before adding to cart are next to the button they
 * check them for. Rows are label-and-value pairs on one line each: a product carries two to
 * four of the six possible specs, and the grid this replaced turned every absent one into
 * an empty cell. Absent specs now take no space at all, and a product with no specs renders
 * nothing. See [ADR-024](/docs/decisions/ADR-024-funnel-ui-polish.md).
 */
export function ProductDetailsList({
  details,
}: ProductDetailsListProps): JSX.Element | null {
  const presentRows = DETAIL_ROWS.filter((row) => details[row.key] !== undefined);
  if (presentRows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-eyebrow uppercase text-gold-deep">Details</h2>

      <dl className="flex flex-col divide-y divide-line border-y border-line">
        {presentRows.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-6 py-2.5"
          >
            <dt className="shrink-0 text-eyebrow uppercase text-muted">{row.label}</dt>
            <dd className="text-right text-body-sm text-ink">{details[row.key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
