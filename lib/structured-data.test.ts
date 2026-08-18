import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCategoryLabel, type Product } from "@/types/product";
import {
  FLAT_SHIPPING_RATE,
  FREE_SHIPPING_THRESHOLD,
  LEGAL_CONFIG,
  RETURN_WINDOW_DAYS,
  SITE_CONFIG,
} from "@/lib/config";
import { buildProductBreadcrumb } from "@/lib/breadcrumbs";
import { getAllProducts, getProductById } from "@/lib/products";
import {
  OFFER_PRICE_VALID_UNTIL,
  buildBreadcrumbSchema,
  buildOfferSchema,
  buildOrganizationSchema,
  buildProductSchema,
  buildProductSchemaGraph,
  buildReturnPolicySchema,
  buildShippingDetailsSchema,
  buildSiteSchemaGraph,
  buildWebSiteSchema,
  getOrganizationId,
  isReturnable,
} from "@/lib/structured-data";

const PRODUCTION_ORIGIN = "https://www.morchadigems.com";

const previousAppBaseUrl = process.env.APP_BASE_URL;
const previousPublicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

beforeEach(() => {
  process.env.APP_BASE_URL = PRODUCTION_ORIGIN;
  delete process.env.NEXT_PUBLIC_BASE_URL;
});

afterEach(() => {
  if (previousAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = previousAppBaseUrl;

  if (previousPublicBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
  else process.env.NEXT_PUBLIC_BASE_URL = previousPublicBaseUrl;
});

function requireProduct(id: string): Product {
  const product = getProductById(id);
  if (product === undefined) throw new Error(`Fixture product ${id} is missing`);
  return product;
}

function findProduct(predicate: (product: Product) => boolean): Product {
  const product = getAllProducts().find(predicate);
  if (product === undefined) throw new Error("No catalogue product matches the fixture");
  return product;
}

describe("the Organization schema", () => {
  it("states the brand a shopper sees and the entity that trades as it", () => {
    const organization = buildOrganizationSchema();

    expect(organization["@type"]).toBe("Organization");
    expect(organization.name).toBe(SITE_CONFIG.brandName);
    expect(organization.legalName).toBe(LEGAL_CONFIG.entityName);
    expect(organization["@id"]).toBe(`${PRODUCTION_ORIGIN}/#organization`);
    expect(organization.url).toBe(`${PRODUCTION_ORIGIN}/`);
  });

  it("points at an absolute logo and share image", () => {
    const organization = buildOrganizationSchema();

    expect(organization.logo.url).toBe(`${PRODUCTION_ORIGIN}/logo.png`);
    expect(organization.logo.width).toBeGreaterThan(0);
    expect(organization.image).toBe(`${PRODUCTION_ORIGIN}${SITE_CONFIG.ogImage.url}`);
  });

  it("carries the Jaipur postal address in parts", () => {
    const { address } = buildOrganizationSchema();

    expect(address["@type"]).toBe("PostalAddress");
    expect(address.addressLocality).toBe("Jaipur");
    expect(address.addressRegion).toBe("Rajasthan");
    expect(address.postalCode).toBe("302020");
    expect(address.addressCountry).toBe("IN");
  });

  it("offers one support contact point covering India", () => {
    const [contactPoint, ...rest] = buildOrganizationSchema().contactPoint;

    expect(rest).toEqual([]);
    expect(contactPoint.email).toBe("admin@morchadigems.com");
    expect(contactPoint.telephone).toBe("+91 9358358834");
    expect(contactPoint.areaServed).toBe("IN");
  });

  it("claims no social profile it cannot prove", () => {
    expect(buildOrganizationSchema().sameAs).toEqual([]);
  });
});

describe("the WebSite schema", () => {
  it("names the organization as publisher by reference", () => {
    const website = buildWebSiteSchema();

    expect(website["@type"]).toBe("WebSite");
    expect(website["@id"]).toBe(`${PRODUCTION_ORIGIN}/#website`);
    expect(website.url).toBe(`${PRODUCTION_ORIGIN}/`);
    expect(website.publisher["@id"]).toBe(getOrganizationId());
  });

  it("declares no SearchAction, because the site has no search", () => {
    expect(JSON.stringify(buildWebSiteSchema())).not.toContain("SearchAction");
  });

  it("ships both site-wide nodes in one graph", () => {
    const graph = buildSiteSchemaGraph();

    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"].map((node) => node["@type"])).toEqual([
      "Organization",
      "WebSite",
    ]);
  });
});

