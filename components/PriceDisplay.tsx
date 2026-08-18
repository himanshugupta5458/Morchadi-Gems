import { calculateDiscountPercent, formatRupees } from "@/lib/format";

export type PriceDisplaySize = "md" | "lg";

export interface PriceDisplayProps {
  mrp: number;
  price: number;
  size?: PriceDisplaySize;
}

const priceClasses: Record<PriceDisplaySize, string> = {
  md: "text-body-lg",
  lg: "text-heading-sm",
};

const mrpClasses: Record<PriceDisplaySize, string> = {
  md: "text-body-sm",
  lg: "text-body",
};

/**
 * The single implementation of the display rules in ADR-003, shared by the card and the
 * product page so the two cannot disagree about what a discount looks like. `mrp` is
 * compare-at only and never enters an amount calculation.
 */
export function PriceDisplay({
  mrp,
  price,
  size = "md",
}: PriceDisplayProps): JSX.Element {
  const discountPercent = calculateDiscountPercent(mrp, price);

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {discountPercent > 0 ? (
        <>
          <span className={`font-sans text-muted line-through ${mrpClasses[size]}`}>
            {formatRupees(mrp)}
          </span>
          <span className={`font-sans font-medium text-sale ${priceClasses[size]}`}>
            {formatRupees(price)}
          </span>
          <span className="bg-sale/10 px-1.5 py-0.5 text-eyebrow uppercase text-sale">
            {discountPercent}% off
          </span>
        </>
      ) : (
        <span className={`font-sans font-medium text-ink ${priceClasses[size]}`}>
          {formatRupees(price)}
        </span>
      )}
    </div>
  );
}
