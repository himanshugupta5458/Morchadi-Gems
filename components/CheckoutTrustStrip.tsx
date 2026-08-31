import { CONTACT_CONFIG, LEGAL_CONFIG, RETURN_WINDOW_DAYS } from "@/lib/config";
import {
  ReturnArrowIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "@/components/icons";

const ICON_CLASS = "h-4 w-4 shrink-0 text-gold-deep";

/**
 * The three promises worth restating at the moment of payment, every one of them read from the
 * one place it is written down: the gateway from `LEGAL_CONFIG.paymentProvider`, the window from
 * `RETURN_WINDOW_DAYS`, the coverage from `LEGAL_CONFIG.shippingScope`.
 *
 * `TrustStripCompact` is the home page's four-promise band and is deliberately not reused here.
 * Its second badge is the free-shipping threshold, which on the cart would restate the number
 * the progress bar directly above it is already counting towards, and on the payment step is
 * exactly the nudge ADR-072 removed from that screen.
 *
 * **There is no "insured in transit" line**, which the brief suggested. Nothing in this shop's
 * arrangements substantiates it — no carrier insurance is bought and no policy page claims it —
 * and a trust strip is the last place to make a promise the business has not made. The support
 * address below is the honest version of the same reassurance: a person to reach.
 */
const CHECKOUT_TRUST_POINTS = [
  {
    key: "secure-checkout",
    label: `Secure checkout via ${LEGAL_CONFIG.paymentProvider}`,
    icon: <ShieldCheckIcon className={ICON_CLASS} />,
  },
  {
    key: "returns",
    label: `${RETURN_WINDOW_DAYS}-day returns`,
    icon: <ReturnArrowIcon className={ICON_CLASS} />,
  },
  {
    key: "delivery",
    label: `Delivered across ${LEGAL_CONFIG.shippingScope}`,
    icon: <TruckIcon className={ICON_CLASS} />,
  },
];

export interface CheckoutTrustStripProps {
  /** Adds the support address as a fourth line. On by default; off where it is already stated. */
  showSupportEmail?: boolean;
}

export function CheckoutTrustStrip({
  showSupportEmail = true,
}: CheckoutTrustStripProps): JSX.Element {
  return (
    <ul className="flex flex-col gap-2">
      {CHECKOUT_TRUST_POINTS.map((point) => (
        <li key={point.key} className="flex items-center gap-2 text-body-sm text-muted">
          {point.icon}
          <span>{point.label}</span>
        </li>
      ))}
      {showSupportEmail ? (
        <li className="flex items-center gap-2 text-body-sm text-muted">
          <span className={ICON_CLASS} aria-hidden />
          <a
            href={`mailto:${CONTACT_CONFIG.supportEmail}`}
            className="underline underline-offset-4 transition-colors duration-250 hover:text-ink"
          >
            {CONTACT_CONFIG.supportEmail}
          </a>
        </li>
      ) : null}
    </ul>
  );
}

/**
 * What a shopper may pay with, as words.
 *
 * **No logos.** Cashfree's brand assets are not in this repository and neither are the card
 * networks', and the alternative — drawing something that resembles them — would be putting a
 * fabricated trademark on a payment screen. The methods are stated in text instead, which is
 * true, legible at every width, and costs no request. If the owner supplies the official
 * artwork from Cashfree's brand guidelines it belongs in `public/` and this component is where
 * it goes.
 */
const PAYMENT_METHODS = ["UPI", "Cards", "Net banking", "Wallets"];

export function PaymentMethodMarks(): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap items-center gap-2">
        {PAYMENT_METHODS.map((method) => (
          <li
            key={method}
            className="border border-line bg-white px-2.5 py-1 text-eyebrow uppercase tracking-caps text-muted"
          >
            {method}
          </li>
        ))}
      </ul>
      <p className="text-body-sm text-muted">
        Processed by {LEGAL_CONFIG.paymentProvider}. We never see your card or UPI details.
      </p>
    </div>
  );
}
