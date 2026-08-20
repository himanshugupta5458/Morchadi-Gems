import type { NextResponse } from "next/server";
import {
  readAdminForOrderAction,
  readJsonObject,
  readOptionalBoolean,
  respondToAdminOrderOutcome,
  unauthorisedAdminOrderResponse,
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
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse<AdminOrderActionResponseBody>> {
  const admin = await readAdminForOrderAction();
  if (admin === null) return unauthorisedAdminOrderResponse();

  const body = await readJsonObject(request);

  const outcome = await updateAdminOrderReceipt(
    {
      orderId: params.id,
      itemReceivedBack: readOptionalBoolean(body, "itemReceivedBack"),
      codAmountCollected: readOptionalBoolean(body, "codAmountCollected"),
    },
    prisma,
  );

  return respondToAdminOrderOutcome(outcome);
}
