/**
 * Where a long product description is cut when it is first shown.
 *
 * 150 words is the **floor** of the house range `scripts/product-record-rules.mjs` enforces —
 * every published description is between 150 and 300 words — so cutting here shows the whole
 * of the shortest ones and about half of the longest. Choosing the floor rather than a round
 * number keeps the collapsed height roughly the same on every product, which is what stops
 * the buy button moving up and down the page as a shopper browses between pieces.
 */
export const DESCRIPTION_PREVIEW_WORDS = 150;

export interface TruncatedDescription {
  /** The paragraphs shown before the shopper expands anything. Never empty. */
  preview: string[];
  /** The paragraphs held back. Empty when the description fits. */
  rest: string[];
  isTruncated: boolean;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Splits a description into what is shown and what is held behind "See more", **at a paragraph
 * boundary** rather than mid-sentence.
 *
 * Cutting at the 150th word wherever it falls would end the preview in the middle of a clause
 * and need an ellipsis to admit it. Paragraphs are how these descriptions are written and
 * stored (`getDescriptionParagraphs`), so the preview is whole paragraphs up to the point the
 * running count reaches the budget — which means a preview is usually a little over 150 words
 * rather than a little under, and always reads as finished prose.
 *
 * The first paragraph is always in the preview, however long it is: a "See more" that hides
 * everything is a description that was not shown at all. And a description whose held-back
 * part would be nothing is not truncated — there is no control for revealing zero paragraphs.
 */
export function splitDescriptionForPreview(
  paragraphs: readonly string[],
  budget: number = DESCRIPTION_PREVIEW_WORDS,
): TruncatedDescription {
  const preview: string[] = [];
  const rest: string[] = [];
  let wordsShown = 0;

  for (const paragraph of paragraphs) {
    const isFirst = preview.length === 0;
    if (isFirst || wordsShown < budget) {
      preview.push(paragraph);
      wordsShown += countWords(paragraph);
    } else {
      rest.push(paragraph);
    }
  }

  return { preview, rest, isTruncated: rest.length > 0 };
}
