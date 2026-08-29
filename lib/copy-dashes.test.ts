import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllProducts } from "@/lib/products";

const EM_DASH = "—";

/**
 * Three files render a lone em dash where a value is absent: `OrderTotals` for a total that is
 * not yet known, `AdminOrderTable` for an order with nothing owing on it, and `AdminProductTable`
 * for a product carrying no compare-at price and no merchandising flag. In all three it is a
 * typographic placeholder standing in for a value rather than prose, which is the only use of the
 * character this project allows. Everything else is copy somebody reads as a sentence.
 *
 * The admin columns are deliberately blank rather than `₹0` or "None": a column of zeroes is one
 * an operator learns to skip, and the few rows carrying a figure are the whole reason it exists.
 */
const PLACEHOLDER_FILES = new Set([
  "components/OrderTotals.tsx",
  "components/AdminOrderTable.tsx",
  "components/AdminProductTable.tsx",
]);

const SCANNED_ROOTS = ["app", "components", "lib", "config", "types"];
const SCANNED_EXTENSIONS = [".ts", ".tsx"];

function collectSourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    if (path.includes(".test.")) return [];
    return SCANNED_EXTENSIONS.some((extension) => path.endsWith(extension)) ? [path] : [];
  });
}

/**
 * Comments are documentation, not content: an em dash in a JSDoc block never reaches a page,
 * so stripping them is what keeps this from failing on prose written for the next agent.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<![:\w])\/\/[^\n]*/g, "");
}

describe("the em-dash sweep", () => {
  it("leaves no em dash in any catalogue string a shopper reads", () => {
    for (const product of getAllProducts()) {
      const shopperFacing = [
        product.name,
        product.description,
        ...Object.keys(product.specs),
        ...Object.values(product.specs),
        ...(product.options ?? []).flatMap((option) => [option.name, ...option.values]),
        product.seo.metaTitle,
        product.seo.metaDescription,
        product.seo.imageAlt,
        ...(product.seo.additionalImageAlts ?? []),
        product.seo.ogTitle,
        product.seo.ogDescription,
      ];

      for (const text of shopperFacing.filter(
        (value): value is string => value !== undefined,
      )) {
        expect(text, `${product.id}: ${text}`).not.toContain(EM_DASH);
      }
    }
  });

  it("leaves no em dash in any rendered source outside the one placeholder", () => {
    const offenders = SCANNED_ROOTS.flatMap(collectSourceFiles).filter(
      (path) =>
        !PLACEHOLDER_FILES.has(path) &&
        stripComments(readFileSync(path, "utf8")).includes(EM_DASH),
    );

    expect(offenders).toEqual([]);
  });
});
