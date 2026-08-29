"use client";

import { useId } from "react";
import type { PaymentPath } from "@/types/order";
import { formatRupees } from "@/lib/format";

export interface PaymentChoiceOption {
  path: PaymentPath;
  label: string;
  /** The amount this option collects now. Rendered beside the label, never typed by anyone. */
  amountNow: number;
  description: string;
  /**
   * A short, honest badge next to the label — currently only "Save 5%" on the online-full
   * option for a cash-on-delivery-eligible cart. No countdown, no manufactured urgency: a
   * plain statement of a real, server-enforced discount.
   */
  note?: string;
}

export interface PaymentChoiceProps {
  options: readonly PaymentChoiceOption[];
  value: PaymentPath;
  disabled: boolean;
  onChange: (path: PaymentPath) => void;
}

/**
 * How the order is paid for, as a radio group.
 *
 * Radios rather than a slider or an amount box, and the reason is the whole shape of this
 * feature: there are exactly two amounts on offer and both of them were decided by the server.
 * A control that let a shopper type a number would be a control whose value the server would
 * have to refuse most of the time, and one that let them drag to a figure would imply the shop
 * will take any of them. The choice is which of two named amounts to pay, so it looks like one.
 *
 * The same control renders both states the payment step has — cash on delivery against paying
 * in full, and paying the minimum against paying in full — because they are the same question
 * asked of different carts, and giving the barred cart its own pattern would make the rarer
 * path look like the stranger one.
 */
export function PaymentChoice({
  options,
  value,
  disabled,
  onChange,
}: PaymentChoiceProps): JSX.Element {
  const groupId = useId();

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-label uppercase tracking-caps text-ink">
        How would you like to pay?
      </legend>

      <div className="flex flex-col gap-3">
        {options.map((option) => {
          const inputId = `${groupId}-${option.path}`;
          const isSelected = option.path === value;

          return (
            <div key={option.path}>
              <input
                type="radio"
                id={inputId}
                name={groupId}
                value={option.path}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onChange(option.path)}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                className={`flex cursor-pointer flex-col gap-1 border px-5 py-4 transition-colors duration-250 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-deep peer-disabled:cursor-not-allowed ${
                  isSelected
                    ? "border-charcoal bg-white"
                    : "border-line bg-white hover:border-charcoal peer-disabled:border-line"
                }`}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="flex items-center gap-2">
                    <span className="text-body text-ink">{option.label}</span>
                    {option.note === undefined ? null : (
                      <span className="text-label uppercase tracking-caps rounded-card bg-gold/15 px-1.5 py-0.5 text-gold-deep">
                        {option.note}
                      </span>
                    )}
                  </span>
                  <span className="font-sans text-body font-medium text-ink">
                    {formatRupees(option.amountNow)}
                  </span>
                </span>
                <span className="text-body-sm text-muted">{option.description}</span>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
