"use client";

import { useState } from "react";
import type { CatalogueEntry } from "@/types/product";
import { MIN_QUANTITY } from "@/lib/quantity";
import { Button } from "@/components/Button";
import { QuantityStepper } from "@/components/QuantityStepper";

export type PurchaseHandler = (item: CatalogueEntry, quantity: number) => void;

export interface ProductPurchasePanelProps {
  item: CatalogueEntry;
  onAddToCart: PurchaseHandler;
  onBuyNow: PurchaseHandler;
}

/**
 * Presentational: it owns the selected quantity and nothing else. Cart state is reached
 * through `ProductPurchaseActions`, which supplies both handlers — this panel never imports
 * the cart, so the quantity control can be rendered in isolation on `/style-guide`.
 */
export function ProductPurchasePanel({
  item,
  onAddToCart,
  onBuyNow,
}: ProductPurchasePanelProps): JSX.Element {
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const isSoldOut = !item.inStock;

  return (
    <div className="flex flex-col gap-6">
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
            onClick={() => onAddToCart(item, quantity)}
          >
            {isSoldOut ? "Sold out" : "Add to cart"}
          </Button>
        </div>

        <div className="flex-1">
          <Button
            variant="secondary"
            fullWidth
            disabled={isSoldOut}
            onClick={() => onBuyNow(item, quantity)}
          >
            Buy now
          </Button>
        </div>
      </div>

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
