"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem } from "@/types/cart";
import type { CatalogueEntry, SelectedOptions } from "@/types/product";
import {
  CART_STORAGE_KEY,
  addProductToCart,
  buildCartLines,
  changeCartItemOptions,
  calculateCartTotals,
  countCartItems,
  hasUnavailableLine,
  parsePersistedCart,
  reconcileCartWithCatalogue,
  removeProductFromCart,
  setCartItemQuantity,
  type CartLine,
  type CartOptionChange,
} from "@/lib/cart";

export interface CartContextValue {
  items: CartItem[];
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
  hasUnavailableItems: boolean;
  /**
   * False until the persisted cart has been read. Everything renders the empty cart until
   * this flips, which is what keeps the server and first client render identical.
   */
  isHydrated: boolean;
  /**
   * `selectedOptions` may be omitted even for a product that has options — the defaults are
   * applied for a shopper who never touched a selector. A selection the catalogue no longer
   * offers is resolved to the default rather than stored.
   */
  addItem: (
    entry: CatalogueEntry,
    quantity?: number,
    selectedOptions?: SelectedOptions,
  ) => void;
  /** Addressed by `CartLine.key`, not by product id — one product can hold several lines. */
  removeItem: (lineKey: string) => void;
  setQty: (lineKey: string, quantity: number) => void;
  /**
   * Changes a line's recorded choices, returning the refusal when the catalogue no longer
   * offers what was asked for. It returns rather than throws because the caller is a control
   * the shopper is still looking at, and the message belongs beside it. Validated by the same
   * function `/api/create-order` runs — see `changeCartItemOptions`.
   */
  setLineOptions: (
    lineKey: string,
    selectedOptions: SelectedOptions,
  ) => CartOptionChange;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export interface CartProviderProps {
  catalogue: CatalogueEntry[];
  children: ReactNode;
}

function readStoredCart(): string | null {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredCart(items: CartItem[]): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    return;
  }
}

/**
 * The cart lives entirely in the browser — there is no account to attach it to, and the
 * database holds orders rather than carts
 * ([ADR-010](/docs/decisions/ADR-010-cart-architecture.md),
 * [ADR-040](/docs/decisions/ADR-040-postgres-for-orders.md)). `catalogue` is the lean
 * index a Server Component passes in; every price shown or summed comes from it rather than
 * from the persisted snapshot.
 */
export function CartProvider({
  catalogue,
  children,
}: CartProviderProps): JSX.Element {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (isHydrated) return;
    setItems(
      reconcileCartWithCatalogue(parsePersistedCart(readStoredCart()), catalogue),
    );
    setIsHydrated(true);
  }, [catalogue, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    writeStoredCart(items);
  }, [isHydrated, items]);

  const addItem = useCallback(
    (
      entry: CatalogueEntry,
      quantity: number = 1,
      selectedOptions?: SelectedOptions,
    ) => {
      setItems((currentItems) =>
        addProductToCart(currentItems, entry, quantity, selectedOptions),
      );
    },
    [],
  );

  const removeItem = useCallback((lineKey: string) => {
    setItems((currentItems) => removeProductFromCart(currentItems, lineKey));
  }, []);

  const setQty = useCallback((lineKey: string, quantity: number) => {
    setItems((currentItems) => setCartItemQuantity(currentItems, lineKey, quantity));
  }, []);

  const setLineOptions = useCallback(
    (lineKey: string, selectedOptions: SelectedOptions): CartOptionChange => {
      const change = changeCartItemOptions(items, catalogue, lineKey, selectedOptions);
      if (change.error === null) setItems(change.items);
      return change;
    },
    [items, catalogue],
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const lines = buildCartLines(items, catalogue);
    const { subtotal, shipping, total } = calculateCartTotals(lines);

    return {
      items,
      lines,
      itemCount: countCartItems(items),
      subtotal,
      shipping,
      total,
      hasUnavailableItems: hasUnavailableLine(lines),
      isHydrated,
      addItem,
      removeItem,
      setQty,
      setLineOptions,
      clearCart,
    };
  }, [
    items,
    catalogue,
    isHydrated,
    addItem,
    removeItem,
    setQty,
    setLineOptions,
    clearCart,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context === null) {
    throw new Error("useCart must be used inside a CartProvider");
  }
  return context;
}
