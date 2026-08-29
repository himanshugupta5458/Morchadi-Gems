import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-routing";

/**
 * The expired-session sweep, failing, during a login that is otherwise perfectly correct.
 *
 * This is housekeeping: `deleteMany` over rows that expired days ago, run on each login so the
 * table is swept without a scheduled job. Awaited bare it sat between a verified password and
 * the cookie that acts on it, so a fault in the tidying turned a valid sign-in into a 500 and
 * locked the owner out of the panel for a reason that had nothing to do with their credentials.
 * ADR-048 records it as the one admin surface that degrades silently, and this file is why that
 * is safe to say.
 *
 * Credentials are `ADMIN_USERNAME`/`ADMIN_PASSWORD` (ADR-061), not a Postgres row, so only
 * `adminSession` needs mocking here — `authenticateAdmin` never touches `@/lib/prisma` at all.
 */
const database = vi.hoisted(() => ({
  sweepAttempts: 0,
  sessionsCreated: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminSession: {
      deleteMany: async () => {
        database.sweepAttempts += 1;
        throw new Error("deadlock detected while sweeping admin_sessions");
      },
      create: async () => {
        database.sessionsCreated += 1;
        return { id: "session-1" };
      },
    },
  },
}));

const CORRECT_USERNAME = "himanshu";
const CORRECT_PASSWORD = "a-genuinely-correct-password";

let silencedErrors: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  silencedErrors = vi.spyOn(console, "error").mockImplementation(() => {});
});

beforeEach(() => {
  vi.stubEnv("ADMIN_USERNAME", CORRECT_USERNAME);
  vi.stubEnv("ADMIN_PASSWORD", CORRECT_PASSWORD);
});

afterEach(() => {
  silencedErrors.mockClear();
  vi.unstubAllEnvs();
});

afterAll(() => {
  silencedErrors.mockRestore();
});

function signIn(password: string): Promise<Response> {
  return import("@/app/admin/api/login/route").then(({ POST }) =>
    POST(
      new Request("http://localhost:3000/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: CORRECT_USERNAME, password }),
      }),
    ),
  );
}

describe("a login whose expired-session sweep fails", () => {
  it("signs the owner in anyway, with the cookie that proves it", async () => {
    const attemptsBefore = database.sweepAttempts;
    const sessionsBefore = database.sessionsCreated;

    const response = await signIn(CORRECT_PASSWORD);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "SIGNED_IN" });
    expect(response.headers.get("Set-Cookie")).toContain(ADMIN_SESSION_COOKIE);

    expect(database.sweepAttempts).toBe(attemptsBefore + 1);
    expect(database.sessionsCreated).toBe(sessionsBefore + 1);
  });

  it("leaves the failure in the log and nothing of it in the response", async () => {
    const rawBody = await (await signIn(CORRECT_PASSWORD)).text();

    expect(rawBody).not.toContain("deadlock");
    expect(rawBody).not.toContain("admin_sessions");

    const loggedText = silencedErrors.mock.calls.flat().map(String).join(" ");
    expect(loggedText).toContain("[admin-session]");
    expect(loggedText).toContain("the login continues regardless");
  });

  it("still rejects a wrong password, because the sweep was never the check", async () => {
    const response = await signIn("not-the-password");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ status: "REJECTED" });
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });
});
