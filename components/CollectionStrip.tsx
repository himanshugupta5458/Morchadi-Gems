import Link from "next/link";
import { COLLECTION_MENU } from "@/lib/navigation";

/**
 * The second tier, rendered as a row of links rather than tiles: collections cut across
 * categories, so they have no single image that could honestly stand for one.
 */
export function CollectionStrip(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4">
      <h3 className="text-eyebrow uppercase text-charcoal">Or shop by collection</h3>
      <ul className="flex flex-wrap items-center justify-center gap-3">
        {COLLECTION_MENU.items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="inline-flex items-center border border-gold/45 bg-gold/10 px-4 py-3 text-label uppercase tracking-caps text-charcoal shadow-card transition-colors duration-250 hover:border-charcoal hover:bg-charcoal hover:text-ivory sm:px-6"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
