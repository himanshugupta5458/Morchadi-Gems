"use client";

import type { ProductOption } from "@/types/product";
import {
  optionControlSizeClasses,
  type OptionControlLayout,
} from "@/lib/option-control-layout";
import {
  OptionRadioGroup,
  optionControlBaseClasses,
  optionControlSelectedClasses,
  optionControlUnselectedClasses,
} from "@/components/OptionRadioGroup";

export interface OptionChipGroupProps {
  option: ProductOption;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  label?: string;
  layout?: OptionControlLayout;
}

const flowChipClasses = "min-w-[3rem] px-4 py-2.5";

/**
 * Square-cornered choice chips, for a handful of values a shopper compares against each
 * other rather than scans in order — locket shapes, finishes. Wide enough to hold a word,
 * wrapping to a second row rather than scrolling.
 */
export function OptionChipGroup({
  option,
  value,
  disabled,
  onChange,
  label,
  layout = "flow",
}: OptionChipGroupProps): JSX.Element {
  const chipClasses = `${optionControlBaseClasses} ${optionControlSizeClasses(layout, flowChipClasses)}`;

  return (
    <OptionRadioGroup
      option={option}
      value={value}
      disabled={disabled}
      onChange={onChange}
      label={label}
      listClassName="flex flex-wrap gap-2"
      itemClassName={(isSelected) =>
        `${chipClasses} ${isSelected ? optionControlSelectedClasses : optionControlUnselectedClasses}`
      }
    />
  );
}
