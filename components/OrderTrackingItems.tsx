import Image from "next/image";
import type { PublicOrderItem } from "@/lib/order-tracking";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";

export interface OrderTrackingItemsProps {
  items: readonly PublicOrderItem[];
}

/**
 * What is in the parcel, with the photograph of each piece.
 *
 * The name, the picture and the recorded choice are snapshot columns on `order_line_items`, so
 * a customer opening this months later sees what they actually bought rather than what the
 * catalogue says today. No price per line: what the order is worth is stated once, in the
 * payment summary beside this. See
 * [ADR-071](/docs/decisions/ADR-071-order-tracking-detail-and-timestamps.md).
 */
export function OrderTrackingItems({ items }: OrderTrackingItemsProps): JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((item) => {
        const chosen = Object.entries(item.selectedOptions);

        return (
          <li key={item.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
            <span className="relative h-16 w-16 shrink-0 overflow-hidden border border-line bg-white">
              {item.productImage.length === 0 ? (
                <ProductImagePlaceholder />
              ) : (
                <Image
                  src={item.productImage}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
              )}
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-body-sm text-ink">{item.productName}</span>
              {chosen.length === 0 ? null : (
                <span className="text-body-sm text-muted">
                  {chosen.map(([name, value]) => `${name}: ${value}`).join(" · ")}
                </span>
              )}
            </span>

            <span className="shrink-0 text-eyebrow uppercase tracking-caps text-muted">
              {`× ${item.quantity}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
