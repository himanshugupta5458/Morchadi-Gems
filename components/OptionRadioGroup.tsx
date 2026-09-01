"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import type { ProductOption } from "@/types/product";

export interface OptionRadioGroupProps {
  option: ProductOption;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  listClassName: string;
  itemClassName: (isSelected: boolean) => string;
  renderContent?: (optionValue: string, isSelected: boolean) => ReactNode;
  className?: string;
  /**
   * What the legend reads, when the surface wants something other than the group's bare name.
   * The add-to-cart modal passes "Select Size for bangles"; the product page passes nothing and
   * gets the name. It is one string rather than a visible label beside a hidden legend, so the
   * accessible name and the printed one can never say different things.
   */
  label?: string;
  /**
   * Where the group's name is shown, or `sr-only` to keep it as the accessible name alone.
   * Every surface shows it today; the prop stays because a surface with one row of vertical
   * space to spend may still need to hide it.
   */
  legendClassName?: string;
}

/**
 * The wiring every choose-one-of-a-few control needs, with no opinion about how it looks.
 * Swatches, pills and chips each supply their own classes and, if they draw more than text,
 * their own content — and get arrow-key navigation, the group's accessible name, the checked
 * state and a visible focus ring without re-implementing any of them.
 *
 * Radios rather than buttons is the whole point: a row of buttons has none of that for free.
 */
export function OptionRadioGroup({
  option,
  value,
  disabled,
  onChange,
  listClassName,
  itemClassName,
  renderContent,
  label,
  className = "flex flex-col gap-3",
  legendClassName = "text-eyebrow uppercase text-muted",
}: OptionRadioGroupProps): JSX.Element {
  const groupId = useId();

  return (
    <fieldset className={className}>
      <legend className={legendClassName}>{label ?? option.name}</legend>

      <div className={listClassName}>
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
              <label htmlFor={inputId} className={itemClassName(isSelected)}>
                {renderContent === undefined
                  ? optionValue
                  : renderContent(optionValue, isSelected)}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Shared by all three radio controls, so focus and the disabled state read identically. */
export const optionControlBaseClasses =
  "inline-flex cursor-pointer items-center justify-center border font-sans text-body-sm transition-colors duration-250 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-deep";

export const optionControlSelectedClasses = "border-charcoal bg-charcoal text-ivory";

export const optionControlUnselectedClasses =
  "border-line bg-white text-ink hover:border-charcoal peer-disabled:cursor-not-allowed peer-disabled:border-line peer-disabled:text-muted";
