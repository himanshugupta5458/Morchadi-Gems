/**
 * Where a long product description is cut when it is first shown.
 *
 * **160 characters, not 150 words.** The word budget was the floor of the house range
 * `scripts/product-record-rules.mjs` enforces — every published description runs 150 to 300
 * words — which meant the *shortest* descriptions were shown whole and the longest were cut in
 * half, and a "preview" that runs to a hundred and fifty words is the description. What a
 * shopper wants above the buy button is a sentence telling them what the piece is; what they
 * want below it is the price and the button. Roughly one short paragraph is that sentence.
 *
 * The whole description is still in the markup either way — see `ProductDescription` — so this
 * number changes how much is *shown*, never how much exists. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export const DESCRIPTION_PREVIEW_CHARACTERS = 160;

/** What is appended to a preview that stops short of the end of a sentence. */
export const PREVIEW_ELLIPSIS = "…";

export interface TruncatedDescription {
  /**
   * The shortened opening shown while the description is collapsed. Empty when nothing is held
   * back, because there is nothing for it to be shorter than.
   */
  preview: string;
  /** Every paragraph of the description, always, whatever the preview holds. */
  paragraphs: string[];
  isTruncated: boolean;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Cuts `text` to at most `budget` characters **at a word boundary**, so a preview never ends
 * mid-word. A first word longer than the whole budget is the one case that cannot be honoured
 * and is cut where the budget falls, which is the only way to stay inside it.
 */
function cutAtWordBoundary(text: string, budget: number): string {
  if (text.length <= budget) return text;

  const cut = text.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;

  return kept.replace(/[\s,;:.\u2014-]+$/, "");
}

/**
 * Splits a description into the short opening a shopper reads first and the whole of what is
 * behind "See more".
 *
 * The preview is cut out of the description's running text — every paragraph joined — rather
 * than being the first paragraph. Descriptions in this catalogue open with paragraphs of very
 * different lengths, and taking whichever one happens to come first gave a preview of forty
 * words on one piece and two hundred on the next, which is what moved the buy button up and
 * down the page as a shopper browsed between them.
 *
 * `paragraphs` comes back untouched and complete. The collapsed state is the preview *plus*
 * every paragraph hidden, never the preview alone — the control shortens the page, it does not
 * shorten the page's content.
 */
export function splitDescriptionForPreview(
  paragraphs: readonly string[],
  budget: number = DESCRIPTION_PREVIEW_CHARACTERS,
): TruncatedDescription {
  const wholeText = paragraphs.join(" ").trim();
  const isTruncated = wholeText.length > budget;

  return {
    preview: isTruncated ? `${cutAtWordBoundary(wholeText, budget)}${PREVIEW_ELLIPSIS}` : "",
    paragraphs: [...paragraphs],
    isTruncated,
  };
}
