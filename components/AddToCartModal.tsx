"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CatalogueEntry, SelectedOptions } from "@/types/product";
import {
  buildGroupLabel,
  buildUnansweredPrompt,
  emptySelection,
  firstUnansweredGroup,
  toConfirmedSelection,
} from "@/lib/add-to-cart-modal";
import { formatRupees } from "@/lib/format";
import { Button } from "@/components/Button";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { ProductOptionSelector } from "@/components/ProductOptionSelector";
import { CloseIcon } from "@/components/icons";

export const ADD_TO_CART_MODAL_TITLE_PREFIX = "Choose options for";

export interface AddToCartModalProps {
  item: CatalogueEntry;
  /** Called with the completed selection. Never called with a partial one. */
  onConfirm: (selectedOptions: SelectedOptions) => void;
  onDismiss: () => void;
}

const THUMBNAIL_PIXELS = 56;

/**
 * The one place a secondary choice is made before something goes in the cart.
 *
 * **Nothing is pre-selected, for any product, however many groups it has and however few values
 * those groups list.** That is the property [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md)
 * was written to protect and the reason it split cards three ways to protect it; this modal
 * protects it in one shape instead. The confirm button is disabled until every group holds a
 * value, so there is no path — not a tap, not an Enter key, not a dismissed dialog — by which a
 * choice nobody made reaches a cart line.
 *
 * Dismissing adds nothing. The draft is component state and the component is unmounted by its
 * caller, so a modal reopened on the same card starts empty again rather than resuming a
 * half-made decision the shopper walked away from.
 *
 * It is deliberately generic in the only way that matters: it reads `item.options` and renders
 * `ProductOptionSelector` per group. A metal tone, a chain length, a second size — anything the
 * catalogue can describe as an option group — needs no change here.
 *
 * Rendered through a portal on `document.body` because a product card carries
 * `hover:-translate-y-1`, and a transformed ancestor is a containing block for its fixed
 * descendants: left in the card, the overlay would be trapped inside one 200px tile the moment
 * a pointer touched it. See [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export function AddToCartModal({
  item,
  onConfirm,
  onDismiss,
}: AddToCartModalProps): JSX.Element | null {
  const options = item.options ?? [];
  const [draft, setDraft] = useState<SelectedOptions>(emptySelection);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      const returnTo = returnFocusRef.current;
      if (returnTo instanceof HTMLElement) returnTo.focus();
    };
  }, []);

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") onDismiss();
    }

    document.addEventListener("keydown", dismissOnEscape);
    return () => document.removeEventListener("keydown", dismissOnEscape);
  }, [onDismiss]);

  const unanswered = firstUnansweredGroup(options, draft);
  const titleId = `add-to-cart-${item.id}`;

  function handleConfirm(): void {
    if (unanswered !== null) return;
    onConfirm(toConfirmedSelection(options, draft));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/60 p-4 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[85vh] w-full max-w-[22.5rem] flex-col overflow-y-auto border border-line bg-white shadow-card-hover"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden border border-line bg-ivory">
              {item.image === null ? (
                <ProductImagePlaceholder />
              ) : (
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes={`${THUMBNAIL_PIXELS}px`}
                  className="object-contain p-1"
                />
              )}
            </span>

            <span className="flex min-w-0 flex-col gap-0.5">
              <span id={titleId} className="truncate text-body-sm text-ink">
                {item.name}
              </span>
              <span className="font-sans text-body-sm font-medium text-ink">
                {formatRupees(item.price)}
              </span>
            </span>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted transition-colors duration-250 hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-4">
          {options.map((option) => (
            <ProductOptionSelector
              key={option.name}
              option={option}
              value={draft[option.name] ?? ""}
              layout="compact"
              label={buildGroupLabel(option)}
              onChange={(value) =>
                setDraft((current) => ({ ...current, [option.name]: value }))
              }
            />
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-line p-4">
          {unanswered === null ? null : (
            <p className="text-body-sm text-muted">{buildUnansweredPrompt(unanswered)}</p>
          )}

          <Button fullWidth disabled={unanswered !== null} onClick={handleConfirm}>
            Add to cart
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
