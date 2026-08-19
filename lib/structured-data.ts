import { getCategoryLabel, type Category, type Product } from "@/types/product";
import { BUSINESS } from "@/config/business";
import {
  CONTACT_CONFIG,
  DELIVERY_BUSINESS_DAYS,
  DISPATCH_BUSINESS_DAYS,
  GEO_CONFIG,
  LEGAL_CONFIG,
  OPENING_HOURS_CONFIG,
  POSTAL_ADDRESS_CONFIG,
  RETURN_WINDOW_DAYS,
  SHIPPING_COUNTRY_CODE,
  SITE_CONFIG,
  STORY_CONFIG,
  calculateShipping,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { getAllProducts } from "@/lib/products";
import { toSpecRows } from "@/lib/specs";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";
import type { BreadcrumbStep } from "@/lib/breadcrumbs";

const SCHEMA_CONTEXT = "https://schema.org";

const CURRENCY = "INR";

/**
 * How long the published price is stated to hold, as an offset from the day the page is
 * built rather than a date written down. A hardcoded date is correct exactly once and then
 * decays silently into a stale offer; a rolling year is always a plausible commitment for a
 * catalogue that ships as code and is redeployed whenever it changes.
 */
const PRICE_VALIDITY_YEARS = 1;

/**
 * The date the published price is stated to hold until, in `YYYY-MM-DD`. Derived from the
 * build date, so it can never go stale the way a literal did.
 */
export function getOfferPriceValidUntil(from: Date = new Date()): string {
  const validUntil = new Date(
    Date.UTC(
      from.getUTCFullYear() + PRICE_VALIDITY_YEARS,
      from.getUTCMonth(),
      from.getUTCDate(),
    ),
  );

  return validUntil.toISOString().slice(0, 10);
}

/**
 * Which categories the refund policy calls pierced jewellery, where hygiene rules prevent
 * resale. Non-returnable unless the piece is faulty, which is a right no policy can remove
 * and which structured data has no vocabulary for.
 */
const PIERCED_CATEGORIES: readonly Category[] = ["earrings", "nose-pins"];

/**
 * Option names that make a piece personalised rather than merely configured. The distinction
 * matters and is not the same as "has options": a letter is engraved to one buyer's
 * specification and cannot be resold, while a ribbon colour or a locket shape is a variant
 * that goes back on the shelf. Claiming a colour choice is non-returnable would understate
 * the buyer's rights as badly as claiming an engraved ring is returnable overstates ours.
 */
const PERSONALISED_OPTION_NAMES: readonly string[] = [
  "letter",
  "initial",
  "name",
  "engraving",
];

export function isPersonalisedProduct(product: Product): boolean {
  return (product.options ?? []).some((option) =>
    PERSONALISED_OPTION_NAMES.includes(option.name.trim().toLowerCase()),
  );
}

export function isPiercedProduct(product: Product): boolean {
  return PIERCED_CATEGORIES.includes(product.category);
}

/**
 * Whether the seven-day window in the refund policy actually applies to this piece. The two
 * exclusions the policy names and the catalogue can answer are personalisation and piercing;
 * the third, clearance and final-sale stock, has no field in the record and so no product is
 * currently excluded on that ground.
 */
export function isReturnable(product: Product): boolean {
  return !isPersonalisedProduct(product) && !isPiercedProduct(product);
}

export function getOrganizationId(): string {
  return `${getSiteUrl()}/#organization`;
}

export function getWebSiteId(): string {
  return `${getSiteUrl()}/#website`;
}

export function getStoreId(): string {
  return `${getSiteUrl()}/#store`;
}

export function getProductId(productId: string): string {
  return `${absoluteUrl(`/product/${productId}`)}#product`;
}

export interface SchemaReference {
  "@id": string;
}

export interface PostalAddressSchema {
  "@type": "PostalAddress";
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
}

export interface ImageObjectSchema {
  "@type": "ImageObject";
  url: string;
  width: number;
  height: number;
}

export interface ContactPointSchema {
  "@type": "ContactPoint";
  contactType: string;
  email: string;
  telephone: string;
  areaServed: string;
}

export interface OrganizationSchema {
  "@type": "Organization";
  "@id": string;
  name: string;
  legalName: string;
  url: string;
  logo: ImageObjectSchema;
  image: string;
  description: string;
  foundingDate: string;
  email: string;
  telephone: string;
  address: PostalAddressSchema;
  contactPoint: ContactPointSchema[];
  sameAs: string[];
}

export interface GeoCoordinatesSchema {
  "@type": "GeoCoordinates";
  latitude: number;
  longitude: number;
}

export interface OpeningHoursSpecificationSchema {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

/**
 * Two types on one node, and both are true: the entity is a real business at a Jaipur
 * address, and the only counter it sells over is this website. `LocalBusiness` is what makes
 * `geo`, `priceRange` and `openingHoursSpecification` legal properties rather than invented
 * ones; `OnlineStore` is what stops a reader assuming a shop floor. See ADR-034.
 */
export interface OnlineStoreSchema {
  "@type": ["OnlineStore", "LocalBusiness"];
  "@id": string;
  name: string;
  legalName: string;
  url: string;
  image: string;
  description: string;
  telephone: string;
  email: string;
  address: PostalAddressSchema;
  geo: GeoCoordinatesSchema;
  openingHoursSpecification: OpeningHoursSpecificationSchema[];
  priceRange: string;
  currenciesAccepted: string;
  paymentAccepted: string;
  areaServed: string;
  parentOrganization: SchemaReference;
  sameAs: string[];
}

export interface WebSiteSchema {
  "@type": "WebSite";
  "@id": string;
  name: string;
  url: string;
  description: string;
  inLanguage: string;
  publisher: SchemaReference;
}

export interface MonetaryAmountSchema {
  "@type": "MonetaryAmount";
  value: number;
  currency: string;
}

export interface QuantitativeValueSchema {
  "@type": "QuantitativeValue";
  minValue: number;
  maxValue: number;
  unitCode: "DAY";
}

export interface ShippingDeliveryTimeSchema {
  "@type": "ShippingDeliveryTime";
  handlingTime: QuantitativeValueSchema;
  transitTime: QuantitativeValueSchema;
}

export interface DefinedRegionSchema {
  "@type": "DefinedRegion";
  addressCountry: string;
}

export interface OfferShippingDetailsSchema {
  "@type": "OfferShippingDetails";
  shippingRate: MonetaryAmountSchema;
  shippingDestination: DefinedRegionSchema;
  deliveryTime: ShippingDeliveryTimeSchema;
}

export interface MerchantReturnPolicySchema {
  "@type": "MerchantReturnPolicy";
  applicableCountry: string;
  returnPolicyCountry: string;
  returnPolicyCategory: string;
  merchantReturnLink: string;
  merchantReturnDays?: number;
  returnMethod?: string;
  returnFees?: string;
}

export interface OfferSchema {
  "@type": "Offer";
  "@id": string;
  url: string;
  price: number;
  priceCurrency: string;
  priceValidUntil: string;
  availability: string;
  itemCondition: string;
  seller: SchemaReference;
  hasMerchantReturnPolicy: MerchantReturnPolicySchema;
  shippingDetails: OfferShippingDetailsSchema;
}

export interface PropertyValueSchema {
  "@type": "PropertyValue";
  name: string;
  value: string;
}

export interface ProductSchema {
  "@type": "Product";
  "@id": string;
  name: string;
  description: string;
  image: string[];
  sku: string;
  brand: { "@type": "Brand"; name: string };
  category: string;
  url: string;
  offers: OfferSchema;
  additionalProperty: PropertyValueSchema[];
}

export interface ListItemSchema {
  "@type": "ListItem";
  position: number;
  name: string;
  item?: string;
}

export interface BreadcrumbListSchema {
  "@type": "BreadcrumbList";
  "@id": string;
  itemListElement: ListItemSchema[];
}

/**
 * An `ItemList` of products, so a listing page tells a crawler which pieces it shows and in
 * what order rather than leaving it to infer them from the markup. Positions are absolute
 * across the whole result set, not per page, so page two starts at thirteen.
 */
export interface ItemListSchema {
  "@type": "ItemList";
  "@id": string;
  name: string;
  numberOfItems: number;
  itemListOrder: string;
  itemListElement: ListItemSchema[];
}

export interface CollectionPageSchema {
  "@type": "CollectionPage";
  "@id": string;
  name: string;
  description: string;
  url: string;
  isPartOf: SchemaReference;
  mainEntity: SchemaReference;
}

export type SchemaNode =
  | OrganizationSchema
  | OnlineStoreSchema
  | WebSiteSchema
  | ProductSchema
  | BreadcrumbListSchema
  | CollectionPageSchema
  | ItemListSchema;

export interface SchemaGraph {
  "@context": typeof SCHEMA_CONTEXT;
  "@graph": SchemaNode[];
}

function buildPostalAddress(): PostalAddressSchema {
  return { "@type": "PostalAddress", ...POSTAL_ADDRESS_CONFIG };
}

export function buildOrganizationSchema(): OrganizationSchema {
  return {
    "@type": "Organization",
    "@id": getOrganizationId(),
    name: SITE_CONFIG.brandName,
    legalName: LEGAL_CONFIG.entityName,
    url: `${getSiteUrl()}/`,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo.png"),
      width: 642,
      height: 388,
    },
    image: absoluteUrl(SITE_CONFIG.ogImage.url),
    description: SITE_CONFIG.description,
    foundingDate: `${STORY_CONFIG.foundedYear}`,
    email: CONTACT_CONFIG.supportEmail,
    telephone: BUSINESS.phoneDisplay,
    address: buildPostalAddress(),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: CONTACT_CONFIG.supportEmail,
        telephone: BUSINESS.phoneDisplay,
        areaServed: SHIPPING_COUNTRY_CODE,
      },
    ],
    sameAs: [...BUSINESS.socialProfileUrls],
  };
}

