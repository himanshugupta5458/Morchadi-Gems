import { BUSINESS } from "@/config/business";
import { ONLINE_PAYMENT_DISCOUNT_RATE } from "@/lib/cod";
import {
  FLAT_SHIPPING_RATE,
  FREE_SHIPPING_THRESHOLD,
  LEGAL_CONFIG,
  PRODUCT_DESCRIPTOR,
  RETURN_WINDOW_DAYS,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { buildCategoryHref, buildCollectionHref } from "@/lib/navigation";
import { getAllProducts } from "@/lib/products";
import { absoluteUrl } from "@/lib/site-url";
import { COLLECTIONS, SURFACED_CATEGORIES } from "@/types/product";

export const LLMS_TXT_PATH = "/llms.txt";

/**
 * The sections a language model is pointed at, as absolute URLs with a sentence each.
 *
 * `/cart`, `/address`, `/payment` and `/order-confirmation` are deliberately absent: they are
 * steps in one shopper's order rather than pages about the shop, and `lib/sitemap.ts` already
 * refuses to publish them for that reason. So is every path under `/admin`, which on this
 * hostname does not serve the panel at all.
 *
 * **`/track` is absent by the owner's decision, and absent completely rather than merely
 * unlinked.** It is `noindex` and disallowed in `robots.txt` because with an order number in
 * the query string it renders the state of one person's order, and this file is read by tools
 * that follow what they read and guess at what they are told about. Naming order lookup as a
 * capability here without a URL is the same invitation one step removed: an agent holding an
 * order number and the knowledge that this shop looks orders up by one will go and find the
 * page. So the file describes no way to reach anybody's order, and `lib/llms-txt.test.ts`
 * holds the whole rendered body to that.
 */
const SITE_SECTIONS: readonly { path: string; label: string; summary: string }[] = [
  {
    path: "/shop",
    label: "Shop",
    summary: "The full catalogue, filterable by category, collection and price.",
  },
  {
    path: "/contact",
    label: "Contact",
    summary: "Support enquiry form, phone, WhatsApp and business hours.",
  },
  {
    path: "/shipping",
    label: "Shipping policy",
    summary: "Dispatch and delivery windows, shipping charges and coverage.",
  },
  {
    path: "/refund",
    label: "Refund and returns policy",
    summary: "What can be returned, within what window, and how a refund is processed.",
  },
  {
    path: "/terms",
    label: "Terms and conditions",
    summary: "What is being sold, what is promised about it, and the governing jurisdiction.",
  },
  {
    path: "/privacy",
    label: "Privacy policy",
    summary: "What is collected at checkout, what is not collected, and what is never sold.",
  },
];

function toDiscountPercentLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function toMarkdownLink(label: string, path: string): string {
  return `[${label}](${absoluteUrl(path)})`;
}

function toSectionLine({
  path,
  label,
  summary,
}: (typeof SITE_SECTIONS)[number]): string {
  return `- ${toMarkdownLink(label, path)}: ${summary}`;
}

/**
 * The honesty paragraph, said the way `/terms` already says it to a shopper and the way
 * `scripts/product-record-rules.mjs` already enforces it on every catalogue record, where a
 * purity figure, an assay mark and a bare precious-metal name with no plating or tone qualifier
 * are each rejected outright.
 *
 * It is repeated here rather than left to be inferred because this file exists to be quoted by
 * something that will paraphrase it. An assistant that has read only the categories above could
 * reasonably summarise this shop as a jeweller; the paragraph is what stops that summary from
 * turning into a precious-metal claim the catalogue itself is not allowed to make.
 *
 * For the same reason it states the rule without naming a single barred term. The gate's
 * vocabulary is a list of strings a paraphrase can carry across while dropping the negation
 * around them, and "no listing carries an 18K claim" is one careless summary away from being an
 * 18K claim. `lib/llms-txt.test.ts` runs the gate's own regex over this file to keep it that
 * way. See [ADR-018](/docs/decisions/ADR-018-honest-product-description.md).
 */
const HONESTY_STATEMENT: readonly string[] = [
  "Every piece sold here is artificial jewellery: plated brass, alloy or stainless steel.",
  "The pieces are fashion jewellery. They are not precious metal or precious stone jewellery, and they are not sold as an investment.",
  "No listing claims a purity figure, an assay mark or a solid precious-metal composition, because nothing in this catalogue is solid gold or solid silver.",
];

/**
 * The `/llms.txt` body: what this shop is, what it promises, what it stocks and where the
 * pages are — for a language model reading the site rather than a crawler indexing it.
 *
 * Every fact in it is read from the place that already owns it. The brand and entity names
 * come from `config/business.ts`, the three policy numbers from `config/site-facts.mjs` by way
 * of `lib/config.ts`, the payment incentive from `lib/cod.ts`, the two catalogue tiers from
 * `types/product.ts` and the piece count from the catalogue itself, so this file cannot state
 * a number the shop has stopped charging. No product is priced here: a price belongs on the
 * product page, where it is server-rendered from `data/products.json` at request time, and a
 * price copied into a summary is a price that can be quoted after it has changed.
 */
export function buildLlmsTxt(): string {
  const activeProductCount = getAllProducts().length;
  const onlineDiscountLabel = toDiscountPercentLabel(ONLINE_PAYMENT_DISCOUNT_RATE);

  return [
    `# ${BUSINESS.brandName}`,
    "",
    `> ${BUSINESS.brandName} is an online jewellery shop selling ${PRODUCT_DESCRIPTOR}, on guest checkout, shipping across ${LEGAL_CONFIG.shippingScope}.`,
    "",
    `Operated by ${BUSINESS.legalEntityName}. The catalogue lists ${activeProductCount} pieces across ${SURFACED_CATEGORIES.length} categories and ${COLLECTIONS.length} collections.`,
    "",
    "## Key facts",
    "",
    `- Free shipping on orders of ${formatRupees(FREE_SHIPPING_THRESHOLD)} and over; a flat ${formatRupees(FLAT_SHIPPING_RATE)} below that.`,
    `- Returns accepted within ${RETURN_WINDOW_DAYS} days.`,
    `- Payment is either cash on delivery or online in full through ${LEGAL_CONFIG.paymentProvider}; paying online in full takes ${onlineDiscountLabel} off the product subtotal.`,
    `- Cash on delivery depends on the pieces in the basket rather than on what it is worth, so it is offered or withheld at checkout and not promised in advance.`,
    `- Guest checkout only. There are no shopper accounts and no sign-in, on this site or anywhere else.`,
    `- Delivery is within ${LEGAL_CONFIG.shippingScope} only.`,
    "",
    "## What this shop does and does not sell",
    "",
    ...HONESTY_STATEMENT.map((sentence) => `- ${sentence}`),
    "",
    "## Categories",
    "",
    ...SURFACED_CATEGORIES.map(
      (category) => `- ${toMarkdownLink(category.label, buildCategoryHref(category.slug))}`,
    ),
    "",
    "## Collections",
    "",
    ...COLLECTIONS.map(
      (collection) =>
        `- ${toMarkdownLink(collection.label, buildCollectionHref(collection.slug))}`,
    ),
    "",
    "## Site sections",
    "",
    ...SITE_SECTIONS.map(toSectionLine),
    "",
  ].join("\n");
}
