"use client";

import { filledOptionValues, type ProductOptionDraft } from "@/lib/admin-product-form";
import { buttonClasses } from "@/lib/button-styles";
import { PRODUCT_OPTION_TYPES, type ProductOptionType } from "@/types/product";

export interface AdminProductOptionEditorProps {
  index: number;
  option: ProductOptionDraft;
  fieldClassName: string;
  labelClassName: string;
  hintClassName: string;
  onChange: (changes: Partial<ProductOptionDraft>) => void;
  onRemove: () => void;
}

/**
 * One option group: its name, its control, its values and which value a shopper gets by default.
 *
 * **Values are a list of fields, not a textarea.** The textarea was simpler and it worked, and it
 * was replaced anyway because of what now sits beside it: every value is a row in the variant
 * photograph picker, keyed by its exact text. In a textarea a trailing space, a stray blank line
 * or a value typed twice are all invisible, and each one either creates a photograph row that
 * pairs with nothing or silently drops the pairing an operator already made. A value with its own
 * field is a thing that can be seen, corrected and deleted, and the picker row moves with it.
 *
 * **The default is a `<select>` over those values**, which removes the whole class of "default
 * must be one of the values" failures rather than reporting them after a save. It is the same
 * argument in a second place: a field whose only legal contents are listed one input above it has
 * no business being free text. See
 * [ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md).
 *
 * The cost is roughly forty lines over a textarea. That is the trade, made once, on the group of
 * fields the rest of the tab is keyed to.
 */
export function AdminProductOptionEditor({
  index,
  option,
  fieldClassName,
  labelClassName,
  hintClassName,
  onChange,
  onRemove,
}: AdminProductOptionEditorProps): JSX.Element {
  const selectableValues = filledOptionValues(option.values);
  const nameId = `option-${index}-name`;
  const typeId = `option-${index}-type`;
  const defaultId = `option-${index}-default`;

  function changeValue(position: number, value: string): void {
    onChange({
      values: option.values.map((candidate, at) => (at === position ? value : candidate)),
    });
  }

  return (
    <div className="flex flex-col gap-4 border border-line bg-ivory px-4 py-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className={labelClassName}>
            Option name
          </label>
          <input
            id={nameId}
            type="text"
            value={option.name}
            onChange={(event) => onChange({ name: event.target.value })}
            className={fieldClassName}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={typeId} className={labelClassName}>
            Control
          </label>
          <select
            id={typeId}
            value={option.type}
            onChange={(event) => onChange({ type: event.target.value as ProductOptionType })}
            className={fieldClassName}
          >
            {PRODUCT_OPTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClassName}>Values</legend>
        <p className={hintClassName}>
          One field per choice. Each gets its own row in Variant photographs below.
        </p>

        {option.values.length === 0 ? (
          <p className={hintClassName}>No values yet.</p>
        ) : (
          option.values.map((value, position) => (
            <div key={position} className="flex items-center gap-3">
              <input
                type="text"
                value={value}
                aria-label={`Value ${position + 1}`}
                onChange={(event) => changeValue(position, event.target.value)}
                className={fieldClassName}
              />
              <button
                type="button"
                aria-label={`Remove value ${position + 1}`}
                onClick={() =>
                  onChange({ values: option.values.filter((_unused, at) => at !== position) })
                }
                className="shrink-0 font-sans text-label uppercase tracking-caps text-muted underline underline-offset-4 transition-colors duration-250 hover:text-sale"
              >
                Remove
              </button>
            </div>
          ))
        )}

        <div>
          <button
            type="button"
            onClick={() => onChange({ values: [...option.values, ""] })}
            className={buttonClasses({ size: "sm", variant: "secondary" })}
          >
            Add a value
          </button>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={defaultId} className={labelClassName}>
          Default
        </label>
        <select
          id={defaultId}
          value={selectableValues.includes(option.default) ? option.default : ""}
          onChange={(event) => onChange({ default: event.target.value })}
          className={fieldClassName}
        >
          <option value="">Choose a value</option>
          {selectableValues.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <span className={hintClassName}>
          What a shopper who never opens the control is recorded as having chosen.
        </span>
      </div>

      <div>
        <button
          type="button"
          onClick={onRemove}
          className="font-sans text-label uppercase tracking-caps text-muted underline underline-offset-4 transition-colors duration-250 hover:text-sale"
        >
          Remove this option
        </button>
      </div>
    </div>
  );
}
