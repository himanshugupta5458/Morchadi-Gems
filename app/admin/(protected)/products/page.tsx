import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  ADMIN_PRODUCT_VIEWS,
  ADMIN_PRODUCT_VIEW_LABELS,
  buildAdminProductsHref,
  hasActiveAdminProductFilters,
  matchesAdminProductView,
  parseAdminProductQuery,
  selectAdminProductPage,
  type AdminProductSearchParams,
} from "@/lib/admin-products";
import {
  resolveAdminProductHref,
  resolveAdminProductsHref,
  resolveRequestHostname,
} from "@/lib/admin-routing";
import { isCatalogueWriteEnabled, productRepository } from "@/lib/product-repository";
import type { Product } from "@/types/product";
import { AdminCatalogueError } from "@/components/AdminCatalogueError";
import { AdminProductFilters } from "@/components/AdminProductFilters";
import { AdminProductPagination } from "@/components/AdminProductPagination";
import { AdminProductTable } from "@/components/AdminProductTable";
import { AdminProductTabs } from "@/components/AdminProductTabs";
import { CataloguePublishNotice } from "@/components/CataloguePublishNotice";

/**
 * Never prerendered and never cached. The rows change whenever a product is edited — often from
 * this very panel — and a cached list is a list that hides the change the operator just made.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

/**
 * The product list — the panel's second screen, and the first one in this project that reads the
 * catalogue rather than Postgres.
 *
 * It is a Server Component that calls `productRepository` directly. There is no API route between
 * the two and there does not need to be: the request is already authenticated by
 * `app/admin/(protected)/layout.tsx`, which resolves the session cookie against Postgres before
 * this function runs. Adding a route would mean re-establishing that same session inside a second
 * handler — a second auth mechanism for one page, which ADR-041 exists to avoid. The write path
 * *is* a route, because a write is not a render.
 *
 * **It does not import `data/products.json` and it does not call `lib/products.ts`.** Every
 * record on this page comes through `ProductRepository`, which is what makes the eventual move to
 * Postgres a swap of one class rather than a rewrite of this page
 * ([ADR-064](/docs/decisions/ADR-064-admin-product-management.md)).
 *
 * The whole of the list's state — view, filters, sort, page — is in the URL, and nothing on this
 * page ships JavaScript to the browser.
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: AdminProductSearchParams;
}): Promise<JSX.Element> {
  const hostname = resolveRequestHostname((name) => headers().get(name));
  const productsHref = resolveAdminProductsHref(hostname);
  const query = parseAdminProductQuery(searchParams);

  let catalogue: Product[];

  try {
    catalogue = await productRepository.listProducts();
  } catch (listError) {
    console.error("[admin-panel] the catalogue could not be read", listError);
    return <AdminCatalogueError what="The product list" />;
  }

  const productPage = selectAdminProductPage(catalogue, query);
  const { rows, totalCount, page, pageCount, pageSize } = productPage;

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const isFiltered = hasActiveAdminProductFilters(query);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-heading text-ink">Products</h1>
        <p className="text-body-sm text-muted">
          Every record in the catalogue. Live is what a shopper can buy today; Out of stock is
          published but unbuyable; Draft is written but not published.
        </p>
      </div>

      <CataloguePublishNotice writesEnabled={isCatalogueWriteEnabled()} />

      <AdminProductTabs
        tabs={ADMIN_PRODUCT_VIEWS.map((view) => ({
          view,
          label: ADMIN_PRODUCT_VIEW_LABELS[view],
          href: buildAdminProductsHref(productsHref, query, { view }),
          isCurrent: view === query.view,
          count: catalogue.filter((product) => matchesAdminProductView(product, view)).length,
        }))}
      />

      <AdminProductFilters
        action={productsHref}
        query={query}
        clearHref={
          isFiltered
            ? buildAdminProductsHref(productsHref, query, {
                category: null,
                priceBand: null,
                flag: null,
                search: "",
              })
            : null
        }
      />

      {rows.length === 0 ? (
        <p className="border border-line px-6 py-10 text-center text-body-sm text-muted">
          {isFiltered
            ? "No products match these filters. Clear them to see the whole catalogue."
            : `No ${ADMIN_PRODUCT_VIEW_LABELS[query.view].toLowerCase()} products.`}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <AdminProductTable
            rows={rows}
            buildProductHref={(productId) => resolveAdminProductHref(hostname, productId)}
          />
          <AdminProductPagination
            page={page}
            pageCount={pageCount}
            totalCount={totalCount}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            hrefForPage={(target) =>
              buildAdminProductsHref(productsHref, query, { page: target })
            }
          />
        </div>
      )}
    </div>
  );
}