describe("the Product offer", () => {
  it("prices in rupees from the charged amount, never the compare-at price", () => {
    const product = requireProduct("P001");
    const offer = buildOfferSchema(product);

    expect(offer.price).toBe(product.pricing.price);
    expect(offer.priceCurrency).toBe("INR");
    expect(offer.price).not.toBe(product.pricing.mrp);
    expect(JSON.stringify(offer)).not.toContain(`${product.pricing.mrp}`);
  });

  it("marks a stocked piece InStock and a sold-out one OutOfStock", () => {
    const stocked = findProduct((product) => product.stock.inStock);
    const soldOut = findProduct((product) => !product.stock.inStock);

    expect(buildOfferSchema(stocked).availability).toBe("https://schema.org/InStock");
    expect(buildOfferSchema(soldOut).availability).toBe("https://schema.org/OutOfStock");
  });

  it("sells new stock, holds the price to a future date, and names the seller", () => {
    const offer = buildOfferSchema(requireProduct("P001"));

    expect(offer.itemCondition).toBe("https://schema.org/NewCondition");
    expect(offer.priceValidUntil).toBe(OFFER_PRICE_VALID_UNTIL);
    expect(Date.parse(`${OFFER_PRICE_VALID_UNTIL}T00:00:00Z`)).toBeGreaterThan(
      Date.parse("2026-08-18T00:00:00Z"),
    );
    expect(offer.seller["@id"]).toBe(getOrganizationId());
  });

  it("gives the offer an absolute url and id", () => {
    const offer = buildOfferSchema(requireProduct("P001"));

    expect(offer.url).toBe(`${PRODUCTION_ORIGIN}/product/P001`);
    expect(offer["@id"]).toBe(`${PRODUCTION_ORIGIN}/product/P001#offer`);
  });
});

describe("the return policy in the offer", () => {
  it("states the real seven-day window for a piece the policy lets you send back", () => {
    const returnable = findProduct(isReturnable);
    const policy = buildReturnPolicySchema(returnable);

    expect(policy.returnPolicyCategory).toBe(
      "https://schema.org/MerchantReturnFiniteReturnWindow",
    );
    expect(policy.merchantReturnDays).toBe(RETURN_WINDOW_DAYS);
    expect(policy.merchantReturnDays).toBe(7);
    expect(policy.returnMethod).toBe("https://schema.org/ReturnByMail");
    expect(policy.returnFees).toBe(
      "https://schema.org/ReturnFeesCustomerResponsibility",
    );
  });

  it("permits no return on a personalized piece, and promises no window", () => {
    const initialRing = requireProduct("P001");

    expect(isReturnable(initialRing)).toBe(false);

    const policy = buildReturnPolicySchema(initialRing);
    expect(policy.returnPolicyCategory).toBe(
      "https://schema.org/MerchantReturnNotPermitted",
    );
    expect(policy.merchantReturnDays).toBeUndefined();
  });

  it("permits no return on pierced jewellery, matching the hygiene exclusion", () => {
    for (const category of ["earrings", "nose-pins"] as const) {
      const pierced = findProduct((product) => product.category === category);

      expect(buildReturnPolicySchema(pierced).returnPolicyCategory).toBe(
        "https://schema.org/MerchantReturnNotPermitted",
      );
    }
  });

  it("keeps a colour or shape choice returnable, because a variant is not made to order", () => {
    for (const id of ["P006", "P010", "P048"]) {
      const configurable = requireProduct(id);

      expect(configurable.options?.length ?? 0).toBeGreaterThan(0);
      expect(isReturnable(configurable)).toBe(true);
    }
  });

  it("applies to India and links to the refund policy on every product", () => {
    for (const product of getAllProducts()) {
      const policy = buildReturnPolicySchema(product);

      expect(policy.applicableCountry).toBe("IN");
      expect(policy.returnPolicyCountry).toBe("IN");
      expect(policy.merchantReturnLink).toBe(`${PRODUCTION_ORIGIN}/refund`);
    }
  });
});

