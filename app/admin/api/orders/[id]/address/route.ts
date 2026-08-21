import type { NextResponse } from "next/server";
import { EMPTY_ADDRESS_FORM, type AddressFormValues } from "@/lib/address";
import {
  readJsonObject,
  readJsonString,
  runAdminOrderAction,
  type AdminOrderActionResponseBody,
} from "@/lib/admin-order-api";
import { updateAdminOrderShippingAddress } from "@/lib/admin-order-updates";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

function readAddressFormValues(body: Record<string, unknown>): AddressFormValues {
  const fields = Object.keys(EMPTY_ADDRESS_FORM) as (keyof AddressFormValues)[];

  return fields.reduce<AddressFormValues>(
    (values, field) => ({ ...values, [field]: readJsonString(body, field) }),
    EMPTY_ADDRESS_FORM,
  );
}

/**
 * Corrects one order's shipping address, while the parcel has not left.
 *
 * The status window is checked here and not only in the page. The page renders the form as
 * read-only text once an order is `shipped`, which stops an operator from making the mistake;
 * it does nothing about a request typed by hand, and "the button was not on screen" is not a
 * rule about the data. The same address validator the storefront's checkout uses decides what
 * counts as an address, so a corrected one is held to exactly the standard the original was.
 *
 * A successful edit writes an `order_status_history` row carrying the order's *unchanged*
 * status — see `updateAdminOrderShippingAddress` for why that table is the right home for it.
 *
 * The session check and the error boundary are `runAdminOrderAction`'s, shared with the other
 * two order actions (ADR-048).
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse<AdminOrderActionResponseBody>> {
  return runAdminOrderAction("address", params.id, async (admin) => {
    const body = await readJsonObject(request);

    return prisma.$transaction((transaction) =>
      updateAdminOrderShippingAddress(
        {
          orderId: params.id,
          changedBy: admin.username,
          values: readAddressFormValues(body),
        },
        transaction,
      ),
    );
  });
}
