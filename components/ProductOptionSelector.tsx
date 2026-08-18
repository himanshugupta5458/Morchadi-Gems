"use client";

import { useId } from "react";
import type { ProductOption } from "@/types/product";
import { fieldBorderClasses, fieldControlClasses } from "@/components/FormField";
import { CaretDownIcon } from "@/components/icons";

export interface ProductOptionSelectorProps {
  option: ProductOption;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/**
 * Above this many values a row of chips wraps into a wall and stops being scannable, so the
 * control becomes a native select instead. Twenty-five engraving letters are a list; four
 * locket shapes are a set of choices you want to see at once.
 */
const MAX_CHIP_VALUES = 6;

const chipClasses =
  "inline-flex min-w-[3rem] cursor-pointer items-center justify-center border px-4 py-2.5 font-sans text-body-sm transition-colors duration-250 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-deep";

const selectedChipClasses = "border-charcoal bg-charcoal text-ivory";
const unselectedChipClasses =
  "border-line bg-white text-ink hover:border-charcoal peer-disabled:cursor-not-allowed peer-disabled:border-line peer-disabled:text-muted";

/**
 * One option group. Every group has a value at all times — the product page seeds it with the
 * group's first value — so there is no empty state and no "please choose" to fail on.
 *
 * Chips are radio inputs rather than buttons, which is what makes arrow-key navigation, the
 * group's accessible name, and the checked state work without re-implementing any of them.
 */
export function ProductOptionSelector({
  option,
  value,
  disabled = false,
  onChange,
}: ProductOptionSelectorProps): JSX.Element {
  const groupId = useId();
  const isChipLayout = option.values.length <= MAX_CHIP_VALUES;

  if (!isChipLayout) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={groupId} className="text-eyebrow uppercase text-muted">
          {option.name}
        </label>

        <div className="relative sm:max-w-[16rem]">
          <select
            id={groupId}
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

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-eyebrow uppercase text-muted">{option.name}</legend>

      <div className="flex flex-wrap gap-2">
        {option.values.map((optionValue) => {
          const inputId = `${groupId}-${optionValue}`;
          const isSelected = optionValue === value;

          return (
            <div key={optionValue}>
              <input
                type="radio"
                id={inputId}
                name={groupId}
                value={optionValue}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onChange(optionValue)}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                className={`${chipClasses} ${isSelected ? selectedChipClasses : unselectedChipClasses}`}
              >
                {optionValue}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
