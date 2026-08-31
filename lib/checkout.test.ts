import { describe, expect, it } from "vitest";
import type { Address, CheckoutData } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { buildCartLines, type CartLine } from "@/lib/cart";
import { buildCheckoutData, parseCheckoutData } from "@/lib/checkout";
import { FLAT_SHIPPING_RATE } from "@/lib/config";

const NECKLACE: CatalogueEntry = {
  id: "nk-001",
  name: "Kundan Rani Haar",
  category: "necklaces",
  price: 1000,
  mrp: 1500,
  image: "/products/nk-001.webp",
  inStock: true,
};

const EARRING: CatalogueEntry = {
  id: "er-001",
  name: "Polki Jhumkas",
  category: "necklaces",
  price: 250,
  mrp: 400,
  image: "/products/er-001.webp",
  inStock: true,
};

const SOLD_OUT_RING: CatalogueEntry = {
  id: "rg-001",
  name: "Temple Gold Ring",
  category: "necklaces",
  price: 700,
  mrp: 900,
  image: "/products/rg-001.webp",
  inStock: false,
};

const CATALOGUE: CatalogueEntry[] = [NECKLACE, EARRING, SOLD_OUT_RING];

const ADDRESS: Address = {
  name: "Ananya Iyer",
  phone: "9876543210",
  email: "ananya@example.com",
  line1: "12 Rosewood Apartments",
  line2: "Off Turner Road",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400050",
};

function linesFor(quantities: Record<string, number>): CartLine[] {
  return buildCartLines(
    Object.entries(quantities).map(([productId, qty]) => ({
      productId,
      name: "snapshot",
      category: "necklaces",
      price: 1,
      image: "",
      qty,
    })),
    CATALOGUE,
  );
}

describe("buildCheckoutData", () => {
  it("bundles the cart, the address, and the totals", () => {
    const bundle = buildCheckoutData(linesFor({ "nk-001": 2 }), ADDRESS);

    expect(bundle).toEqual({
      cart: [
        {
          productId: "nk-001",
          name: "Kundan Rani Haar",
          price: 1000,
          image: "/products/nk-001.webp",
          qty: 2,
        },
      ],
      address: ADDRESS,
      subtotal: 2000,
      shipping: 0,
      total: 2000,
    });
  });

  it("carries the free shipping the subtotal has earned", () => {
    const bundle = buildCheckoutData(linesFor({ "nk-001": 2, "er-001": 4 }), ADDRESS);

    expect(bundle.cart).toHaveLength(2);
    expect(bundle.subtotal).toBe(2000 + 1000);
    expect(bundle.shipping).toBe(0);
    expect(bundle.total).toBe(3000);
  });

  it("charges flat shipping once across several below-threshold lines", () => {
    const bundle = buildCheckoutData(linesFor({ "er-001": 2 }), ADDRESS);

    expect(bundle.subtotal).toBe(500);
    expect(bundle.shipping).toBe(FLAT_SHIPPING_RATE);
    expect(bundle.total).toBe(500 + FLAT_SHIPPING_RATE);
  });

  it("prices from the catalogue, not from the cart's stored snapshot", () => {
    const bundle = buildCheckoutData(linesFor({ "nk-001": 1 }), ADDRESS);

    expect(bundle.cart[0].price).toBe(NECKLACE.price);
    expect(bundle.subtotal).toBe(NECKLACE.price);
  });

  it("never lets mrp into the bundle", () => {
    const bundle = buildCheckoutData(linesFor({ "nk-001": 1 }), ADDRESS);

    expect(JSON.stringify(bundle)).not.toContain(String(NECKLACE.mrp));
  });

  it("drops an unavailable line rather than billing for it", () => {
    const bundle = buildCheckoutData(
      linesFor({ "nk-001": 1, "rg-001": 2 }),
      ADDRESS,
    );

    expect(bundle.cart.map((item) => item.productId)).toEqual(["nk-001"]);
    expect(bundle.subtotal).toBe(1000);
  });

  it("produces an empty, unshipped bundle when nothing is payable", () => {
    const bundle = buildCheckoutData(linesFor({ "rg-001": 2 }), ADDRESS);

    expect(bundle.cart).toEqual([]);
    expect(bundle).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });
});

