"use client";

import type { ProductOption } from "@/types/product";
import { OptionChipGroup } from "@/components/OptionChipGroup";
import { OptionDropdown } from "@/components/OptionDropdown";
import { OptionPillGroup } from "@/components/OptionPillGroup";
import { OptionSwatchGroup } from "@/components/OptionSwatchGroup";

export interface ProductOptionSelectorProps {
  option: ProductOption;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/**
 * One option group, rendered with the control the catalogue asked for. The record names the
 * control because the shape of the question is a merchandising decision, not something to
 * infer from how many values happen to be listed: four shapes and four ribbon colours are
 * the same length and not the same question. See ADR-027.
 *
 * Every group has a value at all times — the selection is seeded from `option.default` — so
 * there is no empty state and no "please choose" to fail on.
 */
export function ProductOptionSelector({
  option,
  value,
  disabled = false,
  onChange,
}: ProductOptionSelectorProps): JSX.Element {
  const controlProps = { option, value, disabled, onChange };

  switch (option.type) {
    case "dropdown":
      return <OptionDropdown {...controlProps} />;
    case "swatch":
      return <OptionSwatchGroup {...controlProps} />;
    case "pills":
      return <OptionPillGroup {...controlProps} />;
    case "chips":
      return <OptionChipGroup {...controlProps} />;
  }
}
