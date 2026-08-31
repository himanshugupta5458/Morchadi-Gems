import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_COOKIE,
  decideAdminRoute,
  resolveAdminProductActionHref,
  resolveAdminProductHref,
  resolveAdminProductsHref,
} from "@/lib/admin-routing";
import type { ProductUpdateOutcome } from "@/lib/product-repository";
import type { Product } from "@/types/product";
import { DEFAULT_ADMIN_HOSTNAME } from "@/lib/admin-routing";

const PRODUCT_ID = "P001";
const ADMIN_HOSTNAME = DEFAULT_ADMIN_HOSTNAME;

/**
 * The session this test grants or withholds. `null` is a request with no live session, which is
 * the case the endpoint must refuse before it reads anything.
 */
let signedInAdmin: { id: string; username: string } | null = null;

/** What the stubbed repository answers, and what it was asked. */
let nextOutcome: ProductUpdateOutcome = { kind: "NOT_FOUND" };
const updateProduct = vi.fn(async () => nextOutcome);

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined }),
  headers: () => ({ get: () => null }),
}));

vi.mock("@/lib/admin-session", () => ({
  readAdminSessionFromRequest: async () => signedInAdmin,
}));

/**
 * The repository is stubbed here on purpose, and it is the only thing that is.
 *
 * What this file tests is the *handler* — that it refuses an unauthenticated request before
 * touching the catalogue, that it takes the id from the URL rather than from the body, that a
 * malformed body cannot crash it, and that each outcome becomes the right HTTP status. What the
 * repository actually does with a valid edit is `lib/product-repository.test.ts`, against a real
 * catalogue on disk, because that is where a write either happens or does not.
 */
vi.mock("@/lib/product-repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/product-repository")>();
  return { ...actual, productRepository: { updateProduct } };
});

