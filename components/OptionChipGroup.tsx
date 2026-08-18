"use client";

import type { ProductOption } from "@/types/product";
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
}

const chipClasses = `${optionControlBaseClasses} min-w-[3rem] px-4 py-2.5`;

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
}: OptionChipGroupProps): JSX.Element {
  return (
    <OptionRadioGroup
      option={option}
      value={value}
      disabled={disabled}
      onChange={onChange}
      listClassName="flex flex-wrap gap-2"
      itemClassName={(isSelected) =>
        `${chipClasses} ${isSelected ? optionControlSelectedClasses : optionControlUnselectedClasses}`
      }
    />
  );
}
