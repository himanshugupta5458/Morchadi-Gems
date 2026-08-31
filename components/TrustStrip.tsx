import { FREE_SHIPPING_THRESHOLD, RETURN_WINDOW_DAYS } from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { TrustBadge } from "@/components/TrustBadge";
import {
  CertificateIcon,
  ReturnArrowIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "@/components/icons";

const ICON_CLASS = "h-6 w-6 sm:h-7 sm:w-7";

const COMPACT_ICON_CLASS = "h-5 w-5";

/**
 * The free-shipping threshold and the returns window come from `lib/config.ts`, the same
 * constants the refund and shipping policies read — and, for the threshold, the same one the
 * cart and the server-side order pricing charge from. The promise made on the home page and
 * the promise made in the policy cannot drift apart.
 *
 * The fourth badge says "Top notch quality" rather than naming anti-tarnish. Anti-tarnish is
 * true of most of the catalogue and is claimed where it is true — in the site description, in
 * the hero, on the pieces themselves — but the promise band covers every order, and a claim
 * that covers every order has to be one every order can keep. See
 * [ADR-070](/docs/decisions/ADR-070-home-page-composition.md).
 */
const TRUST_BADGES = [
  {
    key: "secure-payments",
    label: "Secure Payments",
    detail: "Cashfree encrypted checkout",
    icon: <ShieldCheckIcon className={ICON_CLASS} />,
    compactIcon: <ShieldCheckIcon className={COMPACT_ICON_CLASS} />,
  },
  {
    key: "free-shipping",
    label: `Free Shipping Over ${formatRupees(FREE_SHIPPING_THRESHOLD)}`,
    detail: "Delivered across India",
    icon: <TruckIcon className={ICON_CLASS} />,
    compactIcon: <TruckIcon className={COMPACT_ICON_CLASS} />,
  },
  {
    key: "easy-returns",
    label: `Easy ${RETURN_WINDOW_DAYS}-Day Returns`,
    detail: "No questions asked",
    icon: <ReturnArrowIcon className={ICON_CLASS} />,
    compactIcon: <ReturnArrowIcon className={COMPACT_ICON_CLASS} />,
  },
  {
    key: "top-notch-quality",
    label: "Top notch quality",
    detail: "Checked by hand before dispatch",
    icon: <CertificateIcon className={ICON_CLASS} />,
    compactIcon: <CertificateIcon className={COMPACT_ICON_CLASS} />,
  },
];

export function TrustStrip(): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {TRUST_BADGES.map((badge) => (
        <TrustBadge
          key={badge.key}
          icon={badge.icon}
          label={badge.label}
          detail={badge.detail}
        />
      ))}
    </div>
  );
}

/**
 * The same four promises as one line of text, for the places that need them stated but do not
 * have a screen to give them.
 *
 * It reads the same array as the full band rather than restating four labels — the compact
 * form is a second *rendering* of the promise, never a second copy of it, so a change to the
 * free-shipping threshold moves both and the two can never say different numbers. The
 * per-badge `detail` is dropped: the label is the promise and the detail is the reassurance,
 * and a strip under a Buy button has room for the first only.
 *
 * Rendered directly under the hero on the home page and under the buy actions on a product
 * page, which are the two places a shopper decides whether this shop can be trusted with a
 * card number. See [ADR-070](/docs/decisions/ADR-070-home-page-composition.md).
 */
export function TrustStripCompact(): JSX.Element {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-7 sm:gap-y-3">
      {TRUST_BADGES.map((badge) => (
        <li key={badge.key} className="flex items-center gap-2">
          <span className="shrink-0 text-gold-deep">{badge.compactIcon}</span>
          <span className="text-eyebrow uppercase tracking-caps text-muted">
            {badge.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
