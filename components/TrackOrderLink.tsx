import Link from "next/link";
import { TRACK_ORDER_PATH } from "@/lib/navigation";

export interface TrackOrderLinkProps {
  onNavigate?: () => void;
}

/**
 * The header's standing entry point to `/track`, sat beside the cart in the logo row and
 * repeated in the mobile drawer's cart band. It carries the same uppercase label treatment as
 * the drawer's "Cart" and the primary nav's company links, so it reads as a nav label rather
 * than as body copy dropped into the chrome.
 *
 * A returning customer arrives with an order number and no account to sign into, so the way
 * back in has to be visible without a cart, a session or a scroll to the footer — see
 * [ADR-045](/docs/decisions/ADR-045-public-order-tracking.md).
 */
export function TrackOrderLink({ onNavigate }: TrackOrderLinkProps): JSX.Element {
  return (
    <Link
      href={TRACK_ORDER_PATH}
      onClick={onNavigate}
      className="whitespace-nowrap text-label uppercase tracking-caps text-ink transition-colors duration-250 hover:text-gold-deep"
    >
      Track Order
    </Link>
  );
}
