import { FREE_SHIPPING_THRESHOLD, RETURN_WINDOW_DAYS } from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { ReturnArrowIcon, ShieldCheckIcon, TruckIcon } from "@/components/icons";

const ICON_CLASS = "h-4 w-4 shrink-0 text-gold-deep";

/**
 * The three promises a product page states, on one line under the buy actions and nowhere else
 * on the page.
 *
 * It replaces `TrustStripCompact` here, and the difference is what is left out. The compact
 * strip carries a fourth badge, "Top notch quality", which reduces no purchase objection anyone
 * has: it names no window, no threshold and no gateway, and a shopper deciding whether to spend
 * ₹600 on an unfamiliar shop is not weighing it. The three that stay each answer a specific
 * question — who takes the money, what does delivery cost, what if it is wrong — and each reads
 * its number from `lib/config.ts`, so none of them can drift from the policy pages that make
 * the same promise.
 *
 * One line rather than the two-row icon grid that was here, and it is the only trust content on
 * the page. It was rendered under the buy actions and again beside the share button, which is
 * the same reassurance twice on one screen. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
const PRODUCT_TRUST_POINTS = [
  {
    key: "secure-payment",
    label: "Secure payment",
    icon: <ShieldCheckIcon className={ICON_CLASS} />,
  },
  {
    key: "free-shipping",
    label: `Free shipping over ${formatRupees(FREE_SHIPPING_THRESHOLD)}`,
    icon: <TruckIcon className={ICON_CLASS} />,
  },
  {
    key: "returns",
    label: `${RETURN_WINDOW_DAYS}-day returns`,
    icon: <ReturnArrowIcon className={ICON_CLASS} />,
  },
];

export function ProductTrustLine(): JSX.Element {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {PRODUCT_TRUST_POINTS.map((point) => (
        <li key={point.key} className="flex items-center gap-1.5">
          {point.icon}
          <span className="text-eyebrow uppercase tracking-caps text-muted">
            {point.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
