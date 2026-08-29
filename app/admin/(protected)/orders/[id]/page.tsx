import type { Metadata } from "next";
import type { OrderStatus, PaymentType } from "@prisma/client";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  findAdminOrderDetail,
  normaliseOrderId,
  type AdminOrderDetail,
} from "@/lib/admin-order-detail";
import { formatAdminOrderDate } from "@/lib/admin-orders";
import {
  resolveAdminOrderActionHref,
  resolveAdminOrdersHref,
  resolveRequestHostname,
} from "@/lib/admin-routing";
import { formatRupees } from "@/lib/format";
import { getOrderStatusLabel, getPaymentTypeLabel } from "@/lib/order-status";
import {
  acceptsCodCollection,
  acceptsItemReceivedBack,
  isShippingAddressEditable,
} from "@/lib/order-transitions";
import { AdminDatabaseError } from "@/components/AdminDatabaseError";
import { AdminFactRow, AdminPanelSection } from "@/components/AdminPanelSection";
import { AdminOrderAddressPanel } from "@/components/AdminOrderAddressPanel";
import { AdminOrderLineItems } from "@/components/AdminOrderLineItems";
import {
  AdminOrderReceiptToggles,
  type AdminOrderReceiptToggle,
} from "@/components/AdminOrderReceiptToggles";
import { AdminOrderStatusForm } from "@/components/AdminOrderStatusForm";
import { AdminOrderTimeline } from "@/components/AdminOrderTimeline";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

/**
 * Never prerendered and never cached. An order's status, address and refund all change from
 * this very page, and a cached copy would show an operator the state they just left.
 */
