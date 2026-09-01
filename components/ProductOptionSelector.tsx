"use client";

import type { ProductOption } from "@/types/product";
import type { OptionControlLayout } from "@/lib/option-control-layout";
import { OptionChipGroup } from "@/components/OptionChipGroup";
import { OptionDropdown } from "@/components/OptionDropdown";
import { OptionPillGroup } from "@/components/OptionPillGroup";
import { OptionSwatchGroup } from "@/components/OptionSwatchGroup";

export interface ProductOptionSelectorProps {
  option: ProductOption;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  /** Overrides what the group's legend or field label reads. The modal passes "Select Size". */
  label?: string;
  /** How much room each value gets. `compact` is the add-to-cart modal's 38px baseline. */
  layout?: OptionControlLayout;
}

/**
 * One option group, rendered with the control the catalogue asked for. The record names the
 * control because the shape of the question is a merchandising decision, not something to
 * infer from how many values happen to be listed: four shapes and four ribbon colours are
 * the same length and not the same question. See ADR-027.
 *
 * **The control type is the same wherever the group is asked about**, and that is the point of
 * routing the add-to-cart modal through here rather than giving it selectors of its own: a
 * letter is a dropdown on the product page, in the cart's line editor and in the modal, because
 * it is the same question in all three. `layout` changes how much room a value gets and nothing
 * about what kind of control draws it.
 *
 * A value the group does not offer means nothing has been chosen yet — the modal opens that way
 * deliberately — and every control renders that as an unselected state rather than resolving it
 * to something. See [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export function ProductOptionSelector({
  option,
  value,
  disabled = false,
  onChange,
  label,
  layout = "flow",
}: ProductOptionSelectorProps): JSX.Element {
  const controlProps = { option, value, disabled, onChange, label };

  switch (option.type) {
    case "dropdown":
      return <OptionDropdown {...controlProps} />;
    case "swatch":
      return <OptionSwatchGroup {...controlProps} layout={layout} />;
    case "pills":
      return <OptionPillGroup {...controlProps} layout={layout} />;
    case "chips":
      return <OptionChipGroup {...controlProps} layout={layout} />;
  }
}
