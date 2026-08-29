import "server-only";
import { NextResponse } from "next/server";
import type { AdminIdentity } from "@/lib/admin-auth";
import { readAdminSessionFromRequest } from "@/lib/admin-session";
import { computeProductVersion, type ProductUpdateOutcome } from "@/lib/product-repository";
import type { AdminProductActionResponseBody, ProductEdit } from "@/types/admin-product";
import type {
  Category,
  ProductOption,
  ProductOptionType,
  ProductSpecs,
  ProductStatus,
  VariantImages,
} from "@/types/product";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const LOG_PREFIX = "[admin-product-action]";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The request body coerced into the *shape* of a `ProductEdit` — and no further.
 *
 * The distinction matters and is the whole design of this function. Structure is coerced here
 * because the alternative is a `TypeError`: `applyProductEdit` spreads `edit.options` and reads
 * `Object.keys(edit.variantImages)`, and a body that sends a string where an array belongs would
 * crash the handler rather than be refused by it.
 *
 * **Values are not coerced.** A price of `"210"`, a `featured` of `"yes"` and a category of
 * `"jewellery"` all travel through unchanged, so the thing that rejects them is
 * `scripts/product-record-rules.mjs` — the catalogue's own rules, in the words the build would
 * use. Coercing them here would build a second, quieter validation path, which is exactly what
 * this feature was told not to do: a `Number("abc")` that became `0` would save a zero-rupee price
 * that no rule ever objected to.
 *
 * The casts below are therefore deliberate and narrow: they assert the shape the type system needs
 * while leaving the value for the validator to judge. See
 * [ADR-064](/docs/decisions/ADR-064-admin-product-management.md).
 */
export function readProductEdit(body: Record<string, unknown>): ProductEdit {
  const edit = isPlainObject(body.edit) ? body.edit : {};

  const flags = isPlainObject(edit.flags) ? edit.flags : {};
  const stock = isPlainObject(edit.stock) ? edit.stock : {};
  const pricing = isPlainObject(edit.pricing) ? edit.pricing : {};
  const seo = isPlainObject(edit.seo) ? edit.seo : {};
  const specs = isPlainObject(edit.specs) ? edit.specs : {};
  const variantImages = isPlainObject(edit.variantImages) ? edit.variantImages : {};

  const options = Array.isArray(edit.options) ? edit.options : [];
  const secondaryKeywords = Array.isArray(seo.secondaryKeywords) ? seo.secondaryKeywords : [];
  const additionalImageAlts = Array.isArray(seo.additionalImageAlts)
    ? seo.additionalImageAlts
    : undefined;

  return {
    name: asString(edit.name),
    category: asString(edit.category) as Category,
    subcategory: typeof edit.subcategory === "string" ? edit.subcategory : null,
    description: asString(edit.description),
    status: asString(edit.status) as ProductStatus,
    flags: {
      featured: flags.featured as boolean,
      isNew: flags.isNew as boolean,
    },
    stock: { inStock: stock.inStock as boolean },
    options: options.map((option): ProductOption => {
      const group = isPlainObject(option) ? option : {};
      return {
        name: asString(group.name),
        type: asString(group.type) as ProductOptionType,
        values: Array.isArray(group.values) ? (group.values as string[]) : [],
        default: asString(group.default),
      };
    }),
    variantImages: variantImages as VariantImages,
    pricing: {
      price: pricing.price as number,
      mrp: pricing.mrp as number,
      cost: pricing.cost as number,
      minPrepaidAmount: pricing.minPrepaidAmount as number,
    },
    specs: specs as ProductSpecs,
    seo: {
      primaryKeyword: asString(seo.primaryKeyword),
      secondaryKeywords: secondaryKeywords as string[],
      metaTitle: asString(seo.metaTitle),
      metaDescription: asString(seo.metaDescription),
      imageAlt: asString(seo.imageAlt),
      ...(additionalImageAlts === undefined
        ? {}
        : { additionalImageAlts: additionalImageAlts as string[] }),
      ogTitle: asString(seo.ogTitle),
      ogDescription: asString(seo.ogDescription),
      ogImage: asString(seo.ogImage),
    },
  };
}

export function readExpectedVersion(body: Record<string, unknown>): string {
  return typeof body.expectedVersion === "string" ? body.expectedVersion : "";
}

