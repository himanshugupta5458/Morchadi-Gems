/**
 * Where the floating WhatsApp button is allowed to sit.
 *
 * A `fixed` element covers whatever the page has scrolled under it, so "move it somewhere
 * else" is not a fix — it relocates the collision rather than removing it. The only offset
 * that clears a control at one scroll position covers a different control at the next, which
 * is what made the overlap measured on
 * [the shop fixture](/docs/testing/RESULT-2026-08-31-card-variant-selection.md) look like a
 * one-product problem when it is a property of the layer.
 *
 * So the button reads the page instead of guessing at it. This module is the arithmetic:
 * given the button's own rectangle and the rectangles of the controls it must not cover, it
 * answers how far up the button has to move. It takes plain numbers rather than DOM nodes, so
 * the rule is testable without a browser and the browser measurement checks the same rule
 * rather than a second implementation of it.
 *
 * See [ADR-069](/docs/decisions/ADR-069-floating-contact-clearance.md).
 */

/** A rectangle in viewport coordinates — the four fields of a `DOMRect` that matter here. */
export interface ContactBox {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/**
 * The selector naming every control the button must not cover.
 *
 * Scoped to `main`, so the header, the footer and the button itself are outside it by
 * construction. `[data-control="action"]` is what `ButtonLink` stamps on the anchors it
 * renders — a call to action that happens to be a link is still a call to action, and the
 * shop card's "Choose Your Options" is exactly that case.
 *
 * Cards themselves are links covering their whole area, and they are deliberately *not* in
 * this set. A card is reachable at any point on it, so a button overlapping one corner of a
 * photograph costs nothing; a button overlapping the only 44 pixels that add a piece to a
 * cart costs the sale. The distinction is the whole reason this is a selector rather than
 * `a, button`.
 */
export const CONTACT_OBSTACLE_SELECTOR =
  'main button, main select, main input, main [role="button"], main [data-control="action"]';

/** Clear air left between the button and the control it has moved above. */
export const CONTACT_CLEARANCE_GAP = 12;

/**
 * How far the button may travel from its resting corner before it gives up and stays put.
 *
 * Generous rather than tight: a product grid puts one row of actions every card-height, so
 * the first gap is always within a card of the corner, and a bound this size is reached only
 * by a page whose entire right-hand column is controls — where no offset would help and
 * moving further would just walk the button up to the header.
 */
export const CONTACT_MAX_LIFT = 320;

/**
 * How many times the lift is recomputed before the search is abandoned. Each pass clears the
 * highest control currently overlapped, which may reveal another one above it; three passes
 * cover a grid row, the row above it, and the row above that.
 */
const MAX_CLEARANCE_PASSES = 3;

export function boxesOverlap(one: ContactBox, other: ContactBox): boolean {
  return (
    one.left < other.right &&
    one.right > other.left &&
    one.top < other.bottom &&
    one.bottom > other.top
  );
}

function shiftedUp(box: ContactBox, distance: number): ContactBox {
  return { ...box, top: box.top - distance, bottom: box.bottom - distance };
}

/**
 * How far up the button must move so that it covers none of `obstacles`, or `0` when it
 * already covers none — and `0` again when no reachable position clears them.
 *
 * The last case is deliberate and it is not a silent failure: the caller hides the button
 * while the page is being scrolled, so the position this returns is only ever applied once
 * the page is at rest, and a page with nowhere clear to put the button is one where staying
 * in the corner the shopper expects beats hovering halfway up the screen.
 */
export function liftClearingObstacles(
  button: ContactBox,
  obstacles: readonly ContactBox[],
  maxLift: number = CONTACT_MAX_LIFT,
): number {
  let lift = 0;

  for (let pass = 0; pass < MAX_CLEARANCE_PASSES; pass += 1) {
    const candidate = shiftedUp(button, lift);
    const covered = obstacles.filter((obstacle) => boxesOverlap(candidate, obstacle));

    if (covered.length === 0) return lift;

    const highestCoveredTop = Math.min(...covered.map((obstacle) => obstacle.top));
    lift += candidate.bottom - highestCoveredTop + CONTACT_CLEARANCE_GAP;

    if (lift > maxLift) return 0;
  }

  return 0;
}
