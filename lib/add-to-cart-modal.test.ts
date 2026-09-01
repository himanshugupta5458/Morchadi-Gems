import { describe, expect, it } from "vitest";
import type { ProductOption } from "@/types/product";
import {
  buildGroupLabel,
  buildUnansweredPrompt,
  emptySelection,
  firstUnansweredGroup,
  isGroupAnswered,
  isSelectionComplete,
  toConfirmedSelection,
} from "@/lib/add-to-cart-modal";
import { resolveSelectedOptions } from "@/lib/options";

/**
 * The add-to-cart modal's rules, asserted directly rather than through a rendered dialog.
 *
 * `lib/product-card-purchase.test.tsx` already drives these functions through a real modal, and
 * that file is the proof the *shopper* is never handed a default nobody picked. This one exists
 * because the rules were deliberately written into a module with no React in it, and a rule that
 * is only ever exercised transitively is a rule whose edges nobody has looked at: the dialog can
 * only reach the states its own controls can produce, and three of the states below are not
 * among them.
 *
 * The seal at the bottom is the point of the file. `toConfirmedSelection` is the last thing that
 * touches a selection before the cart does, and what the cart does next —
 * `resolveSelectedOptions`, through `toCartItem` — is substitute `option.default` for every
 * group it is not told about. So the two functions have to be checked *together*: narrowing that
 * drops a group does not discard it, it silently re-defaults it, which is the exact defect
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md) exists to close.
 */

const SIZE: ProductOption = {
  name: "Size for bangles",
  type: "pills",
  values: ["2.4", "2.6", "2.8"],
  default: "2.4",
};

const LETTER: ProductOption = {
  name: "Letter",
  type: "dropdown",
  values: ["B", "C", "A"],
  default: "B",
};

const DESIGN: ProductOption = {
  name: "Design Number",
  type: "pills",
  values: ["1", "2"],
  default: "1",
};

const TWO_GROUPS: ProductOption[] = [DESIGN, SIZE];

describe("emptySelection", () => {
  it("holds nothing at all", () => {
    expect(emptySelection()).toEqual({});
  });

  it("carries no group's default, for a product of any shape", () => {
    const draft = emptySelection();

    for (const option of [...TWO_GROUPS, LETTER]) {
      expect(draft[option.name]).toBeUndefined();
    }
  });

  it("hands back a fresh record each time, so one modal cannot seed the next", () => {
    const first = emptySelection();
    first[SIZE.name] = "2.6";

    expect(emptySelection()).toEqual({});
  });
});

describe("isGroupAnswered", () => {
  it("is answered by a value the group offers", () => {
    expect(isGroupAnswered(SIZE, { "Size for bangles": "2.6" })).toBe(true);
  });

  it("is unanswered when the group is absent from the draft", () => {
    expect(isGroupAnswered(SIZE, {})).toBe(false);
  });

  it("is unanswered when another group was the one answered", () => {
    expect(isGroupAnswered(SIZE, { "Design Number": "1" })).toBe(false);
  });

  /**
   * A native select handed an empty value reports `""`, not `undefined`. Treating that as an
   * answer is how the letter rings would have confirmed with nothing chosen.
   */
  it("is unanswered for an empty string", () => {
    expect(isGroupAnswered(LETTER, { Letter: "" })).toBe(false);
  });

  /**
   * The catalogue is the authority, not the draft. A value the group no longer lists is refused
   * here rather than left for the order route to catch, and the group stays unanswered.
   */
  it("is unanswered for a value the group does not offer", () => {
    expect(isGroupAnswered(LETTER, { Letter: "Z" })).toBe(false);
  });

  it("is unanswered for the group's default when the default is not among its values", () => {
    const withUnofferedDefault: ProductOption = { ...SIZE, default: "3.0" };

    expect(isGroupAnswered(withUnofferedDefault, { "Size for bangles": "3.0" })).toBe(false);
  });
});

describe("firstUnansweredGroup", () => {
  it("names the first group on an empty draft, in the order the catalogue lists them", () => {
    expect(firstUnansweredGroup(TWO_GROUPS, {})?.name).toBe("Design Number");
  });

  it("moves to the second group once the first is answered", () => {
    expect(firstUnansweredGroup(TWO_GROUPS, { "Design Number": "2" })?.name).toBe(
      "Size for bangles",
    );
  });

  /**
   * Answering out of order is reachable with a keyboard, and the prompt must still point at
   * something the shopper has not done rather than at the group they just filled in.
   */
  it("names the earlier group when a later one was answered first", () => {
    expect(firstUnansweredGroup(TWO_GROUPS, { "Size for bangles": "2.8" })?.name).toBe(
      "Design Number",
    );
  });

  it("is null once every group holds an offered value", () => {
    expect(
      firstUnansweredGroup(TWO_GROUPS, { "Design Number": "1", "Size for bangles": "2.4" }),
    ).toBeNull();
  });

  it("is null for a product with no groups at all", () => {
    expect(firstUnansweredGroup([], {})).toBeNull();
  });

  it("ignores a key that belongs to no group", () => {
    expect(firstUnansweredGroup([SIZE], { Ghost: "anything" })?.name).toBe("Size for bangles");
  });
});

