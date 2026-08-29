/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  toProductDraft,
  toProductEdit,
  variantImageRowsFor,
  type ProductDraft,
} from "@/lib/admin-product-form";
import { AdminProductForm } from "@/components/AdminProductForm";
import type { Product } from "@/types/product";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const catalogue = JSON.parse(
  readFileSync(join(process.cwd(), "data", "products.json"), "utf8"),
) as Product[];

const ACTION_HREF = "/admin/api/products/P001/route";

function renderForm(product: Product, writesEnabled = true): void {
  render(
    <AdminProductForm
      actionHref={ACTION_HREF}
      product={product}
      version="v1"
      writesEnabled={writesEnabled}
    />,
  );
}

/** The last body the form sent, parsed. */
function lastSubmittedBody(): { edit: Record<string, unknown>; expectedVersion: string } {
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    { body: string },
  ];
  return JSON.parse(init.body);
}

beforeEach(() => {
  refresh.mockClear();
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ status: "UPDATED", version: "v2", advisories: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
});

afterEach(cleanup);

/**
 * The transforms are checked against every record in the catalogue rather than a fixture, because
 * what they have to be is *lossless*: a form that dropped a spec key or reordered an option's
 * values on the way in and out would corrupt a record on the first save of an unrelated field.
 */
describe("a record survives the round trip through the form's state", () => {
  it("rebuilds every product in the catalogue unchanged", () => {
    const changed: string[] = [];

    for (const product of catalogue) {
      const edit = toProductEdit(toProductDraft(product));

      const matches =
        edit.name === product.name &&
        edit.category === product.category &&
        edit.description === product.description &&
        edit.status === product.status &&
        JSON.stringify(edit.pricing) === JSON.stringify(product.pricing) &&
        JSON.stringify(edit.specs) === JSON.stringify(product.specs) &&
        JSON.stringify(edit.options) === JSON.stringify(product.options ?? []) &&
        JSON.stringify(edit.variantImages) ===
          JSON.stringify(product.media.variantImages ?? {}) &&
        JSON.stringify(edit.flags) === JSON.stringify(product.flags) &&
        JSON.stringify(edit.stock) === JSON.stringify(product.stock) &&
        edit.subcategory === (product.subcategory ?? null);

      if (!matches) changed.push(product.id);
    }

    expect(changed).toEqual([]);
  });

  it("rebuilds every product's SEO block unchanged", () => {
    const changed: string[] = [];

    for (const product of catalogue) {
      const { seo } = toProductEdit(toProductDraft(product));
      if (JSON.stringify(seo) !== JSON.stringify(product.seo)) changed.push(product.id);
    }

    expect(changed).toEqual([]);
  });

  it("keeps an option's values in order and one per line", () => {
    const optioned = catalogue.find((product) => (product.options?.length ?? 0) > 0);
    expect(optioned).toBeDefined();
    if (optioned === undefined) return;

    const draft = toProductDraft(optioned);
    expect(draft.options[0].values.split("\n")).toEqual(optioned.options?.[0].values);
  });

  /**
   * A blank amount must not become a zero. It has to reach the server as something the
   * catalogue's real rule rejects, or the form has quietly saved a free product.
   */
  it("turns a blank amount into something the validator refuses, not into zero", () => {
    const draft: ProductDraft = { ...toProductDraft(catalogue[0]), price: "" };

    expect(toProductEdit(draft).pricing.price).toBeNaN();
    expect(JSON.parse(JSON.stringify(toProductEdit(draft))).pricing.price).toBeNull();
  });

  it("passes a non-integer amount through rather than rounding it", () => {
    const draft: ProductDraft = { ...toProductDraft(catalogue[0]), price: "210.5" };

    expect(toProductEdit(draft).pricing.price).toBe(210.5);
  });

  it("drops an unfilled spec row instead of saving a spec with no name", () => {
    const draft = toProductDraft(catalogue[0]);
    draft.specs = [...draft.specs, { key: "  ", value: "" }];

    expect(Object.keys(toProductEdit(draft).specs)).toEqual(
      Object.keys(catalogue[0].specs),
    );
  });

  it("derives variant image rows from the options currently in the draft", () => {
    const draft = toProductDraft(catalogue[0]);
    draft.options = [{ name: "Colour", type: "swatch", values: "Gold\nSilver", default: "Gold" }];
    draft.variantImages = [{ key: "Colour:Gold", image: "/products/P001-gold.webp" }];

    expect(variantImageRowsFor(draft)).toEqual([
      { key: "Colour:Gold", image: "/products/P001-gold.webp" },
      { key: "Colour:Silver", image: "" },
    ]);
  });

  it("forgets a variant image whose option value no longer exists", () => {
    const draft = toProductDraft(catalogue[0]);
    draft.options = [{ name: "Colour", type: "swatch", values: "Gold", default: "Gold" }];
    draft.variantImages = [{ key: "Colour:Bronze", image: "/products/P001-bronze.webp" }];

    expect(variantImageRowsFor(draft)).toEqual([{ key: "Colour:Gold", image: "" }]);
  });
});

