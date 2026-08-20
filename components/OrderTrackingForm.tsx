import { buttonClasses } from "@/lib/button-styles";
import { fieldBorderClasses, fieldControlClasses } from "@/components/FormField";
import { TRACK_ORDER_PATH, TRACK_ORDER_QUERY_PARAM } from "@/lib/navigation";

export interface OrderTrackingFormProps {
  /** What was last looked up, so a failed attempt stays in the box to be corrected. */
  submittedOrderId: string;
}

const ORDER_ID_FIELD_ID = "tracking-order-number";

/**
 * One input and one button, submitting as a plain `GET`.
 *
 * No `"use client"`, no state, no fetch. A `GET` form puts the order number in the URL, which
 * is what makes a lookup survive a refresh, work as a bookmark and be linkable from the
 * confirmation page with the number already in it — all the things the confirmation page could
 * not do while its order number lived in `sessionStorage`. It also means the page works with
 * JavaScript switched off, which costs nothing here because there is nothing interactive to
 * lose.
 *
 * `autoCapitalize` and `autoCorrect` are off because order ids are minted from an uppercase
 * alphabet with no vowel-shaped ambiguity in it, and a phone keyboard helpfully autocorrecting
 * one is a support call. Case itself does not matter — the lookup normalises it — but a
 * substituted character does.
 */
export function OrderTrackingForm({ submittedOrderId }: OrderTrackingFormProps): JSX.Element {
  return (
    <form
      method="get"
      action={TRACK_ORDER_PATH}
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-2">
        <label htmlFor={ORDER_ID_FIELD_ID} className="text-eyebrow uppercase text-muted">
          Order number
        </label>

        <input
          id={ORDER_ID_FIELD_ID}
          name={TRACK_ORDER_QUERY_PARAM}
          type="text"
          defaultValue={submittedOrderId}
          placeholder="W2ACEHACUU"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={`${fieldControlClasses} ${fieldBorderClasses(false)} uppercase tracking-caps placeholder:tracking-normal`}
        />
      </div>

      <button type="submit" className={buttonClasses({ size: "sm" })}>
        Track order
      </button>
    </form>
  );
}
