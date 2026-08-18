"use client";

import { useState } from "react";
import type { CatalogueEntry, SelectedOptions } from "@/types/product";
import { defaultSelectedOptions, hasProductOptions } from "@/lib/options";
import { MIN_QUANTITY } from "@/lib/quantity";
import { Button } from "@/components/Button";
import { PersonalizedNote } from "@/components/PersonalizedNote";
import { ProductOptionSelector } from "@/components/ProductOptionSelector";
import { QuantityStepper } from "@/components/QuantityStepper";
import { SelectedOptionsSummary } from "@/components/SelectedOptionsSummary";

export type PurchaseHandler = (
  item: CatalogueEntry,
  quantity: number,
  selectedOptions?: SelectedOptions,
) => void;

export interface ProductPurchasePanelProps {
  item: CatalogueEntry;
  onAddToCart: PurchaseHandler;
  onBuyNow: PurchaseHandler;
}

/**
 * Presentational: it owns the selected quantity and the selected options, and nothing else.
 * Cart state is reached through `ProductPurchaseActions`, which supplies both handlers — this
 * panel never imports the cart, so it can be rendered in isolation on `/style-guide`.
 *
 * The selection starts at each group's first value, which is what makes a personalized piece
 * addable without touching a selector. It is echoed above the buttons because a default the
 * shopper never chose still has to be a default they can see. Nothing here reads a price:
 * a choice is recorded, never charged for. See ADR-019.
 */
export function ProductPurchasePanel({
  item,
  onAddToCart,
  onBuyNow,
}: ProductPurchasePanelProps): JSX.Element {
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions | undefined>(
    () => defaultSelectedOptions(item.options),
  );

  const isSoldOut = !item.inStock;
  const isPersonalized = hasProductOptions(item.options);

  function chooseOptionValue(groupName: string, value: string): void {
    setSelectedOptions((current) => ({ ...current, [groupName]: value }));
  }

  return (
    <div className="flex flex-col gap-6">
      {isPersonalized ? (
        <div className="flex flex-col gap-5">
          {item.options?.map((option) => (
            <ProductOptionSelector
              key={option.name}
              option={option}
              value={selectedOptions?.[option.name] ?? option.values[0]}
              disabled={isSoldOut}
              onChange={(value) => chooseOptionValue(option.name, value)}
            />
          ))}

          <p className="text-body-sm text-muted">
            <span className="text-eyebrow uppercase text-muted">Your choice</span>{" "}
            <SelectedOptionsSummary selectedOptions={selectedOptions} />
          </p>
        </div>
      ) : null}

      <QuantityStepper
        value={quantity}
        disabled={isSoldOut}
        onChange={setQuantity}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="flex-1">
          <Button
            fullWidth
            disabled={isSoldOut}
            onClick={() => onAddToCart(item, quantity, selectedOptions)}
          >
            {isSoldOut ? "Sold out" : "Add to cart"}
          </Button>
        </div>

        <div className="flex-1">
          <Button
            variant="secondary"
            fullWidth
            disabled={isSoldOut}
            onClick={() => onBuyNow(item, quantity, selectedOptions)}
          >
            Buy now
          </Button>
        </div>
      </div>

      {isPersonalized ? <PersonalizedNote withExplanation /> : null}

      {isSoldOut ? (
        <p className="text-body-sm text-muted">
          This piece is sold out. It is made in small batches, so it may return — the
          rest of the collection is on the{" "}
          <span className="text-ink">Shop</span> page.
        </p>
      ) : null}
    </div>
  );
}
