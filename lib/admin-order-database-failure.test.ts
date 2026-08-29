import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ADMIN_ORDER_ACTIONS, type AdminOrderAction } from "@/lib/admin-routing";

/**
 * Every admin write, against a database that is not there.
 *
 * The storefront's equivalent of this file (`lib/checkout-database-failure.test.ts`) proves
 * that nothing a shopper sees changes when Postgres is down. This one proves the deliberate
 * opposite for the panel: the operator is told, in a typed response their form can read, and
 * the request never becomes an unhandled rejection. Both behaviours are decided in ADR-048.
 *
 * The session lookup is the first thing to fail here, not the write, and that is the point.
 * `readAdminForOrderAction` resolves the cookie against Postgres before a handler body runs, so
 * an error boundary placed after it would catch nothing on the outage it exists for.
 */
const failure = vi.hoisted(() => ({
  error: new Error("not configured") as unknown,
}));

vi.mock("@/lib/prisma", () => {
  const refuse = (): Promise<never> => Promise.reject(failure.error);

  const stub = {
    adminSession: { findUnique: refuse, create: refuse, delete: refuse, deleteMany: refuse },
    order: { findUnique: refuse, updateMany: refuse, findMany: refuse, count: refuse },
    orderStatusHistory: { create: refuse },
    $transaction: (run: (client: unknown) => unknown): Promise<unknown> =>
      Promise.resolve(run(stub)),
  };

  return { prisma: stub };
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

const ORDER_ID = "W2ACEHACUU";

const CONNECTION_REFUSED = new Prisma.PrismaClientInitializationError(
  "Can't reach database server at localhost:5432",
  "test",
);

let silencedErrors: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  silencedErrors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  silencedErrors.mockClear();
});

afterAll(() => {
  silencedErrors.mockRestore();
});

async function postAction(action: AdminOrderAction): Promise<Response> {
  const { POST } =
    action === "status"
      ? await import("@/app/admin/api/orders/[id]/status/route")
      : action === "address"
        ? await import("@/app/admin/api/orders/[id]/address/route")
        : await import("@/app/admin/api/orders/[id]/receipt/route");

  return POST(
    new Request(`http://localhost:3000/admin/api/orders/${ORDER_ID}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "packed", itemReceivedBack: true }),
    }),
    { params: { id: ORDER_ID } },
  );
}

describe("the three order actions with Postgres unreachable", () => {
  it("answer 503 and name the database, rather than crashing into a bare 500", async () => {
    failure.error = CONNECTION_REFUSED;

    for (const action of ADMIN_ORDER_ACTIONS) {
      const response = await postAction(action);
      const body = await response.json();

      expect(response.status, action).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(body, action).toMatchObject({
        status: "REJECTED",
        error: "DATABASE_UNAVAILABLE",
      });
      expect(body.message, action).toContain("nothing about this order was changed");
    }
  });

  /**
   * A fault that is not the database's is still answered in the shape the contract promises,
   * with the sentence that is true of it. Telling an operator the database is down when it is
   * not would send them to restart a healthy Postgres.
   */
  it("keep the shape but change the sentence for a failure that is not the database", async () => {
    failure.error = new TypeError("someRow.toNumber is not a function");

    for (const action of ADMIN_ORDER_ACTIONS) {
      const response = await postAction(action);
      const body = await response.json();

      expect(response.status, action).toBe(500);
      expect(body, action).toMatchObject({ status: "REJECTED", error: "SERVER_ERROR" });
      expect(body.message, action).not.toContain("database");
    }
  });

  /**
   * `submitAdminOrderAction` shows `body.message` and falls back to "That change was refused,
   * and the server did not say why" when there is not one. That fallback was every database
   * fault's message before this boundary existed.
   */
  it("say something the panel can put on screen without inventing it", async () => {
    failure.error = CONNECTION_REFUSED;

    const { submitAdminOrderAction } = await import("@/lib/admin-order-client");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => postAction("status")),
    );

    const result = await submitAdminOrderAction("/admin/api/orders/W2ACEHACUU/status", {});

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("The order database did not answer");
    expect(result.ok === false && result.message).not.toContain("did not say why");

    vi.unstubAllGlobals();
  });

  it("log which action failed on which order, where the exception belongs", async () => {
    failure.error = CONNECTION_REFUSED;

    await postAction("receipt");

    const loggedText = silencedErrors.mock.calls.flat().map(String).join(" ");
    expect(loggedText).toContain("[admin-order-action]");
    expect(loggedText).toContain("receipt");
    expect(loggedText).toContain(ORDER_ID);
  });
});

describe("signing in with Postgres unreachable", () => {
  /**
   * Credentials are `ADMIN_USERNAME`/`ADMIN_PASSWORD` (ADR-061) and never touch Postgres, so a
   * correct password is verified regardless of the database's health. What this proves is the
   * step after: sweeping and creating the session both fail against the mocked-unreachable
   * `prisma.adminSession`, and that failure is reported as the database's fault, not the
   * password's.
   */
  it("says so, instead of leaving the owner retyping a password that was correct", async () => {
    failure.error = CONNECTION_REFUSED;
    vi.stubEnv("ADMIN_USERNAME", "himanshu");
    vi.stubEnv("ADMIN_PASSWORD", "a-real-password");

    const { POST } = await import("@/app/admin/api/login/route");
    const response = await POST(
      new Request("http://localhost:3000/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "himanshu", password: "a-real-password" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.status).toBe("UNAVAILABLE");
    expect(body.error).toContain("It is not your password");
    expect(response.headers.get("Set-Cookie")).toBeNull();

    vi.unstubAllEnvs();
  });
});
