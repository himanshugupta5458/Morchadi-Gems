import { NextResponse } from "next/server";
import {
  isAdminProductListNarrowed,
  parseAdminProductQuery,
  selectMatchingAdminProducts,
  type AdminProductSearchParams,
} from "@/lib/admin-products";
import { readAdminSessionFromRequest } from "@/lib/admin-session";
import {
  PRODUCT_EXPORT_CONTENT_TYPE,
  productExportFilename,
  writeProductExportBuffer,
} from "@/lib/product-export";
import { productRepository } from "@/lib/product-repository";
import type { Product } from "@/types/product";

/** Node, not Edge: `xlsx` writes a binary workbook and needs a `Buffer`. */
export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const LOG_PREFIX = "[admin-product-export]";

function searchParamsFrom(request: Request): AdminProductSearchParams {
  const params: AdminProductSearchParams = {};
  new URL(request.url).searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/**
 * The product list as a downloaded `.xlsx`, replacing `scripts/export-live-products.mjs`.
 *
 * **It exports the list the operator is looking at, not a fixed set.** The query string is the one
 * the list page uses, parsed by the same `parseAdminProductQuery` and filtered by the same
 * `selectMatchingAdminProducts`, so "export" means exactly the rows the current view, filters,
 * search and sort select — every page of them, not the twenty-five on screen. An operator who has
 * just narrowed the list to the six out-of-stock pieces wants those six; the unfiltered default is
 * still the whole catalogue, which is what the standalone script produced
 * ([ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md)).
 *
 * A `GET`, because it creates nothing and changes nothing, which is what lets the button be an
 * ordinary link and keeps the list page free of client JavaScript.
 *
 * The session is resolved against Postgres here rather than trusted from middleware, exactly as
 * the save endpoint does it: middleware sees that *a* cookie was sent, and a forged one gets past
 * it. The whole catalogue including `pricing.cost` is in this file, so margin data leaving the
 * building on an unauthenticated request is the thing this check exists to prevent.
 */
export async function GET(request: Request): Promise<NextResponse | Response> {
  try {
    const admin = await readAdminSessionFromRequest();
    if (admin === null) {
      return NextResponse.json(
        { status: "REJECTED", error: "UNAUTHENTICATED", message: "Sign in again to export." },
        { status: 401, headers: NO_STORE },
      );
    }

    const query = parseAdminProductQuery(searchParamsFrom(request));

    let catalogue: Product[];
    try {
      catalogue = await productRepository.listProducts();
    } catch (readError) {
      console.error(`${LOG_PREFIX} the catalogue could not be read`, readError);
      return NextResponse.json(
        {
          status: "REJECTED",
          error: "CATALOGUE_UNAVAILABLE",
          message:
            "The catalogue could not be read, so nothing was exported. Check the server log.",
        },
        { status: 503, headers: NO_STORE },
      );
    }

    const selected = selectMatchingAdminProducts(catalogue, query);
    const filename = productExportFilename(isAdminProductListNarrowed(query), new Date());

    return new Response(new Uint8Array(writeProductExportBuffer(selected)), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": PRODUCT_EXPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Product-Export-Count": String(selected.length),
      },
    });
  } catch (exportError) {
    console.error(`${LOG_PREFIX} the export failed`, exportError);
    return NextResponse.json(
      {
        status: "REJECTED",
        error: "SERVER_ERROR",
        message: "The export could not be built. The server log has the detail.",
      },
      { status: 500, headers: NO_STORE },
    );
  }
}
