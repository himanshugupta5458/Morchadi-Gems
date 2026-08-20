import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

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

describe("the local Postgres connection", () => {
  it("answers a trivial query through the singleton client", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const rows = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`;

    expect(rows).toEqual([{ result: 1 }]);
  });

  it("reuses one client across a module re-evaluation, as a hot reload would", async () => {
    vi.resetModules();

    const { prisma: afterReevaluation } = await import("@/lib/prisma");

    expect(afterReevaluation).toBe(prisma);
  });
});
