import { SupportLine } from "@/components/OrderNumberCallout";

export interface ConfirmationEmailNoteProps {
  /** The address this order was placed under, from the bundle reconciled against the order. */
  email: string;
}

/**
 * Where the shopper's own copy of this order is going.
 *
 * **It says "on its way", not "has been sent", and the difference is the whole point.** The
 * send is fire-and-forget on both paths and its outcome never reaches this page: a paid order's
 * email is dispatched by `/api/notify-admin`, which the browser calls without reading the reply
 * ([`notifyAdminOfPaidOrder`](/lib/notify-client.ts)), and a cash-on-delivery order's is
 * dispatched inside `/api/create-order` after the row is written and is not awaited there
 * either ([ADR-060](/docs/decisions/ADR-060-cod-order-notification.md)). Both can also end at
 * `SKIPPED_NOT_CONFIGURED` on a deployment with no `RESEND_API_KEY`, which is a runtime-only
 * secret this page cannot read. So "has been sent" is a claim the screen has no way to check,
 * and a confirmation screen is the last place to make one.
 *
 * What *is* knowable is that an address was captured and that the dispatch was attempted for
 * this order, which is why the caller renders this only when the reconciled bundle carries a
 * non-empty email. The spam-folder sentence and the support address are there because they are
 * what actually helps when the email does not arrive — which, on the deployments above, is a
 * real possibility rather than a formality.
 */
export function ConfirmationEmailNote({
  email,
}: ConfirmationEmailNoteProps): JSX.Element | null {
  if (email.length === 0) return null;

  return (
    <p className="max-w-prose text-body-sm text-muted">
      A copy of this order is on its way to{" "}
      <span className="text-ink">{email}</span>. If it has not arrived in a few minutes,
      check your spam folder or{" "}
      <SupportLine>reach us at</SupportLine>.
    </p>
  );
}
