import type { CreateOrderItem, OrderItemError } from "@/types/order";
import type { ProductOption } from "@/types/product";
import {
  isSelectionStale,
  resolveSelectedOptions,
  summarizeLineOptions,
} from "@/lib/options";

/**
 * The only fields of a product this module may see — the mirror of `OrderPricingEntry`, with
 * `price` deliberately absent so option handling cannot reach an amount even by mistake.
 */
export interface OrderOptionEntry {
  id: string;
  name: string;
  options?: ProductOption[];
}

export interface OrderOptionsResult {
  errors: OrderItemError[];
  /** `P001:Letter=A; P010:Colour=Golden`. Empty when nothing in the order has options. */
  summary: string;
}

const SUMMARY_SEPARATOR = "; ";

/** Cashfree caps an `order_tags` value at 255 characters and the map at ten pairs. */
export const ORDER_TAG_VALUE_LIMIT = 255;
const ORDER_TAG_LIMIT = 3;
const OPTIONS_TAG_KEY = "options";

function indexOptionEntries(
  catalogue: readonly OrderOptionEntry[],
): Map<string, OrderOptionEntry> {
  return new Map(catalogue.map((entry) => [entry.id, entry]));
}

/**
 * Checks each line's recorded choices against the catalogue and, if they all still exist,
 * produces the compact summary that travels with the order.
 *
 * A choice the catalogue no longer offers is refused rather than quietly replaced with a
 * default: the shopper's browser may be holding a page from before the change, and shipping
 * them a different letter than the one they asked for is worse than asking them to choose
 * again. A line missing a group it should have is not an error — it gets the default, the
 * same as a shopper who never touched the selector.
 *
 * A product not in the catalogue is passed over, because `buildOrderFromCart` already reports
 * it and one fault should not be reported twice.
 */
export function validateOrderLineOptions(
  items: readonly CreateOrderItem[],
  catalogue: readonly OrderOptionEntry[],
): OrderOptionsResult {
  const catalogueById = indexOptionEntries(catalogue);
  const errors: OrderItemError[] = [];
  const lineSummaries: string[] = [];

  for (const item of items) {
    const entry = catalogueById.get(item.productId);
    if (entry === undefined) continue;

    if (isSelectionStale(entry.options, item.selectedOptions)) {
      errors.push({
        productId: entry.id,
        code: "INVALID_OPTION",
        message: `The option you chose for ${entry.name} is no longer available.`,
      });
      continue;
    }

    const resolvedOptions = resolveSelectedOptions(entry.options, item.selectedOptions);
    const lineSummary = summarizeLineOptions(entry.id, resolvedOptions);
    if (lineSummary.length > 0) lineSummaries.push(lineSummary);
  }

  return {
    errors,
    summary: errors.length > 0 ? "" : lineSummaries.join(SUMMARY_SEPARATOR),
  };
}

function packSummaryChunks(lineSummaries: string[]): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const lineSummary of lineSummaries) {
    const candidate = current.length === 0 ? lineSummary : `${current}${SUMMARY_SEPARATOR}${lineSummary}`;

    if (candidate.length <= ORDER_TAG_VALUE_LIMIT) {
      current = candidate;
      continue;
    }

    if (current.length > 0) chunks.push(current);
    current = lineSummary.slice(0, ORDER_TAG_VALUE_LIMIT);
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * The order's choices as Cashfree `order_tags` — where a packer reads what to engrave.
 *
 * These are now also written to `order_line_items.selected_options`
 * ([ADR-042](/docs/decisions/ADR-042-order-capture-in-postgres.md)), and the tags are kept
 * rather than retired: that database write is deliberately allowed to fail without failing a
 * checkout, so this remains the copy that travels with the payment itself.
 *
 * The summary is split across at most three tag values rather than truncated at the first
 * 255 characters, and if even that overflows the last value says how many lines were left
 * out — a silently shortened list would read as a complete one.
 */
export function toOrderOptionTags(summary: string): Record<string, string> {
  if (summary.length === 0) return {};

  const lineSummaries = summary.split(SUMMARY_SEPARATOR);
  const chunks = packSummaryChunks(lineSummaries);
  const keptChunks = chunks.slice(0, ORDER_TAG_LIMIT);
  const droppedLineCount = countLinesIn(chunks.slice(ORDER_TAG_LIMIT));

  if (droppedLineCount > 0) {
    const lastIndex = keptChunks.length - 1;
    keptChunks[lastIndex] = withOverflowMarker(keptChunks[lastIndex], droppedLineCount);
  }

  return Object.fromEntries(
    keptChunks.map((chunk, index) => [
      index === 0 ? OPTIONS_TAG_KEY : `${OPTIONS_TAG_KEY}_${index + 1}`,
      chunk,
    ]),
  );
}

function countLinesIn(chunks: string[]): number {
  return chunks.reduce(
    (count, chunk) => count + chunk.split(SUMMARY_SEPARATOR).length,
    0,
  );
}

function withOverflowMarker(chunk: string, droppedLineCount: number): string {
  const marker = `${SUMMARY_SEPARATOR}+${droppedLineCount} more`;
  const room = ORDER_TAG_VALUE_LIMIT - marker.length;

  return `${chunk.slice(0, room)}${marker}`;
}