/**
 * The band the catalogue actually spans, read from the catalogue rather than written down.
 * `priceRange` is a free-text field, and the honest thing to put in it is the real cheapest
 * and dearest piece on sale today.
 */
function buildPriceRange(): string {
  const prices = getAllProducts().map((product) => product.pricing.price);
  return `${formatRupees(Math.min(...prices))} – ${formatRupees(Math.max(...prices))}`;
}

/**
 * The selling entity as a place and a shopfront. It is a separate node from the
 * `Organization` rather than more properties on it: the Organization is who publishes this
 * site, and this is where and when and at what prices that organization trades. The two are
 * joined by `parentOrganization`, so a crawler reads one entity described twice rather than
 * two businesses.
 *
 * `sameAs` comes from `config/business.ts` and is empty until the owner has profiles to name.
 * An empty array is the honest state — it claims no accounts — and populating it is a
 * one-line edit in that file. See ADR-034.
 */
export function buildOnlineStoreSchema(): OnlineStoreSchema {
  return {
    "@type": ["OnlineStore", "LocalBusiness"],
    "@id": getStoreId(),
    name: SITE_CONFIG.brandName,
    legalName: LEGAL_CONFIG.entityName,
    url: `${getSiteUrl()}/`,
    image: absoluteUrl(SITE_CONFIG.ogImage.url),
    description: SITE_CONFIG.description,
    telephone: BUSINESS.phoneDisplay,
    email: CONTACT_CONFIG.supportEmail,
    address: buildPostalAddress(),
    geo: {
      "@type": "GeoCoordinates",
      latitude: GEO_CONFIG.latitude,
      longitude: GEO_CONFIG.longitude,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [...OPENING_HOURS_CONFIG.dayOfWeek],
        opens: OPENING_HOURS_CONFIG.opens,
        closes: OPENING_HOURS_CONFIG.closes,
      },
    ],
    priceRange: buildPriceRange(),
    currenciesAccepted: CURRENCY,
    paymentAccepted: LEGAL_CONFIG.paymentProvider,
    areaServed: SHIPPING_COUNTRY_CODE,
    parentOrganization: { "@id": getOrganizationId() },
    sameAs: [...BUSINESS.socialProfileUrls],
  };
}

