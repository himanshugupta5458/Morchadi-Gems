import { getCategoryLabel, type Product } from "@/types/product";
import { buildCategoryHref } from "@/lib/navigation";

/** A step in a breadcrumb trail. The last step is the current page and carries no `href`. */
export interface BreadcrumbStep {
  label: string;
  href?: string;
}

/**
 * The trail a product page shows, built once and read twice: `Breadcrumb` renders it and
 * `buildBreadcrumbSchema` publishes it. Two trails written separately would drift, and a
 * `BreadcrumbList` that disagrees with the visible trail is the one structured-data error a
 * search engine treats as misrepresentation rather than as a missing field.
 */
export function buildProductBreadcrumb(product: Product): BreadcrumbStep[] {
  return [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    {
      label: getCategoryLabel(product.category),
      href: buildCategoryHref(product.category),
    },
    { label: product.name },
  ];
}
