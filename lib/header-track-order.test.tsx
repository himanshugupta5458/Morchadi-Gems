/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TRACK_ORDER_PATH } from "@/lib/navigation";
import { getCatalogueIndex } from "@/lib/products";
import { CartProvider } from "@/lib/cart-context";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/MobileNav";

/**
 * The header carries the search box now, and `ProductSearch` reaches for the app router to
 * follow an arrow-keyed suggestion. There is no router outside a Next render, so the shell tests
 * stand one up, exactly as they already stand up `next/image` and `next/font`.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "font-display-variable" }),
  Jost: () => ({ variable: "font-sans-variable" }),
}));

/**
 * The click handlers are the point of two of these tests, so they are forwarded rather than
 * dropped — and the default is suppressed, because jsdom cannot navigate and says so loudly.
 */
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...anchorProps
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
      {...anchorProps}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: { src: string } | string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === "string" ? src : src.src} alt={alt} />
  ),
}));

vi.mock("next/headers", () => ({
  headers: () => ({
    get: (name: string) => (name.toLowerCase() === "host" ? "localhost:3000" : null),
  }),
}));

afterEach(cleanup);

function renderHeader(): void {
  render(
    <CartProvider catalogue={getCatalogueIndex()}>
      <Header />
    </CartProvider>,
  );
}

function headerTrackOrderLink(): HTMLAnchorElement {
  return screen.getByRole("link", { name: "Track Order" }) as HTMLAnchorElement;
}

