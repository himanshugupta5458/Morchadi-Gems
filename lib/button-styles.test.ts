import { describe, expect, it } from "vitest";
import { buttonClasses } from "@/lib/button-styles";

describe("buttonClasses", () => {
  /**
   * The numbers, not just their relative order: `md` is 22px of vertical padding on an 18px
   * line box, which is the 64px call to action the hero and the buy panel both render, and
   * `sm` is 10px on a 16px line box, the 38px scale a product card carries.
   */
  it("gives the page-level scale room around its label", () => {
    const classes = buttonClasses({});

    expect(classes).toContain("py-[1.375rem]");
    expect(classes).toContain("px-12");
    expect(classes).toContain("text-label");
  });

  it("gives the in-card scale a visibly smaller box", () => {
    const classes = buttonClasses({ size: "sm" });

    expect(classes).toContain("py-2.5");
    expect(classes).toContain("px-4");
    expect(classes).toContain("text-[0.6875rem]");
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
