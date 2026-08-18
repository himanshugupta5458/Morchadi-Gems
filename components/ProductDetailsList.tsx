import type { ProductSpecs } from "@/types/product";
import { toSpecRows } from "@/lib/specs";

export interface ProductDetailsListProps {
  specs: ProductSpecs;
}

/**
 * Sits directly under the buy actions rather than in a full-width band further down the
 * page, so the specs a shopper checks before adding to cart are next to the button they
 * check them for. Rows are label-and-value pairs on one line each, and a product with no
 * specs renders nothing. See ADR-024 and ADR-027.
 */
export function ProductDetailsList({
  specs,
}: ProductDetailsListProps): JSX.Element | null {
  const rows = toSpecRows(specs);
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-eyebrow uppercase text-gold-deep">Details</h2>

      <dl className="flex flex-col divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-6 py-2.5"
          >
            <dt className="shrink-0 text-eyebrow uppercase text-muted">{row.label}</dt>
            <dd className="text-right text-body-sm text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
