export interface AdminCatalogueErrorProps {
  /** What the panel was trying to read, named the way an operator would name it. */
  what: string;
}

/**
 * The panel's own answer to "the catalogue file could not be read", in place of Next's generic
 * 500.
 *
 * `AdminDatabaseError` is the same idea for Postgres, and the two are separate on purpose because
 * the operator's next action is different and so is the urgency. A Postgres outage means orders
 * are arriving unrecorded and is an emergency; the catalogue failing to parse means this screen
 * cannot list products, while the shop carries on serving the copy compiled into the running
 * build — no shopper sees anything wrong, and nothing is being lost while it is fixed.
 *
 * Saying that plainly is the point. An operator who read the database wording here would treat a
 * malformed JSON file as a revenue outage.
 *
 * The rule this satisfies is CLAUDE.md's: anything that reads a store must have a deliberate
 * answer to "what happens when it is not there", and the answer differs by who is looking. See
 * [ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md) for the table this
 * adds a row to, and [ADR-064](/docs/decisions/ADR-064-admin-product-management.md).
 */
export function AdminCatalogueError({ what }: AdminCatalogueErrorProps): JSX.Element {
  return (
    <section
      role="alert"
      className="flex flex-col gap-4 border border-sale/30 bg-sale/5 px-6 py-10"
    >
      <h2 className="font-display text-heading text-ink">The catalogue could not be read</h2>

      <p className="max-w-prose text-body text-muted">
        {what} could not be read from <code className="text-ink">data/products.json</code>. This is
        the file rather than the page, so reloading is unlikely to help on its own. The usual
        cause is that it is not valid JSON after a hand edit.
      </p>

      <p className="max-w-prose text-body-sm text-muted">
        The shop itself is unaffected and no order is at risk: every storefront page serves the
        catalogue compiled into the running build, not this file. Run{" "}
        <code className="text-ink">npm run validate:products</code> to see what is wrong with it.
      </p>
    </section>
  );
}
