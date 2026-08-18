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

export function ProductDetailsList({
  details,
}: ProductDetailsListProps): JSX.Element {
  const presentRows = DETAIL_ROWS.filter((row) => details[row.key] !== undefined);

  return (
    <dl className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2">
      {presentRows.map((row) => (
        <div key={row.key} className="flex flex-col gap-1.5 bg-white px-5 py-4">
          <dt className="text-eyebrow uppercase text-gold-deep">{row.label}</dt>
          <dd className="text-body-sm text-ink">{details[row.key]}</dd>
        </div>
      ))}
    </dl>
  );
}
