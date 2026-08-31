/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The test that proves centralising the free-shipping threshold was real rather than cosmetic.
 *
 * Every surface that quotes the number already imports `FREE_SHIPPING_THRESHOLD` — that much is
 * visible in a grep. What a grep cannot show is that the value each one renders actually comes
 * from the constant: a component could import it, ignore it, and print `₹799` beside it, and
 * every existing test would still pass because 799 is what the constant says today.
 *
 * So this file changes the number at its source — `config/site-facts.mjs`, the one file the
 * threshold is written in — and asserts that the shipping *calculation* and the shipping
 * *copy* both move together. A surface that had quietly kept its own copy would still be
 * saying ₹799 while the cart charged nothing over ₹1,499, and that is exactly the drift the
 * centralisation exists to make impossible.
 *
 * The mock is applied with `vi.doMock` and the consumers are imported dynamically afterwards,
 * because a static import is hoisted above the mock and would load the real module first.
 */

const CHANGED_THRESHOLD = 1499;
const REAL_THRESHOLD = 799;

/** The formatted forms of both numbers, as `formatRupees` renders them into visible copy. */
const CHANGED_THRESHOLD_TEXT = "₹1,499";
const REAL_THRESHOLD_TEXT = "₹799";

function mockThresholdAs(threshold: number): void {
  vi.doMock("@/config/site-facts.mjs", async () => {
    const actual = await vi.importActual<typeof import("@/config/site-facts.mjs")>(
      "@/config/site-facts.mjs",
    );

    return { ...actual, FREE_SHIPPING_THRESHOLD: threshold };
  });
}

beforeEach(() => {
  vi.resetModules();
  mockThresholdAs(CHANGED_THRESHOLD);
});

afterEach(() => {
  cleanup();
  vi.doUnmock("@/config/site-facts.mjs");
  vi.resetModules();
});

describe("changing the threshold in config/site-facts.mjs alone", () => {
  it("moves the constant every consumer imports from lib/config.ts", async () => {
    const { FREE_SHIPPING_THRESHOLD } = await import("@/lib/config");

    expect(FREE_SHIPPING_THRESHOLD).toBe(CHANGED_THRESHOLD);
  });

  it("moves the boundary the shipping calculation charges at", async () => {
    const { calculateShipping, FLAT_SHIPPING_RATE } = await import("@/lib/config");

    expect(calculateShipping(REAL_THRESHOLD)).toBe(FLAT_SHIPPING_RATE);
    expect(calculateShipping(CHANGED_THRESHOLD - 1)).toBe(FLAT_SHIPPING_RATE);
    expect(calculateShipping(CHANGED_THRESHOLD)).toBe(0);
  });

  it("moves the shortfall the cart nudge tells a shopper to add", async () => {
    const { amountToFreeShipping } = await import("@/lib/config");

    expect(amountToFreeShipping(REAL_THRESHOLD)).toBe(CHANGED_THRESHOLD - REAL_THRESHOLD);
    expect(amountToFreeShipping(CHANGED_THRESHOLD)).toBe(0);
  });

  it("moves the same number the server-side order pricing charges", async () => {
    const { calculateShipping } = await import("@/lib/config");
    const { FLAT_SHIPPING_RATE } = await import("@/lib/config");

    expect(calculateShipping(REAL_THRESHOLD)).toBe(FLAT_SHIPPING_RATE);
    expect(calculateShipping(CHANGED_THRESHOLD + 1)).toBe(0);
  });

  it("moves the number the site description states to a search engine", async () => {
    const { SITE_CONFIG } = await import("@/lib/config");

    expect(SITE_CONFIG.description).toContain(String(CHANGED_THRESHOLD));
    expect(SITE_CONFIG.description).not.toContain(String(REAL_THRESHOLD));
  });

  it("moves the trust strip's free-shipping badge", async () => {
    const { TrustStrip } = await import("@/components/TrustStrip");

    render(<TrustStrip />);

    expect(screen.getByText(`Free Shipping Over ${CHANGED_THRESHOLD_TEXT}`)).toBeTruthy();
    expect(screen.queryByText(`Free Shipping Over ${REAL_THRESHOLD_TEXT}`)).toBeNull();
  });

  it("moves the rotating header announcement", async () => {
    const { HeaderAnnouncement } = await import("@/components/HeaderAnnouncement");

    render(<HeaderAnnouncement />);

    expect(
      screen.getByText(`Free shipping over ${CHANGED_THRESHOLD_TEXT} across India`),
    ).toBeTruthy();
    expect(
      screen.queryByText(`Free shipping over ${REAL_THRESHOLD_TEXT} across India`),
    ).toBeNull();
  });

  it("moves the order summary's shipping label", async () => {
    const { OrderTotals } = await import("@/components/OrderTotals");

    render(<OrderTotals subtotal={REAL_THRESHOLD} shipping={99} total={REAL_THRESHOLD + 99} />);

    expect(
      screen.getByText(`Shipping (free over ${CHANGED_THRESHOLD_TEXT})`, { exact: false }),
    ).toBeTruthy();
  });

  /**
   * The add-more nudge left `OrderTotals` when it stopped appearing on all four surfaces that
   * summarise an order (ADR-072). It is `FreeShippingProgress` now, on the cart alone, and the
   * propagation it has to survive is the same one: the shortfall it names and the bar it draws
   * both have to move when the threshold does.
   */
  it("moves the cart's free-shipping progress, in its words and in its bar", async () => {
    const { FreeShippingProgress } = await import("@/components/FreeShippingProgress");

    render(<FreeShippingProgress subtotal={REAL_THRESHOLD} />);

    expect(
      screen.getByText(
        `₹${(CHANGED_THRESHOLD - REAL_THRESHOLD).toLocaleString("en-IN")}`,
        { exact: false },
      ),
    ).toBeTruthy();

    const bar = screen.getByRole("progressbar", {
      name: "Progress towards free shipping",
    });
    expect(bar.getAttribute("aria-valuenow")).toBe(
      String(Math.round((REAL_THRESHOLD / CHANGED_THRESHOLD) * 100)),
    );
  });

  it("fills the bar exactly when the new threshold is reached", async () => {
    const { FreeShippingProgress } = await import("@/components/FreeShippingProgress");

    render(<FreeShippingProgress subtotal={CHANGED_THRESHOLD} />);

    expect(screen.getByText("Free shipping unlocked.")).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "Progress towards free shipping" })
        .getAttribute("aria-valuenow"),
    ).toBe("100");
  });
});

describe("with the real value in place", () => {
  beforeEach(() => {
    vi.doUnmock("@/config/site-facts.mjs");
    vi.resetModules();
  });

  it("the shop still promises and charges at the number the owner set", async () => {
    const { FREE_SHIPPING_THRESHOLD, calculateShipping } = await import("@/lib/config");

    expect(FREE_SHIPPING_THRESHOLD).toBe(REAL_THRESHOLD);
    expect(calculateShipping(REAL_THRESHOLD)).toBe(0);
  });
});
