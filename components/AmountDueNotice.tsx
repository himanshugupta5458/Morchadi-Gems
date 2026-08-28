import { formatRupees } from "@/lib/format";

export interface AmountDueNoticeProps {
  amountDue: number;
  /** Zero on a cash-on-delivery order; the prepayment floor on a part-paid one. */
  amountPrepaid: number;
}

/**
 * What is still owed on an order, given the same weight as the order number beside it.
 *
 * One component and one visual treatment for both kinds of outstanding balance, which is the
 * decision worth stating: a cash-on-delivery order owing its whole total and a part-paid order
 * owing its remainder are the same fact to the person who has to have money ready when the
 * courier knocks, and rendering them differently would suggest a difference that does not
 * matter to them. Only the sentence changes, and only to say whether anything was already paid.
 *
 * A caller renders this when `amountDue` is greater than zero and not otherwise — "₹0 due on
 * delivery" is a line that makes a prepaid shopper look twice at a settled order.
 */
export function AmountDueNotice({
  amountDue,
  amountPrepaid,
}: AmountDueNoticeProps): JSX.Element {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2 border border-gold/40 bg-gold/5 px-6 py-6">
      <span className="text-eyebrow uppercase tracking-caps-wide text-muted">
        Due on delivery
      </span>
      <strong className="font-sans text-heading tracking-caps text-ink">
        {formatRupees(amountDue)}
      </strong>
      <span className="text-body-sm text-muted">
        {amountPrepaid > 0
          ? `You paid ${formatRupees(amountPrepaid)} online. Please have the balance above ready in cash when your order arrives.`
          : "Please have this ready in cash when your order arrives. Nothing has been charged online."}
      </span>
    </div>
  );
}
