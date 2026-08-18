"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { CART_PATH } from "@/lib/navigation";
import { CartIcon } from "@/components/icons";

export interface CartLinkProps {
  withLabel?: boolean;
  onNavigate?: () => void;
}

export function CartLink({
  withLabel = false,
  onNavigate,
}: CartLinkProps): JSX.Element {
  const { itemCount } = useCart();
  const accessibleLabel =
    itemCount === 0 ? "Cart, empty" : `Cart, ${itemCount} items`;

  return (
    <Link
      href={CART_PATH}
      onClick={onNavigate}
      aria-label={accessibleLabel}
      className="inline-flex items-center gap-2.5 text-ink transition-colors duration-250 hover:text-gold-deep"
    >
      <span className="relative inline-flex">
        <CartIcon className="h-6 w-6" />
        {itemCount > 0 ? (
          <span className="absolute -right-2 -top-1.5 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-maroon px-1 text-[0.625rem] font-medium leading-none text-ivory">
            {itemCount}
          </span>
        ) : null}
      </span>
      {withLabel ? (
        <span className="text-label uppercase tracking-caps">Cart</span>
      ) : null}
    </Link>
  );
}
