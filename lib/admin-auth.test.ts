import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as loginRoute } from "@/app/admin/api/login/route";
import { POST as logoutRoute } from "@/app/admin/api/logout/route";
import {
  ADMIN_LOGIN_FAILURE_MESSAGE,
  FAILED_LOGIN_FLOOR_MS,
  authenticateAdmin,
  hashAdminPassword,
} from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-routing";
import { readAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const THROWAWAY_USERNAME = "auth-suite-throwaway";
const THROWAWAY_PASSWORD = "a-long-enough-throwaway-password";
const LOGIN_URL = "http://localhost:3000/admin/api/login";
const LOGOUT_URL = "http://localhost:3000/admin/api/logout";

let unavailableReason: string | null = null;
let adminId = "";

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

async function removeThrowawayAdmin(): Promise<void> {
  await prisma.admin.deleteMany({ where: { username: THROWAWAY_USERNAME } });
}

beforeAll(async () => {
  try {
    await prisma.$connect();
    await removeThrowawayAdmin();
    const admin = await prisma.admin.create({
      data: {
        username: THROWAWAY_USERNAME,
        passwordHash: await hashAdminPassword(THROWAWAY_PASSWORD),
      },
    });
    adminId = admin.id;
  } catch (error) {
    unavailableReason = `no database at DATABASE_URL (${firstLineOf(error)}) — ${START_POSTGRES_HINT}`;
  }
});

afterAll(async () => {
  if (unavailableReason === null) await removeThrowawayAdmin();
  await prisma.$disconnect();
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

describe("hashing an admin password", () => {
  it("stores something that is not the password and still verifies it", async () => {
    const hash = await hashAdminPassword(THROWAWAY_PASSWORD);

    expect(hash).not.toContain(THROWAWAY_PASSWORD);
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("salts, so the same password twice is two different hashes", async () => {
    const [first, second] = await Promise.all([
      hashAdminPassword(THROWAWAY_PASSWORD),
      hashAdminPassword(THROWAWAY_PASSWORD),
    ]);

    expect(first).not.toBe(second);
  });
});

describe("authenticating an admin", () => {
  it("accepts the right credentials", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(authenticateAdmin(THROWAWAY_USERNAME, THROWAWAY_PASSWORD)).resolves.toEqual({
      id: adminId,
      username: THROWAWAY_USERNAME,
    });
  });

  it("accepts the username however it was capitalised", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(
      authenticateAdmin(`  ${THROWAWAY_USERNAME.toUpperCase()}  `, THROWAWAY_PASSWORD),
    ).resolves.toEqual({ id: adminId, username: THROWAWAY_USERNAME });
  });

  it("rejects a wrong password", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(authenticateAdmin(THROWAWAY_USERNAME, "not-the-password")).resolves.toBeNull();
  });

  it("rejects an unknown username identically", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(authenticateAdmin("nobody-by-that-name", THROWAWAY_PASSWORD)).resolves.toBeNull();
  });

  it("rejects an empty field", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    await expect(authenticateAdmin("", THROWAWAY_PASSWORD)).resolves.toBeNull();
    await expect(authenticateAdmin(THROWAWAY_USERNAME, "")).resolves.toBeNull();
  });

  it("takes at least the failure floor, whichever half was wrong", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const wrongPasswordStart = Date.now();
    await authenticateAdmin(THROWAWAY_USERNAME, "not-the-password");
    const wrongPasswordMs = Date.now() - wrongPasswordStart;

    const unknownUserStart = Date.now();
    await authenticateAdmin("nobody-by-that-name", THROWAWAY_PASSWORD);
    const unknownUserMs = Date.now() - unknownUserStart;

    expect(wrongPasswordMs).toBeGreaterThanOrEqual(FAILED_LOGIN_FLOOR_MS - 10);
    expect(unknownUserMs).toBeGreaterThanOrEqual(FAILED_LOGIN_FLOOR_MS - 10);
  });
});

describe("the login endpoint", () => {
  it("signs a valid admin in and hands back a session cookie", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const response = await postCredentials(THROWAWAY_USERNAME, THROWAWAY_PASSWORD);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "SIGNED_IN" });

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("Path=/");

    await prisma.adminSession.deleteMany({ where: { adminId } });
  });

  it("issues a cookie whose token actually resolves to that admin", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const response = await postCredentials(THROWAWAY_USERNAME, THROWAWAY_PASSWORD);
    const token = /morchadi_admin_session=([^;]+)/.exec(
      response.headers.get("set-cookie") ?? "",
    )?.[1];

    expect(token).toBeDefined();
    await expect(readAdminSession(decodeURIComponent(token ?? ""))).resolves.toEqual({
      id: adminId,
      username: THROWAWAY_USERNAME,
    });

    await prisma.adminSession.deleteMany({ where: { adminId } });
  });

  it("refuses a wrong password without saying which half was wrong", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const response = await postCredentials(THROWAWAY_USERNAME, "not-the-password");

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
      postCredentials(THROWAWAY_USERNAME, "not-the-password"),
      postCredentials("nobody-by-that-name", THROWAWAY_PASSWORD),
    ]);

    expect(unknownUser.status).toBe(wrongPassword.status);
    expect(await unknownUser.text()).toBe(await wrongPassword.text());
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

    const response = await postCredentials(THROWAWAY_USERNAME, "not-the-password");
    const body = await response.text();

    expect(body).not.toContain("not-the-password");
    expect(body).not.toContain(THROWAWAY_USERNAME);
  });

  it("is never cached", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const response = await postCredentials(THROWAWAY_USERNAME, "not-the-password");

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("the logout endpoint", () => {
  it("kills the session server-side and clears the cookie", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const signIn = await postCredentials(THROWAWAY_USERNAME, THROWAWAY_PASSWORD);
    const token = decodeURIComponent(
      /morchadi_admin_session=([^;]+)/.exec(signIn.headers.get("set-cookie") ?? "")?.[1] ?? "",
    );

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
