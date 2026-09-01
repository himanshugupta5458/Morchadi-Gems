"use client";

import { useState } from "react";
import type { TruncatedDescription } from "@/lib/product-description";

export interface ProductDescriptionProps {
  description: TruncatedDescription;
}

/**
 * The free-text description, cut to about one short paragraph with the rest behind "See more".
 *
 * **Every paragraph is in the markup from the first render**, expanded or not. The held-back
 * ones are hidden with `hidden` rather than left unrendered, so a crawler, a reader mode and
 * anyone with JavaScript off all get the whole description — the control shortens the page,
 * it does not shorten the page's content. Splitting the text out of the DOM would have made
 * "See more" a soft paywall on the copy the product page is meant to be found by.
 *
 * The collapsed state adds a shortened opening rather than removing paragraphs, which is why
 * both are rendered and one of the two is always hidden. It costs 160 duplicated characters in
 * the HTML and buys a preview that is the same length on every product in the catalogue —
 * which is what stops the buy button moving up and down the page as a shopper browses. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 *
 * Specs and care information are not in here and are not collapsible. They are short lists
 * that a shopper checks *before* deciding, and an accordion over four rows costs a tap to
 * reveal what would have fitted anyway. See
 * [ADR-070](/docs/decisions/ADR-070-home-page-composition.md).
 */
export function ProductDescription({ description }: ProductDescriptionProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const { preview, paragraphs, isTruncated } = description;
  const isCollapsed = isTruncated && !isExpanded;

  return (
    <div className="flex max-w-prose flex-col gap-3 text-body text-muted">
      {isTruncated ? <p hidden={!isCollapsed}>{preview}</p> : null}

      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 48)} hidden={isCollapsed}>
          {paragraph}
        </p>
      ))}

      {isTruncated ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((shown) => !shown)}
          className="self-start text-label uppercase tracking-caps text-ink underline underline-offset-4 transition-colors duration-250 hover:text-gold-deep"
        >
          {isExpanded ? "See less" : "See more"}
        </button>
      ) : null}
    </div>
  );
}
