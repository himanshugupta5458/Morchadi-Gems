import { buttonClasses } from "@/lib/button-styles";

export interface AdminProductExportProps {
  href: string;
  label: string;
  isNarrowed: boolean;
}

/**
 * The list, downloadable as a spreadsheet.
 *
 * An `<a>` rather than a button with a `fetch` behind it, and a plain one rather than `next/link`:
 * the endpoint answers `Content-Disposition: attachment`, so the browser saves the file and never
 * navigates. That keeps this page's promise of shipping no client JavaScript, and it means the
 * download survives every way a link can be used — a new tab, a copied URL, a retry.
 *
 * The href carries the list's own query string, so the file holds exactly the rows on screen. The
 * label says which of the two it is, because a button that exports something other than what you
 * are looking at is a button you check twice every time
 * ([ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md)).
 */
export function AdminProductExport({
  href,
  label,
  isNarrowed,
}: AdminProductExportProps): JSX.Element {
  return (
    <div className="flex flex-col items-start gap-2">
      <a href={href} className={buttonClasses({ size: "sm", variant: "secondary" })}>
        {label}
      </a>
      <p className="text-body-sm text-muted">
        {isNarrowed
          ? "Every row these filters select, across all pages, not only the page on screen."
          : "The whole catalogue, one row per product, with pricing, media, specs, SEO and migration provenance in their own columns."}
      </p>
    </div>
  );
}
