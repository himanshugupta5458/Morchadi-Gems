import { describe, expect, it } from "vitest";
import {
  CONTACT_CLEARANCE_GAP,
  CONTACT_MAX_LIFT,
  CONTACT_OBSTACLE_SELECTOR,
  boxesOverlap,
  liftClearingObstacles,
  type ContactBox,
} from "@/lib/floating-contact";

/**
 * The button exactly as it was measured in the browser at 1440 × 1000 during the previous
 * prompt's manual pass: 166 × 48, at `left: 1250, top: 1328`. Every case below is built from
 * that rectangle rather than from round numbers, so the arithmetic here is the arithmetic that
 * produced the reported overlap.
 * See [the card-variant result](/docs/testing/RESULT-2026-08-31-card-variant-selection.md).
 */
const MEASURED_BUTTON: ContactBox = { left: 1250, top: 1328, right: 1416, bottom: 1376 };

/**
 * P408's "Choose Your Options", positioned so that it intersects the button by 53 × 42 pixels
 * — the 29% overlap the browser reported. The card CTA is 44px tall (`ACTION_HEIGHT_CLASSES`)
 * and the last column of the four-across grid at 1440 runs to x = 1303 here.
 */
const OVERLAPPED_CALL_TO_ACTION: ContactBox = {
  left: 1038,
  top: 1334,
  right: 1303,
  bottom: 1378,
};

/** The button after `lift` has been applied, which is what the component renders. */
function lifted(button: ContactBox, lift: number): ContactBox {
  return { ...button, top: button.top - lift, bottom: button.bottom - lift };
}

/**
 * A column of card call-to-actions, one every `cardHeight` pixels, as a product grid actually
 * lays them out. 424 is the measured card height at 1440.
 */
function gridOfCallsToAction(cardHeight: number, rows: number): ContactBox[] {
  return Array.from({ length: rows }, (_row, index) => ({
    left: OVERLAPPED_CALL_TO_ACTION.left,
    right: OVERLAPPED_CALL_TO_ACTION.right,
    top: OVERLAPPED_CALL_TO_ACTION.top - index * cardHeight,
    bottom: OVERLAPPED_CALL_TO_ACTION.bottom - index * cardHeight,
  }));
}

describe("boxesOverlap", () => {
  it("finds the overlap the browser measured on the shop fixture", () => {
    expect(boxesOverlap(MEASURED_BUTTON, OVERLAPPED_CALL_TO_ACTION)).toBe(true);
  });

  it("treats a shared edge as clear rather than as a collision", () => {
    const touchingAbove: ContactBox = {
      left: 1250,
      right: 1416,
      top: 1280,
      bottom: MEASURED_BUTTON.top,
    };

    expect(boxesOverlap(MEASURED_BUTTON, touchingAbove)).toBe(false);
  });

  it("is false when the boxes miss on either axis alone", () => {
    const besideIt: ContactBox = { left: 100, right: 300, top: 1328, bottom: 1376 };
    const aboveIt: ContactBox = { left: 1250, right: 1416, top: 200, bottom: 260 };

    expect(boxesOverlap(MEASURED_BUTTON, besideIt)).toBe(false);
    expect(boxesOverlap(MEASURED_BUTTON, aboveIt)).toBe(false);
  });
});

