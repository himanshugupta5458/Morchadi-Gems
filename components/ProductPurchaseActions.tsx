"use client";

import { useRouter } from "next/navigation";
import type { CatalogueEntry, SelectedOptions } from "@/types/product";
import { useCart } from "@/lib/cart-context";
import { CHECKOUT_ADDRESS_PATH } from "@/lib/navigation";
import { useToast } from "@/lib/toast-context";
import { ADDED_TO_CART_MESSAGE } from "@/components/AddToCartButton";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";

/**
 * The client wrapper that gives `ProductPurchasePanel` its handlers. It is the only part of
 * the product page that reaches the browser besides the header — the gallery, details,
 * reviews and related grid stay server-rendered.
 *
 * Buy now is Add to cart plus a navigation, not a separate purchase path, so the item is in
 * the cart if the shopper backs out of the address step.
 */
export function ProductPurchaseActions({
  item,
}: {
  item: CatalogueEntry;
}): JSX.Element {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const router = useRouter();

  function handleAddToCart(
    entry: CatalogueEntry,
    quantity: number,
    selectedOptions?: SelectedOptions,
  ): void {
    addItem(entry, quantity, selectedOptions);
    showToast(ADDED_TO_CART_MESSAGE);
  }

  function handleBuyNow(
    entry: CatalogueEntry,
    quantity: number,
    selectedOptions?: SelectedOptions,
  ): void {
    addItem(entry, quantity, selectedOptions);
    router.push(CHECKOUT_ADDRESS_PATH);
  }

  return (
    <ProductPurchasePanel
      item={item}
      onAddToCart={handleAddToCart}
      onBuyNow={handleBuyNow}
    />
  );
}
