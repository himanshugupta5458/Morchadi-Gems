"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ProductOption, SelectedOptions } from "@/types/product";
import { defaultSelectedOptions } from "@/lib/options";

export interface ProductSelectionValue {
  selectedOptions: SelectedOptions | undefined;
  chooseOptionValue: (optionName: string, value: string) => void;
}

const ProductSelectionContext = createContext<ProductSelectionValue | null>(null);

export interface ProductSelectionProviderProps {
  options?: ProductOption[];
  children: ReactNode;
}

/**
 * Holds the one thing the gallery and the buy panel both need to agree on: which variant the
 * shopper is currently looking at. The panel owns the controls and the gallery owns the
 * picture, they sit in different columns of the product page, and neither can be the other's
 * parent — so the state lives above both.
 *
 * The `children` handed in stay server-rendered. Only the two components that call
 * `useProductSelection` reach the browser, which is what keeps the title, price, specs and
 * reviews out of the client bundle. See ADR-027.
 *
 * The selection is seeded from each group's stated default, so a personalized piece is
 * addable without touching a control. Nothing here reads a price: a choice is recorded and
 * it decides which photograph is shown, never what is charged. See ADR-019.
 */
export function ProductSelectionProvider({
  options,
  children,
}: ProductSelectionProviderProps): JSX.Element {
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions | undefined>(
    () => defaultSelectedOptions(options),
  );

  const chooseOptionValue = useCallback((optionName: string, value: string): void => {
    setSelectedOptions((current) => ({ ...current, [optionName]: value }));
  }, []);

  const value = useMemo(
    () => ({ selectedOptions, chooseOptionValue }),
    [selectedOptions, chooseOptionValue],
  );

  return (
    <ProductSelectionContext.Provider value={value}>
      {children}
    </ProductSelectionContext.Provider>
  );
}

export function useProductSelection(): ProductSelectionValue {
  const context = useContext(ProductSelectionContext);
  if (context === null) {
    throw new Error(
      "useProductSelection must be used inside a ProductSelectionProvider",
    );
  }

  return context;
}
