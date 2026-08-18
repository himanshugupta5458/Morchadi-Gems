"use client";

import type { ProductOption } from "@/types/product";
import { getSwatchInk } from "@/lib/swatches";
import {
  OptionRadioGroup,
  optionControlBaseClasses,
  optionControlSelectedClasses,
  optionControlUnselectedClasses,
} from "@/components/OptionRadioGroup";

export interface OptionSwatchGroupProps {
  option: ProductOption;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

const swatchClasses = `${optionControlBaseClasses} gap-2.5 px-4 py-2.5`;

/**
 * A colour dot beside its name, never a dot alone. The name is what carries the meaning —
 * "Antique Gold" and "Cream Shimmer" are finishes a flat hex code cannot honestly stand in
 * for — so the dot is a hint and the label is the answer, which also means a finish with no
 * ink mapped simply shows no dot and still reads correctly.
 */
export function OptionSwatchGroup({
  option,
  value,
  disabled,
  onChange,
}: OptionSwatchGroupProps): JSX.Element {
  return (
    <OptionRadioGroup
      option={option}
      value={value}
      disabled={disabled}
      onChange={onChange}
      listClassName="flex flex-wrap gap-2"
      itemClassName={(isSelected) =>
        `${swatchClasses} ${isSelected ? optionControlSelectedClasses : optionControlUnselectedClasses}`
      }
      renderContent={(optionValue) => {
        const ink = getSwatchInk(optionValue);

        return (
          <>
            {ink === null ? null : (
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 rounded-full border border-line"
                style={{ backgroundColor: ink }}
              />
            )}
            <span>{optionValue}</span>
          </>
        );
      }}
    />
  );
}