describe("liftClearingObstacles", () => {
  it("stays where it is when it covers nothing", () => {
    expect(liftClearingObstacles(MEASURED_BUTTON, [])).toBe(0);
  });

  it("stays where it is when the only controls are elsewhere on the page", () => {
    const farAbove: ContactBox = { left: 1038, right: 1303, top: 400, bottom: 444 };

    expect(liftClearingObstacles(MEASURED_BUTTON, [farAbove])).toBe(0);
  });

  it("lifts far enough to clear the call to action it landed on", () => {
    const lift = liftClearingObstacles(MEASURED_BUTTON, [OVERLAPPED_CALL_TO_ACTION]);

    expect(lift).toBeGreaterThan(0);
    expect(boxesOverlap(lifted(MEASURED_BUTTON, lift), OVERLAPPED_CALL_TO_ACTION)).toBe(false);
  });

  it("leaves the declared clearance above it rather than resting on its edge", () => {
    const lift = liftClearingObstacles(MEASURED_BUTTON, [OVERLAPPED_CALL_TO_ACTION]);

    expect(lifted(MEASURED_BUTTON, lift).bottom).toBe(
      OVERLAPPED_CALL_TO_ACTION.top - CONTACT_CLEARANCE_GAP,
    );
  });

  /**
   * The property the fix actually claims. A grid is the case the button failed on, and the
   * answer has to be a clear position **whatever** the scroll offset is — so the same grid is
   * tried at every one-pixel-per-step offset across a whole card height.
   */
  it("finds a clear position at every scroll offset across a card height", () => {
    const cardHeight = 424;
    const obstacles = gridOfCallsToAction(cardHeight, 6);

    for (let scrolled = 0; scrolled < cardHeight; scrolled += 1) {
      const scrolledObstacles = obstacles.map((box) => ({
        ...box,
        top: box.top - scrolled,
        bottom: box.bottom - scrolled,
      }));

      const lift = liftClearingObstacles(MEASURED_BUTTON, scrolledObstacles);
      const resting = lifted(MEASURED_BUTTON, lift);

      for (const obstacle of scrolledObstacles) {
        expect(
          boxesOverlap(resting, obstacle),
          `lift ${lift} at scroll offset ${scrolled} still covers a call to action`,
        ).toBe(false);
      }
    }
  });

  it("finds a clear position at the tighter card heights of narrower viewports", () => {
    for (const cardHeight of [354, 369, 384, 445]) {
      const obstacles = gridOfCallsToAction(cardHeight, 6);
      const lift = liftClearingObstacles(MEASURED_BUTTON, obstacles);
      const resting = lifted(MEASURED_BUTTON, lift);

      for (const obstacle of obstacles) {
        expect(boxesOverlap(resting, obstacle), `card height ${cardHeight}`).toBe(false);
      }
    }
  });

  /**
   * A page whose entire right-hand column is controls has no clear position, and the honest
   * answer is the corner the shopper expects rather than a button parked halfway up the screen.
   * The component never applies a resting position while the page is moving, so this case shows
   * the button back in its corner rather than mid-flight.
   */
  it("gives up and stays in the corner when nothing within reach is clear", () => {
    const wall: ContactBox[] = Array.from({ length: 40 }, (_row, index) => ({
      left: 1038,
      right: 1416,
      top: OVERLAPPED_CALL_TO_ACTION.top - index * 20,
      bottom: OVERLAPPED_CALL_TO_ACTION.bottom - index * 20,
    }));

    expect(liftClearingObstacles(MEASURED_BUTTON, wall)).toBe(0);
  });

  it("never travels further than the declared bound", () => {
    const obstacles = gridOfCallsToAction(424, 6);

    expect(liftClearingObstacles(MEASURED_BUTTON, obstacles)).toBeLessThanOrEqual(
      CONTACT_MAX_LIFT,
    );
  });
});

describe("what counts as a control the button must not cover", () => {
  /**
   * A product card is a link over its whole area, and it is deliberately **not** an obstacle:
   * the card is clickable everywhere, so a button over one corner of a photograph costs nothing,
   * while a button over the 44 pixels that add it to a cart costs the sale.
   */
  it("names buttons and button-styled links, and not every anchor on the page", () => {
    expect(CONTACT_OBSTACLE_SELECTOR).toContain("main button");
    expect(CONTACT_OBSTACLE_SELECTOR).toContain('main [data-control="action"]');
    expect(CONTACT_OBSTACLE_SELECTOR).not.toContain("main a,");
    expect(CONTACT_OBSTACLE_SELECTOR).not.toMatch(/main a\s*$/);
  });

  it("is scoped inside main, so the header, footer and the button itself are exempt", () => {
    for (const clause of CONTACT_OBSTACLE_SELECTOR.split(",")) {
      expect(clause.trim().startsWith("main ")).toBe(true);
    }
  });
});
