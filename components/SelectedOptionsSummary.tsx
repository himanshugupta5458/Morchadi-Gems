import type { SelectedOptions } from "@/types/product";
import { formatSelectedOptions } from "@/lib/options";

export interface SelectedOptionsSummaryProps {
  selectedOptions?: SelectedOptions;
}

/**
 * `Letter: A · Colour: Silver`, wherever a chosen line is listed. It renders nothing at all
 * for a product sold in one configuration, so no caller has to guard the call.
 */
export function SelectedOptionsSummary({
  selectedOptions,
}: SelectedOptionsSummaryProps): JSX.Element | null {
  const summary = formatSelectedOptions(selectedOptions);
  if (summary.length === 0) return null;

  return <span className="text-body-sm text-muted">{summary}</span>;
}
