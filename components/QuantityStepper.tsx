"use client";

import { useId, type ChangeEvent } from "react";
import { MAX_QUANTITY, MIN_QUANTITY, clampQuantity } from "@/lib/quantity";
import { MinusIcon, PlusIcon } from "@/components/icons";

export interface QuantityStepperProps {
  value: number;
  disabled?: boolean;
  /** Names the control for assistive tech when several steppers share a page, as on `/cart`. */
  accessibleLabel?: string;
  onChange: (quantity: number) => void;
}

const stepButtonClasses =
  "inline-flex h-11 w-11 items-center justify-center text-ink transition-colors duration-250 hover:bg-ivory disabled:cursor-not-allowed disabled:text-line disabled:hover:bg-transparent";

export function QuantityStepper({
  value,
  disabled = false,
  accessibleLabel,
  onChange,
}: QuantityStepperProps): JSX.Element {
  const labelId = useId();

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(clampQuantity(Number(event.target.value)));
  }

  return (
    <div className="flex items-center gap-4">
      <span id={labelId} className="text-eyebrow uppercase text-muted">
        Quantity
      </span>

      <div className="inline-flex items-stretch border border-line">
        <button
          type="button"
          onClick={() => onChange(clampQuantity(value - 1))}
          disabled={disabled || value <= MIN_QUANTITY}
          aria-label={`Decrease quantity${accessibleLabel === undefined ? "" : `, ${accessibleLabel}`}`}
          className={stepButtonClasses}
        >
          <MinusIcon className="h-4 w-4" />
        </button>

        <input
          type="number"
          inputMode="numeric"
          min={MIN_QUANTITY}
          max={MAX_QUANTITY}
          value={value}
          disabled={disabled}
          onChange={handleInputChange}
          aria-label={accessibleLabel}
          aria-labelledby={accessibleLabel === undefined ? labelId : undefined}
          className="w-14 border-x border-line bg-white text-center font-sans text-body text-ink [appearance:textfield] disabled:text-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <button
          type="button"
          onClick={() => onChange(clampQuantity(value + 1))}
          disabled={disabled || value >= MAX_QUANTITY}
          aria-label={`Increase quantity${accessibleLabel === undefined ? "" : `, ${accessibleLabel}`}`}
          className={stepButtonClasses}
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