export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return {
    title: `Order ${normaliseOrderId(params.id)}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Why the address is read-only, in the words that are true of *this* order. A cancelled order
 * placed an hour ago never had a parcel to leave, and telling the operator it did would be the
 * page inventing a fact to justify a locked field.
 */
function addressLockedNote(status: OrderStatus): string {
  if (status === "shipped") {
    return "The parcel is with the courier, so this address is now a record of where it was sent rather than a field. Anything that still needs changing goes through them.";
  }

  return "This order has finished, so its address is the record of where it was sent rather than a field.";
}

/**
 * Whether a payment gateway was involved at all.
 *
 * A `cod` order carries a `COD_…` reference this shop minted and a payment status of
 * `NOT_APPLICABLE`, and labelling either of those "Cashfree" would tell an operator to go
 * looking in a dashboard that has never heard of this order. A `partial_cod` order *did* go to
 * Cashfree for its prepayment, so it keeps both labels.
 */
function isGatewayOrder(paymentType: PaymentType): boolean {
  return paymentType !== "cod";
}

/**
 * `amountPrepaid` is written at Cashfree-session creation, before the customer has paid
 * anything (ADR-042) — so for a gateway order it names money only once Cashfree's own status
 * says `PAID`. A `cod` order never went through this at all, so its figure needs no such gate.
 */
function isPrepaidAmountConfirmed(
  paymentType: PaymentType,
  cashfreePaymentStatus: string,
): boolean {
  return !isGatewayOrder(paymentType) || cashfreePaymentStatus === "PAID";
}

function refundSummary(
  refundAmount: number | null,
  isRefunded: boolean,
  refundedAt: Date | null,
): string {
  if (refundAmount === null) return "No decision recorded";
  if (!isRefunded) return `${formatRupees(0)}: nothing was returned to the customer`;
  return `${formatRupees(refundAmount)}${refundedAt === null ? "" : ` on ${formatAdminOrderDate(refundedAt)}`}`;
}

function buildReceiptToggles(
  itemReceivedBack: boolean,
  itemReceivedBackAt: Date | null,
  codAmountCollected: boolean,
  codCollectedAt: Date | null,
  showItemReturn: boolean,
  showCodCollection: boolean,
): AdminOrderReceiptToggle[] {
  return [
    ...(showItemReturn
      ? [
          {
            field: "itemReceivedBack" as const,
            label: "Item received back",
            description: "Tick this when the parcel is physically back on the shelf.",
            isOn: itemReceivedBack,
            recordedAt: itemReceivedBackAt === null ? null : formatAdminOrderDate(itemReceivedBackAt),
          },
        ]
      : []),
    ...(showCodCollection
      ? [
          {
            field: "codAmountCollected" as const,
            label: "COD amount collected",
            description: "Tick this when the courier's cash has actually been remitted.",
            isOn: codAmountCollected,
            recordedAt: codCollectedAt === null ? null : formatAdminOrderDate(codCollectedAt),
          },
        ]
      : []),
  ];
}

/**
 * One order, everything about it, and every control that changes it.
 *
 * A Server Component reading Prisma directly, for the reason the list gives: the protected
 * layout has already resolved the session against Postgres before this function runs, so there
 * is no second place for authentication to be established. The *writes* do go through route
 * handlers — a page cannot answer a POST — and each of those re-checks the session itself.
 *
 * The `[id]` segment is `orders.id`, the ten-character number ADR-043 made the order's public
 * name and the same value the list's first column links on. The Cashfree id appears far down
 * this page in fine print, because it names the payment and not the order, and the one place a
 * mistake between the two is expensive is a conversation with a customer.
 *
 * A database fault and a missing order are different answers and are given as different pages.
 * `notFound()` stays outside the `try` for exactly that reason — it works by throwing, and a
 * boundary that swallowed it would tell an operator the database was down every time they
 * mistyped an order number ([ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md)).
 */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const hostname = resolveRequestHostname((name) => headers().get(name));

  let order: AdminOrderDetail | null;

  try {
    order = await findAdminOrderDetail(params.id);
  } catch (detailError) {
    console.error(
      `[admin-panel] order ${normaliseOrderId(params.id)} could not be read from Postgres`,
      detailError,
    );
    return <AdminDatabaseError what={`Order ${normaliseOrderId(params.id)}`} />;
  }

  if (order === null) notFound();

  const receiptToggles = buildReceiptToggles(
    order.itemReceivedBack,
    order.itemReceivedBackAt,
    order.codAmountCollected,
    order.codCollectedAt,
    acceptsItemReceivedBack(order.status),
    acceptsCodCollection(order.paymentType),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={resolveAdminOrdersHref(hostname)}
          className="font-sans text-label uppercase tracking-caps text-muted underline underline-offset-4 transition-colors duration-250 hover:text-ink"
        >
          ← All orders
        </Link>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <h1 className="font-display text-heading tracking-caps text-ink">{order.id}</h1>
          <OrderStatusBadge status={order.status} />
        </div>

        <p className="text-body-sm text-muted">
          Placed {formatAdminOrderDate(order.createdAt)} · last changed{" "}
          {formatAdminOrderDate(order.updatedAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <AdminPanelSection title="Items" description={`${order.lines.length} line${order.lines.length === 1 ? "" : "s"}, priced as they were at checkout`}>
            <AdminOrderLineItems lines={order.lines} />

            <div className="mt-5 flex flex-col border-t border-line pt-4">
              <AdminFactRow label="Subtotal">{formatRupees(order.subtotal)}</AdminFactRow>
              <AdminFactRow label="Shipping">
                {order.shippingFee === 0 ? "Free" : formatRupees(order.shippingFee)}
              </AdminFactRow>
              <AdminFactRow label="Total">
                <span className="font-medium">{formatRupees(order.total)}</span>
              </AdminFactRow>
            </div>
          </AdminPanelSection>

          <AdminPanelSection
            title="Customer and delivery"
            description={order.customerPhone}
          >
            <AdminOrderAddressPanel
              actionHref={resolveAdminOrderActionHref(hostname, order.id, "address")}
              address={order.shippingAddress}
              isEditable={isShippingAddressEditable(order.status)}
              lockedNote={addressLockedNote(order.status)}
            />
          </AdminPanelSection>

          <AdminPanelSection
            title="History"
            description="Every recorded change to this order, oldest first"
          >
            <AdminOrderTimeline history={order.history} />
          </AdminPanelSection>
        </div>

        <div className="flex flex-col gap-6">
          <AdminPanelSection
            title="Status"
            description={`Currently ${getOrderStatusLabel(order.status)}`}
          >
            <AdminOrderStatusForm
              actionHref={resolveAdminOrderActionHref(hostname, order.id, "status")}
              currentStatus={order.status}
              paymentType={order.paymentType}
              amountPrepaid={order.amountPrepaid}
            />
          </AdminPanelSection>

          {receiptToggles.length === 0 ? null : (
            <AdminPanelSection
              title="Receipt tracking"
              description="Independent of the status above. Tick each when it actually happens"
            >
              <AdminOrderReceiptToggles
                actionHref={resolveAdminOrderActionHref(hostname, order.id, "receipt")}
                toggles={receiptToggles}
              />
            </AdminPanelSection>
          )}

          <AdminPanelSection title="Money">
            <div className="flex flex-col">
              <AdminFactRow label="Payment type">
                {getPaymentTypeLabel(order.paymentType)}
              </AdminFactRow>
              <AdminFactRow label="Prepaid">
                {isPrepaidAmountConfirmed(order.paymentType, order.cashfreePaymentStatus) ? (
                  formatRupees(order.amountPrepaid)
                ) : (
                  <span className="text-sale">Awaiting payment confirmation</span>
                )}
              </AdminFactRow>
              <AdminFactRow label="Due on delivery">
                {formatRupees(order.amountDue)}
              </AdminFactRow>
              <AdminFactRow label="Refund">
                {refundSummary(order.refundAmount, order.isRefunded, order.refundedAt)}
              </AdminFactRow>
            </div>

            <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-eyebrow uppercase tracking-caps-wide text-muted">
              <div className="flex flex-col gap-1">
                <dt>{isGatewayOrder(order.paymentType) ? "Cashfree order" : "Payment reference"}</dt>
                <dd className="break-all normal-case tracking-normal text-muted">
                  {order.cashfreeOrderId}
                </dd>
              </div>
              {isGatewayOrder(order.paymentType) ? (
                <div className="flex flex-col gap-1">
                  <dt>Cashfree payment status</dt>
                  <dd className="normal-case tracking-normal text-muted">
                    {order.cashfreePaymentStatus}
                  </dd>
                </div>
              ) : (
                <p className="normal-case tracking-normal text-muted">
                  This order never went to the payment gateway. The reference above is ours.
                </p>
              )}
            </dl>
          </AdminPanelSection>
        </div>
      </div>
    </div>
  );
}
