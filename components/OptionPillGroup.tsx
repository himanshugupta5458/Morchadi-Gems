"use client";

import type { ProductOption } from "@/types/product";
import {
  OptionRadioGroup,
  optionControlBaseClasses,
  optionControlSelectedClasses,
  optionControlUnselectedClasses,
} from "@/components/OptionRadioGroup";

export interface OptionPillGroupProps {
  option: ProductOption;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

const pillClasses = `${optionControlBaseClasses} min-w-[3.25rem] rounded-full px-5 py-2.5`;

/**
 * A row of rounded pills, for a short ordered scale — sizes, lengths. The rounding is what
 * separates it from a chip at a glance: a pill reads as a point on a scale, a chip as one
 * item from a set.
 */
export function OptionPillGroup({
  option,
  value,
  disabled,
  onChange,
}: OptionPillGroupProps): JSX.Element {
  return (
    <OptionRadioGroup
      option={option}
      value={value}
      disabled={disabled}
      onChange={onChange}
      listClassName="flex flex-wrap gap-2"
      itemClassName={(isSelected) =>
        `${pillClasses} ${isSelected ? optionControlSelectedClasses : optionControlUnselectedClasses}`
      }
    />
  );
}
