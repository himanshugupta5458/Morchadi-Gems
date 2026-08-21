import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { hash } from "bcryptjs";
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
 */
const database = vi.hoisted(() => ({
  passwordHash: "",
  sweepAttempts: 0,
  sessionsCreated: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    admin: {
      findUnique: async () => ({
        id: "admin-1",
        username: "himanshu",
        passwordHash: database.passwordHash,
      }),
    },
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

const CORRECT_PASSWORD = "a-genuinely-correct-password";

let silencedErrors: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  silencedErrors = vi.spyOn(console, "error").mockImplementation(() => {});
  database.passwordHash = await hash(CORRECT_PASSWORD, 10);
});

afterEach(() => {
  silencedErrors.mockClear();
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
        body: JSON.stringify({ username: "himanshu", password }),
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
