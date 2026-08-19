"use client";

import Image from "next/image";
import Link from "next/link";
import type { CartLine } from "@/lib/cart";
import { formatRupees } from "@/lib/format";
import { formatSelectedOptions } from "@/lib/options";
import { PersonalizedNote } from "@/components/PersonalizedNote";
import { PriceDisplay } from "@/components/PriceDisplay";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { QuantityStepper } from "@/components/QuantityStepper";
import { SelectedOptionsSummary } from "@/components/SelectedOptionsSummary";
import { CloseIcon } from "@/components/icons";

export interface CartLineItemProps {
  line: CartLine;
  onQuantityChange: (lineKey: string, quantity: number) => void;
  onRemove: (lineKey: string) => void;
}

/**
 * An unavailable line keeps its place in the list rather than disappearing. It shows what the
 * shopper chose, states plainly that it cannot be bought, and offers the one action that
 * unblocks checkout — the stepper and the line total are withdrawn because neither means
 * anything for an item that contributes nothing.
 *
 * Every action addresses `line.key`, not the product id, because one product can hold several
 * lines here — one per recorded choice. See ADR-019.
 */
export function CartLineItem({
  line,
  onQuantityChange,
  onRemove,
}: CartLineItemProps): JSX.Element {
  const { key, entry, selectedOptions, image, quantity, lineTotal, isPayable } = line;
  const productHref = `/product/${entry.id}`;
  const isPersonalized = selectedOptions !== undefined;
  const removeLabel =
    isPersonalized
      ? `Remove ${entry.name} (${formatSelectedOptions(selectedOptions)}) from cart`
      : `Remove ${entry.name} from cart`;
  const quantityLabel = isPersonalized
    ? `${entry.name}, ${formatSelectedOptions(selectedOptions)}`
    : entry.name;

  return (
    <div className="flex gap-4 py-4 sm:gap-6 sm:py-6">
      <Link
        href={productHref}
        aria-hidden
        tabIndex={-1}
        className="relative h-24 w-24 shrink-0 overflow-hidden border border-line bg-ivory sm:h-28 sm:w-28"
      >
        {image === null ? (
          <ProductImagePlaceholder />
        ) : (
          <Image
            src={image}
            alt=""
            fill
            sizes="112px"
            className={`object-contain p-2 ${isPayable ? "" : "opacity-40 grayscale"}`}
          />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <Link
              href={productHref}
              className="text-body text-ink transition-colors duration-250 hover:text-gold-deep"
            >
              {entry.name}
            </Link>

            <SelectedOptionsSummary selectedOptions={selectedOptions} />

            {isPayable ? (
              <PriceDisplay mrp={entry.mrp} price={entry.price} />
            ) : (
              <span className="w-fit bg-charcoal px-2.5 py-1 text-eyebrow uppercase text-ivory">
                Out of stock
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onRemove(key)}
            aria-label={removeLabel}
            className="-mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center text-muted transition-colors duration-250 hover:text-sale"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {isPayable ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <QuantityStepper
              value={quantity}
              accessibleLabel={quantityLabel}
              onChange={(nextQuantity) => onQuantityChange(key, nextQuantity)}
            />
            <span className="font-sans text-body-lg font-medium text-ink">
              {formatRupees(lineTotal)}
            </span>
          </div>
        ) : (
          <p className="text-body-sm text-muted">
            This piece sold out while it was in your cart. Remove it to continue to
            checkout.
          </p>
        )}

        {isPersonalized ? <PersonalizedNote /> : null}
      </div>
    </div>
  );
}
