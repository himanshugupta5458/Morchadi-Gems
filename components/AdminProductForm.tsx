"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { submitAdminProductEdit } from "@/lib/admin-product-client";
import {
  PRODUCT_FORM_TABS,
  PRODUCT_FORM_TAB_LABELS,
  assignVariantImage,
  photographChoicesFor,
  serialiseDraftForComparison,
  tabsWithProductFailures,
  toProductDraft,
  toProductEdit,
  variantImageRowsFor,
  type ProductDraft,
  type ProductFormTab,
  type ProductOptionDraft,
  type ProductSpecDraft,
} from "@/lib/admin-product-form";
import { buttonClasses } from "@/lib/button-styles";
import {
  CATEGORIES,
  PRODUCT_BADGES,
  PRODUCT_STATUSES,
  isProductBadge,
  type Product,
  type ProductBadge,
  type ProductStatus,
} from "@/types/product";
import { LOW_STOCK_THRESHOLD } from "@/lib/product-badge";
import { AdminProductOptionEditor } from "@/components/AdminProductOptionEditor";
import { AdminVariantImagePicker } from "@/components/AdminVariantImagePicker";
import { Button } from "@/components/Button";

const FIELD_CLASSES =
  "w-full border border-line bg-white px-3 py-2.5 font-sans text-body-sm text-ink transition-colors duration-250 focus:border-gold";

const FIELD_LABEL_CLASSES = "text-eyebrow uppercase tracking-caps-wide text-muted";

const HINT_CLASSES = "text-body-sm text-muted";

const SECTION_CLASSES = "flex flex-col gap-5 border border-line px-5 py-5";

const SECTION_TITLE_CLASSES = "font-sans text-label uppercase tracking-caps text-ink";

const NO_BADGE_VALUE = "none";

const BADGE_LABELS: Record<ProductBadge, string> = {
  trending: "Trending",
  bestseller: "Best Seller",
  new: "New",
};

function toBadgeChoice(value: string): ProductBadge | null {
  return isProductBadge(value) ? value : null;
}

/**
 * A labelled control, with any explanatory line kept **outside** the `<label>`.
 *
 * That placement is deliberate. A hint inside the label becomes part of the control's accessible
 * name, so a screen reader announces the whole paragraph every time focus lands on the field —
 * and "Minimum prepaid amount" turns into forty words about cash on delivery. Outside, the name
 * is the label and the hint is read as the surrounding text it is.
 */
function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL_CLASSES}>{label}</span>
        {children}
      </label>
      {hint === undefined ? null : <span className={HINT_CLASSES}>{hint}</span>}
    </div>
  );
}

function CheckboxField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="flex items-center gap-3 text-body-sm text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 shrink-0 accent-charcoal"
        />
        <span>{label}</span>
      </label>
      <span className={`${HINT_CLASSES} pl-7`}>{hint}</span>
    </div>
  );
}

/**
 * A fact about the record that this surface may not change, shown so an operator can see it
 * without being invited to edit it.
 */
function ReadOnlyFact({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-1.5">
      <span className={FIELD_LABEL_CLASSES}>{label}</span>
      <span className="text-body-sm text-ink">{children}</span>
    </div>
  );
}

export interface AdminProductFormProps {
  actionHref: string;
  product: Product;
  version: string;
  writesEnabled: boolean;
}

/**
 * The whole of one product's record, editable, across three tabs behind a save bar that never
 * leaves the screen.
 *
 * **One form, three tabs.** The tab control decides which section is on screen and nothing else:
 * every field belongs to the same `draft` state and the same submit, so switching tabs cannot lose
 * an edit and saving from any tab saves all three. Three separate forms with three save buttons
 * was the alternative and would have meant an operator who changed a price and a description could
 * save one and walk away from the other — and would have run the catalogue validator three times
 * on three partially-updated records, each of which could fail for the other's reasons.
 *
 * The inactive tabs are unmounted rather than hidden. The state they were editing lives here, one
 * level above them, which is what makes that safe — and testing it is worth doing precisely
 * because a form that kept state in its inputs would pass every other test and lose the operator's
 * work on a tab change.
 *
 * **The save bar is sticky, and the tabs are in it.** The tabs stayed; the save button moved. A
 * record this size is a long scroll on every tab, and a save button at the bottom of one of them
 * meant an operator with unsaved work had to remember they had it and then go and find the button.
 * The bar states both — whether anything is unsaved, and where to put it — from wherever they are.
 * The single-scrolling-page alternative was considered and rejected: it would have put a refused
 * rule an entire viewport away from the field it names, which is the problem the tab markers below
 * solve rather than create ([ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md)).
 *
 * **A refused save marks the tabs it came from.** The request is one save across three tabs, so a
 * rejection routinely names a field that is not on screen. `tabsWithProductFailures` maps each
 * rule back to the tab holding its field, so "meta title is 4 characters" is visibly a Pricing &
 * SEO problem rather than a hunt.
 *
 * **Nothing here is trusted.** The client-side checks are conveniences; the record is re-derived
 * and re-validated in the route handler against the same rules the build runs, because a control
 * this form does not render is still a field an authenticated `curl` can name (ADR-044). The save,
 * the version token and the CONCURRENT_CHANGE refusal are exactly the mechanics ADR-064 built —
 * this is their presentation, not a second copy of them.
 */
