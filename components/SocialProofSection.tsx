import Image from "next/image";
import Link from "next/link";
import type { SocialProofEntry } from "@/types/social-proof";
import { SectionHeading } from "@/components/SectionHeading";

export interface SocialProofSectionProps {
  entries: readonly SocialProofEntry[];
}

function PostCard({ entry }: { entry: SocialProofEntry }): JSX.Element {
  const photograph = (
    <span className="relative block aspect-square w-full overflow-hidden bg-ivory">
      <Image
        src={entry.image}
        alt={entry.alt}
        fill
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </span>
  );

  return (
    <article className="group flex h-full flex-col border border-line bg-white shadow-card transition duration-250 hover:-translate-y-1 hover:shadow-card-hover">
      {entry.sourceUrl === undefined ? (
        photograph
      ) : (
        <Link href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">
          {photograph}
        </Link>
      )}

      <blockquote className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <p className="text-body-sm text-ink">{entry.quote}</p>
        {entry.attribution === undefined ? null : (
          <footer className="mt-auto text-eyebrow uppercase tracking-caps text-gold-deep">
            {entry.attribution}
          </footer>
        )}
      </blockquote>
    </article>
  );
}

/**
 * Curated photographs and the words that came with them.
 *
 * **Renders nothing at all when there is nothing curated**, which is its state today and the
 * correct one: this shop has collected no reviews and its record holds nothing it cannot
 * substantiate ([ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md)). An empty band
 * with a heading over it would be a promise that something is coming; no band is simply the
 * truth. The moment `data/social-proof.json` holds a real post, the section appears with it.
 */
export function SocialProofSection({ entries }: SocialProofSectionProps): JSX.Element | null {
  if (entries.length === 0) return null;

  return (
    <section className="border-t border-line bg-ivory">
      <div className="container flex flex-col gap-6 py-7 sm:gap-8 sm:py-11 lg:gap-10 lg:py-16">
        <SectionHeading
          roman="Worn"
          accent="By You"
          subtitle="Photographs and words shared by the people wearing these pieces."
        />

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {entries.map((entry) => (
            <li key={entry.id} className="h-full">
              <PostCard entry={entry} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
