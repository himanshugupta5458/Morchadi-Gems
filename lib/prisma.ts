import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * The one `PrismaClient` for this process.
 *
 * Each `PrismaClient` opens its own connection pool. In development Next.js re-evaluates a
 * module on every hot reload, so a plain `new PrismaClient()` at module scope creates a fresh
 * pool per save and exhausts Postgres' connection limit within a few edits — a failure that
 * shows up much later as `too many clients already` and reads like a leak in whatever route
 * happened to run last. Caching the instance on `globalThis`, which survives a reload, is
 * Prisma's documented fix for exactly this.
 *
 * The cache is skipped in production, where modules are evaluated once and a global would only
 * outlive the code that owns it.
 *
 * `server-only` makes importing this from a `"use client"` file a build error rather than a
 * code-review catch: `DATABASE_URL` is a credential and must never be resolvable from the
 * browser bundle.
 */
export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
