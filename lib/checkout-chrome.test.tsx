/** @vitest-environment jsdom */

import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CATEGORY_MENU, COLLECTION_MENU, COMPANY_LINKS } from "@/lib/navigation";
import { CONTACT_CONFIG, SITE_CONFIG } from "@/lib/config";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "font-display-variable" }),
  Jost: () => ({ variable: "font-sans-variable" }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span role="img" aria-label={alt} data-src={String(src)} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

/**
 * The address and payment steps used to be nested inside `app/(storefront)`, which meant they
 * rendered the shop header — two dropdown menus, About, Contact — and the floating WhatsApp
 * bubble, and could not decline either, because a nested layout cannot opt out of an ancestor.
 * That is nine ways out of a funnel the shopper has already committed to, at the top of the two
 * screens closest to the money.
 *
 * `app/(checkout)` is a sibling route group with its own shell, exactly as `app/admin` is
 * (ADR-044). A route group adds no URL segment, so `/address` and `/payment` are served where
 * they always were — which is the property most worth pinning, because getting it wrong is a
 * 404 on the checkout rather than a visual regression. See
 * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */

/** Markers only the shop chrome emits. */
const SHOP_CHROME_MARKERS: readonly string[] = [
  "wa.me",
  CATEGORY_MENU.label,
  COLLECTION_MENU.label,
  ...COMPANY_LINKS.map((link) => link.label),
];

async function renderCheckoutShell(): Promise<string> {
  const { default: CheckoutLayout } = await import("@/app/(checkout)/layout");
  return renderToStaticMarkup(
    <CheckoutLayout>
      <p>checkout content</p>
    </CheckoutLayout>,
  );
}

async function renderCheckoutHeader(step: 1 | 2): Promise<string> {
  const { CheckoutHeader } = await import("@/components/CheckoutHeader");
  return renderToStaticMarkup(<CheckoutHeader current={step} />);
}

describe("where the checkout steps live", () => {
  it("serves /address and /payment from the checkout group, at the same URLs", () => {
    expect(existsSync("app/(checkout)/address/page.tsx")).toBe(true);
    expect(existsSync("app/(checkout)/payment/page.tsx")).toBe(true);

    expect(existsSync("app/(storefront)/address/page.tsx")).toBe(false);
    expect(existsSync("app/(storefront)/payment/page.tsx")).toBe(false);
  });

  it("leaves the confirmation screen in the shop, where its cross-sell and support live", () => {
    expect(existsSync("app/(storefront)/order-confirmation/page.tsx")).toBe(true);
  });

  it("shares the cart and the campaign capture with the shop rather than restating them", () => {
    const checkoutLayout = readFileSync("app/(checkout)/layout.tsx", "utf8");
    const storefrontLayout = readFileSync("app/(storefront)/layout.tsx", "utf8");

    for (const layout of [checkoutLayout, storefrontLayout]) {
      expect(layout).toContain("ShopProviders");
      expect(layout).not.toContain("CartProvider");
    }
  });
});

describe("the checkout shell", () => {
  it("renders none of the shop chrome", async () => {
    const markup = await renderCheckoutShell();

    for (const marker of SHOP_CHROME_MARKERS) {
      expect(markup, `checkout shell still renders "${marker}"`).not.toContain(marker);
    }
  });

  it("keeps the page it was given", async () => {
    expect(await renderCheckoutShell()).toContain("checkout content");
  });

  it("still offers the policies and a way to reach a person", async () => {
    const markup = await renderCheckoutShell();

    expect(markup).toContain("/shipping");
    expect(markup).toContain("/refund");
    expect(markup).toContain(CONTACT_CONFIG.supportEmail);
  });
});

describe("the checkout header", () => {
  it("carries the logo, the step indicator and one link back to the cart", async () => {
    const markup = await renderCheckoutHeader(1);

    expect(markup).toContain(SITE_CONFIG.brandName);
    expect(markup).toContain("Back to cart");
    expect(markup).toContain('href="/cart"');
    expect(markup).toContain("Address");
    expect(markup).toContain("Payment");
    expect(markup).toContain("Confirmation");
  });

  it("marks the step the shopper is actually on", async () => {
    expect(await renderCheckoutHeader(1)).toContain('aria-current="step"');
    expect(await renderCheckoutHeader(2)).toContain('aria-current="step"');
  });

  it("offers no other way out of the funnel", async () => {
    const markup = await renderCheckoutHeader(2);
    const hrefs = Array.from(markup.matchAll(/href="([^"]+)"/g)).map((match) => match[1]);

    /** The logo home link and the cart link, and nothing else. */
    expect(new Set(hrefs)).toEqual(new Set(["/", "/cart"]));
  });
});
