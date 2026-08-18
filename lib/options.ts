import type { ProductOption, SelectedOptions } from "@/types/product";

/**
 * The one text a shopper sees wherever a chosen option is shown. It is a policy statement,
 * not decoration: `/refund` exempts made-to-order pieces from returns, and an option is what
 * makes a piece made-to-order.
 */
export const PERSONALIZED_NOTE = "Personalized · non-returnable";

const KEY_FIELD_SEPARATOR = "|";
const KEY_PAIR_SEPARATOR = "=";
const DISPLAY_SEPARATOR = " · ";

export function hasProductOptions(
  options: ProductOption[] | undefined,
): options is ProductOption[] {
  return Array.isArray(options) && options.length > 0;
}

function compareOptionNames(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

function sortedSelectionPairs(selected: SelectedOptions): [string, string][] {
  return Object.entries(selected).sort(([left], [right]) =>
    compareOptionNames(left, right),
  );
}

/**
 * The identity of a cart line. Two lines of the same product with different choices are
 * different lines; the same product with the same choices is one line however the record's
 * keys happen to be ordered, because the pairs are sorted before they are joined.
 *
 * Names and values are percent-encoded, so a value containing the separators cannot forge
 * another line's key. A product with no choices keys on its id alone, which is what every
 * pre-options line and every option-less product already keyed on.
 */
export function lineKey(
  productId: string,
  selectedOptions?: SelectedOptions,
): string {
  if (selectedOptions === undefined) return productId;

  const pairs = sortedSelectionPairs(selectedOptions);
  if (pairs.length === 0) return productId;

  const encodedPairs = pairs.map(
    ([name, value]) =>
      `${encodeURIComponent(name)}${KEY_PAIR_SEPARATOR}${encodeURIComponent(value)}`,
  );

  return [productId, ...encodedPairs].join(KEY_FIELD_SEPARATOR);
}

export function defaultSelectedOptions(
  options: ProductOption[] | undefined,
): SelectedOptions | undefined {
  if (!hasProductOptions(options)) return undefined;

  return Object.fromEntries(
    options.map((option) => [option.name, option.default]),
  );
}

/**
 * What a line's choices actually are, given what was asked for and what the catalogue offers
 * now. Every group the product has gets a value — the requested one when the catalogue still
 * offers it, the group's stated default otherwise — so a line always carries a complete,
 * current selection and a shopper who never touched a selector still gets the defaults.
 *
 * A product with no options resolves to `undefined`, never to an empty record, so its lines
 * key on the product id exactly as they did before options existed.
 */
export function resolveSelectedOptions(
  options: ProductOption[] | undefined,
  requested: SelectedOptions | undefined,
): SelectedOptions | undefined {
  if (!hasProductOptions(options)) return undefined;

  return Object.fromEntries(
    options.map((option) => {
      const requestedValue = requested?.[option.name];
      const isOffered =
        requestedValue !== undefined && option.values.includes(requestedValue);

      return [option.name, isOffered ? requestedValue : option.default];
    }),
  );
}

/**
 * Whether a stored selection names something the catalogue no longer has — a group that was
 * deleted, or a value that was withdrawn. Such a line is dropped rather than silently
 * re-pointed at a different choice: the shopper asked for a letter we no longer make, and
 * quietly shipping them another one is worse than making them choose again.
 *
 * A selection that is merely *incomplete* is not stale. That is a line added before the
 * product gained a group, and `resolveSelectedOptions` fills it with the default.
 */
export function isSelectionStale(
  options: ProductOption[] | undefined,
  selected: SelectedOptions | undefined,
): boolean {
  if (selected === undefined) return false;

  const entries = Object.entries(selected);
  if (entries.length === 0) return false;
  if (!hasProductOptions(options)) return true;

  return entries.some(([name, value]) => {
    const group = options.find((option) => option.name === name);
    return group === undefined || !group.values.includes(value);
  });
}

/**
 * Reads a selection out of untrusted JSON — `localStorage`, `sessionStorage`, or a request
 * body. Shape only: whether the names and values are real is `isSelectionStale`'s job,
 * against the catalogue.
 */
export function parseSelectedOptions(value: unknown): SelectedOptions | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const pairs = Object.entries(value as Record<string, unknown>).filter(
    (pair): pair is [string, string] =>
      typeof pair[1] === "string" && pair[0].length > 0 && pair[1].length > 0,
  );

  return pairs.length === 0 ? undefined : Object.fromEntries(pairs);
}

/** `Letter: A · Colour: Silver` — how a selection reads to a shopper. */
export function formatSelectedOptions(
  selectedOptions: SelectedOptions | undefined,
): string {
  if (selectedOptions === undefined) return "";

  return Object.entries(selectedOptions)
    .map(([name, value]) => `${name}: ${value}`)
    .join(DISPLAY_SEPARATOR);
}

/**
 * `P001:Letter=A` — how a selection reads to whoever is packing the order. Compact because
 * it travels in Cashfree order metadata, which is the only place an order's choices are
 * recorded: there is no database ([ADR-001](/docs/decisions/ADR-001-tech-stack.md)).
 */
export function summarizeLineOptions(
  productId: string,
  selectedOptions: SelectedOptions | undefined,
): string {
  if (selectedOptions === undefined) return "";

  const pairs = sortedSelectionPairs(selectedOptions);
  if (pairs.length === 0) return "";

  return `${productId}:${pairs
    .map(([name, value]) => `${name}${KEY_PAIR_SEPARATOR}${value}`)
    .join(",")}`;
}
