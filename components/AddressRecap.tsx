import Link from "next/link";
import type { Address } from "@/types/cart";
import { formatAddressOneLine } from "@/lib/address";

export interface AddressRecapProps {
  address: Address;
  /**
   * One line instead of a bordered panel: name, address, and the way back.
   *
   * The payment step takes it. The address there was confirmed on the screen before, and
   * repeating it as a six-line boxed panel between the heading and the payment choice spends
   * the top of the screen restating what the shopper already agreed to. The confirmation
   * screens keep the panel, where the address is a record to check rather than a step to get
   * past. See [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
   */
  compact?: boolean;
  /**
   * Omitted once the order is paid. A confirmation screen showing an Edit link would offer a
   * change it cannot make — there is no order record to amend, so the honest answer after
   * payment is a support conversation rather than a form.
   */
  editHref?: string;
}

/**
 * The delivery address, read-only, with one way back to the form that produced it. Editing
 * happens on `/address`; the details survive the trip because they are held in
 * `sessionStorage` and the form repopulates from them.
 */
export function AddressRecap({
  address,
  editHref,
  compact = false,
}: AddressRecapProps): JSX.Element {
  if (compact) {
    return (
      <section className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-body-sm text-muted">
        <h2 className="sr-only">Delivering to</h2>
        <span className="text-ink">{address.name}</span>
        <span aria-hidden>·</span>
        <span>{formatAddressOneLine(address)}</span>
        {editHref === undefined ? null : (
          <>
            <span aria-hidden>·</span>
            <Link
              href={editHref}
              className="text-ink underline decoration-gold underline-offset-4 transition-colors duration-250 hover:text-gold-deep"
            >
              Edit
            </Link>
          </>
        )}
      </section>
    );
  }

  const streetLines = [address.line1, address.line2].filter(
    (line): line is string => line !== undefined && line.length > 0,
  );

  return (
    <section className="border border-line bg-ivory p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-heading-sm text-ink">Delivering to</h2>
        {editHref === undefined ? null : (
          <Link
            href={editHref}
            className="text-body-sm text-muted underline underline-offset-4 transition-colors duration-250 hover:text-ink"
          >
            Edit
          </Link>
        )}
      </div>

      <address className="mt-4 flex flex-col gap-1 not-italic text-body-sm text-muted">
        <span className="text-body text-ink">{address.name}</span>
        {streetLines.map((line) => (
          <span key={line}>{line}</span>
        ))}
        <span>
          {address.city}, {address.state} {address.pincode}
        </span>
        <span className="mt-3 text-ink">+91 {address.phone}</span>
        <span>{address.email}</span>
      </address>
    </section>
  );
}