export function AdminProductForm({
  actionHref,
  product,
  version,
  writesEnabled,
}: AdminProductFormProps): JSX.Element {
  const router = useRouter();

  const [draft, setDraft] = useState<ProductDraft>(() => toProductDraft(product));
  const [tab, setTab] = useState<ProductFormTab>("basic");
  const [currentVersion, setCurrentVersion] = useState(version);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    serialiseDraftForComparison(toProductDraft(product)),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [advisories, setAdvisories] = useState<string[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const photographChoices = useMemo(() => photographChoicesFor(product), [product]);
  const variantRows = variantImageRowsFor(draft);
  const failedTabs = tabsWithProductFailures(failures);
  const hasUnsavedChanges = serialiseDraftForComparison(draft) !== savedSnapshot;

  function update(changes: Partial<ProductDraft>): void {
    setDraft((previous) => ({ ...previous, ...changes }));
    setSavedNote(null);
  }

  function updateOption(index: number, changes: Partial<ProductOptionDraft>): void {
    update({
      options: draft.options.map((option, position) =>
        position === index ? { ...option, ...changes } : option,
      ),
    });
  }

  function updateSpec(index: number, changes: Partial<ProductSpecDraft>): void {
    update({
      specs: draft.specs.map((spec, position) =>
        position === index ? { ...spec, ...changes } : spec,
      ),
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const submitted = serialiseDraftForComparison(draft);

    setIsSaving(true);
    setMessage(null);
    setFailures([]);

    const result = await submitAdminProductEdit(actionHref, {
      edit: toProductEdit(draft),
      expectedVersion: currentVersion,
    });

    setIsSaving(false);

    if (!result.ok) {
      setMessage(result.message);
      setFailures(result.failures);
      setAdvisories([]);
      return;
    }

    if (result.version !== null) setCurrentVersion(result.version);
    setSavedSnapshot(submitted);
    setAdvisories(result.advisories);
    setSavedNote(
      result.status === "UNCHANGED"
        ? "Nothing to save. The record already reads exactly like this."
        : "Saved to data/products.json. Commit and redeploy to publish it.",
    );
    router.refresh();
  }

  function saveBarNote(): string {
    if (!writesEnabled) return "This deployment serves a compiled catalogue, so saving is disabled here.";
    if (isSaving) return "Saving all three tabs in one request.";
    if (hasUnsavedChanges) return "Unsaved changes on this record.";
    return "Nothing unsaved. Saving writes all three tabs at once.";
  }

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-6">
      <div className="sticky top-0 z-20 flex flex-col gap-4 border-b border-line bg-white pb-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label="Product fields" className="flex flex-wrap items-center gap-6">
            {PRODUCT_FORM_TABS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-current={candidate === tab ? "true" : undefined}
                onClick={() => setTab(candidate)}
                className={
                  candidate === tab
                    ? "border-b-2 border-ink pb-1 font-sans text-label uppercase tracking-caps text-ink"
                    : "border-b-2 border-transparent pb-1 font-sans text-label uppercase tracking-caps text-muted transition-colors duration-250 hover:text-ink"
                }
              >
                {PRODUCT_FORM_TAB_LABELS[candidate]}
                {failedTabs.includes(candidate) ? (
                  <>
                    <span aria-hidden="true" className="pl-1.5 text-sale">
                      &bull;
                    </span>
                    <span className="sr-only"> (has a refused rule)</span>
                  </>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <span className={HINT_CLASSES}>{saveBarNote()}</span>
            <Button type="submit" size="sm" disabled={isSaving || !writesEnabled}>
              {isSaving ? "Saving…" : "Save product"}
            </Button>
          </div>
        </div>
      </div>

      {message === null ? null : (
        <div role="alert" className="flex flex-col gap-2 border border-sale/30 bg-sale/5 px-4 py-3.5">
          <p className="text-body-sm text-sale">{message}</p>
          {failures.length === 0 ? null : (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {failures.map((failure) => (
                <li key={failure} className="text-body-sm text-muted">
                  {failure}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {savedNote === null ? null : (
        <div role="status" className="flex flex-col gap-2 border border-line bg-ivory px-4 py-3.5">
          <p className="text-body-sm text-ink">{savedNote}</p>
          {advisories.length === 0 ? null : (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {advisories.map((advisory) => (
                <li key={advisory} className="text-body-sm text-muted">
                  {advisory}. Saved anyway; this one is a judgement call rather than a rule.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "basic" ? (
        <div className="flex flex-col gap-6">
          <section className={SECTION_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>Identity</h2>

            <FieldLabel label="Name">
              <input
                type="text"
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldLabel label="Category">
                <select
                  value={draft.category}
                  onChange={(event) =>
                    update({ category: event.target.value as ProductDraft["category"] })
                  }
                  className={FIELD_CLASSES}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel
                label="Subcategory"
                hint="Free text carried over from the source listing. Nothing renders it; leave it blank to remove it."
              >
                <input
                  type="text"
                  value={draft.subcategory}
                  onChange={(event) => update({ subcategory: event.target.value })}
                  className={FIELD_CLASSES}
                />
              </FieldLabel>
            </div>

            <FieldLabel
              label="Description"
              hint="Paragraphs separated by a blank line. The house range is 150–300 words."
            >
              <textarea
                rows={12}
                value={draft.description}
                onChange={(event) => update({ description: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>
          </section>

          <section className={SECTION_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>Publication and merchandising</h2>

            <FieldLabel
              label="Status"
              hint="A draft ships in the file and is validated like any other record, but no public surface renders, links, prices or sells it."
            >
              <select
                value={draft.status}
                onChange={(event) => update({ status: event.target.value as ProductStatus })}
                className={FIELD_CLASSES}
              >
                {PRODUCT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === "active" ? "Active (published)" : "Draft (not published)"}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <CheckboxField
              label="In stock"
              hint="Unticking it keeps the page up and shows the sold-out state; it does not unpublish the product."
              checked={draft.inStock}
              onChange={(next) => update({ inStock: next })}
            />

            <FieldLabel
              label="Quantity on the shelf"
              hint={`A whole number of pieces. Zero reads as sold out whatever the tick above says, and ${LOW_STOCK_THRESHOLD} or fewer puts "Only N left" on the card. Leave it above that unless the count is real.`}
            >
              <input
                type="text"
                inputMode="numeric"
                value={draft.quantity}
                onChange={(event) => update({ quantity: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>
            <CheckboxField
              label="Featured"
              hint="Fills the home best-sellers row and the Best Sellers collection."
              checked={draft.featured}
              onChange={(next) => update({ featured: next })}
            />
            <CheckboxField
              label="New arrival"
              hint="Fills the home new-arrivals row and the New Arrivals collection."
              checked={draft.isNew}
              onChange={(next) => update({ isNew: next })}
            />

            <FieldLabel
              label="Card badge"
              hint="What the card says when the piece is in stock and not running low. Sold out and low stock outrank it. New shows anyway while New arrival is ticked."
            >
              <select
                value={draft.badge ?? NO_BADGE_VALUE}
                onChange={(event) => update({ badge: toBadgeChoice(event.target.value) })}
                className={FIELD_CLASSES}
              >
                <option value={NO_BADGE_VALUE}>No badge</option>
                {PRODUCT_BADGES.map((badge) => (
                  <option key={badge} value={badge}>
                    {BADGE_LABELS[badge]}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </section>

          <section className={SECTION_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>Not editable here</h2>
            <p className={HINT_CLASSES}>
              These are facts about the record rather than fields. The product code is the
              owner&rsquo;s P-code, collections are a hand-tagged list, and provenance records which
              listing this record was migrated from.
            </p>

            <div className="flex flex-col divide-y divide-line">
              <ReadOnlyFact label="Product code">{product.id}</ReadOnlyFact>
              <ReadOnlyFact label="Collections">
                {product.collections === undefined || product.collections.length === 0
                  ? "None"
                  : product.collections.join(", ")}
              </ReadOnlyFact>
              {product.migrationProvenance === undefined ? null : (
                <>
                  <ReadOnlyFact label="Migrated from">
                    Odoo listing #{product.migrationProvenance.originalId}
                  </ReadOnlyFact>
                  <ReadOnlyFact label="Original SKU">
                    {product.migrationProvenance.originalSku ?? "Not recorded"}
                  </ReadOnlyFact>
                  <ReadOnlyFact label="Original category path">
                    {product.migrationProvenance.originalCategories.join(" › ") || "Not recorded"}
                  </ReadOnlyFact>
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "variants" ? (
        <div className="flex flex-col gap-6">
          <section className={SECTION_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>Options</h2>
            <p className={HINT_CLASSES}>
              A choice the buyer makes <strong className="font-medium text-ink">without</strong>{" "}
              changing the price. This catalogue has no per-variant price and no per-variant name,
              only per-variant photographs, so an option group varies which picture is shown and
              what the order line records, and nothing else.
            </p>

            {draft.options.length === 0 ? (
              <p className={HINT_CLASSES}>This product is sold in one configuration.</p>
            ) : null}

            {draft.options.map((option, index) => (
              <AdminProductOptionEditor
                key={index}
                index={index}
                option={option}
                fieldClassName={FIELD_CLASSES}
                labelClassName={FIELD_LABEL_CLASSES}
                hintClassName={HINT_CLASSES}
                onChange={(changes) => updateOption(index, changes)}
                onRemove={() =>
                  update({
                    options: draft.options.filter((_unused, position) => position !== index),
                  })
                }
              />
            ))}

            <div>
              <button
                type="button"
                onClick={() =>
                  update({
                    options: [
                      ...draft.options,
                      { name: "", type: "dropdown", values: [""], default: "" },
                    ],
                  })
                }
                className={buttonClasses({ size: "sm", variant: "secondary" })}
              >
                Add an option
              </button>
            </div>
          </section>

          <section className={SECTION_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>Variant photographs</h2>
            <p className={HINT_CLASSES}>
              Pick which of this product&rsquo;s photographs a shopper sees for each option value.
              A value with no photograph of its own falls through to the primary one. Uploading and
              replacing photographs is not part of this screen.
            </p>

            {variantRows.length === 0 ? (
              <p className={HINT_CLASSES}>No option values to photograph.</p>
            ) : (
              <AdminVariantImagePicker
                rows={variantRows}
                choices={photographChoices}
                onAssign={(key, image) =>
                  update({ variantImages: assignVariantImage(draft, key, image) })
                }
              />
            )}
          </section>

          <section className={SECTION_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>Photographs</h2>
            <p className={HINT_CLASSES}>
              Read-only. The first is the product&rsquo;s own photograph and is what every listing
              renders; its name is fixed to the product code by the catalogue&rsquo;s image
              convention. Their alt text is on the Pricing &amp; SEO tab.
            </p>

            <ol className="flex flex-col divide-y divide-line">
              {product.media.images.map((image, index) => (
                <li key={image} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5">
                  <span className="flex items-center gap-3">
                    <Image
                      src={image}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 object-cover"
                    />
                    <span className={FIELD_LABEL_CLASSES}>
                      {index === 0 ? "Primary" : `View ${index + 1}`}
                    </span>
                  </span>
                  <code className="text-body-sm text-ink">{image}</code>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}

      {tab === "pricing" ? (
        <div className="flex flex-col gap-6">
          <section className={SECTION_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>Pricing</h2>
            <p className={HINT_CLASSES}>
              Whole rupees. <strong className="font-medium text-ink">Cost is margin data</strong>:
              it is server-only and admin-only, and never reaches a shopper&rsquo;s browser on any
              storefront page.
            </p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldLabel label="Price" hint="The amount actually charged.">
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.price}
                  onChange={(event) => update({ price: event.target.value })}
                  className={FIELD_CLASSES}
                />
              </FieldLabel>

              <FieldLabel label="MRP" hint="Display-only compare-at price. Never charged.">
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.mrp}
                  onChange={(event) => update({ mrp: event.target.value })}
                  className={FIELD_CLASSES}
                />
              </FieldLabel>

              <FieldLabel label="Cost" hint="What the piece costs the shop.">
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.cost}
                  onChange={(event) => update({ cost: event.target.value })}
                  className={FIELD_CLASSES}
                />
              </FieldLabel>

              <FieldLabel
                label="Minimum prepaid amount"
                hint="0 means this piece may be sold cash on delivery. Any figure above 0 disables COD for the whole order it appears in."
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.minPrepaidAmount}
                  onChange={(event) => update({ minPrepaidAmount: event.target.value })}
                  className={FIELD_CLASSES}
                />
              </FieldLabel>
            </div>
          </section>

          <section className={SECTION_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>Specifications</h2>
            <p className={HINT_CLASSES}>
              Keys are lower case. A material, plating, finish or coating naming gold, silver or
              platinum must say how the metal is present. Nothing in this catalogue is solid.
            </p>

            {draft.specs.map((spec, index) => (
              <div key={index} className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <FieldLabel label="Key">
                  <input
                    type="text"
                    value={spec.key}
                    onChange={(event) => updateSpec(index, { key: event.target.value })}
                    className={FIELD_CLASSES}
                  />
                </FieldLabel>
                <FieldLabel label="Value">
                  <input
                    type="text"
                    value={spec.value}
                    onChange={(event) => updateSpec(index, { value: event.target.value })}
                    className={FIELD_CLASSES}
                  />
                </FieldLabel>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      specs: draft.specs.filter((_unused, position) => position !== index),
                    })
                  }
                  className="pb-2.5 font-sans text-label uppercase tracking-caps text-muted underline underline-offset-4 transition-colors duration-250 hover:text-sale"
                >
                  Remove
                </button>
              </div>
            ))}

            <div>
              <button
                type="button"
                onClick={() => update({ specs: [...draft.specs, { key: "", value: "" }] })}
                className={buttonClasses({ size: "sm", variant: "secondary" })}
              >
                Add a specification
              </button>
            </div>
          </section>

          <section className={SECTION_CLASSES}>
            <h2 className={SECTION_TITLE_CLASSES}>Search and social</h2>
            <p className={HINT_CLASSES}>
              Lengths are measured against what a search result and a share card actually render, so
              a title that is too long or too short is refused rather than published truncated. No
              two products may share a primary keyword or a meta title.
            </p>

            <FieldLabel label="Primary keyword" hint="Internal targeting only. Never emitted as a meta tag.">
              <input
                type="text"
                value={draft.primaryKeyword}
                onChange={(event) => update({ primaryKeyword: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>

            <FieldLabel label="Secondary keywords" hint="One per line. Overlap with other products is allowed.">
              <textarea
                rows={5}
                value={draft.secondaryKeywords}
                onChange={(event) => update({ secondaryKeywords: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>

            <FieldLabel label="Meta title" hint={`${[...draft.metaTitle].length} characters. The range is 50 to 60.`}>
              <input
                type="text"
                value={draft.metaTitle}
                onChange={(event) => update({ metaTitle: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>

            <FieldLabel
              label="Meta description"
              hint={`${[...draft.metaDescription].length} characters. The range is 140 to 160.`}
            >
              <textarea
                rows={3}
                value={draft.metaDescription}
                onChange={(event) => update({ metaDescription: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>

            <FieldLabel
              label="Open Graph title"
              hint={`${[...draft.ogTitle].length} characters. The range is 40 to 70, and it may not repeat the meta title.`}
            >
              <input
                type="text"
                value={draft.ogTitle}
                onChange={(event) => update({ ogTitle: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>

            <FieldLabel
              label="Open Graph description"
              hint={`${[...draft.ogDescription].length} characters. Up to 200, and it may not repeat the meta description.`}
            >
              <textarea
                rows={3}
                value={draft.ogDescription}
                onChange={(event) => update({ ogDescription: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>

            <FieldLabel label="Open Graph image" hint="Must be the product's own primary photograph.">
              <input
                type="text"
                value={draft.ogImage}
                onChange={(event) => update({ ogImage: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>

            <FieldLabel
              label="Image alt: primary"
              hint="Up to 125 characters, and it may not open with “image of”."
            >
              <input
                type="text"
                value={draft.imageAlt}
                onChange={(event) => update({ imageAlt: event.target.value })}
                className={FIELD_CLASSES}
              />
            </FieldLabel>

            {draft.additionalImageAlts.map((alt, index) => (
              <FieldLabel
                key={index}
                label={`Image alt: view ${index + 2}`}
                hint={`For ${product.media.images[index + 1]}. Every photograph needs its own.`}
              >
                <input
                  type="text"
                  value={alt}
                  onChange={(event) =>
                    update({
                      additionalImageAlts: draft.additionalImageAlts.map((candidate, position) =>
                        position === index ? event.target.value : candidate,
                      ),
                    })
                  }
                  className={FIELD_CLASSES}
                />
              </FieldLabel>
            ))}
          </section>
        </div>
      ) : null}
    </form>
  );
}
