/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignVariantImage,
  photographChoicesFor,
  tabForProductFailure,
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

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <span role="img" aria-label={alt} data-src={src} />
  ),
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
    expect(draft.options[0].values).toEqual(optioned.options?.[0].values);
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
    draft.options = [
      { name: "Colour", type: "swatch", values: ["Gold", "Silver"], default: "Gold" },
    ];
    draft.variantImages = [{ key: "Colour:Gold", image: "/products/P001-gold.webp" }];

    expect(variantImageRowsFor(draft)).toEqual([
      { key: "Colour:Gold", image: "/products/P001-gold.webp" },
      { key: "Colour:Silver", image: "" },
    ]);
  });

  it("forgets a variant image whose option value no longer exists", () => {
    const draft = toProductDraft(catalogue[0]);
    draft.options = [{ name: "Colour", type: "swatch", values: ["Gold"], default: "Gold" }];
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

  /**
   * The picker made "Primary" a thing you can click, so the old assertion — that no control is
   * labelled Primary — now means the opposite of what it was written to mean. What has to stay
   * true is narrower and is the actual boundary: no field on this screen holds an image path, so
   * `media.images` cannot be edited, only chosen from.
   */
  it("lists the photographs without offering to change them", () => {
    renderForm(catalogue[0]);

    fireEvent.click(screen.getByRole("button", { name: "Variants & media" }));

    expect(screen.getByText(catalogue[0].media.images[0])).toBeTruthy();

    const typedFields = screen.queryAllByRole("textbox") as HTMLInputElement[];
    for (const image of catalogue[0].media.images) {
      expect(typedFields.some((field) => field.value === image)).toBe(false);
    }
  });
});

/**
 * The record the picker was designed around: seven colour values, eight of the product's own
 * photographs, and six variant photographs that are in **none** of them. Before the redesign every
 * one of those six was a path typed into a text box; a picker offering only `media.images` would
 * have shown all six as unassigned and the first save would have made that true.
 */
const PICKER_PRODUCT_ID = "P586";

function pickerProduct(): Product {
  const product = catalogue.find((candidate) => candidate.id === PICKER_PRODUCT_ID);
  if (product === undefined) throw new Error(`${PICKER_PRODUCT_ID} is not in the catalogue`);
  return product;
}

function openVariantsTab(): void {
  fireEvent.click(screen.getByRole("button", { name: "Variants & media" }));
}

/**
 * The `media.variantImages` the **pre-redesign** form would have produced for one set of choices,
 * reimplemented here rather than imported.
 *
 * Importing today's helper and comparing it with itself would prove nothing. This is the old
 * mechanism written out: rows derived from the option's values as newline-separated text, each
 * carrying whatever path was typed into it, and the blank ones dropped. The picker is a UI over
 * the same map, so the bytes it sends must match this exactly — key order included.
 */
function variantImagesTheTypedFormWouldHaveSent(
  product: Product,
  typed: Record<string, string>,
): Record<string, string> {
  const variantImages: Record<string, string> = {};

  for (const option of product.options ?? []) {
    const values = option.values
      .join("\n")
      .split("\n")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    for (const value of values) {
      const key = `${option.name}:${value}`;
      const path = typed[key] ?? product.media.variantImages?.[key] ?? "";
      if (path.trim() !== "") variantImages[key] = path.trim();
    }
  }

  return variantImages;
}

async function submittedVariantImages(): Promise<Record<string, string>> {
  fireEvent.click(screen.getByRole("button", { name: "Save product" }));
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  return lastSubmittedBody().edit.variantImages as Record<string, string>;
}

