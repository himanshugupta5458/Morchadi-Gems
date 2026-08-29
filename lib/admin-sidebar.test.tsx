import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ADMIN_SECTIONS, resolveAdminSectionLinks } from "@/lib/admin-routing";

/**
 * The sidebar's one job beyond listing the sections: saying which of them you are in.
 *
 * It is asserted through the protected layout rather than by handing `AdminSidebar` a prop,
 * because the prop is the easy half. The claim worth testing runs from middleware's
 * `x-admin-internal-path` header, through `resolveAdminSection`, into `aria-current` — and it is
 * that chain, not the component, which is what stops the panel from needing `usePathname` and a
 * Client Component layout ([ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md)).
 */

const requestState = vi.hoisted(() => ({ internalPath: "/admin/orders" }));

vi.mock("next/headers", () => ({
  headers: () => ({
    get: (name: string) => {
      const key = name.toLowerCase();
      if (key === "host") return "localhost:3000";
      if (key === "x-admin-internal-path") return requestState.internalPath;
      return null;
    },
  }),
}));

vi.mock("@/lib/admin-session", () => ({
  requireAdminSession: async () => ({
    kind: "SIGNED_IN",
    admin: { id: "admin-1", username: "owner" },
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    "aria-current"?: "page";
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

async function renderPanel(internalPath: string): Promise<string> {
  requestState.internalPath = internalPath;
  const { default: ProtectedAdminLayout } = await import("@/app/admin/(protected)/layout");
  return renderToStaticMarkup(
    await ProtectedAdminLayout({ children: <p>panel content</p> }),
  );
}

/** The `<a>` tag for one href, so `aria-current` can be read off the right link. */
function anchorFor(markup: string, href: string): string {
  const match = markup.match(new RegExp(`<a[^>]*href="${href}"[^>]*>`));
  return match?.[0] ?? "";
}

describe("the admin sidebar", () => {
  it("lists every section, on every page", async () => {
    const markup = await renderPanel("/admin/orders");

    for (const link of resolveAdminSectionLinks("localhost:3000")) {
      expect(markup).toContain(`href="${link.href}"`);
      expect(markup).toContain(link.label);
    }
  });

  it("marks Orders as the current section on the order list", async () => {
    const markup = await renderPanel("/admin/orders");

    expect(anchorFor(markup, "/admin/orders")).toContain('aria-current="page"');
    expect(anchorFor(markup, "/admin/products")).not.toContain("aria-current");
  });

  it("marks Products as the current section on the product list", async () => {
    const markup = await renderPanel("/admin/products");

    expect(anchorFor(markup, "/admin/products")).toContain('aria-current="page"');
    expect(anchorFor(markup, "/admin/orders")).not.toContain("aria-current");
  });

  /**
   * A detail page is inside the section it was reached from. A sidebar that lost its highlight on
   * the way into a record would be telling the operator they had left.
   */
  it("keeps the section marked inside a record", async () => {
    const markup = await renderPanel("/admin/products/P001");

    expect(anchorFor(markup, "/admin/products")).toContain('aria-current="page"');
  });

  it("marks nothing on the panel's home, which is not a section", async () => {
    const markup = await renderPanel("/admin");

    expect(markup).not.toContain('aria-current="page"');
  });

  it("carries the identity and the way out on every page", async () => {
    const markup = await renderPanel("/admin/orders");

    expect(markup).toContain("owner");
    expect(markup).toContain("Sign out");
    expect(markup).toContain("panel content");
  });

  /**
   * The sections are declared once. A third one added to `ADMIN_SECTIONS` without a label or an
   * href resolver would render as `undefined` in the sidebar rather than fail here.
   */
  it("resolves a label and an href for every declared section", () => {
    const links = resolveAdminSectionLinks("localhost:3000");

    expect(links.map((link) => link.section)).toEqual([...ADMIN_SECTIONS]);
    for (const link of links) {
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.href.startsWith("/")).toBe(true);
    }
  });
});
