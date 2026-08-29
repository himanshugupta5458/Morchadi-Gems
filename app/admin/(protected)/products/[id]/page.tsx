import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  resolveAdminProductActionHref,
  resolveAdminProductsHref,
  resolveRequestHostname,
} from "@/lib/admin-routing";
import {
  computeProductVersion,
  isCatalogueWriteEnabled,
  productRepository,
} from "@/lib/product-repository";
import type { Product } from "@/types/product";
import { AdminCatalogueError } from "@/components/AdminCatalogueError";
import { AdminProductForm } from "@/components/AdminProductForm";
import { CataloguePublishNotice } from "@/components/CataloguePublishNotice";

/**
 * Never prerendered and never cached. The record changes from this very page, and a cached copy
 * would show an operator the state they just left — and would hand the edit form a version token
 * that is already stale, turning their next save into a spurious conflict.
 */
export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return {
    title: `Product ${params.id}`,
    robots: { index: false, follow: false },
  };
}

/**
 * One product's whole record, editable.
 *
 * A Server Component for the read and a route handler for the write, which is the same split the
 * order detail page uses: rendering is already authenticated by the protected layout, and a write
 * is not a render. Both sides go through `productRepository` — this page never imports
 * `data/products.json` and never calls `lib/products.ts`
 * ([ADR-064](/docs/decisions/ADR-064-admin-product-management.md)).
 *
 * The version token is computed here, from the record this page is rendering, and travels into the
 * form. It is what the write path compares against the file at save time, so an edit made against
 * a page left open while the catalogue moved underneath is refused rather than silently
 * overwriting.
 *
 * A draft is editable here and reachable by URL, unlike on the storefront where it 404s. That is
 * the point of the status field: the panel is where an unpublished record is worked on.
 */
export default async function AdminProductPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const hostname = resolveRequestHostname((name) => headers().get(name));
  const productsHref = resolveAdminProductsHref(hostname);

  let product: Product | null;

  try {
    product = await productRepository.getProduct(params.id);
  } catch (readError) {
    console.error(`[admin-panel] product ${params.id} could not be read`, readError);
    return <AdminCatalogueError what="This product" />;
  }

  if (product === null) notFound();

  const writesEnabled = isCatalogueWriteEnabled();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href={productsHref}
          className="font-sans text-label uppercase tracking-caps text-muted underline underline-offset-4 transition-colors duration-250 hover:text-ink"
        >
          Back to products
        </Link>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-heading text-ink">{product.name}</h1>
          <span className="font-sans text-label uppercase tracking-caps text-muted">
            {product.id}
          </span>
        </div>

        <p className="text-body-sm text-muted">
          Every field on this record, across three tabs. Switching tabs keeps unsaved edits, and
          the save bar above them stays on screen and saves all three at once.
        </p>
      </div>

      <CataloguePublishNotice writesEnabled={writesEnabled} />

      <AdminProductForm
        actionHref={resolveAdminProductActionHref(hostname, product.id)}
        product={product}
        version={computeProductVersion(product)}
        writesEnabled={writesEnabled}
      />
    </div>
  );
}
