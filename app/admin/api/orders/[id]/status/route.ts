import type { NextResponse } from "next/server";
import {
  readJsonObject,
  readJsonString,
  runAdminOrderAction,
  type AdminOrderActionResponseBody,
} from "@/lib/admin-order-api";
import { applyAdminOrderStatusChange } from "@/lib/admin-order-updates";
import { prisma } from "@/lib/prisma";

/** Node, not Edge: this handler opens a Postgres transaction. */
export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Moves one order along the lifecycle, records why, and settles the refund — in one request
 * and one transaction.
 *
 * The three are inseparable by the owner's decision: an order cannot be cancelled, turned
 * around or returned without somebody saying why and saying what happened to the money, so
 * there is no endpoint here that does one of the three. `$transaction` is what makes that true
 * of the database as well as of the form — a crash between the status update and the audit row
 * would otherwise leave an order that moved with nobody's name against it.
 *
 * Everything the request says about the *order* is untrusted; the transition and the refund
 * ceiling are both re-derived from the row itself. The one field that is never read from the
 * body is `changedBy`: the audit trail names the session's admin, not whoever the request
 * claims to be.
 *
 * `runAdminOrderAction` carries the session check and the error boundary, so a database that
 * is down leaves this endpoint answering the typed rejection its contract describes rather
 * than crashing into a bare 500 (ADR-048).
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse<AdminOrderActionResponseBody>> {
  return runAdminOrderAction("status", params.id, async (admin) => {
    const body = await readJsonObject(request);

    return prisma.$transaction((transaction) =>
      applyAdminOrderStatusChange(
        {
          orderId: params.id,
          changedBy: admin.username,
          submission: {
            status: readJsonString(body, "status"),
            reason: readJsonString(body, "reason"),
            refundAmount: readJsonString(body, "refundAmount"),
            refundAcknowledged: body.refundAcknowledged === true,
          },
        },
        transaction,
      ),
    );
  });
}
