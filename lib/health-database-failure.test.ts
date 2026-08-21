import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `/api/health` with Postgres refused at the module boundary, the same way
 * `lib/checkout-database-failure.test.ts` refuses it.
 *
 * The point is the mirror image of that file's. Checkout must not change a byte when the
 * database is down; this route exists to change everything about its answer when it is, because
 * it is the only thing in the deployment that says so out loud. See ADR-048.
 */
const DATABASE_DOWN = new Error("Can't reach database server at localhost:5432");

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockRejectedValue(DATABASE_DOWN),
    order: { findFirst: vi.fn().mockRejectedValue(DATABASE_DOWN) },
  },
}));

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

async function getHealth(): Promise<Response> {
  const { GET } = await import("@/app/api/health/route");
  return GET();
}

describe("GET /api/health with Postgres unreachable", () => {
  it("answers 503, which is the whole point of the route existing", async () => {
    const response = await getHealth();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      status: "unhealthy",
      database: "unreachable",
    });
  });

  /**
   * The container's own health check still passes in this state, and must: the storefront is
   * served from `data/products.json` and does not need Postgres to render a page or take a
   * payment. That is exactly why this route had to be added rather than the existing check
   * being tightened.
   */
  it("disagrees with the storefront homepage, which is still perfectly healthy", async () => {
    const { default: HomePage } = await import("@/app/(storefront)/page");

    expect((await getHealth()).status).toBe(503);
    expect(() => HomePage()).not.toThrow();
  });

  it("says nothing about the connection in the body, and everything in the log", async () => {
    const rawBody = await (await getHealth()).text();

    expect(rawBody).not.toContain("localhost");
    expect(rawBody).not.toContain("5432");
    expect(rawBody).not.toContain("prisma");
    expect(rawBody).not.toContain("Postgres");

    const loggedText = silencedErrors.mock.calls.flat().map(String).join(" ");
    expect(loggedText).toContain("[health]");
    expect(loggedText).toContain("SELECT 1");
  });
});