function openMobileDrawer(): HTMLElement {
  render(
    <CartProvider catalogue={getCatalogueIndex()}>
      <MobileNav />
    </CartProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  return screen.getByRole("dialog", { name: "Site menu" });
}

/**
 * A returning customer arrives with an order number and no account to sign in with, so the
 * only thing standing between them and `/track` is whether the way in is on screen. It is a
 * placement change and nothing more — the tracking page, its lookup and its rate limit are
 * untouched by this file and by the change it guards.
 */
describe("the header's track-order link", () => {
  it("points at /track", () => {
    renderHeader();

    expect(headerTrackOrderLink().getAttribute("href")).toBe(TRACK_ORDER_PATH);
    expect(TRACK_ORDER_PATH).toBe("/track");
  });

  /**
   * Title Case in the source, uppercased by the type scale — the same arrangement as the
   * primary nav's About and Contact, so the label reads as a nav label rather than as copy.
   */
  it("carries the house nav label treatment", () => {
    renderHeader();
    const link = headerTrackOrderLink();

    expect(link.textContent).toBe("Track Order");
    expect(link.className).toContain("uppercase");
    expect(link.className).toContain("tracking-caps");
    expect(link.className).toContain("text-label");
    expect(link.className).toContain("text-ink");
    expect(link.className).toContain("hover:text-gold-deep");
  });

  it("sits in the logo row immediately before the cart", () => {
    renderHeader();
    const link = headerTrackOrderLink();
    const cluster = link.parentElement;

    if (cluster === null) throw new Error("The track-order link has no cluster around it");
    expect(within(cluster).getByLabelText(/^Cart,/)).toBeTruthy();
    expect(link.nextElementSibling).toBe(within(cluster).getByLabelText(/^Cart,/));
  });

  /**
   * The one way this addition could fail its own brief is by being rendered and then hidden.
   * The link and the cluster holding it carry no breakpoint-gated visibility of any kind, so
   * every viewport that renders the header renders this.
   */
  it("is visible at every width rather than gated to one", () => {
    renderHeader();
    const link = headerTrackOrderLink();
    const cluster = link.parentElement;

    if (cluster === null) throw new Error("The track-order link has no cluster around it");
    for (const element of [link, cluster]) {
      expect(element.className).not.toContain("hidden");
      expect(element.className).not.toMatch(/(sm|md|lg|xl):(block|flex|inline)/);
    }
  });

  it("is repeated in the mobile drawer beside the cart", () => {
    const drawer = openMobileDrawer();
    const link = within(drawer).getByRole("link", { name: "Track Order" });
    const band = link.parentElement;

    if (band === null) throw new Error("The drawer's track-order link has no band around it");
    expect(link.getAttribute("href")).toBe(TRACK_ORDER_PATH);
    expect(within(band).getByLabelText(/^Cart,/)).toBeTruthy();
  });

  it("closes the drawer on the way to /track", () => {
    const drawer = openMobileDrawer();

    fireEvent.click(within(drawer).getByRole("link", { name: "Track Order" }));

    expect(screen.queryByRole("dialog", { name: "Site menu" })).toBeNull();
  });
});

/**
 * `text-label` is 12px with 0.14em of tracking, and "TRACK ORDER" is ten glyphs and a space.
 * At 320px — the narrowest viewport the storefront supports — the logo row has 280px of
 * content box, and the hamburger, wordmark, cart and the three gaps between them spend 169px
 * of it. The label has to fit in the 111px left over, on one line, because a logo row that
 * overflows its container is a horizontally scrolling page on every route at once.
 *
 * The same reasoning as `CategoryTile`'s label in `lib/responsive-scale.test.ts`: checked
 * against the room it actually has, not assumed to fit. No browser runs in this environment,
 * so the glyph advance is a deliberately generous estimate for Jost — a geometric sans whose
 * caps sit nearer 0.60em — which makes the budget a floor rather than a reading.
 */
describe("the mobile logo row's width budget", () => {
  const NARROWEST_VIEWPORT_PX = 320;
  const CONTAINER_PADDING_PX = 20;
  const HAMBURGER_PX = 32;
  const WORDMARK_PX = 73;
  const CART_ICON_PX = 24;
  const WORDMARK_GAP_PX = 8;
  const CLUSTER_GAP_PX = 16;
  const ROW_GAP_PX = 16;

  const LABEL_FONT_SIZE_PX = 12;
  const UPPERCASE_ADVANCE_RATIO = 0.63;
  const SPACE_ADVANCE_RATIO = 0.28;
  const TRACKING_CAPS_EM = 0.14;

  function measureUppercaseLabel(label: string): number {
    const glyphs = label.toUpperCase().split("");
    const advances = glyphs.map((glyph) =>
      glyph === " " ? SPACE_ADVANCE_RATIO : UPPERCASE_ADVANCE_RATIO,
    );
    const glyphWidth = advances.reduce((total, ratio) => total + ratio, 0);
    return (glyphWidth + glyphs.length * TRACKING_CAPS_EM) * LABEL_FONT_SIZE_PX;
  }

  it("leaves the track-order label room to sit on one line at 320px", () => {
    const contentWidth = NARROWEST_VIEWPORT_PX - CONTAINER_PADDING_PX * 2;
    const spokenFor =
      HAMBURGER_PX +
      WORDMARK_GAP_PX +
      WORDMARK_PX +
      ROW_GAP_PX +
      CLUSTER_GAP_PX +
      CART_ICON_PX;

    expect(measureUppercaseLabel("Track Order")).toBeLessThan(contentWidth - spokenFor);
  });

  /**
   * The measurement above is only meaningful while the label stays at the compact end of the
   * scale and refuses to wrap. Both are load-bearing, so both are asserted.
   */
  it("keeps the label unwrapped and at the compact end of the type scale", () => {
    const source = readFileSync("components/TrackOrderLink.tsx", "utf8");

    expect(source).toContain("whitespace-nowrap");
    expect(source).toContain("text-label");
    expect(source).not.toContain("text-body");
  });

  it("keeps the logo row's gaps at the widths the budget was measured against", () => {
    const header = readFileSync("components/Header.tsx", "utf8");

    expect(header).toContain("flex h-16 items-center justify-between gap-4");
    expect(header).toContain('className="flex items-center justify-end gap-4 lg:gap-6"');
  });
});

/**
 * `/admin` is a sibling route group with a shell of its own, so the storefront header cannot
 * reach it — but "the component is not imported" is a claim about one module, and the way the
 * shop chrome reached the panel the first time was through a layout nobody had imported it
 * into. Asserted on rendered HTML, and on the storefront first so a broken marker cannot pass
 * the admin case by matching nothing at all.
 */
describe("ADR-044 keeps the link off the panel", () => {
  async function renderStorefrontShell(): Promise<string> {
    const { default: StorefrontLayout } = await import("@/app/(storefront)/layout");
    return renderToStaticMarkup(
      <StorefrontLayout>
        <p>storefront content</p>
      </StorefrontLayout>,
    );
  }

  async function renderAdminShell(): Promise<string> {
    const { default: RootLayout } = await import("@/app/layout");
    const { default: AdminLayout } = await import("@/app/admin/layout");

    return renderToStaticMarkup(
      <RootLayout>
        <AdminLayout>
          <p>admin content</p>
        </AdminLayout>
      </RootLayout>,
    );
  }

  it("renders on the storefront", async () => {
    const html = await renderStorefrontShell();

    expect(html).toContain('href="/track"');
    expect(html).toContain("Track Order");
  });

  it("renders on no admin page", async () => {
    const html = await renderAdminShell();

    expect(html).toContain("admin content");
    expect(html).not.toContain('href="/track"');
    expect(html).not.toContain("Track Order");
  });
});
