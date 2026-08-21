import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { checkDatabaseHealth, type HealthCheckClient } from "@/lib/health";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

const CLIENT_VERSION = "test";

let unavailableReason: string | null = null;
let silencedErrors: ReturnType<typeof vi.spyOn>;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

beforeAll(async () => {
  silencedErrors = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    await prisma.$connect();
  } catch (error) {
    unavailableReason = `no database at DATABASE_URL (${firstLineOf(error)}) — ${START_POSTGRES_HINT}`;
  }
});

afterEach(() => {
  silencedErrors.mockClear();
});

afterAll(async () => {
  silencedErrors.mockRestore();
  await prisma.$disconnect();
});

/**
 * A client that answers each of the two probes however the test needs it to.
 *
 * The cast is what a stub for `$queryRaw` costs: it is a tagged-template function with four
 * overloads, and a fake that satisfies all of them is more type ceremony than the two lines of
 * behaviour under test. Nothing here is `any`, and the shape the probe actually uses is the
 * shape given.
 */
function stubClient(probes: {
  connectivity: () => Promise<unknown>;
  schema: () => Promise<unknown>;
}): HealthCheckClient {
  return {
    $queryRaw: probes.connectivity,
    order: { findFirst: probes.schema },
  } as unknown as HealthCheckClient;
}

const CONNECTION_REFUSED = new Prisma.PrismaClientInitializationError(
  "Can't reach database server at localhost:5432",
  CLIENT_VERSION,
);

const COLUMN_MISSING = new Prisma.PrismaClientKnownRequestError(
  "The column `orders.amount_prepaid` does not exist in the current database.",
  { code: "P2022", clientVersion: CLIENT_VERSION },
);

describe("the database health probe", () => {
  it("calls a database that answers both probes healthy", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const report = await checkDatabaseHealth(prisma);

    expect(report.status).toBe("healthy");
    expect(report.database).toBe("reachable");
    expect(Number.isNaN(Date.parse(report.checkedAt))).toBe(false);
  });

  it("calls a refused connection unhealthy rather than throwing", async () => {
    const report = await checkDatabaseHealth(
      stubClient({
        connectivity: () => Promise.reject(CONNECTION_REFUSED),
        schema: () => Promise.reject(CONNECTION_REFUSED),
      }),
    );

    expect(report).toMatchObject({ status: "unhealthy", database: "unreachable" });
  });

  /**
   * The failure the old health check could not see at all. Postgres is up, the connection is
   * fine, `SELECT 1` succeeds — and the deployment is still broken, because nobody ran
   * `prisma migrate deploy` and the first real query will fail. A probe that stopped at
   * connectivity would report this deployment healthy while it lost every order.
   */
  it("separates a database that is missing this image's schema from one that is down", async () => {
    const report = await checkDatabaseHealth(
      stubClient({
        connectivity: () => Promise.resolve([{ result: 1 }]),
        schema: () => Promise.reject(COLUMN_MISSING),
      }),
    );

    expect(report).toMatchObject({ status: "unhealthy", database: "schema-mismatch" });
  });

  it("gives up on a database that accepts the connection and never answers", async () => {
    const never = (): Promise<unknown> => new Promise(() => undefined);

    const startedAt = Date.now();
    const report = await checkDatabaseHealth(
      stubClient({ connectivity: never, schema: never }),
      25,
    );

    expect(report).toMatchObject({ status: "unhealthy", database: "unreachable" });
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });

  /**
   * `/api/health` answers the open internet, so the report is three fields wide on purpose.
   * Everything that names a host, a port, a driver or a column belongs in the log.
   */
  it("puts the reason in the log and nothing but the verdict in the report", async () => {
    const report = await checkDatabaseHealth(
      stubClient({
        connectivity: () => Promise.reject(CONNECTION_REFUSED),
        schema: () => Promise.reject(CONNECTION_REFUSED),
      }),
    );

    const reportAsText = JSON.stringify(report);
    expect(reportAsText).not.toContain("localhost");
    expect(reportAsText).not.toContain("5432");
    expect(reportAsText).not.toContain("Prisma");
    expect(Object.keys(report).sort()).toEqual(["checkedAt", "database", "status"]);

    const loggedText = silencedErrors.mock.calls.flat().map(String).join(" ");
    expect(loggedText).toContain("[health]");
  });
});

describe("GET /api/health against a live database", () => {
  it("answers 200 with a report nothing may cache", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      status: "healthy",
      database: "reachable",
    });
  });
});