describe("pairing an option value with a photograph", () => {
  it("offers every photograph on the record, not only the ones in media.images", () => {
    const product = pickerProduct();
    renderForm(product);
    openVariantsTab();

    const group = screen.getByRole("group", { name: "Color: Combo" });
    const choices = within(group).getAllByRole("radio");

    expect(photographChoicesFor(product)).toHaveLength(
      product.media.images.length +
        Object.keys(product.media.variantImages ?? {}).length,
    );
    expect(choices).toHaveLength(photographChoicesFor(product).length + 1);
  });

  it("shows a value with no photograph of its own as using the default, not as blank", () => {
    renderForm(pickerProduct());
    openVariantsTab();

    const group = screen.getByRole("group", { name: "Color: Combo" });

    expect(within(group).getByRole("radio", { name: "Default photo" })).toHaveProperty(
      "checked",
      true,
    );
    expect(within(group).getByText(/no photograph of its own/i)).toBeTruthy();
  });

  it("shows a value that has one as pointing at that photograph", () => {
    renderForm(pickerProduct());
    openVariantsTab();

    const group = screen.getByRole("group", { name: "Color: Wine Red" });
    const selected = within(group)
      .getAllByRole("radio")
      .find((radio) => (radio as HTMLInputElement).checked) as HTMLInputElement;

    expect(selected.value).toBe("/products/P586-wine-red.webp");
  });

  it("assigns the photograph a click selects", async () => {
    const product = pickerProduct();
    renderForm(product);
    openVariantsTab();

    const group = screen.getByRole("group", { name: "Color: Combo" });
    fireEvent.click(within(group).getByRole("radio", { name: "View 3" }));

    expect(await submittedVariantImages()).toMatchObject({
      "Color:Combo": product.media.images[2],
    });
  });

  it("clears the pairing when the default is chosen again", async () => {
    renderForm(pickerProduct());
    openVariantsTab();

    const group = screen.getByRole("group", { name: "Color: Wine Red" });
    fireEvent.click(within(group).getByRole("radio", { name: "Default photo" }));

    expect(await submittedVariantImages()).not.toHaveProperty("Color:Wine Red");
  });

  /**
   * The regression this whole redesign had to not become. Every one of these six paths is outside
   * `media.images`, and a picker that could not name them would have deleted them all on the first
   * save of an unrelated field.
   */
  it("leaves an untouched record's mappings exactly as they were", async () => {
    const product = pickerProduct();
    renderForm(product);
    openVariantsTab();

    expect(await submittedVariantImages()).toEqual(product.media.variantImages);
  });

  it("sends byte-identical bytes to what the typed-path form would have sent", async () => {
    const product = pickerProduct();
    renderForm(product);
    openVariantsTab();

    const group = screen.getByRole("group", { name: "Color: Combo" });
    fireEvent.click(within(group).getByRole("radio", { name: "View 2" }));

    const sent = await submittedVariantImages();
    const legacy = variantImagesTheTypedFormWouldHaveSent(product, {
      "Color:Combo": product.media.images[1],
    });

    expect(JSON.stringify(sent)).toBe(JSON.stringify(legacy));
  });

  it("keeps a choice made on the variants tab across a visit to another tab", () => {
    const product = pickerProduct();
    renderForm(product);
    openVariantsTab();

    fireEvent.click(
      within(screen.getByRole("group", { name: "Color: Combo" })).getByRole("radio", {
        name: "View 4",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Basic details" }));
    openVariantsTab();

    const selected = within(screen.getByRole("group", { name: "Color: Combo" }))
      .getAllByRole("radio")
      .find((radio) => (radio as HTMLInputElement).checked) as HTMLInputElement;

    expect(selected.value).toBe(product.media.images[3]);
  });
});

describe("assignVariantImage", () => {
  it("writes one value's photograph and leaves the rest alone", () => {
    const draft = toProductDraft(pickerProduct());

    const rows = assignVariantImage(draft, "Color:Combo", "/products/P586-2.webp");

    expect(rows.find((row) => row.key === "Color:Combo")?.image).toBe(
      "/products/P586-2.webp",
    );
    expect(rows.find((row) => row.key === "Color:Wine Red")?.image).toBe(
      "/products/P586-wine-red.webp",
    );
  });

  it("cannot resurrect a mapping whose option value has been deleted", () => {
    const draft = toProductDraft(pickerProduct());
    draft.options = [{ name: "Color", type: "swatch", values: ["Combo"], default: "Combo" }];

    const rows = assignVariantImage(draft, "Color:Combo", "/products/P586-2.webp");

    expect(rows.map((row) => row.key)).toEqual(["Color:Combo"]);
  });
});

describe("editing an option's values", () => {
  it("gives every value its own field rather than one textarea", () => {
    renderForm(pickerProduct());
    openVariantsTab();

    expect(screen.getByLabelText("Value 1")).toHaveProperty("value", "Combo");
    expect(screen.getByLabelText("Value 2")).toHaveProperty("value", "Wine Red");
  });

  it("adds a photograph row for a value as soon as it is typed", () => {
    renderForm(pickerProduct());
    openVariantsTab();

    fireEvent.click(screen.getByRole("button", { name: "Add a value" }));
    fireEvent.change(screen.getByLabelText("Value 8"), { target: { value: "Sea Green" } });

    expect(screen.getByRole("group", { name: "Color: Sea Green" })).toBeTruthy();
  });

  it("takes the photograph row away with the value it belonged to", async () => {
    renderForm(pickerProduct());
    openVariantsTab();

    fireEvent.click(screen.getByRole("button", { name: "Remove value 2" }));

    expect(screen.queryByRole("group", { name: "Color: Wine Red" })).toBeNull();
    expect(await submittedVariantImages()).not.toHaveProperty("Color:Wine Red");
  });

  it("offers the default as a choice among the values rather than as free text", () => {
    renderForm(pickerProduct());
    openVariantsTab();

    const defaultControl = screen.getByLabelText("Default");

    expect(defaultControl.tagName).toBe("SELECT");
    expect(
      within(defaultControl).getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Choose a value", ...(pickerProduct().options?.[0].values ?? [])]);
  });
});

describe("the save bar", () => {
  it("is reachable from every tab", () => {
    renderForm(catalogue[0]);

    for (const tab of ["Basic details", "Variants & media", "Pricing & SEO"]) {
      fireEvent.click(screen.getByRole("button", { name: tab }));
      expect(screen.getByRole("button", { name: "Save product" })).toBeTruthy();
    }
  });

  it("says nothing is unsaved until something is", () => {
    renderForm(catalogue[0]);

    expect(screen.getByText(/Nothing unsaved/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Changed" } });

    expect(screen.getByText("Unsaved changes on this record.")).toBeTruthy();
  });

  it("stops saying so once the save has landed", async () => {
    renderForm(catalogue[0]);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await waitFor(() => expect(screen.getByText(/Nothing unsaved/)).toBeTruthy());
  });

  /**
   * Whitespace a trim would remove is not an unsaved change: the bytes the save would send are
   * identical, so claiming otherwise would train an operator to ignore the indicator.
   */
  it("does not count an edit the save would trim away", () => {
    renderForm(catalogue[0]);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: `${catalogue[0].name}  ` },
    });

    expect(screen.getByText(/Nothing unsaved/)).toBeTruthy();
  });
});

describe("a refused save points at the tab that holds the field", () => {
  it("sorts each rule onto the tab its field lives on", () => {
    expect(tabForProductFailure("P001: pricing.price must be a positive whole number")).toBe(
      "pricing",
    );
    expect(tabForProductFailure("P001: seo.metaTitle is 4 characters")).toBe("pricing");
    expect(tabForProductFailure("P001: specs.material must say how the metal is present")).toBe(
      "pricing",
    );
    expect(tabForProductFailure("P001: options[0].default is not one of its values")).toBe(
      "variants",
    );
    expect(tabForProductFailure("P001: media.variantImages names a missing file")).toBe(
      "variants",
    );
    expect(tabForProductFailure("P001: name must not be empty")).toBe("basic");
    expect(tabForProductFailure("P001: something nobody anticipated")).toBe("basic");
  });

  it("marks the tab on screen after the server refuses the save", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "REJECTED",
          error: "VALIDATION_FAILED",
          message: "That edit would break a rule the catalogue is built on.",
          failures: ["P001: seo.metaTitle is 4 characters, outside the 50-60 range"],
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    renderForm(catalogue[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save product" }));

    await screen.findByRole("alert");

    expect(
      screen.getByRole("button", { name: /Pricing & SEO/ }).textContent,
    ).toContain("has a refused rule");
    expect(
      screen.getByRole("button", { name: /Basic details/ }).textContent,
    ).not.toContain("has a refused rule");
  });
});
