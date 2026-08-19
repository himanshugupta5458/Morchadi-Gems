import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * ADR-031 tightened the mobile scale only. The contract it has to keep is narrow and easy to
 * break by accident: a compact value belongs on the unprefixed utility, and wherever that
 * unprefixed utility also governed 640px and up, the original value has to be restated at
 * `sm:` so nothing at tablet or desktop width moves. A later edit that drops the `sm:` half
 * of a pair silently rescales the desktop layout, which is the one outcome this pass was not
 * allowed to produce, so the pairs are asserted rather than trusted.
 */
const MOBILE_TO_DESKTOP_PAIRS: ReadonlyArray<{
  file: string;
  what: string;
  mobile: string;
  desktop: string;
}> = [
  { file: "components/Hero.tsx", what: "hero image aspect", mobile: "aspect-[2/1]", desktop: "sm:aspect-[16/7]" },
  { file: "components/Hero.tsx", what: "hero band padding", mobile: "py-8", desktop: "sm:py-14" },
  { file: "components/Hero.tsx", what: "hero copy stack gap", mobile: "gap-4", desktop: "sm:gap-7" },
  { file: "components/Hero.tsx", what: "hero headline", mobile: "text-display-sm", desktop: "sm:text-display-lg" },
  { file: "components/Hero.tsx", what: "hero subtext", mobile: "text-body", desktop: "sm:text-body-lg" },

  { file: "components/ProductCard.tsx", what: "card image aspect", mobile: "aspect-[5/4]", desktop: "sm:aspect-square" },
  { file: "components/ProductCard.tsx", what: "card body padding", mobile: "p-3", desktop: "sm:p-4" },
  { file: "components/ProductCard.tsx", what: "card body gap", mobile: "gap-2", desktop: "sm:gap-3" },
  { file: "components/ProductGrid.tsx", what: "grid row gap", mobile: "gap-y-5", desktop: "sm:gap-y-8" },
  { file: "components/ProductGrid.tsx", what: "grid column gap", mobile: "gap-x-3", desktop: "sm:gap-x-4" },

  { file: "components/CategoryTile.tsx", what: "tile aspect", mobile: "aspect-square", desktop: "sm:aspect-[4/5]" },
  { file: "components/CategoryTile.tsx", what: "tile label type", mobile: "text-eyebrow", desktop: "sm:text-label" },
  { file: "components/CategoryTile.tsx", what: "tile label inset", mobile: "px-2", desktop: "sm:px-4" },
  { file: "components/CategoryGrid.tsx", what: "tile grid gap", mobile: "gap-3", desktop: "sm:gap-4" },

  { file: "components/TrustBadge.tsx", what: "badge padding", mobile: "py-5", desktop: "sm:py-7" },
  { file: "components/TrustStrip.tsx", what: "badge icon", mobile: "h-6 w-6", desktop: "sm:h-7 sm:w-7" },
  { file: "components/TestimonialCard.tsx", what: "testimonial padding", mobile: "p-4", desktop: "sm:p-6" },
  { file: "components/TestimonialBand.tsx", what: "testimonial band padding", mobile: "py-10", desktop: "sm:py-16" },

  { file: "components/SectionHeading.tsx", what: "section heading type", mobile: "text-heading-sm", desktop: "sm:text-heading-lg" },
  { file: "components/SectionHeading.tsx", what: "section heading gap", mobile: "gap-2", desktop: "sm:gap-3" },
];

describe("ADR-031 mobile scale", () => {
  it.each(MOBILE_TO_DESKTOP_PAIRS)(
    "$file restates the desktop value for $what",
    ({ file, mobile, desktop }) => {
      const source = readFileSync(file, "utf8");
      expect(source).toContain(mobile);
      expect(source).toContain(desktop);
    },
  );

  /**
   * The floating WhatsApp button is 48px tall and sits 16px above the viewport floor, so the
   * bottom 64px of every mobile screen is spoken for. Both elements that can end a scroll
   * reserve at least that much, which is what keeps the button off the last row of a grid and
   * off a call to action. See ADR-031.
   */
  it("reserves the floating button's lane at the end of a mobile scroll", () => {
    expect(readFileSync("app/layout.tsx", "utf8")).toContain('pb-16 sm:pb-0"');
    expect(readFileSync("components/Footer.tsx", "utf8")).toContain("pb-24");
  });

  /**
   * `py-14` and `lg:py-16` were split into their `pt`/`pb` longhands so the mobile `pb-24`
   * cannot be beaten by a shorthand that Tailwind happens to emit later in the sheet. The
   * desktop values must survive that rewrite unchanged.
   */
  it("keeps the footer's desktop padding through the longhand split", () => {
    const footer = readFileSync("components/Footer.tsx", "utf8");
    expect(footer).toContain("sm:pb-14");
    expect(footer).toContain("sm:pt-14");
    expect(footer).toContain("lg:pb-16");
    expect(footer).toContain("lg:pt-16");
  });

  /**
   * The tile label is the one string in the grid that has to fit on one line at 360px: at
   * `text-label` with `px-4` it measured 133px against 120px of room and wrapped mid-word.
   * Nothing here may drift back up to the larger type or the wider inset.
   */
  it("keeps the category label at the size that fits 360px", () => {
    const tile = readFileSync("components/CategoryTile.tsx", "utf8");
    const label = tile.slice(tile.indexOf("absolute inset-x-0 bottom-0"));
    expect(label).toContain("text-eyebrow");
    expect(label).toContain("px-2");
    expect(label).not.toMatch(/absolute inset-x-0 bottom-0 px-4/);
  });
});