describe("parseCheckoutData", () => {
  const VALID_BUNDLE: CheckoutData = buildCheckoutData(
    linesFor({ "nk-001": 2 }),
    ADDRESS,
  );

  it("reads back a bundle it wrote", () => {
    expect(parseCheckoutData(JSON.stringify(VALID_BUNDLE))).toEqual(VALID_BUNDLE);
  });

  it("returns null when nothing is stored", () => {
    expect(parseCheckoutData(null)).toBeNull();
  });

  it("returns null for unparseable JSON", () => {
    expect(parseCheckoutData("{not json")).toBeNull();
  });

  it("returns null for JSON that is not an object", () => {
    expect(parseCheckoutData("[]")).toBeNull();
    expect(parseCheckoutData('"bundle"')).toBeNull();
    expect(parseCheckoutData("null")).toBeNull();
  });

  it("returns null for an empty or missing cart", () => {
    expect(parseCheckoutData(JSON.stringify({ ...VALID_BUNDLE, cart: [] }))).toBeNull();
    expect(
      parseCheckoutData(JSON.stringify({ ...VALID_BUNDLE, cart: undefined })),
    ).toBeNull();
  });

  it("returns null when a cart item is malformed", () => {
    expect(
      parseCheckoutData(
        JSON.stringify({ ...VALID_BUNDLE, cart: [{ productId: "nk-001" }] }),
      ),
    ).toBeNull();
    expect(
      parseCheckoutData(
        JSON.stringify({
          ...VALID_BUNDLE,
          cart: [{ ...VALID_BUNDLE.cart[0], qty: "2" }],
        }),
      ),
    ).toBeNull();
  });

  it("returns null when the address is missing a required field", () => {
    const { phone, ...addressWithoutPhone } = ADDRESS;
    expect(phone).toBeDefined();
    expect(
      parseCheckoutData(
        JSON.stringify({ ...VALID_BUNDLE, address: addressWithoutPhone }),
      ),
    ).toBeNull();
  });

  it("returns null when the stored state is not an Indian state", () => {
    expect(
      parseCheckoutData(
        JSON.stringify({
          ...VALID_BUNDLE,
          address: { ...ADDRESS, state: "Atlantis" },
        }),
      ),
    ).toBeNull();
  });

  it("accepts an address with no second line", () => {
    const { line2, ...addressWithoutLine2 } = ADDRESS;
    expect(line2).toBeDefined();
    expect(
      parseCheckoutData(
        JSON.stringify({ ...VALID_BUNDLE, address: addressWithoutLine2 }),
      ),
    ).not.toBeNull();
  });

  it("returns null when an amount is not a number", () => {
    expect(
      parseCheckoutData(JSON.stringify({ ...VALID_BUNDLE, total: "2099" })),
    ).toBeNull();
    expect(
      parseCheckoutData(JSON.stringify({ ...VALID_BUNDLE, shipping: undefined })),
    ).toBeNull();
  });

  it("lets a tampered amount through, because it validates shape and not truth", () => {
    const tampered = parseCheckoutData(
      JSON.stringify({ ...VALID_BUNDLE, subtotal: 1, total: 1 }),
    );

    expect(tampered?.total).toBe(1);
  });
});

const INITIAL_RING: CatalogueEntry = {
  id: "P001",
  name: "Wave Band Initial Ring",
  category: "necklaces",
  price: 400,
  mrp: 600,
  image: "/products/P001.webp",
  inStock: true,
  options: [
    { name: "Letter", type: "dropdown", values: ["A", "B", "C"], default: "A" },
  ],
};

const OPTIONED_CATALOGUE: CatalogueEntry[] = [INITIAL_RING, NECKLACE];

function optionedLines(selections: { letter: string; qty: number }[]): CartLine[] {
  return buildCartLines(
    selections.map(({ letter, qty }) => ({
      productId: "P001",
      name: "snapshot",
      category: "necklaces",
      price: 1,
      image: "",
      qty,
      selectedOptions: { Letter: letter },
    })),
    OPTIONED_CATALOGUE,
  );
}