describe("isSelectionComplete", () => {
  it("refuses an empty draft, whatever the group count", () => {
    expect(isSelectionComplete([SIZE], {})).toBe(false);
    expect(isSelectionComplete(TWO_GROUPS, {})).toBe(false);
  });

  it("refuses a draft that answers some groups but not all", () => {
    expect(isSelectionComplete(TWO_GROUPS, { "Design Number": "1" })).toBe(false);
  });

  it("accepts a draft that answers every group", () => {
    expect(
      isSelectionComplete(TWO_GROUPS, { "Design Number": "1", "Size for bangles": "2.4" }),
    ).toBe(true);
  });

  it("refuses a draft filled only with values the catalogue does not offer", () => {
    expect(isSelectionComplete([LETTER], { Letter: "Q" })).toBe(false);
  });

  /**
   * `firstUnansweredGroup` is what disables the confirm button and what the helper text names,
   * so the two can never disagree about which group is missing. Asserted rather than assumed,
   * because they are separate call sites in the component.
   */
  it("agrees with firstUnansweredGroup at every step of answering a two-group product", () => {
    const draft: Record<string, string> = {};

    for (const option of TWO_GROUPS) {
      expect(isSelectionComplete(TWO_GROUPS, draft)).toBe(false);
      expect(firstUnansweredGroup(TWO_GROUPS, draft)).toBe(option);

      draft[option.name] = option.values[1];
    }

    expect(isSelectionComplete(TWO_GROUPS, draft)).toBe(true);
    expect(firstUnansweredGroup(TWO_GROUPS, draft)).toBeNull();
  });

  it("is vacuously true for a product with no groups", () => {
    expect(isSelectionComplete([], {})).toBe(true);
  });
});

describe("the labels the dialog prints", () => {
  it("reads the group's own name back in the legend", () => {
    expect(buildGroupLabel(SIZE)).toBe("Select Size for bangles");
    expect(buildGroupLabel(LETTER)).toBe("Select Letter");
  });

  it("names the waiting group in the prompt", () => {
    expect(buildUnansweredPrompt(SIZE)).toBe("Choose a Size for bangles to continue");
  });

  it("names the group the prompt is about, for every group of a multi-group product", () => {
    for (const option of TWO_GROUPS) {
      expect(buildUnansweredPrompt(option)).toContain(option.name);
      expect(buildGroupLabel(option)).toContain(option.name);
    }
  });
});

describe("toConfirmedSelection", () => {
  it("keeps every answered group exactly as it was drafted", () => {
    expect(
      toConfirmedSelection(TWO_GROUPS, { "Design Number": "2", "Size for bangles": "2.8" }),
    ).toEqual({ "Design Number": "2", "Size for bangles": "2.8" });
  });

  it("narrows a key that belongs to no group of this product", () => {
    expect(toConfirmedSelection([SIZE], { "Size for bangles": "2.6", Letter: "C" })).toEqual({
      "Size for bangles": "2.6",
    });
  });

  it("drops a group answered with a value the catalogue no longer offers", () => {
    expect(toConfirmedSelection([LETTER], { Letter: "Z" })).toEqual({});
  });

  it("drops a group the draft never answered rather than inventing one", () => {
    expect(toConfirmedSelection(TWO_GROUPS, { "Design Number": "1" })).toEqual({
      "Design Number": "1",
    });
  });

  it("hands back nothing for a product with no groups, whatever the draft holds", () => {
    expect(toConfirmedSelection([], { Letter: "A" })).toEqual({});
  });
});

/**
 * The two halves checked together, because neither is safe alone.
 *
 * `toConfirmedSelection` narrows and `resolveSelectedOptions` re-fills, so the only thing that
 * makes the pair honest is the confirm button refusing an incomplete draft. These assert both
 * directions of that: what a complete draft survives as, and what an incomplete one would have
 * become had the button ever let one through.
 */
describe("what the cart is actually told", () => {
  it("carries a complete draft through to the cart unchanged", () => {
    const draft = { "Design Number": "2", "Size for bangles": "2.8" };

    expect(isSelectionComplete(TWO_GROUPS, draft)).toBe(true);
    expect(resolveSelectedOptions(TWO_GROUPS, toConfirmedSelection(TWO_GROUPS, draft))).toEqual(
      draft,
    );
  });

  it("carries a complete draft through unchanged even when a stray key rode along", () => {
    const draft = { "Design Number": "1", "Size for bangles": "2.4", Ghost: "2.6" };

    expect(resolveSelectedOptions(TWO_GROUPS, toConfirmedSelection(TWO_GROUPS, draft))).toEqual({
      "Design Number": "1",
      "Size for bangles": "2.4",
    });
  });

  it("keeps a chosen value that happens to equal the group's default", () => {
    const draft = { "Design Number": "1", "Size for bangles": "2.4" };

    expect(resolveSelectedOptions(TWO_GROUPS, toConfirmedSelection(TWO_GROUPS, draft))).toEqual(
      draft,
    );
  });

  /**
   * The reason the confirm button is disabled rather than merely discouraged. An incomplete
   * draft does not reach the cart as a gap — it reaches it as `option.default`, which is
   * indistinguishable from a choice.
   */
  it("would re-default an unanswered group, which is why an incomplete draft may never confirm", () => {
    const incomplete = { "Design Number": "2" };

    expect(isSelectionComplete(TWO_GROUPS, incomplete)).toBe(false);
    expect(
      resolveSelectedOptions(TWO_GROUPS, toConfirmedSelection(TWO_GROUPS, incomplete)),
    ).toEqual({ "Design Number": "2", "Size for bangles": SIZE.default });
  });

  it("would re-default every group of an empty draft", () => {
    expect(resolveSelectedOptions(TWO_GROUPS, toConfirmedSelection(TWO_GROUPS, {}))).toEqual({
      "Design Number": DESIGN.default,
      "Size for bangles": SIZE.default,
    });
  });
});
