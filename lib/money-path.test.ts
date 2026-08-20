import { describe, expect, it } from "vitest";
import type { CreateOrderItem } from "@/types/order";
import type { Product } from "@/types/product";
import {
  buildOrderFromCart,
  mergeOrderItemsByProduct,
  parseOrderItems,
} from "@/lib/order";
import { toOrderOptionTags, validateOrderLineOptions } from "@/lib/order-options";
import {
  getAllProducts,
  getCatalogueIndex,
  getOrderOptionCatalogue,
  getOrderPricingCatalogue,
} from "@/lib/products";
import { parseUtmParams, toUtmOrderTags } from "@/lib/utm";

const WATCH_RING_ID = "P010";
const INITIAL_RING_ID = "P001";
const NECKLACE_ID = "P002";

function productById(id: string): Product {
  const product = getAllProducts().find((candidate) => candidate.id === id);
  if (product === undefined) throw new Error(`Fixture product ${id} is missing`);
  return product;
}

function totalFor(items: CreateOrderItem[]): number {
  return pricedOrder(items).total;
}

function subtotalFor(items: CreateOrderItem[]): number {
  return pricedOrder(items).subtotal;
}

function pricedOrder(items: CreateOrderItem[]): {
  subtotal: number;
  total: number;
} {
  const order = buildOrderFromCart(
    mergeOrderItemsByProduct(items),
    getOrderPricingCatalogue(),
  );
  expect(order.valid).toBe(true);
  return { subtotal: order.subtotal, total: order.total };
}

describe("what the pricing catalogue is allowed to carry", () => {
  it("holds a price and nothing else that looks like money", () => {
    for (const entry of getOrderPricingCatalogue()) {
      expect(Object.keys(entry).sort()).toEqual(["id", "inStock", "name", "price"]);
    }
  });

  it("does not carry mrp at all, so no cast can reach a compare-at price", () => {
    const marked = getOrderPricingCatalogue().find(
      (entry) => entry.id === WATCH_RING_ID,
    );

    expect(marked).not.toHaveProperty("mrp");
    expect(JSON.stringify(getOrderPricingCatalogue())).not.toContain("mrp");
    expect(marked?.price).toBe(productById(WATCH_RING_ID).pricing.price);
  });

  it("does not carry cost, which is margin data and more sensitive than mrp", () => {
    const serialised = JSON.stringify(getOrderPricingCatalogue());

    expect(serialised).not.toContain("cost");
    for (const entry of getOrderPricingCatalogue()) {
      expect(entry).not.toHaveProperty("cost");
    }
  });

  it("does not carry options, variant images, specs or reviews", () => {
    const serialised = JSON.stringify(getOrderPricingCatalogue());

    expect(serialised).not.toContain("variantImages");
    expect(serialised).not.toContain("options");
    expect(serialised).not.toContain("specs");
    expect(serialised).not.toContain("reviews");
  });

  it("keeps the fulfilment catalogue free of every amount", () => {
    const serialised = JSON.stringify(getOrderOptionCatalogue());

    expect(serialised).not.toContain("price");
    expect(serialised).not.toContain("mrp");
    expect(serialised).not.toContain("pricing");

    for (const entry of getOrderOptionCatalogue()) {
      expect(entry).not.toHaveProperty("price");
      expect(entry).not.toHaveProperty("pricing");
    }
  });
});

describe("what crosses into the browser", () => {
  it("hands the client cart no cost, so margin data never reaches a bundle", () => {
    const serialised = JSON.stringify(getCatalogueIndex());

    expect(serialised).not.toContain("cost");
    for (const entry of getCatalogueIndex()) {
      expect(entry).not.toHaveProperty("cost");
    }
  });

  it("still carries a cost on every product it was narrowed from", () => {
    for (const product of getAllProducts()) {
      expect(product.pricing.cost).toBeGreaterThan(0);
      expect(product.pricing.cost).toBeLessThan(product.pricing.price);
    }
  });
});

describe("a tampered request", () => {
  it("is priced from the catalogue, whatever amounts the client attached", () => {
    const tampered = parseOrderItems([
      { productId: WATCH_RING_ID, qty: 1, price: 1, mrp: 1, lineTotal: 1, total: 1 },
    ]);

    expect(tampered).not.toBeNull();
    expect(tampered?.[0]).toEqual({ productId: WATCH_RING_ID, qty: 1 });
    expect(totalFor(tampered ?? [])).toBe(
      totalFor([{ productId: WATCH_RING_ID, qty: 1 }]),
    );
  });

  it("cannot make a marked-down piece cost its mrp", () => {
    const watchRing = productById(WATCH_RING_ID);
    const order = buildOrderFromCart(
      [{ productId: WATCH_RING_ID, qty: 1 }],
      getOrderPricingCatalogue(),
    );

    expect(watchRing.pricing.mrp).toBeGreaterThan(watchRing.pricing.price);
    expect(order.lineItems[0].unitPrice).toBe(watchRing.pricing.price);
    expect(order.subtotal).toBe(watchRing.pricing.price);
    expect(order.subtotal).not.toBe(watchRing.pricing.mrp);
  });
});

