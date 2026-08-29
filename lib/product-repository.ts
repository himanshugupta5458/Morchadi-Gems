import "server-only";
import { createHash } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildKeywordMap, serialiseKeywordMap } from "@/scripts/backfill-keyword-map.mjs";
import { validateCatalogue, validateCatalogueForEdit } from "@/lib/product-validation";
import type { ProductEdit } from "@/types/admin-product";
import type { Product } from "@/types/product";

export type { ProductEdit };

/**
 * The one door between the admin product panel and wherever the catalogue is kept.
 *
 * Every page, route and form in the product feature calls this interface. None of them imports
 * `data/products.json`, and none of them calls `lib/products.ts` — those stay exactly as they
 * are, serving the storefront's read-only needs, and this is a parallel admin path that happens
 * to read the same file today. `lib/product-repository-boundary.test.ts` is what keeps that true
 * rather than a promise in a review.
 *
 * The interface is written in terms of `Product` and nothing else. There is no cursor, no byte
 * offset, no file handle and no notion of a JSON document anywhere in it, so the day the
 * catalogue moves into Postgres a `PrismaProductRepository` implements these three methods and
 * the pages, routes and validation above it do not change. See
 * [ADR-064](/docs/decisions/ADR-064-admin-product-management.md).
 */
export interface ProductRepository {
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  updateProduct(request: ProductUpdateRequest): Promise<ProductUpdateOutcome>;
}

export interface ProductUpdateRequest {
  id: string;
  edit: ProductEdit;
  /**
   * The `version` the form was rendered from. The write is refused if the record on disk no
   * longer hashes to it, which is the whole of the concurrency story — see `computeProductVersion`.
   */
  expectedVersion: string;
}

export type ProductUpdateError =
  | "VALIDATION_FAILED"
  | "CONCURRENT_CHANGE"
  | "WRITES_DISABLED"
  | "STORAGE_ERROR";

export type ProductUpdateOutcome =
  | { kind: "UPDATED"; product: Product; advisories: string[] }
  | { kind: "UNCHANGED"; product: Product }
  | { kind: "NOT_FOUND" }
  | {
      kind: "REJECTED";
      error: ProductUpdateError;
      message: string;
      /** The rules that refused it, verbatim from the gate's own vocabulary. */
      failures: string[];
    };

/**
 * A record's identity for concurrency purposes: the SHA-256 of its serialised form, truncated to
 * something a hidden form field can carry.
 *
 * A hash rather than a timestamp because the catalogue has no `updatedAt` and adding one would
 * put a field in every record that only this feature reads. A hash of the record rather than of
 * the file because two operators editing two different products are not in conflict, and a
 * file-level token would tell them they were.
 *
 * Truncation is safe here: this is a change detector between two versions of one record, not a
 * security boundary. Sixteen hex characters is 64 bits, and the failure mode of a collision is
 * that one edit overwrites another that happened in the same second — which is the behaviour
 * with no token at all.
 */
export function computeProductVersion(product: Product): string {
  return createHash("sha256").update(JSON.stringify(product)).digest("hex").slice(0, 16);
}

/**
 * The record rebuilt from an edit, with the untouchable fields carried through.
 *
 * Keys are written in the order `PRODUCT_KEYS` lists them, which is the order all 449 records
 * already use, so a one-field edit produces a one-line diff rather than a reordered record.
 * Optional keys are omitted rather than written as `null`: `scripts/validate-products.mjs`
 * checks the *set* of keys on a record, and a `subcategory: null` is an unknown shape rather
 * than an absent field.
 */
export function applyProductEdit(current: Product, edit: ProductEdit): Product {
  const trimmedSubcategory = edit.subcategory?.trim() ?? "";

  return {
    id: current.id,
    name: edit.name,
    category: edit.category,
    ...(trimmedSubcategory === "" ? {} : { subcategory: trimmedSubcategory }),
    status: edit.status,
    ...(current.collections === undefined ? {} : { collections: current.collections }),
    pricing: { ...current.pricing, ...edit.pricing },
    media: {
      ...current.media,
      images: current.media.images,
      ...(Object.keys(edit.variantImages).length === 0
        ? {}
        : { variantImages: edit.variantImages }),
    },
    ...(edit.options.length === 0 ? {} : { options: edit.options }),
    specs: edit.specs,
    description: edit.description,
    seo: { ...current.seo, ...edit.seo },
    stock: { ...current.stock, ...edit.stock },
    flags: { ...current.flags, ...edit.flags },
    ...(current.migrationProvenance === undefined
      ? {}
      : { migrationProvenance: current.migrationProvenance }),
  };
}

