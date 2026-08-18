import { describe, expect, it } from "vitest";
import { buttonClasses } from "@/lib/button-styles";

describe("buttonClasses", () => {
  /**
   * The numbers, not just their relative order: `md` is 20px of vertical padding on the 18px
   * line box `text-label` carries, which is the 60px call to action the hero and the buy
   * panel both render, with 40px either side, and `sm` is 10px, the roughly 38px scale a
   * product card carries.
   */
  it("gives the page-level scale room around its label", () => {
    const classes = buttonClasses({});

    expect(classes).toContain("py-5");
    expect(classes).toContain("px-10");
    expect(classes).toContain("text-label");
  });

  it("gives the in-card scale a visibly smaller box", () => {
    const classes = buttonClasses({ size: "sm" });

    expect(classes).toContain("py-2.5");
    expect(classes).toContain("px-5");
    expect(classes).toContain("text-[0.6875rem]");
  });

  /**
   * Padding is the only thing that decides how tall a button is. A fixed height or a
   * `leading-*` shorter than the padding implies would silently cap it, which is how a
   * button ends up hugging its own text.
   */
  it("lets padding define the height, with no fixed height or line-box override", () => {
    for (const size of ["sm", "md"] as const) {
      const classes = buttonClasses({ size });

      expect(classes).not.toMatch(/(^|\s)h-/);
      expect(classes).not.toMatch(/(^|\s)min-h-/);
      expect(classes).not.toMatch(/(^|\s)max-h-/);
      expect(classes).not.toMatch(/(^|\s)leading-/);
    }
  });

  it("keeps one style across both scales", () => {
    const primary = buttonClasses({ size: "sm" });
    const cta = buttonClasses({ size: "md" });

    for (const shared of ["uppercase", "tracking-caps", "bg-charcoal", "text-ivory"]) {
      expect(primary).toContain(shared);
      expect(cta).toContain(shared);
    }
  });

  it("spans its container only when asked", () => {
    expect(buttonClasses({ fullWidth: true })).toContain("w-full");
    expect(buttonClasses({})).not.toContain("w-full");
  });
});
