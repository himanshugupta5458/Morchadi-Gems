"use client";

import { useState } from "react";
import type { ProductOption, SelectedOptions } from "@/types/product";
import type { CartOptionChange } from "@/lib/cart";
import { Button } from "@/components/Button";
import { ProductOptionSelector } from "@/components/ProductOptionSelector";
import { SelectedOptionsSummary } from "@/components/SelectedOptionsSummary";

export interface CartLineOptionsEditorProps {
  options: ProductOption[];
  selectedOptions: SelectedOptions;
  /** Applies the change and reports what happened. See `CartContextValue.setLineOptions`. */
  onApply: (selectedOptions: SelectedOptions) => CartOptionChange;
  /** The line's product name, so the toggle reads as a specific action to a screen reader. */
  productName: string;
}

const EDIT_LABEL = "Change";

/**
 * A cart line's choices, with a way to change them.
 *
 * Before this, a wrong selection could only be recovered from by removing the line and adding
 * it again from the product page — which meant the shopper who had been given a default they
 * never chose had to notice, leave the cart, and start over. See
 * [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md).
 *
 * The controls are `ProductOptionSelector`, the same component the product page uses, so a
 * letter is a dropdown here for the same reason it is one there. The draft is local until
 * Save: an edit the catalogue refuses leaves the shopper's selection on screen with the reason
 * beside it, rather than snapping back to a value they had already rejected.
 */
export function CartLineOptionsEditor({
  options,
  selectedOptions,
  onApply,
  productName,
}: CartLineOptionsEditorProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<SelectedOptions>(selectedOptions);
  const [error, setError] = useState<string | null>(null);

  function openEditor(): void {
    setDraft(selectedOptions);
    setError(null);
    setIsEditing(true);
  }

  function closeEditor(): void {
    setError(null);
    setIsEditing(false);
  }

  function handleSave(): void {
    const change = onApply(draft);
    if (change.error !== null) {
      setError(change.error);
      return;
    }
    closeEditor();
  }

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <SelectedOptionsSummary selectedOptions={selectedOptions} />
        <button
          type="button"
          onClick={openEditor}
          aria-label={`Change the options chosen for ${productName}`}
          className="text-body-sm text-muted underline underline-offset-4 transition-colors duration-250 hover:text-gold-deep"
        >
          {EDIT_LABEL}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border border-line bg-ivory px-4 py-4">
      {options.map((option) => (
        <ProductOptionSelector
          key={option.name}
          option={option}
          value={draft[option.name] ?? option.default}
          onChange={(value) => setDraft({ ...draft, [option.name]: value })}
        />
      ))}

      {error === null ? null : (
        <p role="alert" className="text-body-sm text-sale">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={handleSave}>
          Save
        </Button>
        <button
          type="button"
          onClick={closeEditor}
          className="text-body-sm text-muted underline underline-offset-4 transition-colors duration-250 hover:text-gold-deep"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
