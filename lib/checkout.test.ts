import { describe, expect, it } from "vitest";
import type { Address, CheckoutData } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { buildCartLines, type CartLine } from "@/lib/cart";
import { buildCheckoutData, parseCheckoutData } from "@/lib/checkout";
import { FLAT_SHIPPING_RATE } from "@/lib/config";

const NECKLACE: CatalogueEntry = {
  id: "nk-001",
  name: "Kundan Rani Haar",
  price: 1000,
  mrp: 1500,
  image: "/products/nk-001.webp",
  inStock: true,
};

const EARRING: CatalogueEntry = {
  id: "er-001",
  name: "Polki Jhumkas",
  price: 250,
  mrp: 400,
  image: "/products/er-001.webp",
  inStock: true,
};

const SOLD_OUT_RING: CatalogueEntry = {
  id: "rg-001",
  name: "Temple Gold Ring",
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
      shipping: FLAT_SHIPPING_RATE,
      total: 2000 + FLAT_SHIPPING_RATE,
    });
  });

  it("charges flat shipping once across several lines", () => {
    const bundle = buildCheckoutData(linesFor({ "nk-001": 2, "er-001": 4 }), ADDRESS);

    expect(bundle.cart).toHaveLength(2);
    expect(bundle.subtotal).toBe(2000 + 1000);
    expect(bundle.shipping).toBe(FLAT_SHIPPING_RATE);
    expect(bundle.total).toBe(3000 + FLAT_SHIPPING_RATE);
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
