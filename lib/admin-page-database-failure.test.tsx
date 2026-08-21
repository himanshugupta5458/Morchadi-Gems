import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The three admin screens, rendered against a database that refuses everything.
 *
 * The audit that prompted ADR-048 called this surface "arguably correct behaviour" as it stood,
 * because an operator *should* learn that the database is down. The half that was not correct is
 * what they learned it from: Next's generic 500, which says nothing about which system failed or
 * what it means for the shop. These tests hold the panel to its own error state instead, and to
 * the two things that state must never be mistaken for — an empty order list, and a signed-out
 * session.
 */
const DATABASE_DOWN = new Error("Can't reach database server at localhost:5432");

vi.mock("@/lib/prisma", () => {
  const refuse = (): Promise<never> => Promise.reject(DATABASE_DOWN);

  return {
    prisma: {
      admin: { findUnique: refuse },
      adminSession: { findUnique: refuse, create: refuse, delete: refuse, deleteMany: refuse },
      order: { findUnique: refuse, findMany: refuse, count: refuse },
      $transaction: refuse,
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      name === "morchadi_admin_session" ? { name, value: "a-live-looking-token" } : undefined,
  }),
  headers: () => ({
    get: (name: string) => (name.toLowerCase() === "host" ? "localhost:3000" : null),
  }),
}));

class RedirectSignal extends Error {}
class NotFoundSignal extends Error {}

const navigationCalls = vi.hoisted(() => ({ redirects: 0, notFounds: 0 }));

vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    navigationCalls.redirects += 1;
    throw new RedirectSignal(location);
  },
  notFound: () => {
    navigationCalls.notFounds += 1;
    throw new NotFoundSignal("not found");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const ORDER_ID = "W2ACEHACUU";
const DATABASE_ERROR_HEADING = "The order database did not answer";

let silencedErrors: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  silencedErrors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  silencedErrors.mockRestore();
});

async function renderProtectedLayout(): Promise<string> {
  const { default: ProtectedAdminLayout } = await import("@/app/admin/(protected)/layout");
  return renderToStaticMarkup(await ProtectedAdminLayout({ children: null }));
}

async function renderOrderList(): Promise<string> {
  const { default: AdminOrdersPage } = await import("@/app/admin/(protected)/orders/page");
  return renderToStaticMarkup(await AdminOrdersPage({ searchParams: {} }));
}

async function renderOrderDetail(): Promise<string> {
  const { default: AdminOrderDetailPage } = await import(
    "@/app/admin/(protected)/orders/[id]/page"
  );
  return renderToStaticMarkup(await AdminOrderDetailPage({ params: { id: ORDER_ID } }));
}

describe("the protected admin layout with Postgres unreachable", () => {
  it("renders the panel's own error state rather than throwing a 500", async () => {
    const html = await renderProtectedLayout();

    expect(html).toContain(DATABASE_ERROR_HEADING);
    expect(html).toContain("not being recorded");
  });

  /**
   * Failing closed, and failing honestly. The session could not be resolved, so nothing behind
   * it renders; and the operator is not bounced to a login page that would fail at exactly the
   * same query, which reads as "your session expired" for a session that did not.
   */
  it("neither renders the panel nor pretends the session merely expired", async () => {
    const redirectsBefore = navigationCalls.redirects;

    const html = await renderProtectedLayout();

    expect(html).not.toContain("Sign out");
    expect(navigationCalls.redirects).toBe(redirectsBefore);
  });
});

describe("the order list with Postgres unreachable", () => {
  it("says the database failed instead of drawing an empty table", async () => {
    const html = await renderOrderList();

    expect(html).toContain(DATABASE_ERROR_HEADING);
    expect(html).not.toContain("No active orders yet");
    expect(html).not.toContain("No orders match these filters");
  });

  it("logs which read failed, and leaves the connection string out of the page", async () => {
    const html = await renderOrderList();

    expect(html).not.toContain("localhost:5432");

    const loggedText = silencedErrors.mock.calls.flat().map(String).join(" ");
    expect(loggedText).toContain("[admin-panel]");
    expect(loggedText).toContain("the order list could not be read from Postgres");
  });
});

describe("one order's detail page with Postgres unreachable", () => {
  it("says the database failed instead of claiming the order does not exist", async () => {
    const notFoundsBefore = navigationCalls.notFounds;

    const html = await renderOrderDetail();

    expect(html).toContain(DATABASE_ERROR_HEADING);
    expect(html).toContain(ORDER_ID);
    expect(navigationCalls.notFounds).toBe(notFoundsBefore);
  });
});
