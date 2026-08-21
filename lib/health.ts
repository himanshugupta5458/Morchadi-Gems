import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const LOG_PREFIX = "[health]";

/**
 * How long the probe is given before it is called unreachable.
 *
 * A refused connection fails in milliseconds and needs no ceiling. The failure this exists for
 * is the other one: a Postgres that accepts the TCP connection and then never answers, which
 * without a bound leaves the request open until something further up the stack gives up — and
 * a health endpoint that hangs is a health endpoint that reports nothing at all.
 */
export const HEALTH_CHECK_TIMEOUT_MS = 5_000;

/**
 * What the database turned out to be.
 *
 * `schema-mismatch` is the state that makes this route worth having. A deployment whose
 * migrations were never applied reaches Postgres perfectly well and fails at the first query
 * the application actually makes — so a probe that stopped at connectivity would call that
 * deployment healthy right up until the first order was lost.
 */
export type DatabaseHealth = "reachable" | "unreachable" | "schema-mismatch";

export interface HealthReport {
  status: "healthy" | "unhealthy";
  database: DatabaseHealth;
  checkedAt: string;
}

export type HealthCheckClient = Pick<PrismaClient, "$queryRaw" | "order">;

/**
 * An id no minted order can hold — order numbers are ten characters from
 * [`ORDER_ID_ALPHABET`](./order-id.ts) — so the schema probe below reads no customer's row
 * while still making Postgres parse the column list the Prisma Client expects.
 */
const SCHEMA_PROBE_ORDER_ID = "";

async function probeDatabase(client: HealthCheckClient): Promise<DatabaseHealth> {
  try {
    await client.$queryRaw`SELECT 1`;
  } catch (connectionError) {
    console.error(`${LOG_PREFIX} Postgres did not answer SELECT 1`, connectionError);
    return "unreachable";
  }

  try {
    await client.order.findFirst({ where: { id: SCHEMA_PROBE_ORDER_ID } });
  } catch (schemaError) {
    console.error(
      `${LOG_PREFIX} Postgres answered, but the orders table does not match the Prisma Client this image was built with. Migrations are probably unapplied`,
      schemaError,
    );
    return "schema-mismatch";
  }

  return "reachable";
}

function timeoutAfter(milliseconds: number): {
  expiry: Promise<DatabaseHealth>;
  cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout>;

  const expiry = new Promise<DatabaseHealth>((resolve) => {
    timer = setTimeout(() => {
      console.error(`${LOG_PREFIX} Postgres did not answer within ${milliseconds}ms`);
      resolve("unreachable");
    }, milliseconds);
  });

  return { expiry, cancel: () => clearTimeout(timer) };
}

/**
 * Whether this process can actually use its database, answered in a form an operator and a
 * monitor can both read.
 *
 * It is deliberately the **only** thing here that talks to Postgres on behalf of the health
 * route, and it never throws: a probe that could fail with an exception would be reporting its
 * own bug rather than the database's state. Everything it learns about why the database is
 * unusable goes to the server log; the returned report carries no error text, no host and no
 * connection string, because this endpoint answers the public internet.
 *
 * See [ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md).
 */
export async function checkDatabaseHealth(
  client: HealthCheckClient = prisma,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS,
): Promise<HealthReport> {
  const { expiry, cancel } = timeoutAfter(timeoutMs);

  const database = await Promise.race([probeDatabase(client), expiry]);
  cancel();

  return {
    status: database === "reachable" ? "healthy" : "unhealthy",
    database,
    checkedAt: new Date().toISOString(),
  };
}
