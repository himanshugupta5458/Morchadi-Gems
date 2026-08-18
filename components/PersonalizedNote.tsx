import Link from "next/link";
import { PERSONALIZED_NOTE } from "@/lib/options";

export interface PersonalizedNoteProps {
  /** Off on a cart line, where four of them stacked would be four copies of one sentence. */
  withExplanation?: boolean;
}

const REFUND_POLICY_PATH = "/refund";

/**
 * Shown wherever a personalized piece is — the product page and its cart line. It is the
 * refund policy's made-to-order carve-out said at the moment it applies, rather than only on
 * the policy page the shopper has not opened.
 */
export function PersonalizedNote({
  withExplanation = false,
}: PersonalizedNoteProps): JSX.Element {
  return (
    <p className="text-body-sm text-muted">
      <span className="text-eyebrow uppercase text-gold-deep">
        {PERSONALIZED_NOTE}
      </span>
      {withExplanation ? (
        <>
          {" — "}
          this piece is made to your choice, so it cannot be returned or exchanged unless it
          arrives damaged or is not what you ordered.{" "}
          <Link
            href={REFUND_POLICY_PATH}
            className="text-ink underline underline-offset-4 transition-colors duration-250 hover:text-gold-deep"
          >
            Refund policy
          </Link>
        </>
      ) : null}
    </p>
  );
}