/**
 * No `SearchAction`. The site has no search endpoint, and a `potentialAction` pointing at a
 * URL that does not resolve is a claim a crawler will follow and find broken.
 */
export function buildWebSiteSchema(): WebSiteSchema {
  return {
    "@type": "WebSite",
    "@id": getWebSiteId(),
    name: SITE_CONFIG.brandName,
    url: `${getSiteUrl()}/`,
    description: SITE_CONFIG.description,
    inLanguage: "en-IN",
    publisher: { "@id": getOrganizationId() },
  };
}

export function buildSiteSchemaGraph(): SchemaGraph {
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      buildOrganizationSchema(),
      buildOnlineStoreSchema(),
      buildWebSiteSchema(),
    ],
  };
}

/**
 * The seven-day window for anything the policy lets a shopper send back, and an explicit
 * `MerchantReturnNotPermitted` for the pieces it does not. Stating the window on a
 * personalised ring would be a promise the refund policy does not make, and leaving the
 * property off entirely would let a crawler assume a default.
 */
export function buildReturnPolicySchema(product: Product): MerchantReturnPolicySchema {
  const shared = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: SHIPPING_COUNTRY_CODE,
    returnPolicyCountry: SHIPPING_COUNTRY_CODE,
    merchantReturnLink: absoluteUrl("/refund"),
  } as const;

  if (!isReturnable(product)) {
    return {
      ...shared,
      returnPolicyCategory: `${SCHEMA_CONTEXT}/MerchantReturnNotPermitted`,
    };
  }

  return {
    ...shared,
    returnPolicyCategory: `${SCHEMA_CONTEXT}/MerchantReturnFiniteReturnWindow`,
    merchantReturnDays: RETURN_WINDOW_DAYS,
    returnMethod: `${SCHEMA_CONTEXT}/ReturnByMail`,
    returnFees: `${SCHEMA_CONTEXT}/ReturnFeesCustomerResponsibility`,
  };
}

