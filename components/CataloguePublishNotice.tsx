export interface CataloguePublishNoticeProps {
  writesEnabled: boolean;
}

/**
 * How a catalogue edit actually reaches a shopper, said on the screen where the edit is made.
 *
 * This is the honest half of this feature, and it is on the page rather than only in an ADR
 * because the thing it explains is invisible and counter-intuitive. `lib/products.ts` reads the
 * catalogue with a static `import`, which webpack **inlines into the compiled server bundle** —
 * every record is a literal in `.next/server/chunks`. The `data/products.json` that Next's build
 * trace also copies into the production image is never read by the running process. A write there
 * changes nothing a shopper can see, survives no redeploy, and looks exactly like a success.
 *
 * So the panel says which of the two situations it is in rather than letting an operator guess:
 *
 * - **Writes on** — a real checkout. The save edits `data/products.json` in the working tree.
 *   Under `next dev` the change is compiled and visible within seconds; under a production build
 *   it is a working-tree change that reaches the shop on the next build. Either way the record of
 *   the change is a commit, which is the property [ADR-001](/docs/decisions/ADR-001-tech-stack.md)
 *   wanted from prices in the first place — a diff is the best audit trail a price can have.
 * - **Writes off** — the deployed container. Editing is refused rather than accepted and
 *   discarded, because a save that reported success and did nothing is worse than no save at all.
 *
 * See [ADR-064](/docs/decisions/ADR-064-admin-product-management.md) for the measurement behind
 * this.
 */
export function CataloguePublishNotice({
  writesEnabled,
}: CataloguePublishNoticeProps): JSX.Element {
  if (!writesEnabled) {
    return (
      <section
        role="note"
        className="flex flex-col gap-2 border border-sale/30 bg-sale/5 px-5 py-4"
      >
        <h2 className="font-sans text-label uppercase tracking-caps text-ink">
          Read-only on this deployment
        </h2>
        <p className="max-w-prose text-body-sm text-muted">
          This server runs a build with the catalogue compiled into it, so a save here would change
          nothing and would not survive the next deploy. Products can be browsed but not edited.
          Make catalogue changes in a checkout and publish them with a commit and a redeploy.
        </p>
      </section>
    );
  }

  return (
    <section role="note" className="flex flex-col gap-2 border border-line bg-ivory px-5 py-4">
      <h2 className="font-sans text-label uppercase tracking-caps text-ink">
        Edits are saved to the working tree
      </h2>
      <p className="max-w-prose text-body-sm text-muted">
        Saving a product writes <code className="text-ink">data/products.json</code> and rebuilds{" "}
        <code className="text-ink">data/keyword-map.json</code> beside it. The live shop shows the
        change once those files are committed and the deployment is rebuilt. The commit is the
        catalogue&rsquo;s audit trail, and nothing here bypasses it.
      </p>
    </section>
  );
}
