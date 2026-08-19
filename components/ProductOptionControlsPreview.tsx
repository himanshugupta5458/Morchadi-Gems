"use client";

import type { CatalogueEntry, ProductOption } from "@/types/product";
import { useProductSelection } from "@/lib/product-selection";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";

export interface ProductOptionControlsPreviewProps {
  item: CatalogueEntry;
  galleryImages: string[];
  /** One alt per entry in `galleryImages`, in the same order. */
  galleryImageAlts: string[];
}

/**
 * The QA surface for the four option controls, which no single catalogued product can
 * provide: the real catalogue has `dropdown`, `swatch` and `chips` spread across five
 * products and does not use `pills` at all. The synthetic entry this renders exists only
 * here, in memory, and never reaches `data/products.json`, the shop, or a cart.
 *
 * It renders the real `ProductPurchasePanel`, not a copy of its markup, so the spacing,
 * the running summary and the personalized note are whatever a product page would show
 * rather than an imitation that can drift from one.
 */
export function ProductOptionControlsPreview({
  item,
  galleryImages,
  galleryImageAlts,
}: ProductOptionControlsPreviewProps): JSX.Element {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="max-w-sm">
          <ProductGallery images={galleryImages} imageAlts={galleryImageAlts} />
        </div>

        <ProductPurchasePanel
          item={item}
          onAddToCart={ignorePurchase}
          onBuyNow={ignorePurchase}
        />
      </div>

      <SelectionReadout options={item.options ?? []} />
    </div>
  );
}

/**
 * Add to cart and Buy now are inert here. The panel takes both handlers as props and never
 * imports the cart, so a style-guide render needs no cart state and cannot leave anything
 * in one.
 */
function ignorePurchase(): void {
  return undefined;
}

/**
 * One row per group: which control is driving it and what it currently holds. The panel's
 * own summary reads them as one sentence, which is what a shopper sees; this reads them
 * apart, which is what someone checking a control needs.
 */
function SelectionReadout({ options }: { options: ProductOption[] }): JSX.Element {
  const { selectedOptions } = useProductSelection();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-left text-body-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2 pr-6 text-eyebrow uppercase text-muted">Group</th>
            <th className="py-2 pr-6 text-eyebrow uppercase text-muted">Control</th>
            <th className="py-2 pr-6 text-eyebrow uppercase text-muted">Default</th>
            <th className="py-2 text-eyebrow uppercase text-muted">Selected</th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr key={option.name} className="border-b border-line">
              <td className="py-2.5 pr-6 text-ink">{option.name}</td>
              <td className="py-2.5 pr-6 font-sans text-muted">{option.type}</td>
              <td className="py-2.5 pr-6 text-muted">{option.default}</td>
              <td className="py-2.5 text-ink">
                {selectedOptions?.[option.name] ?? option.default}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
