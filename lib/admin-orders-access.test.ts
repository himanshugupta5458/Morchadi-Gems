import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ADMIN_IDENTITY_ID } from "@/lib/admin-auth";
import {
  ADMIN_SESSION_COOKIE,
  DEFAULT_ADMIN_HOSTNAME,
  decideAdminRoute,
} from "@/lib/admin-routing";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const ADMIN_ORDERS_INTERNAL_PATH = "/admin/orders";
const ADMIN_ORDER_DETAIL_INTERNAL_PATH = "/admin/orders/W2ACEHACUU";

let unavailableReason: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

/**
 * What `redirect()` does in Next: it throws. The layout under test never returns on an
 * unauthenticated request, so the redirect has to be caught rather than read off a return
 * value — and a test that merely rendered the layout without this would pass on a page that
 * silently rendered itself to a stranger.
 */
class RedirectSignal extends Error {
  constructor(readonly location: string) {
    super(`redirect:${location}`);
  }
}

let requestCookie: string | null = null;
let requestHost = "localhost:3000";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      name === "morchadi_admin_session" && requestCookie !== null
        ? { name, value: requestCookie }
        : undefined,
  }),
  headers: () => ({
    get: (name: string) => (name.toLowerCase() === "host" ? requestHost : null),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new RedirectSignal(location);
  },
}));

async function renderProtectedLayout(): Promise<string> {
  const { default: ProtectedAdminLayout } = await import("@/app/admin/(protected)/layout");

  try {
    await ProtectedAdminLayout({ children: null });
  } catch (thrown) {
    if (thrown instanceof RedirectSignal) return thrown.location;
    throw thrown;
  }

  return "";
}

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    unavailableReason = `no database at DATABASE_URL (${firstLineOf(error)}) — ${START_POSTGRES_HINT}`;
  }
});

afterEach(() => {
  requestCookie = null;
  requestHost = "localhost:3000";
  vi.unstubAllEnvs();
});

/**
 * The order list is a new route under `(protected)`, and both of the panel's two gates are
 * supposed to cover it by construction rather than by remembering to opt in. These tests are
 * what turn "supposed to" into a claim — the middleware matcher and the route group are both
 * easy to be wrong about, and neither failure is visible from looking at the page.
 */
describe("the middleware gate on /admin/orders", () => {
  it("sends a browser with no session cookie to the login page", () => {
    expect(
      decideAdminRoute({
        hostname: "localhost",
        pathname: ADMIN_ORDERS_INTERNAL_PATH,
        hasSessionCookie: false,
      }),
    ).toEqual({ kind: "redirect", location: "/admin/login" });
  });

  it("does the same on the admin subdomain, in that host's own URL space", () => {
    expect(
      decideAdminRoute({
        hostname: DEFAULT_ADMIN_HOSTNAME,
        pathname: "/orders",
        hasSessionCookie: false,
      }),
    ).toEqual({ kind: "redirect", location: "/login" });
  });

  it("covers the order detail page the rows link to, which does not exist yet", () => {
    expect(
      decideAdminRoute({
        hostname: "localhost",
        pathname: ADMIN_ORDER_DETAIL_INTERNAL_PATH,
        hasSessionCookie: false,
      }),
    ).toEqual({ kind: "redirect", location: "/admin/login" });
  });

  it("is not a public path — it must never answer without a session", () => {
    expect(
      decideAdminRoute({
        hostname: DEFAULT_ADMIN_HOSTNAME,
        pathname: "/orders",
        hasSessionCookie: true,
      }),
    ).toEqual({ kind: "rewrite", internalPath: ADMIN_ORDERS_INTERNAL_PATH });
  });

  it("does not serve the list on the storefront's own domain at all", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(
      decideAdminRoute({
        hostname: "www.morchadigems.com",
        pathname: ADMIN_ORDERS_INTERNAL_PATH,
        hasSessionCookie: true,
      }),
    ).toEqual({ kind: "redirect", location: "/" });
  });
});

describe("the authoritative gate the order list renders behind", () => {
  it("redirects to login when no cookie was sent", async () => {
    expect(await renderProtectedLayout()).toBe("/admin/login");
  });

  it("redirects to the admin host's own login page when that is where the request came from", async () => {
    requestHost = DEFAULT_ADMIN_HOSTNAME;

    expect(await renderProtectedLayout()).toBe("/login");
  });

  it("redirects a forged cookie that got past middleware, which only saw that one existed", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);
    requestCookie = "a-token-nobody-was-ever-issued";

    expect(await renderProtectedLayout()).toBe("/admin/login");
  });

  it("renders for a live session rather than redirecting", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { createAdminSession, destroyAdminSession } = await import("@/lib/admin-session");
    const ticket = await createAdminSession(ADMIN_IDENTITY_ID);
    requestCookie = ticket.token;

    try {
      expect(await renderProtectedLayout()).toBe("");
    } finally {
      await destroyAdminSession(ticket.token);
    }
  });
});

describe("the session cookie the gates agree on", () => {
  it("is the one name both middleware and the layout read", () => {
    expect(ADMIN_SESSION_COOKIE).toBe("morchadi_admin_session");
  });
});
