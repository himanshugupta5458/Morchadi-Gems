import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createProductRuleContext,
  validateCatalogueFloors,
  validateCatalogueSeoUniqueness,
  validateProductRecord,
} from "@/scripts/product-record-rules.mjs";
import type { Product } from "@/types/product";

/**
 * The catalogue's own rules, applied from inside a running server rather than from the gate.
 *
 * **It does not reimplement anything.** Every rule comes from `scripts/product-record-rules.mjs`,
 * the module `scripts/validate-products.mjs` was refactored to import, so an edit saved through
 * the admin panel is held to the rules the build will hold it to — not to a friendlier subset
 * somebody wrote for a form. That is the whole reason the extraction happened; see
 * [ADR-064](/docs/decisions/ADR-064-admin-product-management.md).
 *
 * What it deliberately leaves out is the gate's near-match keyword advisory, which compares every
 * keyword entry against every other — around 1.6 million pairs — and is advisory in both places.
 * A request handler may not spend that to tell an operator something that would not have blocked
 * the save anyway.
 */

/**
 * A failure blocks the save; an advisory is shown and ignored. The split is the gate's own: the
 * things it exits non-zero for are failures here, and the things it prints under `ADVISORY` are
 * advisories here. An operator who prices a piece below cost is told, and is still allowed to do
 * it, because margin is the owner's call and not the code's (ADR-040).
 */
export interface CatalogueValidationResult {
  ok: boolean;
  failures: string[];
  advisories: string[];
}

function existsUnderPublic(publicPath: string): boolean {
  return existsSync(join(process.cwd(), "public", publicPath.replace(/^\//, "")));
}

/**
 * Validates a whole catalogue, not the one record that changed.
 *
 * The record-level rules would run happily on one product, but three of the guarantees this
 * catalogue actually depends on cannot be seen from inside a single record: an id that now
 * collides with another, a `metaTitle` or `primaryKeyword` another product already owns, and the
 * floors that keep a rendered surface populated — unfeaturing the fourth featured piece empties
 * the home best-sellers row, and the operator who did it should hear that from the panel rather
 * than from a failed build.
 *
 * Costing a full pass on every save is affordable precisely because the expensive advisory is
 * excluded: what is left is one linear pass over the records and a few map lookups.
 */
export function validateCatalogue(catalogue: readonly Product[]): CatalogueValidationResult {
  const context = createProductRuleContext({ existsUnderPublic });

  for (const product of catalogue) {
    validateProductRecord(product, product.id ?? "<missing id>", context);
  }

  validateCatalogueSeoUniqueness(catalogue, context);
  validateCatalogueFloors(context);

  const failures: string[] = context.failures;

  const advisories: string[] = [
    ...context.discountAdvisories,
    ...context.marginAdvisories,
    ...context.minPrepaidAdvisories,
    ...context.descriptionAdvisories,
  ];

  return { ok: failures.length === 0, failures, advisories };
}

/**
 * The same pass, reported as only what the edited record is responsible for.
 *
 * A catalogue-wide validation names every problem in the file, and 404 of the products already
 * carry an advisory nobody is about to fix. Showing an operator who changed one price a list of
 * other people's records would bury the sentence they need. So failures are split: the ones
 * naming this id, and the rest.
 *
 * `catalogueFailures` is not discarded — a save is refused when either list is non-empty, because
 * an edit that breaks a floor ("found 3 featured products") produces a failure that names no id
 * at all and is still this edit's fault.
 */
export interface ProductEditValidationResult {
  ok: boolean;
  productFailures: string[];
  catalogueFailures: string[];
  advisories: string[];
}

export function validateCatalogueForEdit(
  catalogue: readonly Product[],
  editedProductId: string,
  baselineFailures: readonly string[],
): ProductEditValidationResult {
  const { failures, advisories } = validateCatalogue(catalogue);

  /**
   * Failures the catalogue already had before this edit are not this edit's to answer for. The
   * repository measures them once against the unedited file and hands them in here, so a
   * catalogue that is already failing the gate for an unrelated reason does not make every
   * product uneditable until somebody fixes it.
   */
  const introduced = failures.filter((failure) => !baselineFailures.includes(failure));

  const productFailures = introduced.filter((failure) =>
    failure.startsWith(`${editedProductId}:`),
  );
  const catalogueFailures = introduced.filter(
    (failure) => !failure.startsWith(`${editedProductId}:`),
  );

  return {
    ok: introduced.length === 0,
    productFailures,
    catalogueFailures,
    advisories: advisories.filter((advisory) => advisory.startsWith(`${editedProductId}:`)),
  };
}
