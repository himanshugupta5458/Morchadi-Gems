import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ADMIN_ORDER_ACTIONS,
  ADMIN_SESSION_COOKIE,
  decideAdminRoute,
  resolveAdminOrderActionHref,
  resolveAdminOrderHref,
  type AdminOrderAction,
} from "@/lib/admin-routing";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ADMIN_HOSTNAME } from "@/lib/admin-routing";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const ORDER_ID = "W2ACEHACUU";
const ADMIN_HOSTNAME = DEFAULT_ADMIN_HOSTNAME;

let unavailableReason: string | null = null;
let requestCookie: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      name === "morchadi_admin_session" && requestCookie !== null
        ? { name, value: requestCookie }
        : undefined,
  }),
  headers: () => ({
    get: (name: string) => (name.toLowerCase() === "host" ? "localhost:3000" : null),
  }),
}));

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    unavailableReason = `no database at DATABASE_URL (${firstLineOf(error)}) — ${START_POSTGRES_HINT}`;
  }
});

afterEach(() => {
  requestCookie = null;
});

function jsonRequest(action: AdminOrderAction): Request {
  return new Request(`http://localhost:3000/admin/api/orders/${ORDER_ID}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "packed" }),
  });
}

async function importActionRoute(
  action: AdminOrderAction,
): Promise<(request: Request, context: { params: { id: string } }) => Promise<Response>> {
  if (action === "status") {
    return (await import("@/app/admin/api/orders/[id]/status/route")).POST;
  }
  if (action === "address") {
    return (await import("@/app/admin/api/orders/[id]/address/route")).POST;
  }
  return (await import("@/app/admin/api/orders/[id]/receipt/route")).POST;
}

describe("where the order actions live", () => {
  it("hides the /admin prefix on the admin hostname and keeps it everywhere else", () => {
    for (const action of ADMIN_ORDER_ACTIONS) {
      expect(resolveAdminOrderActionHref(ADMIN_HOSTNAME, ORDER_ID, action)).toBe(
        `/api/orders/${ORDER_ID}/${action}`,
      );
      expect(resolveAdminOrderActionHref("localhost", ORDER_ID, action)).toBe(
        `/admin/api/orders/${ORDER_ID}/${action}`,
      );
    }
  });

  it("keys every action on the same id the list links a row with", () => {
    expect(resolveAdminOrderHref("localhost", ORDER_ID)).toBe(`/admin/orders/${ORDER_ID}`);

    for (const action of ADMIN_ORDER_ACTIONS) {
      expect(resolveAdminOrderActionHref("localhost", ORDER_ID, action)).toContain(ORDER_ID);
    }
  });

  /**
   * These endpoints change data, so unlike login and logout they are not in the middleware's
   * public list. A browser without a session cookie never reaches the handler at all.
   */
  it("is behind the middleware gate on both hostnames", () => {
    for (const action of ADMIN_ORDER_ACTIONS) {
      expect(
        decideAdminRoute({
          hostname: ADMIN_HOSTNAME,
          pathname: `/api/orders/${ORDER_ID}/${action}`,
          hasSessionCookie: false,
        }),
      ).toEqual({ kind: "redirect", location: "/login" });

      expect(
        decideAdminRoute({
          hostname: ADMIN_HOSTNAME,
          pathname: `/api/orders/${ORDER_ID}/${action}`,
          hasSessionCookie: true,
        }),
      ).toEqual({
        kind: "rewrite",
        internalPath: `/admin/api/orders/${ORDER_ID}/${action}`,
      });

      expect(
        decideAdminRoute({
          hostname: "localhost",
          pathname: `/admin/api/orders/${ORDER_ID}/${action}`,
          hasSessionCookie: false,
        }),
      ).toEqual({ kind: "redirect", location: "/admin/login" });
    }
  });
});

/**
 * The middleware gate can only see that *a* cookie was sent. Each handler resolves it against
 * Postgres, exactly as the protected layout does before rendering a page — a forged value gets
 * past the cheap gate and must not get past this one.
 */
describe("the order action handlers", () => {
  it("refuse a request with no session cookie", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    for (const action of ADMIN_ORDER_ACTIONS) {
      const handler = await importActionRoute(action);
      const response = await handler(jsonRequest(action), { params: { id: ORDER_ID } });

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        status: "REJECTED",
        error: "UNAUTHENTICATED",
      });
    }
  });

  it("refuse a forged session cookie", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    requestCookie = "not-a-real-session-token";

    for (const action of ADMIN_ORDER_ACTIONS) {
      const handler = await importActionRoute(action);
      const response = await handler(jsonRequest(action), { params: { id: ORDER_ID } });

      expect(response.status).toBe(401);
    }
  });

  it("names the session cookie the middleware and the panel already agree on", () => {
    expect(ADMIN_SESSION_COOKIE).toBe("morchadi_admin_session");
  });
});
