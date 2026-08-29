import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "font-display-variable" }),
  Jost: () => ({ variable: "font-sans-variable" }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span role="img" aria-label={alt} data-src={src} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/headers", () => ({
  headers: () => ({ get: (name: string) => (name.toLowerCase() === "host" ? "localhost:3000" : null) }),
}));

/**
 * The markers that say the shop is on the page. Each is something only the storefront chrome
 * emits: the WhatsApp link's destination, the footer's copyright line, the header's cart link
 * and the site-wide schema graph's script id.
 */
const STOREFRONT_CHROME_MARKERS: readonly string[] = [
  "wa.me",
  "All rights reserved",
  "site-schema",
];

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
  const { AdminSidebar } = await import("@/components/AdminSidebar");

  return renderToStaticMarkup(
    <RootLayout>
      <AdminLayout>
        <AdminSidebar
          username="owner"
          links={[{ label: "Orders", href: "/admin/orders", isCurrent: true }]}
          logoutApiHref="/admin/api/logout"
          signedOutHref="/admin/login"
        />
        <p>admin content</p>
      </AdminLayout>
    </RootLayout>,
  );
}

/**
 * The admin panel used to sit inside the storefront's root layout, because that is what a root
 * layout does — a nested layout cannot decline an ancestor. The panel therefore rendered with
 * the shop's header above it, its footer below it, and the floating WhatsApp button parked over
 * the bottom-right corner of whatever control happened to be there.
 *
 * These tests are about **rendered HTML**, not about which files import which. "The component
 * is not imported" is a claim about one module; the button reached the panel through a layout
 * nobody had imported it into. The storefront case is asserted first and positively, so a
 * broken marker cannot make the admin case pass by matching nothing at all.
 */
describe("ADR-044 admin layout shell", () => {
  it("still renders every piece of chrome on the storefront", async () => {
    const html = await renderStorefrontShell();

    for (const marker of STOREFRONT_CHROME_MARKERS) {
      expect(html).toContain(marker);
    }
  });

  it("renders none of it on an admin page", async () => {
    const html = await renderAdminShell();

    for (const marker of STOREFRONT_CHROME_MARKERS) {
      expect(html).not.toContain(marker);
    }
  });

  it("still gives the admin page a document, a sidebar and its own content", async () => {
    const html = await renderAdminShell();

    expect(html).toContain("<html");
    expect(html).toContain("<body");
    expect(html).toContain('aria-label="Admin panel"');
    expect(html).toContain('aria-label="Admin sections"');
    expect(html).toContain("admin content");
  });

  /**
   * The login page is not inside `(protected)`, so it is guarded by nothing — but it *is* under
   * `/admin`, and it used to inherit the shop chrome exactly as the protected pages did. It has
   * to lose it by the same mechanism rather than by a second one.
   */
  it("renders the login page inside the admin shell and nothing else", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    const { default: AdminLayout } = await import("@/app/admin/layout");
    const { default: AdminLoginPage } = await import("@/app/admin/login/page");

    const html = renderToStaticMarkup(
      <RootLayout>
        <AdminLayout>
          <AdminLoginPage />
        </AdminLayout>
      </RootLayout>,
    );

    expect(html).toContain("Admin sign in");
    for (const marker of STOREFRONT_CHROME_MARKERS) {
      expect(html).not.toContain(marker);
    }
  });

  /**
   * A `not-found.tsx` is serialised into the payload of every route beneath the segment it sits
   * in, as the subtree to swap in should that page call `notFound()`. A shop-flavoured 404 at
   * the root of `app/` therefore travels with every admin page — invisible on screen and still
   * 22 KB of header, footer, WhatsApp button and catalogue index. The 404 lives inside the
   * storefront group instead, reached by the catch-all route beside it, and the panel has one
   * of its own.
   */
  it("keeps the storefront's 404 out of the panel's payload", () => {
    expect(existsSync("app/not-found.tsx")).toBe(false);
    expect(existsSync("app/(storefront)/not-found.tsx")).toBe(true);
    expect(existsSync("app/(storefront)/[...unmatched]/page.tsx")).toBe(true);
    expect(existsSync("app/admin/not-found.tsx")).toBe(true);
  });

  /**
   * The root layout is the document and nothing else. Anything shopper-facing added to it would
   * reach the panel again by the one route that has no boundary to stop it.
   */
  it("leaves the root layout with no storefront components in it", () => {
    const rootLayout = readFileSync("app/layout.tsx", "utf8");

    for (const component of ["Header", "Footer", "WhatsAppButton", "CartProvider", "JsonLd"]) {
      expect(rootLayout).not.toContain(component);
    }
  });
});
