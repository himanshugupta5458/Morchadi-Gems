import { FREE_SHIPPING_THRESHOLD, RETURN_WINDOW_DAYS } from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { TrustBadge } from "@/components/TrustBadge";
import {
  CertificateIcon,
  ReturnArrowIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "@/components/icons";

const ICON_CLASS = "h-7 w-7";

/**
 * The free-shipping threshold and the returns window come from `lib/config.ts`, the same
 * constants the refund and shipping policies read — and, for the threshold, the same one the
 * cart and the server-side order pricing charge from. The promise made on the home page and
 * the promise made in the policy cannot drift apart.
 */
const TRUST_BADGES = [
  {
    key: "secure-payments",
    label: "Secure Payments",
    detail: "Cashfree encrypted checkout",
    icon: <ShieldCheckIcon className={ICON_CLASS} />,
  },
  {
    key: "free-shipping",
    label: `Free Shipping Over ${formatRupees(FREE_SHIPPING_THRESHOLD)}`,
    detail: "Delivered across India",
    icon: <TruckIcon className={ICON_CLASS} />,
  },
  {
    key: "easy-returns",
    label: `Easy ${RETURN_WINDOW_DAYS}-Day Returns`,
    detail: "No questions asked",
    icon: <ReturnArrowIcon className={ICON_CLASS} />,
  },
  {
    key: "certified-quality",
    label: "Certified Quality",
    detail: "Every piece inspected",
    icon: <CertificateIcon className={ICON_CLASS} />,
  },
];

export function TrustStrip(): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