/**
 * What shipping this piece costs on its own, from the same `calculateShipping` the cart and
 * the server-side order pricing use — so the rate published to a crawler cannot drift from
 * the rate charged. An offer describes one item, so the basis is a single-unit order: a
 * shopper who fills a basket past the free-shipping threshold pays less than this, never
 * more.
 *
 * Handling starts at zero because a piece can leave the same day; transit starts at one
 * because nothing arrives before it has been dispatched.
 */
export function buildShippingDetailsSchema(product: Product): OfferShippingDetailsSchema {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: calculateShipping(product.pricing.price),
      currency: CURRENCY,
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: SHIPPING_COUNTRY_CODE,
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: DISPATCH_BUSINESS_DAYS,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: 1,
        maxValue: DELIVERY_BUSINESS_DAYS,
        unitCode: "DAY",
      },
    },
  };
}

export function buildOfferSchema(product: Product): OfferSchema {
  const url = absoluteUrl(`/product/${product.id}`);

  return {
    "@type": "Offer",
    "@id": `${url}#offer`,
    url,
    price: product.pricing.price,
    priceCurrency: CURRENCY,
    priceValidUntil: getOfferPriceValidUntil(),
    availability: product.stock.inStock
      ? `${SCHEMA_CONTEXT}/InStock`
      : `${SCHEMA_CONTEXT}/OutOfStock`,
    itemCondition: `${SCHEMA_CONTEXT}/NewCondition`,
    seller: { "@id": getOrganizationId() },
    hasMerchantReturnPolicy: buildReturnPolicySchema(product),
    shippingDetails: buildShippingDetailsSchema(product),
  };
}