describe("a recorded choice", () => {
  it("costs nothing, whichever value is chosen", () => {
    const plain = totalFor([{ productId: INITIAL_RING_ID, qty: 1 }]);
    const letterA = totalFor([
      { productId: INITIAL_RING_ID, qty: 1, selectedOptions: { Letter: "A" } },
    ]);
    const letterZ = totalFor([
      { productId: INITIAL_RING_ID, qty: 1, selectedOptions: { Letter: "Z" } },
    ]);

    expect(letterA).toBe(plain);
    expect(letterZ).toBe(plain);
  });

  it("costs the same across two lines of one product as two of one line", () => {
    const twoChoices = totalFor([
      { productId: INITIAL_RING_ID, qty: 1, selectedOptions: { Letter: "A" } },
      { productId: INITIAL_RING_ID, qty: 1, selectedOptions: { Letter: "B" } },
    ]);
    const twoOfOne = totalFor([{ productId: INITIAL_RING_ID, qty: 2 }]);

    expect(twoChoices).toBe(twoOfOne);
  });

  it("is checked against the catalogue without any amount being consulted", () => {
    const result = validateOrderLineOptions(
      [{ productId: INITIAL_RING_ID, qty: 1, selectedOptions: { Letter: "C" } }],
      getOrderOptionCatalogue(),
    );

    expect(result.errors).toEqual([]);
    expect(result.summary).toBe("P001:Letter=C");
    expect(result.summary).not.toContain("₹");
  });
});

describe("a per-variant image", () => {
  it("does not change what the variant costs", () => {
    const watchRing = productById(WATCH_RING_ID);
    const mapped = Object.keys(watchRing.media.variantImages ?? {});

    expect(mapped).toContain("Colour:Golden");

    const silver = subtotalFor([
      { productId: WATCH_RING_ID, qty: 1, selectedOptions: { Colour: "Silver" } },
    ]);
    const golden = subtotalFor([
      { productId: WATCH_RING_ID, qty: 1, selectedOptions: { Colour: "Golden" } },
    ]);

    expect(golden).toBe(silver);
    expect(golden).toBe(watchRing.pricing.price);
  });
});

describe("a second gallery image", () => {
  it("does not change what the product costs", () => {
    const necklace = productById(NECKLACE_ID);

    expect(necklace.media.images.length).toBeGreaterThan(1);
    expect(subtotalFor([{ productId: NECKLACE_ID, qty: 1 }])).toBe(
      necklace.pricing.price,
    );
  });
});

describe("the single-image products", () => {
  it("price exactly as they did before media grew a second field", () => {
    const untouched = getAllProducts().filter(
      (product) =>
        product.media.images.length === 1 && product.media.variantImages === undefined,
    );

    expect(untouched.length).toBe(getAllProducts().length - 2);

    for (const product of untouched) {
      if (!product.stock.inStock) continue;
      expect(subtotalFor([{ productId: product.id, qty: 1 }]), product.id).toBe(
        product.pricing.price,
      );
    }
  });
});

describe("a campaign attached to the request", () => {
  const CAMPAIGN_BODY = {
    items: [{ productId: WATCH_RING_ID, qty: 2 }],
    utm: {
      source: "instagram",
      medium: "paid_social",
      campaign: "rakhi_2026",
      term: "anti tarnish rings",
      content: "carousel_2",
    },
  };

  it("does not reach the pricing core, which has no parameter for it", () => {
    const items = parseOrderItems(CAMPAIGN_BODY.items);

    expect(items).not.toBeNull();
    expect(items?.[0]).toEqual({ productId: WATCH_RING_ID, qty: 2 });
    expect(totalFor(items ?? [])).toBe(
      totalFor([{ productId: WATCH_RING_ID, qty: 2 }]),
    );
  });

  it("prices an order identically whether it is present, absent or nonsense", () => {
    const priced = totalFor([{ productId: WATCH_RING_ID, qty: 2 }]);

    for (const utm of [
      undefined,
      null,
      { source: "instagram" },
      { source: "instagram", campaign: "rakhi_2026" },
      { price: 1, total: 1, shipping: 0 },
    ]) {
      const items = parseOrderItems([
        { productId: WATCH_RING_ID, qty: 2, utm },
      ]);

      expect(totalFor(items ?? []), JSON.stringify(utm)).toBe(priced);
      expect(parseUtmParams(utm) ?? {}).not.toHaveProperty("price");
    }
  });

  it("cannot smuggle an amount in through a utm field", () => {
    expect(parseUtmParams({ price: 1, total: 999, shipping: 0 })).toBeNull();
    expect(toUtmOrderTags(parseUtmParams({ price: 1 }))).toEqual({});
  });

  it("rides on the order tags beside the recorded choices, never instead of them", () => {
    const { summary } = validateOrderLineOptions(
      [{ productId: INITIAL_RING_ID, qty: 1, selectedOptions: { Letter: "A" } }],
      getOrderOptionCatalogue(),
    );
    const tags = {
      ...toOrderOptionTags(summary),
      ...toUtmOrderTags(parseUtmParams(CAMPAIGN_BODY.utm)),
    };

    expect(tags.options).toContain("Letter=A");
    expect(tags.utm_source).toBe("instagram");
    expect(Object.keys(tags).length).toBeLessThanOrEqual(10);
    expect(JSON.stringify(tags)).not.toContain(
      String(productById(INITIAL_RING_ID).pricing.price),
    );
  });

  it("leaves an untagged order sending exactly the tags it always sent", () => {
    const { summary } = validateOrderLineOptions(
      [{ productId: INITIAL_RING_ID, qty: 1, selectedOptions: { Letter: "A" } }],
      getOrderOptionCatalogue(),
    );

    expect({
      ...toOrderOptionTags(summary),
      ...toUtmOrderTags(null),
    }).toEqual(toOrderOptionTags(summary));

    expect({
      ...toOrderOptionTags(""),
      ...toUtmOrderTags(null),
    }).toEqual({});
  });
});
