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
 * non-empty email.
 *
 * **It is the only contact line on the screen now, and it carries both addresses.** The
 * shopper's own was here, the support address was here *and* again in the footnote under the
 * buttons, and the spam-folder sentence sat between them — three sentences and two mailto links
 * saying one thing, which is where to write and where a copy went. The spam-folder advice went
 * with them: it is guesswork about somebody else's inbox, and the support address it was
 * hedging towards is on the same line anyway. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export function ConfirmationEmailNote({
  email,
}: ConfirmationEmailNoteProps): JSX.Element | null {
  if (email.length === 0) return null;

  return (
    <p className="max-w-prose text-body-sm text-muted">
      A copy is on its way to <span className="text-ink">{email}</span>.{" "}
      <SupportLine>Questions?</SupportLine>
    </p>
  );
}
