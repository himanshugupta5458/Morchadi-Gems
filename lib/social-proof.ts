import entries from "@/data/social-proof.json";
import type { SocialProofEntry } from "@/types/social-proof";

/**
 * How many curated posts the home page shows at once. Six is three across at `lg`, two at
 * `sm` and one on a phone, so the row is full at every width rather than trailing an orphan.
 */
export const SOCIAL_PROOF_DISPLAY_LIMIT = 6;

/**
 * The curated wall, from `data/social-proof.json`.
 *
 * **A JSON file in the repository, and deliberately not an admin form.** Three reasons, in
 * order of weight:
 *
 * 1. It is the same decision the catalogue already made. Prices, photographs and copy ship as
 *    code because a diff is the best audit trail a claim can have
 *    ([ADR-040](/docs/decisions/ADR-040-postgres-for-orders.md)), and a customer's words
 *    attributed to them by name is a claim of exactly that kind.
 * 2. The admin panel's writes are gated off in production
 *    ([ADR-064](/docs/decisions/ADR-064-admin-product-management.md)), so a form there would
 *    edit nothing on the live site — the owner would still be shipping a commit, with an extra
 *    screen in the way.
 * 3. Each entry needs an image file in `public/social/` beside it. A form that cannot upload
 *    the photograph is a form that edits half the record.
 *
 * **It ships empty, and that is the finished state of this work.** The section renders nothing
 * until somebody adds a real post — the same rule `BUSINESS.socialProfileUrls` follows, and for
 * the same reason: an unverified claim about what customers think is worse than no claim. Real
 * photographs and real quotes are the owner's to supply; the mechanism that shows them is
 * here. See [ADR-070](/docs/decisions/ADR-070-home-page-composition.md).
 */
const curated = entries as SocialProofEntry[];

export function getSocialProof(
  limit: number = SOCIAL_PROOF_DISPLAY_LIMIT,
): SocialProofEntry[] {
  return curated.slice(0, limit);
}

/** The whole file, unclipped. Read by the test that checks its shape, and by nothing else. */
export function getAllSocialProof(): SocialProofEntry[] {
  return curated;
}
