"use client";

import type { ProductOption } from "@/types/product";
import { CARD_OPTION_VALUE_LIMIT } from "@/lib/card-purchase";
import {
  OptionRadioGroup,
  optionControlBaseClasses,
  optionControlSelectedClasses,
  optionControlUnselectedClasses,
} from "@/components/OptionRadioGroup";

export interface CardOptionChipsProps {
  option: ProductOption;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

const chipClasses = `${optionControlBaseClasses} h-7 w-full px-1.5`;

/**
 * One column per value, so the row is a grid rather than a wrap.
 *
 * A wrapping row would be shorter on a card with two values than on one with three at some
 * widths, and a grid row whose cards disagree about their heights is the alignment problem the
 * fixed title block already exists to prevent. Equal columns also mean the chips line up
 * vertically down a column of cards, which reads as a control rather than as three loose tags.
 */
const columnClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

/**
 * The option control a card gets: the same radio wiring, checked state and focus ring as the
 * product page's chips and pills, at card scale and with the group's name kept as the
 * accessible name alone.
 *
 * Deliberately not a new kind of control. It is `OptionRadioGroup` with smaller padding, so a
 * card's chips cannot drift from the page's in how they announce themselves, how they take
 * arrow keys, or what "selected" looks like. See
 * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
 *
 * Values are truncated rather than wrapped — the full text stays in the DOM for a screen
 * reader and in the `title` for a pointer, and the row keeps its height either way.
 */
export function CardOptionChips({
  option,
  value,
  disabled,
  onChange,
}: CardOptionChipsProps): JSX.Element {
  const columns = columnClasses[Math.min(option.values.length, CARD_OPTION_VALUE_LIMIT)];

  return (
    <OptionRadioGroup
      option={option}
      value={value}
      disabled={disabled}
      onChange={onChange}
      className="flex flex-col"
      legendClassName="sr-only"
      listClassName={`grid ${columns} gap-1.5`}
      itemClassName={(isSelected) =>
        `${chipClasses} ${isSelected ? optionControlSelectedClasses : optionControlUnselectedClasses}`
      }
      renderContent={(optionValue) => (
        <span className="w-full truncate text-center" title={optionValue}>
          {optionValue}
        </span>
      )}
    />
  );
}
