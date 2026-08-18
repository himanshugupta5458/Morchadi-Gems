import { GemOutlineIcon } from "@/components/icons";

export type ProductImagePlaceholderSize = "sm" | "lg";

export interface ProductImagePlaceholderProps {
  size?: ProductImagePlaceholderSize;
}

const iconClasses: Record<ProductImagePlaceholderSize, string> = {
  sm: "h-10 w-10",
  lg: "h-16 w-16",
};

/**
 * Stands in for an empty `images[]`, which is a data error rather than a photo that has
 * not arrived — every catalogued product has a generated placeholder file at its normal
 * path (ADR-006).
 */
export function ProductImagePlaceholder({
  size = "sm",
}: ProductImagePlaceholderProps): JSX.Element {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-ivory">
      <GemOutlineIcon className={`text-gold ${iconClasses[size]}`} />
      <span className="text-eyebrow uppercase text-muted">Image coming soon</span>
    </div>
  );
}
