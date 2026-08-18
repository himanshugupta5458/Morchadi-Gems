"use client";

import { useId } from "react";
import type { ProductOption } from "@/types/product";
import { fieldBorderClasses, fieldControlClasses } from "@/components/FormField";
import { CaretDownIcon } from "@/components/icons";

export interface OptionDropdownProps {
  option: ProductOption;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/**
 * A native select, for a group too long to lay out — the twenty-five engraving letters are a
 * list to find your place in, not a set to compare. Native because a shopper on a phone gets
 * their platform's own picker, which no custom listbox matches for typeahead or one-handed
 * reach.
 */
export function OptionDropdown({
  option,
  value,
  disabled,
  onChange,
}: OptionDropdownProps): JSX.Element {
  const selectId = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-eyebrow uppercase text-muted">
        {option.name}
      </label>

      <div className="relative sm:max-w-[16rem]">
        <select
          id={selectId}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldControlClasses} ${fieldBorderClasses(false)} appearance-none pr-11`}
        >
          {option.values.map((optionValue) => (
            <option key={optionValue} value={optionValue}>
              {optionValue}
            </option>
          ))}
        </select>

        <CaretDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}
