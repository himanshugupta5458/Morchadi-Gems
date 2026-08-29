import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The test that makes the repository boundary real rather than a promise in a review.
 *
 * `ProductRepository` exists so that the day the catalogue moves into Postgres, a
 * `PrismaProductRepository` replaces the JSON-backed one and nothing above it changes. That
 * property survives exactly as long as no page, route or component quietly reaches past the
 * interface to `data/products.json` or to `lib/products.ts` — and nothing but a test can keep
 * that true, because reaching past it is easier than going through it and works just as well
 * today. See [ADR-064](/docs/decisions/ADR-064-admin-product-management.md).
 *
 * `lib/products.ts` itself is untouched and stays exactly as it is: it is the storefront's
 * read-only accessor, it is not a defect, and this file says nothing about it beyond "the admin
 * product feature does not call it".
 */

const REPOSITORY_ROOT = process.cwd();

/** Directories whose every file belongs to this feature, however the tree grows inside them. */
const FEATURE_DIRECTORIES: readonly string[] = [
  join("app", "admin", "(protected)", "products"),
  join("app", "admin", "api", "products"),
];

/** Modules and components of the feature that live beside their unrelated neighbours. */
const FEATURE_FILES: readonly string[] = [
  join("lib", "admin-product-api.ts"),
  join("lib", "admin-product-client.ts"),
  join("lib", "admin-product-form.ts"),
  join("lib", "admin-products.ts"),
  join("lib", "product-validation.ts"),
  join("components", "AdminCatalogueError.tsx"),
  join("components", "AdminProductFilters.tsx"),
  join("components", "AdminProductForm.tsx"),
  join("components", "AdminProductPagination.tsx"),
  join("components", "AdminProductTable.tsx"),
  join("components", "AdminProductTabs.tsx"),
  join("components", "CataloguePublishNotice.tsx"),
];

const REPOSITORY_MODULE = join("lib", "product-repository.ts");

function filesUnder(directory: string): string[] {
  const absolute = join(REPOSITORY_ROOT, directory);
  if (!existsSync(absolute)) return [];

  return readdirSync(absolute).flatMap((entry) => {
    const relative = join(directory, entry);
    return statSync(join(REPOSITORY_ROOT, relative)).isDirectory()
      ? filesUnder(relative)
      : [relative];
  });
}

const featureSources: readonly { path: string; source: string }[] = [
  ...FEATURE_DIRECTORIES.flatMap(filesUnder),
  ...FEATURE_FILES,
].map((path) => ({ path, source: readFileSync(join(REPOSITORY_ROOT, path), "utf8") }));

/**
 * Every way a module could name the catalogue file or the storefront's accessors. Matched as
 * import specifiers rather than as bare words, so a doc comment that *mentions* `lib/products.ts`
 * — several of them do, and should — is not a violation.
 */
const FORBIDDEN_IMPORTS: readonly RegExp[] = [
  /from\s+["']@\/data\/products\.json["']/,
  /from\s+["']@\/lib\/products["']/,
  /from\s+["']\.\.?\/products["']/,
  /require\(\s*["'][^"']*data\/products\.json["']\s*\)/,
  /from\s+["']@\/lib\/shop["']/,
];

describe("the admin product feature reaches the catalogue only through the repository", () => {
  it("has files to check", () => {
    expect(featureSources.length).toBeGreaterThanOrEqual(FEATURE_FILES.length);
  });

  it.each(featureSources.map(({ path }) => path))(
    "%s imports neither data/products.json nor lib/products.ts",
    (path) => {
      const { source } = featureSources.find((file) => file.path === path) ?? { source: "" };

      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(source).not.toMatch(forbidden);
      }
    },
  );

  /**
   * The mirror of the rule above: the pages and the route do not merely avoid the catalogue, they
   * positively go through the interface. A page that read nothing at all would pass the negative
   * check trivially.
   */
  it.each([
    join("app", "admin", "(protected)", "products", "page.tsx"),
    join("app", "admin", "(protected)", "products", "[id]", "page.tsx"),
    join("app", "admin", "api", "products", "[id]", "route.ts"),
  ])("%s reads and writes through productRepository", (path) => {
    const source = readFileSync(join(REPOSITORY_ROOT, path), "utf8");

    expect(source).toContain("productRepository");
    expect(source).toMatch(/from\s+["']@\/lib\/product-repository["']/);
  });

  /**
   * The one module allowed to know the catalogue is a file. Even it does not `import` the JSON —
   * it reads the path with `fs`, which is what lets a write be seen by the next read rather than
   * being shadowed by a module-level copy webpack inlined at build time.
   */
  it("keeps file access inside the JSON-backed implementation alone", () => {
    const source = readFileSync(join(REPOSITORY_ROOT, REPOSITORY_MODULE), "utf8");

    expect(source).toContain("node:fs/promises");
    for (const forbidden of FORBIDDEN_IMPORTS) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it("is the only place in the feature that writes a file", () => {
    for (const { path, source } of featureSources) {
      expect(
        { path, writes: /writeFile|writeFileSync|renameSync|\brename\(/.test(source) },
      ).toEqual({ path, writes: false });
    }
  });
});

/**
 * `pricing.cost` is margin data, and the seal it is held to is about the *public* storefront. The
 * admin panel is the surface the seal exists to serve rather than to hide from — an operator
 * setting a price needs to see what the piece cost — so this asserts the thing that actually
 * matters: no bundle a shopper downloads carries it.
 *
 * A grep over real build output rather than a reading of the module that narrows it, which is the
 * method `docs/testing/RESULT-2026-08-20-order-capture.md` (TC-31) established.
 */
const BUILD_ID = ".next/BUILD_ID";
const CLIENT_CHUNK_DIRECTORY = ".next/static/chunks";

const buildMissing = !existsSync(BUILD_ID) || !existsSync(CLIENT_CHUNK_DIRECTORY);
const buildHint = "run `npm run build` first — this reads real build output";

describe("margin data stays out of the shopper's browser", () => {
  it("ships no client chunk carrying a catalogue cost figure", (ctx) => {
    ctx.skip(buildMissing, buildMissing ? buildHint : undefined);

    const catalogue = JSON.parse(
      readFileSync(join(REPOSITORY_ROOT, "data", "products.json"), "utf8"),
    ) as { id: string; pricing: { cost: number; price: number } }[];

    const chunks = filesUnder(CLIENT_CHUNK_DIRECTORY).filter((path) => path.endsWith(".js"));
    expect(chunks.length).toBeGreaterThan(0);

    /**
     * A cost figure alone is just a number and would collide with anything. What no client chunk
     * may contain is the *record* — the id beside its cost — which is how the catalogue would
     * actually arrive in a bundle.
     */
    const sample = catalogue.slice(0, 25);

    for (const path of chunks) {
      const source = readFileSync(join(REPOSITORY_ROOT, path), "utf8");
      for (const product of sample) {
        if (!source.includes(`"${product.id}"`)) continue;
        expect({ path, id: product.id, carriesCost: source.includes('"cost"') }).toEqual({
          path,
          id: product.id,
          carriesCost: false,
        });
      }
    }
  });
});
