import type {
  Category,
  ProductFlags,
  ProductOption,
  ProductPricing,
  ProductSeo,
  ProductSpecs,
  ProductStatus,
  ProductStock,
  VariantImages,
} from "@/types/product";

/**
 * Every field the admin panel may change about a product, all of them present on every save.
 *
 * It lives in `/types` rather than beside the repository for the reason `types/admin-order.ts`
 * gives: `lib/product-repository.ts` is `server-only`, and the tabbed edit form is a
 * `"use client"` file that needs to know the shape it is building. A type imported from a
 * server-only module into a client component is a build error.
 *
 * **Deliberately not `Partial<Product>`.** A partial makes "absent" ambiguous — it can mean
 * "leave this alone" or "clear this" — and the two readings differ for exactly the fields most
 * worth getting right: `subcategory`, `options` and `variantImages` are all legitimately absent
 * on a real record, so a partial merge could never tell "the operator removed the last option"
 * from "the form did not mention options". A complete edit says what the record should be, and
 * the repository decides which keys that means writing.
 *
 * What is *not* here is the access rule: `id`, `media.images`, `collections` and
 * `migrationProvenance` are absent because nothing in this feature may change them. An id is the
 * owner's P-code, image files are out of scope for this surface, and provenance is a historical
 * fact about where a record came from. See
 * [ADR-064](/docs/decisions/ADR-064-admin-product-management.md).
 */
export interface ProductEdit {
  name: string;
  category: Category;
  /** `null` removes the key; the field is optional on the record and blank is not a value. */
  subcategory: string | null;
  description: string;
  status: ProductStatus;
  flags: ProductFlags;
  stock: ProductStock;
  /** An empty array removes the key — a product sold in one configuration has no `options`. */
  options: ProductOption[];
  /** An empty object removes the key, on the same reasoning as `options`. */
  variantImages: VariantImages;
  pricing: ProductPricing;
  specs: ProductSpecs;
  seo: ProductSeo;
}

/**
 * The one response shape the product save answers with, shared by the route handler that produces
 * it and the form that reads it.
 *
 * `failures` is the field that makes this different from `AdminOrderActionResponseBody`. An order
 * action is refused for one reason and says one sentence; a catalogue edit can break several
 * rules at once, and the operator needs all of them — in the gate's own words, so that what the
 * panel says and what a failed build would say are the same text.
 */
export interface AdminProductActionResponseBody {
  status: "UPDATED" | "UNCHANGED" | "REJECTED";
  error?: string;
  message?: string;
  /** The rules that refused the save, verbatim from the catalogue validator. */
  failures?: string[];
  /** Rules the save broke that do not block it — a thin margin, a short description. */
  advisories?: string[];
  /**
   * The saved record's new version token, so the form can go on saving without a reload. Without
   * it the second consecutive edit would always be refused as a concurrent change — by the
   * operator's own first edit.
   */
  version?: string;
}

/** What a submitted save did, as the form needs to know it. */
export type AdminProductActionResult =
  | {
      ok: true;
      status: "UPDATED" | "UNCHANGED";
      version: string | null;
      advisories: string[];
    }
  | { ok: false; message: string; failures: string[] };
