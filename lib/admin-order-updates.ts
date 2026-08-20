import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { AddressFormValues } from "@/lib/address";
import { ADDRESS_FIELDS, toAddressFormValues, validateAddressForm } from "@/lib/address";
import { normaliseOrderId, readShippingAddress } from "@/lib/admin-order-detail";
import {
  planOrderStatusChange,
  type OrderStatusChangeSubmission,
} from "@/lib/order-status-change";
import {
  acceptsCodCollection,
  acceptsItemReceivedBack,
  isShippingAddressEditable,
} from "@/lib/order-transitions";
import { prisma } from "@/lib/prisma";

/**
 * What one attempted change did. `REJECTED` is a normal outcome, not an exception: every
 * rejection here is something an operator can read and act on, and `error` is the machine
 * name the tests assert against while `message` is the sentence the panel shows.
 */
export type AdminOrderUpdateOutcome =
  | { kind: "UPDATED" }
  | { kind: "UNCHANGED" }
  | { kind: "NOT_FOUND" }
  | { kind: "REJECTED"; error: string; message: string };

/**
 * The subset of the client these writers need, so a caller can hand in an interactive
 * transaction's — which the route handlers do, and which is what makes a status change, its
 * refund decision and its audit row one atomic act rather than three chances to stop halfway.
 * None of these functions opens a transaction of its own for exactly that reason: Prisma has
 * no nested interactive transaction, and a function that insisted on one could not be composed.
 */
export type AdminOrderWriteClient = Pick<PrismaClient, "order" | "orderStatusHistory">;

export interface AdminOrderStatusChangeInput {
  orderId: string;
  /** The signed-in operator's username, from the session. Never anything the client sent. */
  changedBy: string;
  submission: OrderStatusChangeSubmission;
}

const CONCURRENT_CHANGE_MESSAGE =
  "This order moved while the page was open. Reload it and try again.";

/**
 * Moves one order, records why, and settles the refund — in that order and as one act.
 *
 * The transition, the reason and the refund are validated together by `planOrderStatusChange`
 * before anything is written, so a change that is going to be refused is refused before it can
 * half-happen. The refund columns are touched **only** when the new status carries a refund
 * question; a `packed` order's `refund_amount` is left exactly as it was found.
 *
 * The update is guarded on the status the plan was made against. If the order moved between
 * the read and the write, the guard matches nothing, no history row is written, and the
 * operator is told to reload rather than being shown a success for a decision that was made
 * about a different order state.
 *
 * `refundedAt` is set only when money actually went back. ADR-040 records the invariant
 * `isRefunded ≡ refundedAt IS NOT NULL`, and stamping a timestamp on a refund of zero would
 * make the row say a refund happened on a day nothing did.
 */
export async function applyAdminOrderStatusChange(
  input: AdminOrderStatusChangeInput,
  client: AdminOrderWriteClient = prisma,
): Promise<AdminOrderUpdateOutcome> {
  const orderId = normaliseOrderId(input.orderId);

  const order = await client.order.findUnique({
    where: { id: orderId },
    select: { status: true, paymentType: true, amountPrepaid: true },
  });

  if (order === null) return { kind: "NOT_FOUND" };

  const validation = planOrderStatusChange(
    order.status,
    { paymentType: order.paymentType, amountPrepaid: order.amountPrepaid.toNumber() },
    input.submission,
  );

  if (!validation.ok) {
    return { kind: "REJECTED", error: validation.error, message: validation.message };
  }

  const { plan } = validation;
  const changedAt = new Date();

  const { count } = await client.order.updateMany({
    where: { id: orderId, status: order.status },
    data: {
      status: plan.status,
      ...(plan.refund === null
        ? {}
        : {
            isRefunded: plan.refund.isRefunded,
            refundAmount: new Prisma.Decimal(plan.refund.refundAmount),
            refundedAt: plan.refund.isRefunded ? changedAt : null,
          }),
    },
  });

  if (count === 0) {
    return { kind: "REJECTED", error: "CONCURRENT_CHANGE", message: CONCURRENT_CHANGE_MESSAGE };
  }

  await client.orderStatusHistory.create({
    data: {
      orderId,
      status: plan.status,
      changedAt,
      changedBy: input.changedBy,
      reason: plan.reason,
    },
  });

  return { kind: "UPDATED" };
}

export interface AdminOrderAddressUpdateInput {
  orderId: string;
  changedBy: string;
  values: AddressFormValues;
}

/**
 * The address fields whose values differ, in the order the form lists them. Used to say *what*
 * was corrected in the audit row, because "address updated" on its own does not distinguish a
 * fixed PIN code from a completely different recipient.
 */
export function findChangedAddressFields(
  before: AddressFormValues,
  after: AddressFormValues,
): string[] {
  return ADDRESS_FIELDS.filter((field) => before[field].trim() !== after[field].trim());
}

