import { NextResponse } from "next/server";
import { checkDatabaseHealth, type HealthReport } from "@/lib/health";

/** Node, not Edge: this handler opens a Postgres connection. */
export const runtime = "nodejs";

/** A health report is a reading, never a document. A cached one is a lie about the present. */
export const dynamic = "force-dynamic";

/**
 * Whether this deployment can reach and use its database — the one question the container's
 * own health check cannot answer.
 *
 * The storefront renders entirely from `data/products.json` and checkout writes to Postgres
 * off the critical path by design ([ADR-042](/docs/decisions/ADR-042-order-capture-in-postgres.md)),
 * so `/` returns 200 from a container whose database is unreachable, whose `DATABASE_URL` is
 * wrong, or whose migrations were never applied. That combination is what let a deployment
 * take real payments while writing zero order rows, with nothing to see but a log line.
 *
 * This route is the missing signal and nothing more: **it is not the container's liveness
 * probe and must not be wired up as one.** Postgres going away for thirty seconds must not
 * take down a shop that is still perfectly able to serve pages and take money — see
 * [ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md) and §5b of
 * [DEPLOY.md](/DEPLOY.md).
 *
 * `503` rather than `200` with a sad body, so a monitor that reads only the status line still
 * learns the truth. The body says what is wrong in three words and never why: it is reachable
 * by anyone, and the log is where the exception belongs.
 */
export async function GET(): Promise<NextResponse<HealthReport>> {
  const report = await checkDatabaseHealth();

  return NextResponse.json<HealthReport>(report, {
    status: report.status === "healthy" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