/**
 * The property the tabbed design lives or dies on. State is held one level above the sections, so
 * unmounting a tab cannot take an edit with it — and a form that kept state in its inputs would
 * pass every other test in this file and still lose the operator's work on a tab change.
 */
describe("switching tabs keeps unsaved edits", () => {
  it("keeps an edit made on the first tab after visiting the third and coming back", () => {
    renderForm(catalogue[0]);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "A Renamed Ring" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Pricing & SEO" }));
    expect(screen.queryByLabelText("Name")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Basic details" }));
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "A Renamed Ring");
  });

  it("keeps edits made on two different tabs at once", () => {
    renderForm(catalogue[0]);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Tab One Edit" } });

    fireEvent.click(screen.getByRole("button", { name: "Pricing & SEO" }));
    fireEvent.change(screen.getByLabelText("Price"), { target: { value: "999" } });

    fireEvent.click(screen.getByRole("button", { name: "Basic details" }));
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Tab One Edit");

    fireEvent.click(screen.getByRole("button", { name: "Pricing & SEO" }));
    expect(screen.getByLabelText("Price")).toHaveProperty("value", "999");
  });

  it("keeps a checkbox toggled on a tab that has been left", () => {
    renderForm(catalogue[0]);

    const featured = screen.getByLabelText("Featured");
    const wasFeatured = (featured as HTMLInputElement).checked;
    fireEvent.click(featured);

    fireEvent.click(screen.getByRole("button", { name: "Variants & media" }));
    fireEvent.click(screen.getByRole("button", { name: "Basic details" }));

    expect(screen.getByLabelText("Featured")).toHaveProperty("checked", true);
    expect(wasFeatured).toBe(false);
  });
});

describe("saving sends every tab in one request", () => {
  it("submits edits made on all three tabs together", async () => {
    renderForm(catalogue[0]);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "One Save" } });

    fireEvent.click(screen.getByRole("button", { name: "Pricing & SEO" }));
    fireEvent.change(screen.getByLabelText("Price"), { target: { value: "444" } });
    fireEvent.change(screen.getByLabelText("Primary keyword"), {
      target: { value: "a fresh keyword" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const body = lastSubmittedBody();
    expect(body.expectedVersion).toBe("v1");
    expect(body.edit).toMatchObject({
      name: "One Save",
      pricing: expect.objectContaining({ price: 444 }),
      seo: expect.objectContaining({ primaryKeyword: "a fresh keyword" }),
    });
  });

  it("sends a PATCH as JSON, which a cross-site form cannot issue", async () => {
    renderForm(catalogue[0]);

    fireEvent.click(screen.getByRole("button", { name: "Save product" }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [href, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string> },
    ];

    expect(href).toBe(ACTION_HREF);
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  /**
   * Without adopting the version the save returned, an operator's second consecutive edit would
   * be refused as a concurrent change — by their own first one.
   */
  it("adopts the version the save returned, so a second edit is not a false conflict", async () => {
    renderForm(catalogue[0]);

    fireEvent.click(screen.getByRole("button", { name: "Save product" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Second Edit" } });
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(lastSubmittedBody().expectedVersion).toBe("v2"));
  });

  it("says where the change went and what still has to happen to publish it", async () => {
    renderForm(catalogue[0]);

    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    expect((await screen.findByRole("status")).textContent).toMatch(
      /Commit and redeploy to publish it/,
    );
  });
});

describe("a refused save", () => {
  it("shows every rule the edit broke, in the words the build would use", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "REJECTED",
          error: "VALIDATION_FAILED",
          message: "That edit would break a rule the catalogue is built on.",
          failures: [
            "P001: pricing.price must be a positive whole number of rupees",
            "P001: seo.metaTitle is 4 characters, outside the 50-60 range a search result renders",
          ],
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    renderForm(catalogue[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("pricing.price must be a positive whole number of rupees");
    expect(alert.textContent).toContain("outside the 50-60 range");
  });

  it("keeps the operator's edits on screen so nothing has to be retyped", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ status: "REJECTED", error: "VALIDATION_FAILED", failures: [] }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    renderForm(catalogue[0]);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Still Here" } });
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Still Here");
  });
});

describe("a deployment that cannot publish", () => {
  it("disables the save rather than accepting an edit it would discard", () => {
    renderForm(catalogue[0], false);

    expect(screen.getByRole("button", { name: "Save product" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByText(/serves a compiled catalogue/)).toBeTruthy();
  });
});

describe("what the form will not let an operator change", () => {
  it("shows the product code and the provenance as facts rather than fields", () => {
    const migrated = catalogue.find((product) => product.migrationProvenance !== undefined);
    expect(migrated).toBeDefined();
    if (migrated === undefined) return;

    renderForm(migrated);

    expect(screen.getByText(migrated.id)).toBeTruthy();
    expect(
      screen.getByText(`Odoo listing #${migrated.migrationProvenance?.originalId}`),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Product code")).toBeNull();
  });

  it("lists the photographs without offering to change them", () => {
    renderForm(catalogue[0]);

    fireEvent.click(screen.getByRole("button", { name: "Variants & media" }));

    expect(screen.getByText(catalogue[0].media.images[0])).toBeTruthy();
    expect(screen.queryByLabelText("Primary")).toBeNull();
  });
});