async function patch(body: unknown, id: string = PRODUCT_ID): Promise<Response> {
  const { PATCH } = await import("@/app/admin/api/products/[id]/route");

  return PATCH(
    new Request(`http://localhost:3000/admin/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: { id } },
  );
}

function productFixture(): Product {
  return {
    id: PRODUCT_ID,
    name: "Wave Band Initial Ring",
    category: "rings",
    status: "active",
    pricing: { price: 210, mrp: 299, cost: 126, minPrepaidAmount: 0 },
    media: { images: [`/products/${PRODUCT_ID}.webp`] },
    specs: { material: "Gold-plated brass" },
    description: "A gold-tone band.",
    seo: {
      primaryKeyword: "wave band ring",
      secondaryKeywords: [],
      metaTitle: "Wave Band Initial Ring in a Gold-Plated Adjustable Fit",
      metaDescription: "A gold-plated wave band initial ring on an adjustable fit.",
      imageAlt: "Gold-tone wave band ring",
      ogTitle: "Wave Band Initial Ring",
      ogDescription: "A gold-plated wave band.",
      ogImage: `/products/${PRODUCT_ID}.webp`,
    },
    stock: { inStock: true, quantity: 10 },
    flags: { featured: false, isNew: true, badge: null },
  };
}

beforeEach(() => {
  signedInAdmin = { id: "admin-1", username: "owner" };
  nextOutcome = { kind: "NOT_FOUND" };
  updateProduct.mockClear();
});

afterEach(() => {
  signedInAdmin = null;
});

describe("where the product save lives", () => {
  it("hides the /admin prefix on the admin hostname and keeps it everywhere else", () => {
    expect(resolveAdminProductActionHref(ADMIN_HOSTNAME, PRODUCT_ID)).toBe(
      `/api/products/${PRODUCT_ID}`,
    );
    expect(resolveAdminProductActionHref("localhost", PRODUCT_ID)).toBe(
      `/admin/api/products/${PRODUCT_ID}`,
    );
  });

  it("keys the save on the same id the list links a row with", () => {
    expect(resolveAdminProductHref("localhost", PRODUCT_ID)).toBe(
      `/admin/products/${PRODUCT_ID}`,
    );
    expect(resolveAdminProductsHref(ADMIN_HOSTNAME)).toBe("/products");
  });

  /**
   * The endpoint changes data, so unlike login and logout it is not in the middleware's public
   * list: a browser with no session cookie never reaches the handler at all.
   */
  it("is behind the middleware gate on both hostnames", () => {
    expect(
      decideAdminRoute({
        hostname: ADMIN_HOSTNAME,
        pathname: `/api/products/${PRODUCT_ID}`,
        hasSessionCookie: false,
      }),
    ).toMatchObject({ kind: "redirect" });

    expect(
      decideAdminRoute({
        hostname: "localhost",
        pathname: `/admin/api/products/${PRODUCT_ID}`,
        hasSessionCookie: false,
      }),
    ).toMatchObject({ kind: "redirect" });
  });

  it("lets a request carrying a session cookie through to the handler", () => {
    expect(
      decideAdminRoute({
        hostname: ADMIN_HOSTNAME,
        pathname: `/api/products/${PRODUCT_ID}`,
        hasSessionCookie: true,
      }),
    ).toMatchObject({ kind: "rewrite" });

    expect(ADMIN_SESSION_COOKIE).toBe("morchadi_admin_session");
  });
});

describe("the product save refuses an unauthenticated request", () => {
  it("answers 401 and never reaches the catalogue", async () => {
    signedInAdmin = null;

    const response = await patch({ edit: {}, expectedVersion: "abc" });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      status: "REJECTED",
      error: "UNAUTHENTICATED",
    });
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("does not let a body claim an identity", async () => {
    signedInAdmin = null;

    const response = await patch({
      edit: {},
      expectedVersion: "abc",
      admin: "owner",
      changedBy: "owner",
    });

    expect(response.status).toBe(401);
    expect(updateProduct).not.toHaveBeenCalled();
  });
});

describe("the product save maps every outcome to an honest status", () => {
  it("answers 200 and the new version when the record was written", async () => {
    nextOutcome = {
      kind: "UPDATED",
      product: productFixture(),
      advisories: ["P001: something worth saying"],
    };

    const response = await patch({ edit: {}, expectedVersion: "abc" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("UPDATED");
    expect(body.version).toEqual(expect.any(String));
    expect(body.advisories).toEqual(["P001: something worth saying"]);
  });

  it("answers 200 and UNCHANGED when the edit changed nothing", async () => {
    nextOutcome = { kind: "UNCHANGED", product: productFixture() };

    const response = await patch({ edit: {}, expectedVersion: "abc" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "UNCHANGED" });
  });

  it("answers 404 for an id the catalogue does not hold", async () => {
    nextOutcome = { kind: "NOT_FOUND" };

    const response = await patch({ edit: {}, expectedVersion: "abc" }, "P000");

    expect(response.status).toBe(404);
  });

  /**
   * The failures travel to the browser verbatim. An operator reading the panel and an operator
   * reading a failed build should be reading the same sentence.
   */
  it("answers 422 and lists every rule a rejected edit broke", async () => {
    nextOutcome = {
      kind: "REJECTED",
      error: "VALIDATION_FAILED",
      message: "That edit would break a rule the catalogue is built on",
      failures: [
        "P001: pricing.price must be a positive whole number of rupees",
        "P001: seo.metaTitle is 9 characters, outside the 50-60 range a search result renders",
      ],
    };

    const response = await patch({ edit: {}, expectedVersion: "abc" });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.failures).toHaveLength(2);
    expect(body.failures[0]).toContain("pricing.price must be a positive whole number");
  });

  it("answers 409 when the record moved under the operator", async () => {
    nextOutcome = {
      kind: "REJECTED",
      error: "CONCURRENT_CHANGE",
      message: "This product changed on disk after this form was opened",
      failures: [],
    };

    expect((await patch({ edit: {}, expectedVersion: "stale" })).status).toBe(409);
  });

  it("answers 503 on a deployment whose catalogue is compiled in", async () => {
    nextOutcome = {
      kind: "REJECTED",
      error: "WRITES_DISABLED",
      message: "This deployment serves a catalogue compiled into the build",
      failures: [],
    };

    const response = await patch({ edit: {}, expectedVersion: "abc" });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "WRITES_DISABLED" });
  });
});

describe("the product save trusts the URL and not the body", () => {
  it("edits the product the URL names, whatever the body says", async () => {
    nextOutcome = { kind: "UNCHANGED", product: productFixture() };

    await patch({ id: "P999", edit: { name: "x" }, expectedVersion: "abc" }, "P042");

    expect(updateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: "P042", expectedVersion: "abc" }),
    );
  });

  it("survives a body that is not JSON at all", async () => {
    nextOutcome = { kind: "UNCHANGED", product: productFixture() };

    const response = await patch("this is not json");

    expect(response.status).toBe(200);
    expect(updateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: PRODUCT_ID, expectedVersion: "" }),
    );
  });

  /**
   * A body that sends the wrong *shape* must be refused by the catalogue's rules rather than
   * crash the handler — `applyProductEdit` spreads `options` and reads `Object.keys` on
   * `variantImages`, and a string in either place would be a `TypeError` instead of a 422.
   */
  it("coerces a hostile shape into something the validator can judge", async () => {
    nextOutcome = { kind: "UNCHANGED", product: productFixture() };

    const response = await patch({
      edit: {
        name: 42,
        options: "not an array",
        variantImages: "not an object",
        specs: [],
        pricing: "not an object",
        seo: { secondaryKeywords: "not an array" },
        flags: null,
      },
      expectedVersion: "abc",
    });

    expect(response.status).toBe(200);

    const [request] = updateProduct.mock.calls[0] as unknown as [
      { edit: { options: unknown[]; variantImages: object; seo: { secondaryKeywords: unknown[] } } },
    ];

    expect(Array.isArray(request.edit.options)).toBe(true);
    expect(Array.isArray(request.edit.seo.secondaryKeywords)).toBe(true);
    expect(typeof request.edit.variantImages).toBe("object");
  });

  /**
   * The values themselves are *not* coerced. A price of `"210"` reaches the repository as the
   * string it was sent as, so the catalogue's own rule is what rejects it — building a quieter
   * parallel check here is the thing this feature was told not to do.
   */
  it("passes values through untouched for the real rules to judge", async () => {
    nextOutcome = { kind: "UNCHANGED", product: productFixture() };

    await patch({
      edit: { pricing: { price: "210", mrp: 299, cost: null, minPrepaidAmount: 0.5 } },
      expectedVersion: "abc",
    });

    const [request] = updateProduct.mock.calls[0] as unknown as [
      { edit: { pricing: Record<string, unknown> } },
    ];

    expect(request.edit.pricing.price).toBe("210");
    expect(request.edit.pricing.cost).toBeNull();
    expect(request.edit.pricing.minPrepaidAmount).toBe(0.5);
  });
});
