"use client";

import { useId } from "react";
import type { ProductOption } from "@/types/product";
import { fieldBorderClasses, fieldControlClasses } from "@/components/FormField";
import { CaretDownIcon } from "@/components/icons";

/** What an unanswered dropdown reads before anything is picked. */
export const CHOOSE_A_VALUE_LABEL = "Choose…";

export interface OptionDropdownProps {
  option: ProductOption;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  /** What the field's label reads, when the surface wants more than the group's bare name. */
  label?: string;
}

/**
 * A native select, for a group too long to lay out — the twenty-five engraving letters are a
 * list to find your place in, not a set to compare. Native because a shopper on a phone gets
 * their platform's own picker, which no custom listbox matches for typeahead or one-handed
 * reach.
 *
 * **A value the group does not offer shows a disabled placeholder rather than the first
 * letter.** The product page always seeds a selection, so this never fires there; the
 * add-to-cart modal deliberately seeds none, and a select that resolved an empty value by
 * displaying `A` would be the silent default the modal exists to prevent, drawn by the browser
 * instead of by us. See [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export function OptionDropdown({
  option,
  value,
  disabled,
  onChange,
  label,
}: OptionDropdownProps): JSX.Element {
  const selectId = useId();
  const hasChosen = option.values.includes(value);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-eyebrow uppercase text-muted">
        {label ?? option.name}
      </label>

      <div className="relative sm:max-w-[16rem]">
        <select
          id={selectId}
          value={hasChosen ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldControlClasses} ${fieldBorderClasses(false)} appearance-none pr-11`}
        >
          {hasChosen ? null : (
            <option value="" disabled>
              {CHOOSE_A_VALUE_LABEL}
            </option>
          )}
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
