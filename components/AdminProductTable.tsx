import Link from "next/link";
import type { AdminProductRow } from "@/lib/admin-products";
import { formatRupees } from "@/lib/format";

export interface AdminProductTableProps {
  rows: readonly AdminProductRow[];
  buildProductHref: (productId: string) => string;
}

const HEADER_CELL_CLASSES =
  "whitespace-nowrap px-4 py-3 text-left font-sans text-eyebrow uppercase tracking-caps-wide text-muted";

const CELL_CLASSES = "px-4 py-4 align-middle text-body-sm text-ink";

const BADGE_CLASSES =
  "inline-flex items-center border px-2 py-0.5 font-sans text-eyebrow uppercase tracking-caps-wide";

/**
 * The catalogue as an operator scans it.
 *
 * The product code is the first column and is the link, for the same reason the order number is
 * in `AdminOrderTable`: it is the identifier every other surface — an invoice, a photograph
 * filename, a message about stock — is keyed on.
 *
 * `pricing.cost` is not a column. It is on the detail page, where an operator has opened one
 * record on purpose; a list is read over somebody's shoulder, and margin across the whole
 * catalogue is not what this screen is for. `AdminProductRow` does not carry it either, so this
 * is a property of the data the page holds rather than of what it chose to render.
 *
 * The table scrolls inside its own container on a narrow screen rather than reflowing into cards
 * — a row is one product and the comparison being made is between rows, which stacking destroys.
 */
export function AdminProductTable({
  rows,
  buildProductHref,
}: AdminProductTableProps): JSX.Element {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[60rem] border-collapse">
        <thead className="border-b border-line bg-ivory">
          <tr>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Code
            </th>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Name
            </th>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Category
            </th>
            <th scope="col" className={`${HEADER_CELL_CLASSES} text-right`}>
              Price
            </th>
            <th scope="col" className={`${HEADER_CELL_CLASSES} text-right`}>
              MRP
            </th>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Stock
            </th>
            <th scope="col" className={HEADER_CELL_CLASSES}>
              Flags
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-line last:border-b-0 transition-colors duration-250 hover:bg-ivory"
            >
              <td className={CELL_CLASSES}>
                <Link
                  href={buildProductHref(row.id)}
                  className="font-sans tracking-caps text-ink underline underline-offset-4 transition-colors duration-250 hover:text-gold"
                >
                  {row.id}
                </Link>
              </td>
              <td className={CELL_CLASSES}>
                <span className="flex flex-col gap-1">
                  <span>{row.name}</span>
                  {row.optionCount > 0 ? (
                    <span className="text-eyebrow uppercase tracking-caps-wide text-muted">
                      {row.optionCount} option {row.optionCount === 1 ? "group" : "groups"}
                    </span>
                  ) : null}
                </span>
              </td>
              <td className={`${CELL_CLASSES} whitespace-nowrap text-muted`}>
                {row.categoryLabel}
              </td>
              <td className={`${CELL_CLASSES} whitespace-nowrap text-right`}>
                {formatRupees(row.price)}
              </td>
              <td className={`${CELL_CLASSES} whitespace-nowrap text-right text-muted`}>
                {row.mrp > row.price ? formatRupees(row.mrp) : "—"}
              </td>
              <td className={`${CELL_CLASSES} whitespace-nowrap`}>
                {row.isDraft ? (
                  <span className={`${BADGE_CLASSES} border-line text-muted`}>Draft</span>
                ) : row.inStock ? (
                  <span className="text-muted">In stock</span>
                ) : (
                  <span className={`${BADGE_CLASSES} border-sale text-sale`}>Out of stock</span>
                )}
              </td>
              <td className={`${CELL_CLASSES} whitespace-nowrap`}>
                <span className="flex flex-wrap items-center gap-2">
                  {row.featured ? (
                    <span className={`${BADGE_CLASSES} border-gold text-gold-deep`}>Featured</span>
                  ) : null}
                  {row.isNew ? (
                    <span className={`${BADGE_CLASSES} border-line text-muted`}>New</span>
                  ) : null}
                  {!row.featured && !row.isNew ? <span className="text-muted">—</span> : null}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