/**
 * The 401 for a request that carried no live session.
 *
 * Middleware has already turned away anything without a session *cookie*, but a cookie is not a
 * session: it is checked here against Postgres, on the Node runtime, exactly as the protected
 * layout checks it before rendering a page. An endpoint that rewrites the catalogue may not be
 * satisfied by the cheaper gate.
 */
export function unauthorisedAdminProductResponse(): NextResponse<AdminProductActionResponseBody> {
  return NextResponse.json<AdminProductActionResponseBody>(
    { status: "REJECTED", error: "UNAUTHENTICATED", message: "Sign in again to make changes." },
    { status: 401, headers: NO_STORE },
  );
}

/**
 * One save's outcome as an HTTP answer.
 *
 * `409` is the record having moved under the operator, which is the one rejection that is not
 * about what they typed. `422` is an edit that broke a catalogue rule. `503` is the deployment
 * refusing to pretend a write would do anything — a distinct status because it is neither the
 * operator's fault nor a fault at all, it is this deployment's shape.
 */
export function respondToProductUpdateOutcome(
  outcome: ProductUpdateOutcome,
): NextResponse<AdminProductActionResponseBody> {
  if (outcome.kind === "UPDATED") {
    return NextResponse.json<AdminProductActionResponseBody>(
      {
        status: "UPDATED",
        version: computeProductVersion(outcome.product),
        advisories: outcome.advisories,
      },
      { status: 200, headers: NO_STORE },
    );
  }

  if (outcome.kind === "UNCHANGED") {
    return NextResponse.json<AdminProductActionResponseBody>(
      { status: "UNCHANGED", version: computeProductVersion(outcome.product), advisories: [] },
      { status: 200, headers: NO_STORE },
    );
  }

  if (outcome.kind === "NOT_FOUND") {
    return NextResponse.json<AdminProductActionResponseBody>(
      { status: "REJECTED", error: "NOT_FOUND", message: "That product is not in the catalogue." },
      { status: 404, headers: NO_STORE },
    );
  }

  const statusByError: Record<string, number> = {
    CONCURRENT_CHANGE: 409,
    VALIDATION_FAILED: 422,
    WRITES_DISABLED: 503,
    STORAGE_ERROR: 500,
  };

  return NextResponse.json<AdminProductActionResponseBody>(
    {
      status: "REJECTED",
      error: outcome.error,
      message: outcome.message,
      failures: outcome.failures,
    },
    { status: statusByError[outcome.error] ?? 422, headers: NO_STORE },
  );
}

function unexpectedProductFailureResponse(): NextResponse<AdminProductActionResponseBody> {
  return NextResponse.json<AdminProductActionResponseBody>(
    {
      status: "REJECTED",
      error: "SERVER_ERROR",
      message:
        "Something went wrong on the server, so nothing about this product was changed. Try again. If it keeps failing, the server log has the detail.",
    },
    { status: 500, headers: NO_STORE },
  );
}

/**
 * The session check and the error boundary the product endpoint runs inside, mirroring
 * `runAdminOrderAction`.
 *
 * The boundary wraps the session resolution as well as the write, which is the half that is easy
 * to miss: `readAdminSessionFromRequest` resolves the cookie **against Postgres**, so a database
 * that is down fails there first, before the handler body has run. A boundary that started after
 * the session was resolved would catch nothing on the outage it exists for (ADR-048).
 *
 * A failure here is loud, and the sentence it produces is safe to print: every path in
 * `updateProduct` either renames a complete file over the old one or writes nothing at all, so
 * "nothing about this product was changed" is a guarantee rather than a reassurance.
 */
export async function runAdminProductAction(
  productId: string,
  performAction: (admin: AdminIdentity) => Promise<ProductUpdateOutcome>,
): Promise<NextResponse<AdminProductActionResponseBody>> {
  try {
    const admin = await readAdminSessionFromRequest();
    if (admin === null) return unauthorisedAdminProductResponse();

    return respondToProductUpdateOutcome(await performAction(admin));
  } catch (actionError) {
    console.error(`${LOG_PREFIX} saving product ${productId} failed`, actionError);
    return unexpectedProductFailureResponse();
  }
}