describe("the shipping details in the offer", () => {
  it("charges the flat rate below the free-shipping threshold", () => {
    const belowThreshold = findProduct(
      (product) => product.pricing.price < FREE_SHIPPING_THRESHOLD,
    );

    const { shippingRate } = buildShippingDetailsSchema(belowThreshold);
    expect(shippingRate.value).toBe(FLAT_SHIPPING_RATE);
    expect(shippingRate.value).toBe(99);
    expect(shippingRate.currency).toBe("INR");
  });

  it("charges the flat rate on every product, because none reaches the threshold alone", () => {
    for (const product of getAllProducts()) {
      expect(product.pricing.price).toBeLessThan(FREE_SHIPPING_THRESHOLD);
      expect(buildShippingDetailsSchema(product).shippingRate.value).toBe(
        FLAT_SHIPPING_RATE,
      );
    }
  });

  it("charges nothing once a piece does reach the threshold on its own", () => {
    const atThreshold: Product = {
      ...requireProduct("P001"),
      pricing: { price: FREE_SHIPPING_THRESHOLD, mrp: FREE_SHIPPING_THRESHOLD },
    };

    expect(buildShippingDetailsSchema(atThreshold).shippingRate.value).toBe(0);
  });

  it("ships to India and nowhere else", () => {
    for (const product of getAllProducts()) {
      const { shippingDestination } = buildShippingDetailsSchema(product);

      expect(shippingDestination["@type"]).toBe("DefinedRegion");
      expect(shippingDestination.addressCountry).toBe("IN");
    }
  });

  it("states dispatch within two days and delivery within seven", () => {
    const { deliveryTime } = buildShippingDetailsSchema(requireProduct("P001"));

    expect(deliveryTime.handlingTime.maxValue).toBe(2);
    expect(deliveryTime.handlingTime.unitCode).toBe("DAY");
    expect(deliveryTime.transitTime.maxValue).toBe(7);
    expect(deliveryTime.transitTime.minValue).toBeGreaterThan(0);
    expect(`${deliveryTime.handlingTime.maxValue} business days`).toBe(
      LEGAL_CONFIG.dispatchWindow,
    );
    expect(`${deliveryTime.transitTime.maxValue} business days`).toBe(
      LEGAL_CONFIG.deliveryWindow,
    );
  });
});