/**
 * Whether a write to `data/products.json` from a running server is meaningful here.
 *
 * **In the deployed container it is not, and this is the field note for why.** `lib/products.ts`
 * reads the catalogue with a static `import`, which webpack inlines into the compiled server
 * bundle — all 449 records are literals in `.next/server/chunks`. The file that Next's build
 * trace also copies to `/app/data/products.json` is never read by the running process, so a
 * write there changes nothing any shopper or operator can see, survives no redeploy, and is
 * indistinguishable from success. Verified by experiment, not inferred; the measurement is in
 * [ADR-064](/docs/decisions/ADR-064-admin-product-management.md).
 *
 * Under `next dev` the same write is picked up within seconds, because the dev server watches
 * the module graph and recompiles. That asymmetry is exactly why this gate exists rather than a
 * warning: a panel that saved happily in both places would demo perfectly and silently do
 * nothing in production.
 *
 * So writes are on wherever the file is the catalogue, and off in production unless somebody
 * sets `CATALOGUE_WRITES_ENABLED=true` on purpose — which is the escape hatch for running a
 * production build from a real checkout, where the edit is still a working-tree change worth
 * committing even though the running server will not show it until it is rebuilt.
 */
export function isCatalogueWriteEnabled(): boolean {
  if (process.env.CATALOGUE_WRITES_ENABLED === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export const CATALOGUE_WRITES_DISABLED_MESSAGE =
  "This deployment serves a catalogue compiled into the build, so a save here would change nothing. Edit the product in a checkout and publish it with a commit and a redeploy.";

const CATALOGUE_RELATIVE_PATH = join("data", "products.json");
const KEYWORD_MAP_RELATIVE_PATH = join("data", "keyword-map.json");

/** Byte-identical to how the catalogue is already stored, so a write is a minimal diff. */
export function serialiseCatalogue(catalogue: readonly Product[]): string {
  return `${JSON.stringify(catalogue, null, 2)}\n`;
}

export interface JsonFileProductRepositoryOptions {
  /** The directory holding `data/`. Defaults to the process's working directory. */
  rootDirectory?: string;
  /** Injected so a test can exercise the disabled path without setting `NODE_ENV`. */
  writesEnabled?: () => boolean;
}

/**
 * The catalogue as `data/products.json`, today's one implementation of `ProductRepository`.
 *
 * Reads go to the file every time rather than to a cached array. That costs a 1.38 MB parse per
 * admin page view, which is nothing at one operator, and it buys the property the write path
 * depends on: the panel always shows what is on disk, including a change made by an editor, a
 * script or a `git pull` since the server started.
 */
export class JsonFileProductRepository implements ProductRepository {
  private readonly rootDirectory: string;
  private readonly writesEnabled: () => boolean;

  constructor(options: JsonFileProductRepositoryOptions = {}) {
    this.rootDirectory = options.rootDirectory ?? process.cwd();
    this.writesEnabled = options.writesEnabled ?? isCatalogueWriteEnabled;
  }

  private get cataloguePath(): string {
    return join(this.rootDirectory, CATALOGUE_RELATIVE_PATH);
  }

  private get keywordMapPath(): string {
    return join(this.rootDirectory, KEYWORD_MAP_RELATIVE_PATH);
  }

  private async readCatalogue(): Promise<Product[]> {
    const raw = await readFile(this.cataloguePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${CATALOGUE_RELATIVE_PATH} is not a JSON array`);
    }
    return parsed as Product[];
  }

  async listProducts(): Promise<Product[]> {
    return this.readCatalogue();
  }

  async getProduct(id: string): Promise<Product | null> {
    const catalogue = await this.readCatalogue();
    return catalogue.find((product) => product.id === id) ?? null;
  }

  /**
   * One product's edit, validated against the whole catalogue and written atomically.
   *
   * The order of the steps is the design. The catalogue is re-read from disk immediately before
   * anything is decided, so nothing here is ever reasoning about a copy that was loaded when the
   * form was rendered; the version token is checked against *that* read; and validation runs over
   * the resulting catalogue rather than the edited record alone, because an id collision, a
   * duplicate primary keyword and an emptied merchandising row are all invisible from inside one
   * record.
   *
   * The keyword map is rebuilt in the same operation. It is derived from the catalogue and the
   * gate compares it byte for byte, so an edit to a keyword that left the map alone would hand
   * the operator a green save and a red build.
   */
  async updateProduct({
    id,
    edit,
    expectedVersion,
  }: ProductUpdateRequest): Promise<ProductUpdateOutcome> {
    if (!this.writesEnabled()) {
      return {
        kind: "REJECTED",
        error: "WRITES_DISABLED",
        message: CATALOGUE_WRITES_DISABLED_MESSAGE,
        failures: [],
      };
    }

    let catalogue: Product[];
    try {
      catalogue = await this.readCatalogue();
    } catch (readError) {
      console.error("[product-repository] the catalogue could not be read", readError);
      return {
        kind: "REJECTED",
        error: "STORAGE_ERROR",
        message:
          "The catalogue file could not be read, so nothing was changed. Check the server log.",
        failures: [],
      };
    }

    const index = catalogue.findIndex((product) => product.id === id);
    if (index === -1) return { kind: "NOT_FOUND" };

    const current = catalogue[index];

    if (computeProductVersion(current) !== expectedVersion) {
      return {
        kind: "REJECTED",
        error: "CONCURRENT_CHANGE",
        message:
          "This product changed on disk after this form was opened, so the save was refused rather than overwriting it. Reload the page and make the edit again.",
        failures: [],
      };
    }

    const updated = applyProductEdit(current, edit);

    if (JSON.stringify(updated) === JSON.stringify(current)) {
      return { kind: "UNCHANGED", product: current };
    }

    const baseline = validateCatalogue(catalogue);
    const nextCatalogue = catalogue.map((product, position) =>
      position === index ? updated : product,
    );

    const validation = validateCatalogueForEdit(nextCatalogue, id, baseline.failures);

    if (!validation.ok) {
      return {
        kind: "REJECTED",
        error: "VALIDATION_FAILED",
        message:
          "That edit would break a rule the catalogue is built on, so nothing was saved. The reasons are below, in the same words the build would use.",
        failures: [...validation.productFailures, ...validation.catalogueFailures],
      };
    }

    try {
      await this.writeAtomically(this.cataloguePath, serialiseCatalogue(nextCatalogue));
      await this.writeAtomically(
        this.keywordMapPath,
        serialiseKeywordMap(buildKeywordMap(nextCatalogue)),
      );
    } catch (writeError) {
      console.error("[product-repository] the catalogue could not be written", writeError);
      return {
        kind: "REJECTED",
        error: "STORAGE_ERROR",
        message:
          "The catalogue could not be written, so the edit was not saved. Check the server log and the file's permissions.",
        failures: [],
      };
    }

    return { kind: "UPDATED", product: updated, advisories: validation.advisories };
  }

  /**
   * Write to a sibling temporary file, then rename over the target.
   *
   * `rename` within one filesystem is atomic, so a reader sees either the whole old catalogue or
   * the whole new one. Writing 1.38 MB in place is not: a process killed partway through leaves a
   * truncated file, and the thing truncated is every product rather than the one being edited.
   * That is the concurrency risk actually worth engineering against here — a solo operator will
   * not race themselves, but a container can be stopped mid-write on any deploy.
   */
  private async writeAtomically(path: string, contents: string): Promise<void> {
    const temporaryPath = `${path}.${process.pid}.tmp`;

    try {
      await writeFile(temporaryPath, contents, "utf8");
      await rename(temporaryPath, path);
    } catch (writeError) {
      await unlink(temporaryPath).catch(() => undefined);
      throw writeError;
    }
  }
}

/**
 * The repository every admin product surface uses. A single instance because it holds no state
 * worth keeping — it is a path and a policy — and naming it once means a page cannot quietly
 * construct one pointed somewhere else.
 */
export const productRepository: ProductRepository = new JsonFileProductRepository();
