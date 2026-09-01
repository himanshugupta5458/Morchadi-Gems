import { DELIVERY_ESTIMATE_LINE } from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { WalletIcon } from "@/components/icons";

export interface AmountDueNoticeProps {
  amountDue: number;
  /** Zero on a cash-on-delivery order; the prepayment floor on a part-paid one. */
  amountPrepaid: number;
}

/**
 * What is still owed on an order, and everything that follows from owing it.
 *
 * One component and one visual treatment for both kinds of outstanding balance, which is the
 * decision worth stating: a cash-on-delivery order owing its whole total and a part-paid order
 * owing its remainder are the same fact to the person who has to have money ready when the
 * courier knocks, and rendering them differently would suggest a difference that does not
 * matter to them. Only the sentence changes, and only to say whether anything was already paid.
 *
 * **It is the one panel on the screen that asks for something**, and it now looks like it: a
 * gold ground, a gold rule down its left edge, and a wallet above the label. The order-number
 * panel beside it was styled identically and is a reference the shopper may never need to act
 * on — two gold boxes of equal weight left the actionable one to be found by reading. That one
 * is quiet now and this one is not.
 *
 * **The courier call and the delivery window live in here.** They were two more paragraphs
 * under the panel, each restating the amount or the timing the panel already carried, on a
 * screen that said the cash figure three times and the dispatch window for the fourth time in
 * one checkout. Everything a shopper has to do about this money — how much, when, who will
 * ring first — is inside the box about the money. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 *
 * A caller renders this when `amountDue` is greater than zero and not otherwise — "₹0 due on
 * delivery" is a line that makes a prepaid shopper look twice at a settled order.
 */
export function AmountDueNotice({
  amountDue,
  amountPrepaid,
}: AmountDueNoticeProps): JSX.Element {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2 border border-gold/40 border-l-4 border-l-gold bg-gold/10 px-6 py-6">
      <WalletIcon className="h-6 w-6 text-gold-deep" />

      <span className="text-eyebrow uppercase tracking-caps-wide text-muted">
        Due on delivery
      </span>

      <strong className="font-sans text-heading tracking-caps text-ink">
        {formatRupees(amountDue)}
      </strong>

      <span className="text-body-sm text-muted">
        {amountPrepaid > 0
          ? `You paid ${formatRupees(amountPrepaid)} online. Our courier calls before delivery. Please have the balance above ready in cash, and exact change helps.`
          : "Nothing has been charged online. Our courier calls before delivery. Please have this ready in cash, and exact change helps."}
      </span>

      <span className="text-body-sm text-muted">{DELIVERY_ESTIMATE_LINE}</span>
    </div>
  );
}