describe("the Product schema", () => {
  it("identifies the piece by its P-code, brand and category", () => {
    const product = requireProduct("P001");
    const schema = buildProductSchema(product);

    expect(schema["@type"]).toBe("Product");
    expect(schema["@id"]).toBe(`${PRODUCTION_ORIGIN}/product/P001#product`);
    expect(schema.sku).toBe("P001");
    expect(schema.brand).toEqual({ "@type": "Brand", name: SITE_CONFIG.brandName });
    expect(schema.category).toBe(getCategoryLabel(product.category));
    expect(schema.name).toBe(product.name);
    expect(schema.description).toBe(product.description);
  });

  it("lists every gallery photograph as an absolute url, without repeats", () => {
    for (const product of getAllProducts()) {
      const { image } = buildProductSchema(product);

      expect(image.length).toBeGreaterThan(0);
      expect(new Set(image).size).toBe(image.length);
      for (const url of image) {
        expect(url.startsWith(`${PRODUCTION_ORIGIN}/`)).toBe(true);
      }
    }
  });

  it("includes the variant photographs, not just the primary one", () => {
    const withVariants = findProduct(
      (product) => product.media.variantImages !== undefined,
    );
    const { image } = buildProductSchema(withVariants);

    for (const variantImage of Object.values(withVariants.media.variantImages ?? {})) {
      expect(image).toContain(`${PRODUCTION_ORIGIN}${variantImage}`);
    }
  });

  it("carries an aggregate rating and the reviews behind it on every product", () => {
    for (const product of getAllProducts()) {
      const schema = buildProductSchema(product);

      expect(product.rating.count).toBeGreaterThan(0);
      expect(schema.aggregateRating).toBeDefined();
      expect(schema.aggregateRating?.ratingValue).toBe(product.rating.average);
      expect(schema.aggregateRating?.reviewCount).toBe(product.rating.count);
      expect(schema.aggregateRating?.bestRating).toBe(5);
      expect(schema.review).toHaveLength(product.reviews.length);
    }
  });

  it("renders a review as an author, a rating and the body they wrote", () => {
    const product = requireProduct("P001");
    const [firstReview] = buildProductSchema(product).review ?? [];
    const [source] = product.reviews;

    expect(firstReview.author).toEqual({ "@type": "Person", name: source.name });
    expect(firstReview.reviewRating.ratingValue).toBe(source.rating);
    expect(firstReview.reviewRating.bestRating).toBe(5);
    expect(firstReview.reviewBody).toBe(source.text);
  });

  it("publishes the specs as additional properties", () => {
    const product = requireProduct("P001");
    const { additionalProperty } = buildProductSchema(product);

    expect(additionalProperty).toHaveLength(Object.keys(product.specs).length);
    expect(additionalProperty.every((entry) => entry.value.length > 0)).toBe(true);
  });

  it("gives every one of the 49 products a well-formed, parseable graph", () => {
    const products = getAllProducts();
    expect(products).toHaveLength(49);

    for (const product of products) {
      const graph = buildProductSchemaGraph(product, buildProductBreadcrumb(product));
      const roundTripped: unknown = JSON.parse(JSON.stringify(graph));

      expect(roundTripped).toEqual(graph);
      expect(graph["@context"]).toBe("https://schema.org");
      expect(graph["@graph"].map((node) => node["@type"])).toEqual([
        "Product",
        "BreadcrumbList",
      ]);
    }
  });

  it("leaves no relative url anywhere in a product graph", () => {
    for (const product of getAllProducts()) {
      const serialised = JSON.stringify(
        buildProductSchemaGraph(product, buildProductBreadcrumb(product)),
      );

      expect(serialised).not.toMatch(/"(?:url|item|@id|merchantReturnLink)":"\/(?!\/)/);
    }
  });
});

describe("the BreadcrumbList schema", () => {
  it("mirrors the visible trail, Home to Shop to category to product", () => {
    const product = requireProduct("P001");
    const schema = buildBreadcrumbSchema(
      buildProductBreadcrumb(product),
      `/product/${product.id}`,
    );

    expect(schema["@id"]).toBe(`${PRODUCTION_ORIGIN}/product/P001#breadcrumb`);
    expect(schema.itemListElement.map((step) => step.name)).toEqual([
      "Home",
      "Shop",
      getCategoryLabel(product.category),
      product.name,
    ]);
    expect(schema.itemListElement.map((step) => step.position)).toEqual([1, 2, 3, 4]);
  });

  it("links every step but the current page, absolutely", () => {
    const product = requireProduct("P001");
    const { itemListElement } = buildBreadcrumbSchema(
      buildProductBreadcrumb(product),
      `/product/${product.id}`,
    );
    const [home, shop, category, current] = itemListElement;

    expect(home.item).toBe(`${PRODUCTION_ORIGIN}/`);
    expect(shop.item).toBe(`${PRODUCTION_ORIGIN}/shop`);
    expect(category.item).toBe(`${PRODUCTION_ORIGIN}/shop?category=rings`);
    expect(current.item).toBeUndefined();
  });
});

describe("the base url the schema is built from", () => {
  it("prefers the server-only variable over the public one", () => {
    process.env.APP_BASE_URL = "https://server.example";
    process.env.NEXT_PUBLIC_BASE_URL = "https://public.example";

    expect(buildOrganizationSchema().url).toBe("https://server.example/");
  });

  it("falls back to the public variable when only that is set", () => {
    delete process.env.APP_BASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = "https://public.example";

    expect(buildOrganizationSchema().url).toBe("https://public.example/");
  });

  it("strips a trailing slash rather than doubling it into every id", () => {
    process.env.APP_BASE_URL = `${PRODUCTION_ORIGIN}/`;

    expect(getOrganizationId()).toBe(`${PRODUCTION_ORIGIN}/#organization`);
    expect(buildOfferSchema(requireProduct("P001")).url).toBe(
      `${PRODUCTION_ORIGIN}/product/P001`,
    );
  });
});
