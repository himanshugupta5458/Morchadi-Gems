import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_DAYS,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  buildAdminSessionCookieOptions,
  buildClearedAdminSessionCookieOptions,
  createAdminSession,
  deleteExpiredAdminSessions,
  destroyAdminSession,
  destroyAllSessionsForAdmin,
  readAdminSession,
} from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

/**
 * There is no `Admin` row to create a fixture from: `AdminSession.adminId` is a plain string,
 * always `ADMIN_IDENTITY_ID` in real use (lib/admin-auth.ts). Tests use a distinct fake identity
 * instead, so a session this suite creates and destroys cannot be confused with — or clean up —
 * one another suite happens to be holding open concurrently under the real identity.
 */
const TEST_ADMIN_ID = "session-suite-throwaway";
const THROWAWAY_USERNAME = "session-suite-throwaway";

let unavailableReason: string | null = null;
const adminId = TEST_ADMIN_ID;

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
  if (unavailableReason === null) {
    await prisma.adminSession.deleteMany({ where: { adminId: TEST_ADMIN_ID } });
  }
  await prisma.$disconnect();
});

async function expireEverySessionOf(id: string): Promise<void> {
  await prisma.adminSession.updateMany({
    where: { adminId: id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
}

describe("the admin session cookie", () => {
  it("is out of reach of script and of a cross-site POST", () => {
    const options = buildAdminSessionCookieOptions(new Date());

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("is Secure in production and deliberately not over plain-HTTP local development", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(buildAdminSessionCookieOptions(new Date()).secure).toBe(true);
    expect(buildClearedAdminSessionCookieOptions().secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(buildAdminSessionCookieOptions(new Date()).secure).toBe(false);

    vi.unstubAllEnvs();
  });

  it("clears with the same identity it was set with, expired immediately", () => {
    const cleared = buildClearedAdminSessionCookieOptions();

    expect(cleared.maxAge).toBe(0);
    expect(cleared.path).toBe("/");
    expect(cleared.httpOnly).toBe(true);
    expect(cleared.sameSite).toBe("lax");
  });

  it("lasts seven days", () => {
    expect(ADMIN_SESSION_DAYS).toBe(7);
    expect(ADMIN_SESSION_MAX_AGE_SECONDS).toBe(7 * 24 * 60 * 60);
  });
});

describe("creating a session", () => {
  it("issues a token that resolves back to the admin it was issued for", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    /**
     * `readAdminSession` no longer joins to a stored username — there is no `Admin` row to
     * join to — it reads `ADMIN_USERNAME` fresh from the environment on every lookup. Stubbing
     * it here is what makes this test's expectation meaningful rather than accidental.
     */
    vi.stubEnv("ADMIN_USERNAME", THROWAWAY_USERNAME);

    const { token } = await createAdminSession(adminId);

    await expect(readAdminSession(token)).resolves.toEqual({
      id: adminId,
      username: THROWAWAY_USERNAME,
    });

    await destroyAdminSession(token);
    vi.unstubAllEnvs();
  });

  it("expires it seven days out", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const before = Date.now();
    const { token, expiresAt } = await createAdminSession(adminId);
    const sevenDaysFromNow = before + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(sevenDaysFromNow);
    expect(expiresAt.getTime()).toBeLessThan(sevenDaysFromNow + 10_000);

    await destroyAdminSession(token);
  });

  it("stores a digest rather than the token, so a database dump cannot be replayed", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { token } = await createAdminSession(adminId);
    const rows = await prisma.adminSession.findMany({ where: { adminId } });

    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(token.length).toBeGreaterThanOrEqual(43);

    await destroyAdminSession(token);
  });

  it("issues a different token every time", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const first = await createAdminSession(adminId);
    const second = await createAdminSession(adminId);

    expect(first.token).not.toBe(second.token);
    await expect(readAdminSession(first.token)).resolves.not.toBeNull();
    await expect(readAdminSession(second.token)).resolves.not.toBeNull();

    await destroyAllSessionsForAdmin(adminId);
  });
});

describe("validating a session", () => {
  it("refuses a token nobody was ever issued", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(readAdminSession("not-a-token-anyone-holds")).resolves.toBeNull();
  });

  it("refuses an empty cookie without going near the database", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(readAdminSession("")).resolves.toBeNull();
  });

  it("refuses an expired session and deletes the row as it goes", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { token } = await createAdminSession(adminId);
    await expireEverySessionOf(adminId);

    await expect(readAdminSession(token)).resolves.toBeNull();
    await expect(prisma.adminSession.count({ where: { adminId } })).resolves.toBe(0);
  });
});

describe("destroying a session", () => {
  it("stops the token working immediately, which is what a logout must guarantee", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { token } = await createAdminSession(adminId);
    await destroyAdminSession(token);

    await expect(readAdminSession(token)).resolves.toBeNull();
    await expect(prisma.adminSession.count({ where: { adminId } })).resolves.toBe(0);
  });

  it("leaves other sessions of the same admin alone", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const laptop = await createAdminSession(adminId);
    const phone = await createAdminSession(adminId);

    await destroyAdminSession(laptop.token);

    await expect(readAdminSession(laptop.token)).resolves.toBeNull();
    await expect(readAdminSession(phone.token)).resolves.not.toBeNull();

    await destroyAllSessionsForAdmin(adminId);
  });

  it("ends every session of one admin when asked to", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const laptop = await createAdminSession(adminId);
    const phone = await createAdminSession(adminId);

    await expect(destroyAllSessionsForAdmin(adminId)).resolves.toBe(2);
    await expect(readAdminSession(laptop.token)).resolves.toBeNull();
    await expect(readAdminSession(phone.token)).resolves.toBeNull();
  });

  it("is a no-op for a token that was never issued", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(destroyAdminSession("nothing-here")).resolves.toBeUndefined();
    await expect(destroyAdminSession("")).resolves.toBeUndefined();
  });
});

describe("sweeping expired sessions", () => {
  it("removes the expired ones and keeps the live one", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await createAdminSession(adminId);
    await createAdminSession(adminId);
    await expireEverySessionOf(adminId);

    const live = await createAdminSession(adminId);

    expect(await deleteExpiredAdminSessions()).toBeGreaterThanOrEqual(2);
    await expect(readAdminSession(live.token)).resolves.not.toBeNull();

    await destroyAllSessionsForAdmin(adminId);
  });
});
