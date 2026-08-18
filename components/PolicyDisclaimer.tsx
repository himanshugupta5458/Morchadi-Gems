/**
 * Every policy page carries this, visibly, above the content. The copy below it is a working
 * sample that matches what this site actually does — it is not legal advice and has not been
 * reviewed by anyone qualified to give it. Removing this notice is a decision for whoever
 * commissions that review, not a tidy-up.
 */
export function PolicyDisclaimer(): JSX.Element {
  return (
    <aside
      aria-label="Important notice about this policy"
      className="max-w-prose border border-gold/40 bg-gold/5 px-5 py-4"
    >
      <p className="text-eyebrow uppercase text-gold-deep">Sample template</p>
      <p className="mt-2 text-body-sm text-muted">
        This policy is a <strong className="font-medium text-ink">sample template</strong>{" "}
        written to match how this store operates. It has not been reviewed by a lawyer.
        Review it with a legal professional, and adapt it to your registered entity and
        jurisdiction, before relying on it or publishing it as binding terms.
      </p>
    </aside>
  );
}