/**
 * Corrects where an order is going, while that is still a thing anyone can act on.
 *
 * **It is not a status change, and it does not pretend to be one.** The order's `status` is
 * left exactly where it was; what the write adds is an `order_status_history` row carrying that
 * same unchanged status, the operator's name, the moment, and a reason naming the fields that
 * moved. That table's columns are precisely the four an accountability record of this needs,
 * and the alternative — a new audit table, or a free-text note column on `orders` — would be a
 * migration bought for one event that already has a home. A reader of the timeline sees "14:02,
 * still Packed, himanshu, address updated (line1, pincode)", which is the true sentence.
 *
 * A submission identical to what is already stored writes nothing at all. An audit trail full
 * of rows recording that somebody opened a form and pressed save is an audit trail nobody
 * reads.
 */
export async function updateAdminOrderShippingAddress(
  input: AdminOrderAddressUpdateInput,
  client: AdminOrderWriteClient = prisma,
): Promise<AdminOrderUpdateOutcome> {
  const orderId = normaliseOrderId(input.orderId);

  const order = await client.order.findUnique({
    where: { id: orderId },
    select: { status: true, shippingAddress: true },
  });

  if (order === null) return { kind: "NOT_FOUND" };

  if (!isShippingAddressEditable(order.status)) {
    return {
      kind: "REJECTED",
      error: "ADDRESS_LOCKED",
      message:
        "The parcel has already left, so this address can no longer be changed. Contact the courier instead.",
    };
  }

  const { errors, address } = validateAddressForm(input.values);

  if (address === null) {
    const firstMessage = ADDRESS_FIELDS.map((field) => errors[field]).find(
      (message): message is string => message !== undefined,
    );

    return {
      kind: "REJECTED",
      error: "ADDRESS_INVALID",
      message: firstMessage ?? "That address is not valid.",
    };
  }

  const changedFields = findChangedAddressFields(
    readShippingAddress(order.shippingAddress),
    toAddressFormValues(address),
  );

  if (changedFields.length === 0) return { kind: "UNCHANGED" };

  const changedAt = new Date();

  const { count } = await client.order.updateMany({
    where: { id: orderId, status: order.status },
    data: { shippingAddress: address as unknown as Prisma.InputJsonValue },
  });

  if (count === 0) {
    return { kind: "REJECTED", error: "CONCURRENT_CHANGE", message: CONCURRENT_CHANGE_MESSAGE };
  }

  await client.orderStatusHistory.create({
    data: {
      orderId,
      status: order.status,
      changedAt,
      changedBy: input.changedBy,
      reason: `Address updated (${changedFields.join(", ")})`,
    },
  });

  return { kind: "UPDATED" };
}

export interface AdminOrderReceiptUpdateInput {
  orderId: string;
  itemReceivedBack?: boolean;
  codAmountCollected?: boolean;
}

/**
 * The two facts that arrive on their own schedule: the parcel physically coming back, and the
 * courier's cash actually being handed over.
 *
 * Neither is a status change and neither is tied to one. A courier turns a parcel around on
 * Tuesday and the box reaches the shelf the following Monday; a COD remittance is reconciled
 * whenever the courier settles. Both are therefore toggleable at any time after the order is in
 * a state where the question makes sense, which is what the two guards below check — and they
 * are checked here rather than only in the page, because a toggle the UI never shows is still a
 * field an authenticated `curl` can name.
 *
 * No history row. Unlike an address edit, these two write their own timestamp onto the order,
 * so the row already records what happened and when; a second copy in the audit table would be
 * the duplication ADR-040's addendum argues against.
 */
export async function updateAdminOrderReceipt(
  input: AdminOrderReceiptUpdateInput,
  client: AdminOrderWriteClient = prisma,
): Promise<AdminOrderUpdateOutcome> {
  const orderId = normaliseOrderId(input.orderId);

  const order = await client.order.findUnique({
    where: { id: orderId },
    select: { status: true, paymentType: true },
  });

  if (order === null) return { kind: "NOT_FOUND" };

  if (input.itemReceivedBack !== undefined && !acceptsItemReceivedBack(order.status)) {
    return {
      kind: "REJECTED",
      error: "ITEM_RETURN_NOT_EXPECTED",
      message:
        "Nothing is coming back on this order. Only an RTO or a return can be received.",
    };
  }

  if (input.codAmountCollected !== undefined && !acceptsCodCollection(order.paymentType)) {
    return {
      kind: "REJECTED",
      error: "NO_COD_TO_COLLECT",
      message: "This order was paid up front, so there is no cash to collect on delivery.",
    };
  }

  if (input.itemReceivedBack === undefined && input.codAmountCollected === undefined) {
    return { kind: "UNCHANGED" };
  }

  const changedAt = new Date();

  await client.order.update({
    where: { id: orderId },
    data: {
      ...(input.itemReceivedBack === undefined
        ? {}
        : {
            itemReceivedBack: input.itemReceivedBack,
            itemReceivedBackAt: input.itemReceivedBack ? changedAt : null,
          }),
      ...(input.codAmountCollected === undefined
        ? {}
        : {
            codAmountCollected: input.codAmountCollected,
            codCollectedAt: input.codAmountCollected ? changedAt : null,
          }),
    },
  });

  return { kind: "UPDATED" };
}
