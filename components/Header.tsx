import { CartLink } from "@/components/CartLink";
import { HeaderAnnouncement } from "@/components/HeaderAnnouncement";
import { MobileNav } from "@/components/MobileNav";
import { PrimaryNav } from "@/components/PrimaryNav";
import { TrackOrderLink } from "@/components/TrackOrderLink";
import { Wordmark } from "@/components/Wordmark";

/**
 * Two bands, not three. The logo row is a flex row below `lg` — hamburger and logo against
 * the cart — and a three-column grid above it, where the outer columns are equal fractions
 * and the middle sizes to the announcement. Equal outer columns are what puts the message on
 * the page's centre line rather than merely between its neighbours, and `minmax(0, 1fr)` lets
 * them yield instead of overflowing if the row ever runs out of room.
 *
 * The header is sticky from the logo row down; the announcement scrolls with it now rather
 * than away above it. See [ADR-028](/docs/decisions/ADR-028-header-restructure.md).
 */
export function Header(): JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="container flex h-16 items-center justify-between gap-4 lg:grid lg:h-24 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
        <div className="flex items-center gap-2">
          <MobileNav />
          <Wordmark priority />
        </div>

        <HeaderAnnouncement />

        <div className="flex items-center justify-end gap-4 lg:gap-6">
          <TrackOrderLink />
          <CartLink />
        </div>
      </div>
      <PrimaryNav />
    </header>
  );
}
