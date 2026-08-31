import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `data/products.json` is 1.4MB and holds `pricing.cost` on every record. It has never reached a
 * browser, and until the cross-sell rails shipped that was a property of the component tree
 * rather than of any rule: `ProductCard` was only ever rendered by Server Components, so nothing
 * it imported was ever compiled into a client bundle.
 *
 * `CrossSellRow` is a Client Component and renders `ProductGrid`, which renders `ProductCard`.
 * Every module reachable from it is now compiled into a browser bundle too — so the day someone
 * imports `getPrimaryImage` from `@/lib/products` in `ProductCard` instead of from
 * `@/lib/product-view`, the whole catalogue follows it into `/cart` and `/order-confirmation`,
 * `next build` still succeeds, and the only symptom is a page that is a megabyte heavier and
 * quietly ships every product's margin.
 *
 * This asserts the boundary directly, the way `lib/notify-boundary.test.ts` asserts the CallMeBot
 * key's: no file declaring `"use client"` may reach the catalogue at any depth. See
 * [ADR-072](/docs/decisions/ADR-072-checkout-flow-polish.md).
 */

const SCANNED_ROOTS = ["app", "components", "lib"];

/**
 * The two modules that hold the catalogue. `lib/products.ts` imports the JSON at module scope,
 * so reaching either is reaching all 449 records.
 */
const CATALOGUE_MODULES = new Set(["lib/products.ts", "data/products.json"]);

/**
 * The admin panel is out of scope, and deliberately.
 *
 * The catalogue editor is a different feature with a different boundary
 * (`lib/product-repository-boundary.test.ts` owns that one) and a different audience: an
 * authenticated operator on `admin.morchadigems.com`, for whom putting product records in the
 * browser is the entire point of the screen.
 */
const ADMIN_PREFIXES = [
  join("app", "admin"),
  join("components", "Admin"),
  join("lib", "admin-"),
];

function collectSourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    if (path.includes(".test.")) return [];
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

function isAdminModule(path: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isClientModule(source: string): boolean {
  return /^\s*["']use client["']/m.test(source);
}

/**
 * Import specifiers, **excluding `import type`**. A type-only import is erased before any
 * bundler sees it, so a client module naming `ProductCardView`'s home in a type position drags
 * nothing with it.
 */
function valueImportsOf(source: string): string[] {
  const specifiers: string[] = [];
  const importPattern = /(^|\n)\s*import\s+(?!type\s)([\s\S]*?)from\s+"([^"]+)"/g;

  let match = importPattern.exec(source);
  while (match !== null) {
    specifiers.push(match[3]);
    match = importPattern.exec(source);
  }

  return specifiers;
}

function resolveLocalImport(specifier: string): string | null {
  if (!specifier.startsWith("@/")) return null;

  const base = specifier.slice(2);
  for (const extension of ["", ".ts", ".tsx", ".json"]) {
    const candidate = `${base}${extension}`;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

/** Every local module reachable from `entry` through value imports, and how it was reached. */
function collectReachable(entry: string): Map<string, string[]> {
  const reachedBy = new Map<string, string[]>([[entry, [entry]]]);
  const queue = [entry];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const trail = reachedBy.get(current) ?? [current];

    let source: string;
    try {
      source = readFileSync(current, "utf8");
    } catch {
      continue;
    }

    for (const specifier of valueImportsOf(source)) {
      const resolved = resolveLocalImport(specifier);
      if (resolved === null || reachedBy.has(resolved)) continue;

      reachedBy.set(resolved, [...trail, resolved]);
      queue.push(resolved);
    }
  }

  return reachedBy;
}

const clientModules = SCANNED_ROOTS.flatMap(collectSourceFiles)
  .filter((path) => !isAdminModule(path))
  .filter((path) => isClientModule(readFileSync(path, "utf8")));

describe("the catalogue's client boundary", () => {
  it("finds the client modules it is supposed to be checking", () => {
    expect(clientModules).toContain(join("components", "CrossSellRow.tsx"));
    expect(clientModules).toContain(join("components", "CartView.tsx"));
  });

  it("lets no shopper-facing client module reach data/products.json", () => {
    const offenders = clientModules.flatMap((entry) => {
      const reachable = collectReachable(entry);
      return Array.from(reachable.entries())
        .filter(([path]) => CATALOGUE_MODULES.has(path))
        .map(([, trail]) => trail.join(" -> "));
    });

    expect(offenders).toEqual([]);
  });

  it("keeps ProductCard's projections in the module that holds no catalogue", () => {
    const productCard = readFileSync(join("components", "ProductCard.tsx"), "utf8");

    expect(productCard).toContain('from "@/lib/product-view"');
    expect(productCard).not.toContain('from "@/lib/products"');

    const productView = readFileSync(join("lib", "product-view.ts"), "utf8");
    expect(valueImportsOf(productView)).not.toContain("@/data/products.json");
    expect(valueImportsOf(productView)).not.toContain("@/lib/products");
  });
});