describe("the checkout bundle carries recorded choices", () => {
  it("puts each line's selection into the bundle", () => {
    const bundle = buildCheckoutData(
      optionedLines([{ letter: "A", qty: 1 }, { letter: "C", qty: 2 }]),
      ADDRESS,
    );

    expect(bundle.cart.map((item) => item.selectedOptions)).toEqual([
      { Letter: "A" },
      { Letter: "C" },
    ]);
  });

  it("keeps two selections of one product as two bundle lines", () => {
    const bundle = buildCheckoutData(
      optionedLines([{ letter: "A", qty: 1 }, { letter: "C", qty: 2 }]),
      ADDRESS,
    );

    expect(bundle.cart).toHaveLength(2);
    expect(bundle.cart.every((item) => item.productId === "P001")).toBe(true);
  });

  it("totals the bundle as if the choices were not there", () => {
    const withChoices = buildCheckoutData(
      optionedLines([{ letter: "A", qty: 1 }, { letter: "C", qty: 2 }]),
      ADDRESS,
    );
    const asOneLine = buildCheckoutData(
      optionedLines([{ letter: "A", qty: 3 }]),
      ADDRESS,
    );

    expect(withChoices.subtotal).toBe(asOneLine.subtotal);
    expect(withChoices.total).toBe(asOneLine.total);
    expect(withChoices.subtotal).toBe(400 * 3);
  });

  it("leaves a product without options without a selection", () => {
    const bundle = buildCheckoutData(linesFor({ "nk-001": 1 }), ADDRESS);

    expect(bundle.cart[0]).not.toHaveProperty("selectedOptions");
  });

  it("survives the round trip through sessionStorage", () => {
    const bundle = buildCheckoutData(
      optionedLines([{ letter: "B", qty: 1 }]),
      ADDRESS,
    );

    expect(parseCheckoutData(JSON.stringify(bundle))?.cart[0].selectedOptions).toEqual({
      Letter: "B",
    });
  });

  it("drops an unreadable stored selection instead of the whole bundle", () => {
    const bundle: CheckoutData = {
      ...buildCheckoutData(optionedLines([{ letter: "B", qty: 1 }]), ADDRESS),
    };
    const tampered = JSON.parse(JSON.stringify(bundle)) as Record<string, unknown>;
    (tampered.cart as Record<string, unknown>[])[0].selectedOptions = "Letter=B";

    const parsed = parseCheckoutData(JSON.stringify(tampered));

    expect(parsed).not.toBeNull();
    expect(parsed?.cart[0]).not.toHaveProperty("selectedOptions");
  });
});

describe("the two order identifiers stamped onto a bundle", () => {
  const CASHFREE_ORDER_ID = "MG_1786968394909_v8j3wggq";
  const TRACKING_ID = "W2ACEHACUU";

  function stamped(overrides: Record<string, unknown>): CheckoutData | null {
    const bundle = buildCheckoutData(linesFor({ "nk-001": 1 }), ADDRESS);
    return parseCheckoutData(JSON.stringify({ ...bundle, ...overrides }));
  }

  it("survives the round trip through sessionStorage", () => {
    const parsed = stamped({ orderId: CASHFREE_ORDER_ID, trackingId: TRACKING_ID });

    expect(parsed?.orderId).toBe(CASHFREE_ORDER_ID);
    expect(parsed?.trackingId).toBe(TRACKING_ID);
  });

  it("is simply absent on a bundle that has not reached payment", () => {
    const parsed = stamped({});

    expect(parsed).not.toHaveProperty("orderId");
    expect(parsed).not.toHaveProperty("trackingId");
  });

  it("drops an order number that is not a usable string, rather than the bundle", () => {
    for (const unusable of ["", 12345, null, { id: TRACKING_ID }]) {
      const parsed = stamped({ orderId: CASHFREE_ORDER_ID, trackingId: unusable });

      expect(parsed?.orderId).toBe(CASHFREE_ORDER_ID);
      expect(parsed).not.toHaveProperty("trackingId");
    }
  });

  it("keeps the Cashfree stamp readable when the order number is missing", () => {
    expect(stamped({ orderId: CASHFREE_ORDER_ID })?.orderId).toBe(CASHFREE_ORDER_ID);
  });
});
