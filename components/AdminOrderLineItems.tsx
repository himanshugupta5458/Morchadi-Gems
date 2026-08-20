import Image from "next/image";
import type { AdminOrderDetailLine } from "@/lib/admin-order-detail";
import { formatRupees } from "@/lib/format";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";

export interface AdminOrderLineItemsProps {
  lines: readonly AdminOrderDetailLine[];
}

/**
 * What was bought, as the order recorded it.
 *
 * Every field here is a snapshot column rather than a catalogue read — the name, the
 * photograph and the unit price are what they were at capture time, so an order opened a year
 * from now still describes the thing that was actually sold. The product id is shown beside
 * the name because it is what the operator needs to find the item on a shelf, and it is a link
 * to nothing: the catalogue page may have changed or gone, and this row is the record.
 *
 * `unit_cost` is not selected by the query behind this and is not shown. Margin is real data
 * and it belongs to a dashboard, not to the screen used to pack a parcel.
 */
export function AdminOrderLineItems({ lines }: AdminOrderLineItemsProps): JSX.Element {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {lines.map((line) => {
        const options = Object.entries(line.selectedOptions);

        return (
          <li key={line.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
            <span className="relative h-16 w-16 shrink-0 overflow-hidden border border-line bg-white">
              {line.productImage.length === 0 ? (
                <ProductImagePlaceholder />
              ) : (
                <Image
                  src={line.productImage}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
              )}
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-body-sm text-ink">{line.productName}</span>
              <span className="text-eyebrow uppercase tracking-caps-wide text-muted">
                {line.productId}
              </span>
              {options.length === 0 ? null : (
                <span className="text-body-sm text-muted">
                  {options.map(([name, value]) => `${name}: ${value}`).join(" · ")}
                </span>
              )}
            </span>

            <span className="flex shrink-0 flex-col items-end gap-1 text-body-sm">
              <span className="text-ink">{formatRupees(line.lineTotal)}</span>
              <span className="text-muted">
                {line.quantity} × {formatRupees(line.unitPrice)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
