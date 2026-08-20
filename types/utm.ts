/**
 * Where a visit came from, as the five parameters every ad platform, email tool and social
 * scheduler already writes into a link. Each is optional because a campaign URL carries
 * whichever ones its author bothered with, and a visit with none of them is the normal case.
 *
 * Marketing data, and nothing else. No amount, no product, no order decision reads this — it
 * is recorded alongside an order and shown to the owner, in the same way a recorded engraving
 * choice is. See [ADR-039](/docs/decisions/ADR-039-analytics-and-utm-attribution.md).
 */
export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}
