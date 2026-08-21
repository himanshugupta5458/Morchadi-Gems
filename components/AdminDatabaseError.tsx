export interface AdminDatabaseErrorProps {
  /** What the panel was trying to read, named the way an operator would name it. */
  what: string;
}

/**
 * The panel's own answer to "Postgres did not answer", in place of Next's generic 500.
 *
 * The storefront hides a database fault from a shopper on purpose
 * ([ADR-042](/docs/decisions/ADR-042-order-capture-in-postgres.md)). The panel does the
 * opposite, deliberately: the person looking at this screen is the person who would restart
 * the database, and an order list that quietly rendered "no orders yet" during an outage would
 * be the single most dangerous screen in the application
 * ([ADR-048](/docs/decisions/ADR-048-database-health-and-failure-surfaces.md)).
 *
 * It says what the outage means as well as that there is one. Checkout does not stop when
 * Postgres does — it takes the payment and logs that the write failed — so an operator who
 * knows only "the panel is broken" does not know the thing that actually matters, which is
 * that orders are arriving right now and nothing is recording them.
 */
export function AdminDatabaseError({ what }: AdminDatabaseErrorProps): JSX.Element {
  return (
    <section
      role="alert"
      className="flex flex-col gap-4 border border-sale/30 bg-sale/5 px-6 py-10"
    >
      <h2 className="font-display text-heading text-ink">
        The order database did not answer
      </h2>

      <p className="max-w-prose text-body text-muted">
        {what} could not be read. This is the database rather than the page, so reloading is
        unlikely to help on its own.
      </p>

      <p className="max-w-prose text-body-sm text-muted">
        The shop is almost certainly still up and still taking payments while this lasts, and
        those orders are <strong className="font-medium text-ink">not being recorded</strong>.
        Treat it as urgent. Check that Postgres is running and that this deployment still points
        at it; <code className="text-ink">/api/health</code> on the storefront answers the same
        question in one line.
      </p>
    </section>
  );
}
