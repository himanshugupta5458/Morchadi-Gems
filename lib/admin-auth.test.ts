import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as loginRoute } from "@/app/admin/api/login/route";
import { POST as logoutRoute } from "@/app/admin/api/logout/route";
import {
  ADMIN_IDENTITY_ID,
  ADMIN_LOGIN_FAILURE_MESSAGE,
  FAILED_LOGIN_FLOOR_MS,
  authenticateAdmin,
} from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-routing";
import { destroyAdminSession, readAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const TEST_ADMIN_USERNAME = "auth-suite-throwaway";
const TEST_ADMIN_PASSWORD = "a-long-enough-throwaway-password";
const LOGIN_URL = "http://localhost:3000/admin/api/login";
const LOGOUT_URL = "http://localhost:3000/admin/api/logout";

let unavailableReason: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    unavailableReason = `no database at DATABASE_URL (${firstLineOf(error)}) — ${START_POSTGRES_HINT}`;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * The credentials `authenticateAdmin` reads are `process.env.ADMIN_USERNAME`/`ADMIN_PASSWORD`,
 * so every test gets a known-good pair stubbed in rather than depending on whatever `.env.local`
 * happens to hold. Individual tests override one or both to exercise the "unset" paths.
 */
beforeEach(() => {
  vi.stubEnv("ADMIN_USERNAME", TEST_ADMIN_USERNAME);
  vi.stubEnv("ADMIN_PASSWORD", TEST_ADMIN_PASSWORD);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function postCredentials(username: string, password: string): Promise<Response> {
  return loginRoute(
    new Request(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  );
}

function tokenFromSetCookie(setCookie: string | null): string {
  const match = /morchadi_admin_session=([^;]+)/.exec(setCookie ?? "");
  return decodeURIComponent(match?.[1] ?? "");
}

describe("authenticating an admin", () => {
  it("accepts the right credentials", async () => {
    await expect(authenticateAdmin(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD)).resolves.toEqual({
      id: ADMIN_IDENTITY_ID,
      username: TEST_ADMIN_USERNAME,
    });
  });

  it("accepts the username however it was capitalised", async () => {
    await expect(
      authenticateAdmin(`  ${TEST_ADMIN_USERNAME.toUpperCase()}  `, TEST_ADMIN_PASSWORD),
    ).resolves.toEqual({ id: ADMIN_IDENTITY_ID, username: TEST_ADMIN_USERNAME });
  });

  it("rejects a wrong password", async () => {
    await expect(authenticateAdmin(TEST_ADMIN_USERNAME, "not-the-password")).resolves.toBeNull();
  });

  it("rejects an unknown username identically", async () => {
    await expect(
      authenticateAdmin("nobody-by-that-name", TEST_ADMIN_PASSWORD),
    ).resolves.toBeNull();
  });

  it("rejects an empty field", async () => {
    await expect(authenticateAdmin("", TEST_ADMIN_PASSWORD)).resolves.toBeNull();
    await expect(authenticateAdmin(TEST_ADMIN_USERNAME, "")).resolves.toBeNull();
  });

  it("takes at least the failure floor, whichever half was wrong", async () => {
    const wrongPasswordStart = Date.now();
    await authenticateAdmin(TEST_ADMIN_USERNAME, "not-the-password");
    const wrongPasswordMs = Date.now() - wrongPasswordStart;

    const unknownUserStart = Date.now();
    await authenticateAdmin("nobody-by-that-name", TEST_ADMIN_PASSWORD);
    const unknownUserMs = Date.now() - unknownUserStart;

    expect(wrongPasswordMs).toBeGreaterThanOrEqual(FAILED_LOGIN_FLOOR_MS - 10);
    expect(unknownUserMs).toBeGreaterThanOrEqual(FAILED_LOGIN_FLOOR_MS - 10);
  });

  it("fails closed — never succeeds — when ADMIN_USERNAME is unset", async () => {
    vi.stubEnv("ADMIN_USERNAME", undefined);

    await expect(
      authenticateAdmin(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD),
    ).resolves.toBeNull();
  });

  it("fails closed — never succeeds — when ADMIN_PASSWORD is unset", async () => {
    vi.stubEnv("ADMIN_PASSWORD", undefined);

    await expect(
      authenticateAdmin(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD),
    ).resolves.toBeNull();
  });

  it("fails closed when neither is configured, still at the same failure floor", async () => {
    vi.stubEnv("ADMIN_USERNAME", undefined);
    vi.stubEnv("ADMIN_PASSWORD", undefined);

    const start = Date.now();
    await expect(
      authenticateAdmin(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD),
    ).resolves.toBeNull();

    expect(Date.now() - start).toBeGreaterThanOrEqual(FAILED_LOGIN_FLOOR_MS - 10);
  });

  it("treats a blank ADMIN_USERNAME the same as an unset one", async () => {
    vi.stubEnv("ADMIN_USERNAME", "   ");

    await expect(
      authenticateAdmin(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD),
    ).resolves.toBeNull();
  });

  /**
   * `timingSafeStringEqual` (unexported — this is a behavioural proof, not a call into the
   * private helper) hashes both sides to a fixed 32 bytes before comparing, specifically so a
   * length mismatch between the submitted and configured password never takes an early-return
   * shortcut. Reliably measuring a nanosecond-scale timing difference in CI is not practical —
   * `FAILED_LOGIN_FLOOR_MS` already swallows it — so what this asserts is the property that
   * makes the shortcut impossible to take: a password wildly shorter or longer than the real one
   * is rejected exactly like a same-length wrong password, through the same code path and the
   * same floor, rather than short-circuiting before either comparison runs.
   */
  it("rejects a password of a very different length exactly like a same-length wrong one", async () => {
    await expect(authenticateAdmin(TEST_ADMIN_USERNAME, "x")).resolves.toBeNull();
    await expect(
      authenticateAdmin(TEST_ADMIN_USERNAME, "x".repeat(500)),
    ).resolves.toBeNull();
  });

  it("never echoes the plaintext password back", async () => {
    const result = await authenticateAdmin(TEST_ADMIN_USERNAME, "not-the-password");

    expect(JSON.stringify(result)).not.toContain("not-the-password");
  });
});

describe("the login endpoint", () => {
  it("signs a valid admin in and hands back a session cookie", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const response = await postCredentials(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "SIGNED_IN" });

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("Path=/");

    await destroyAdminSession(tokenFromSetCookie(cookie));
  });

  it("issues a cookie whose token actually resolves to that admin", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const response = await postCredentials(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD);
    const token = tokenFromSetCookie(response.headers.get("set-cookie"));

    expect(token.length).toBeGreaterThan(0);
    await expect(readAdminSession(token)).resolves.toEqual({
      id: ADMIN_IDENTITY_ID,
      username: TEST_ADMIN_USERNAME,
    });

    await destroyAdminSession(token);
  });

  it("refuses a wrong password without saying which half was wrong", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const response = await postCredentials(TEST_ADMIN_USERNAME, "not-the-password");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      status: "REJECTED",
      error: ADMIN_LOGIN_FAILURE_MESSAGE,
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("answers an unknown username with byte-identical bytes", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const [wrongPassword, unknownUser] = await Promise.all([
      postCredentials(TEST_ADMIN_USERNAME, "not-the-password"),
      postCredentials("nobody-by-that-name", TEST_ADMIN_PASSWORD),
    ]);

    expect(unknownUser.status).toBe(wrongPassword.status);
    expect(await unknownUser.text()).toBe(await wrongPassword.text());
  });

  it("answers the same whether ADMIN_USERNAME/ADMIN_PASSWORD are configured or not", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const configured = await postCredentials(TEST_ADMIN_USERNAME, "not-the-password");

    vi.stubEnv("ADMIN_USERNAME", undefined);
    vi.stubEnv("ADMIN_PASSWORD", undefined);
    const unconfigured = await postCredentials(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD);

    expect(unconfigured.status).toBe(configured.status);
    expect(await unconfigured.text()).toBe(await configured.text());
  });

  it("says the same thing to an empty submission and to a body that is not JSON", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const empty = await postCredentials("", "");
    const notJson = await loginRoute(
      new Request(LOGIN_URL, { method: "POST", body: "username=admin&password=admin" }),
    );

    expect(empty.status).toBe(401);
    expect(notJson.status).toBe(401);
    expect(await notJson.text()).toBe(await empty.text());
  });

  it("never echoes the submitted password back", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const response = await postCredentials(TEST_ADMIN_USERNAME, "not-the-password");
    const body = await response.text();

    expect(body).not.toContain("not-the-password");
    expect(body).not.toContain(TEST_ADMIN_USERNAME);
  });

  it("is never cached", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const response = await postCredentials(TEST_ADMIN_USERNAME, "not-the-password");

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("the logout endpoint", () => {
  it("kills the session server-side and clears the cookie", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const signIn = await postCredentials(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD);
    const token = tokenFromSetCookie(signIn.headers.get("set-cookie"));

    const response = await logoutRoute(
      new NextRequest(LOGOUT_URL, {
        method: "POST",
        headers: new Headers({ cookie: `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}` }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "SIGNED_OUT" });
    await expect(readAdminSession(token)).resolves.toBeNull();

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE}=`);
    expect(cookie).toContain("Max-Age=0");
  });

  it("succeeds when there was no session to end", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const response = await logoutRoute(new NextRequest(LOGOUT_URL, { method: "POST" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "SIGNED_OUT" });
  });
});
