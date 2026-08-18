import {
  getCategoryLabel,
  type Category,
  type Product,
  type Review,
} from "@/types/product";
import { BUSINESS } from "@/config/business";
import {
  CONTACT_CONFIG,
  DELIVERY_BUSINESS_DAYS,
  DISPATCH_BUSINESS_DAYS,
  LEGAL_CONFIG,
  POSTAL_ADDRESS_CONFIG,
  RETURN_WINDOW_DAYS,
  SHIPPING_COUNTRY_CODE,
  SITE_CONFIG,
  STORY_CONFIG,
  calculateShipping,
} from "@/lib/config";
import { toSpecRows } from "@/lib/specs";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";
import type { BreadcrumbStep } from "@/lib/breadcrumbs";

const SCHEMA_CONTEXT = "https://schema.org";

/** Ratings in this catalogue are out of five, with one the lowest a review can give. */
const BEST_RATING = 5;
const WORST_RATING = 1;

const CURRENCY = "INR";

/**
 * How long the published price is stated to hold. The catalogue ships as code and has no
 * price calendar, so this is a commitment rather than a lookup: a date far enough out that a
 * crawler does not treat the offer as expired, near enough that it is revisited. Bump it when
 * the catalogue is repriced.
 */
export const OFFER_PRICE_VALID_UNTIL = "2027-12-31";

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

export interface RatingSchema {
  "@type": "Rating";
  ratingValue: number;
  bestRating: number;
  worstRating: number;
}

export interface AggregateRatingSchema {
  "@type": "AggregateRating";
  ratingValue: number;
  reviewCount: number;
  bestRating: number;
  worstRating: number;
}

export interface ReviewSchema {
  "@type": "Review";
  author: { "@type": "Person"; name: string };
  reviewRating: RatingSchema;
  reviewBody: string;
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
  aggregateRating?: AggregateRatingSchema;
  review?: ReviewSchema[];
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

export type SchemaNode =
  | OrganizationSchema
  | WebSiteSchema
  | ProductSchema
  | BreadcrumbListSchema;

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
    "@graph": [buildOrganizationSchema(), buildWebSiteSchema()],
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
    priceValidUntil: OFFER_PRICE_VALID_UNTIL,
    availability: product.stock.inStock
      ? `${SCHEMA_CONTEXT}/InStock`
      : `${SCHEMA_CONTEXT}/OutOfStock`,
    itemCondition: `${SCHEMA_CONTEXT}/NewCondition`,
    seller: { "@id": getOrganizationId() },
    hasMerchantReturnPolicy: buildReturnPolicySchema(product),
    shippingDetails: buildShippingDetailsSchema(product),
  };
}

function toReviewSchema(review: Review): ReviewSchema {
  return {
    "@type": "Review",
    author: { "@type": "Person", name: review.name },
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: BEST_RATING,
      worstRating: WORST_RATING,
    },
    reviewBody: review.text,
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

export function buildProductSchema(product: Product): ProductSchema {
  const hasRatings = product.rating.count > 0;
  const hasReviews = product.reviews.length > 0;

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
    ...(hasRatings
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating.average,
            reviewCount: product.rating.count,
            bestRating: BEST_RATING,
            worstRating: WORST_RATING,
          } satisfies AggregateRatingSchema,
        }
      : {}),
    ...(hasReviews ? { review: product.reviews.map(toReviewSchema) } : {}),
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
