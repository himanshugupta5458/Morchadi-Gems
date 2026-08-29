import type { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/admin-order-api";
import {
  readExpectedVersion,
  readProductEdit,
  runAdminProductAction,
} from "@/lib/admin-product-api";
import { productRepository } from "@/lib/product-repository";
import type { AdminProductActionResponseBody } from "@/types/admin-product";

/** Node, not Edge: this handler reads and rewrites a file. */
export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Saves one product's record — all three tabs of the edit form, in one request.
 *
 * `PATCH` because it replaces the editable fields of an existing record and creates nothing: this
 * endpoint cannot add a product, and the id in the URL must already be in the catalogue or the
 * answer is a 404. It is also not a method a cross-site `<form>` can issue, which sits alongside
 * the JSON content type and the `SameSite=Lax` cookie in keeping this reachable only from the
 * panel.
 *
 * **The handler performs no write itself.** It resolves the session, coerces the body into the
 * shape of an edit, and hands both to `productRepository.updateProduct`, which is the only code in
 * this repository that opens `data/products.json` for writing. That indirection is the point:
 * when the catalogue moves to Postgres this file does not change
 * ([ADR-064](/docs/decisions/ADR-064-admin-product-management.md)).
 *
 * Everything the request says is untrusted, and the repository re-derives every decision from the
 * file rather than from the body — whether the product exists, whether it has moved since the form
 * was rendered, and whether the resulting catalogue still passes the rules the build enforces. The
 * id comes from the URL and never from the body, so a request cannot name one product and edit
 * another.
 *
 * `runAdminProductAction` carries the session check and the error boundary, so a Postgres outage
 * during session resolution answers the typed rejection this endpoint's contract describes rather
 * than crashing into a bare 500 (ADR-048).
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse<AdminProductActionResponseBody>> {
  return runAdminProductAction(params.id, async () => {
    const body = await readJsonObject(request);

    return productRepository.updateProduct({
      id: params.id,
      edit: readProductEdit(body),
      expectedVersion: readExpectedVersion(body),
    });
  });
}