/**
 * Every photograph the gallery can show, not just the first. A variant photograph is one of
 * this product's images too, and the values are de-duplicated because a variant map often
 * points back at an image already in `media.images`.
 */
function collectProductImages(product: Product): string[] {
  const variantImages = Object.values(product.media.variantImages ?? {});
  const seen = new Set<string>();

  return [...product.media.images, ...variantImages]
    .filter((image) => {
      if (seen.has(image)) return false;
      seen.add(image);
      return true;
    })
    .map(absoluteUrl);
}

/**
 * No `aggregateRating` and no `review`. This store has collected no reviews, and a rating a
 * shopper cannot verify is a claim rather than a fact — the one kind of structured data that
 * earns a manual action rather than a rich result. The properties come back when real
 * reviews exist, with the reviewers' own words and dates. See
 * [ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md).
 */
export function buildProductSchema(product: Product): ProductSchema {
  return {
    "@type": "Product",
    "@id": getProductId(product.id),
    name: product.name,
    description: product.description,
    image: collectProductImages(product),
    sku: product.id,
    brand: { "@type": "Brand", name: SITE_CONFIG.brandName },
    category: getCategoryLabel(product.category),
    url: absoluteUrl(`/product/${product.id}`),
    offers: buildOfferSchema(product),
    additionalProperty: toSpecRows(product.specs).map((spec) => ({
      "@type": "PropertyValue",
      name: spec.label,
      value: spec.value,
    })),
  };
}

/**
 * The visible trail as a `BreadcrumbList`. The final step is the page itself and carries no
 * `item`, which is what the vocabulary asks for and what the rendered trail does too.
 */
export function buildBreadcrumbSchema(
  trail: BreadcrumbStep[],
  pagePath: string,
): BreadcrumbListSchema {
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(pagePath)}#breadcrumb`,
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.label,
      ...(step.href === undefined ? {} : { item: absoluteUrl(step.href) }),
    })),
  };
}

export interface CollectionPageInput {
  /** The canonical path of the listing, sort stripped — what both nodes call themselves. */
  path: string;
  name: string;
  description: string;
  products: Product[];
  /** How many products match the filters in total, not just on this page. */
  total: number;
  /** 1-based position of the first product on this page within the whole result set. */
  rangeStart: number;
}

/**
 * What a filtered listing is and what is on it: a `CollectionPage` naming the page, and the
 * `ItemList` of the pieces it actually shows, in the order it shows them. Only the products
 * rendered on this page are listed — claiming the other pages' products would describe a
 * page the crawler is not looking at.
 */
export function buildCollectionPageSchemaGraph({
  path,
  name,
  description,
  products,
  total,
  rangeStart,
}: CollectionPageInput): SchemaGraph {
  const url = absoluteUrl(path);
  const itemListId = `${url}#itemlist`;

  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#collectionpage`,
        name,
        description,
        url,
        isPartOf: { "@id": getWebSiteId() },
        mainEntity: { "@id": itemListId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name,
        numberOfItems: total,
        itemListOrder: `${SCHEMA_CONTEXT}/ItemListOrderAscending`,
        itemListElement: products.map((product, index) => ({
          "@type": "ListItem",
          position: rangeStart + index,
          name: product.name,
          item: absoluteUrl(`/product/${product.id}`),
        })),
      },
    ],
  };
}

export function buildProductSchemaGraph(
  product: Product,
  trail: BreadcrumbStep[],
): SchemaGraph {
  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      buildProductSchema(product),
      buildBreadcrumbSchema(trail, `/product/${product.id}`),
    ],
  };
}
