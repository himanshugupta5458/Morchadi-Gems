import type { NextResponse } from "next/server";
import {
  readJsonObject,
  readOptionalBoolean,
  runAdminOrderAction,
  type AdminOrderActionResponseBody,
} from "@/lib/admin-order-api";
import { updateAdminOrderReceipt } from "@/lib/admin-order-updates";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Records the two facts that arrive on their own schedule — the parcel physically back on the
 * shelf, and the courier's cash actually handed over.
 *
 * Both flags are optional in the body and each is written only when named, so the two toggles
 * on the page are genuinely independent: pressing one cannot clear the other, and neither is
 * tied to the status change that made it relevant. There is no transaction because there is no
 * second write to be atomic with; unlike a status change, these carry their own timestamp on
 * the order row and add nothing to the audit table.
 *
 * The session check and the error boundary are `runAdminOrderAction`'s, shared with the other
 * two order actions (ADR-048).
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse<AdminOrderActionResponseBody>> {
  return runAdminOrderAction("receipt", params.id, async () => {
    const body = await readJsonObject(request);

    return updateAdminOrderReceipt(
      {
        orderId: params.id,
        itemReceivedBack: readOptionalBoolean(body, "itemReceivedBack"),
        codAmountCollected: readOptionalBoolean(body, "codAmountCollected"),
      },
      prisma,
    );
  });
}
