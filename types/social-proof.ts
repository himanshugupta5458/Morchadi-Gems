/**
 * One curated post: a photograph the shop has permission to show, the words that go with it,
 * and optionally who said them.
 *
 * Every field is something a person wrote down on purpose. Nothing here is derived, scraped or
 * generated — this shop has no reviews, no ratings and no testimonial data
 * ([ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md)), and this record is the shape a
 * *real* one would be written in rather than a place to invent some.
 */
export interface SocialProofEntry {
  /** Stable key. Also what a duplicate check is run against. */
  id: string;
  /** Path under `public/`, as `/social/…`. */
  image: string;
  /** What the photograph shows, for a screen reader. Never the quote repeated. */
  alt: string;
  /** The caption or the words the customer used. */
  quote: string;
  /** Who said it. Absent when the post is the shop's own or the customer wanted no name. */
  attribution?: string;
  /** The post this came from, so the claim can be checked. Absent for an unlinked photo. */
  sourceUrl?: string;
}
