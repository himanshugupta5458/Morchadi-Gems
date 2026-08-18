import { describe, expect, it } from "vitest";
import type { CartItem } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { FLAT_SHIPPING_RATE } from "@/lib/config";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/quantity";
import {
  addProductToCart,
  buildCartLines,
  calculateCartTotals,
  countCartItems,
  hasUnavailableLine,
  parsePersistedCart,
  reconcileCartWithCatalogue,
  removeProductFromCart,
  selectPayableLines,
  setCartItemQuantity,
} from "@/lib/cart";

function makeEntry(overrides: Partial<CatalogueEntry> = {}): CatalogueEntry {
  return {
    id: "nk-001",
    name: "Kundan Rani Haar",
    price: 1000,
    mrp: 1500,
    image: "/products/nk-001.webp",
    inStock: true,
    ...overrides,
  };
}

const NECKLACE = makeEntry();
const EARRING = makeEntry({
  id: "er-001",
  name: "Polki Jhumkas",
  price: 250,
  mrp: 400,
  image: "/products/er-001.webp",
});
const SOLD_OUT_RING = makeEntry({
  id: "rg-001",
  name: "Temple Gold Ring",
  price: 700,
  mrp: 900,
  image: "/products/rg-001.webp",
  inStock: false,
});

const CATALOGUE: CatalogueEntry[] = [NECKLACE, EARRING, SOLD_OUT_RING];

function makeItem(entry: CatalogueEntry, qty: number): CartItem {
  return {
    productId: entry.id,
    name: entry.name,
    price: entry.price,
    image: entry.image ?? "",
    qty,
  };
}

function totalsFor(items: CartItem[]): ReturnType<typeof calculateCartTotals> {
  return calculateCartTotals(buildCartLines(items, CATALOGUE));
}

describe("addProductToCart", () => {
  it("adds a new product as its own line", () => {
    const items = addProductToCart([], NECKLACE, 2);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      productId: "nk-001",
      name: "Kundan Rani Haar",
      price: 1000,
      image: "/products/nk-001.webp",
      qty: 2,
    });
  });

  it("defaults to a quantity of one", () => {
    expect(addProductToCart([], NECKLACE)[0].qty).toBe(1);
  });

  it("increments the existing line instead of duplicating it", () => {
    const items = addProductToCart(addProductToCart([], NECKLACE, 2), NECKLACE, 3);

    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(5);
  });

  it("keeps other lines untouched when incrementing", () => {
    const items = addProductToCart(
      addProductToCart(addProductToCart([], NECKLACE, 1), EARRING, 4),
      NECKLACE,
      1,
    );

    expect(items.map((item) => item.productId)).toEqual(["nk-001", "er-001"]);
    expect(items[0].qty).toBe(2);
    expect(items[1].qty).toBe(4);
  });

  it("clamps an increment at the per-line maximum", () => {
    const items = addProductToCart(
      addProductToCart([], NECKLACE, MAX_QUANTITY),
      NECKLACE,
      5,
    );

    expect(items[0].qty).toBe(MAX_QUANTITY);
  });

  it("clamps a single oversized add at the per-line maximum", () => {
    expect(addProductToCart([], NECKLACE, 99)[0].qty).toBe(MAX_QUANTITY);
  });

  it("clamps a zero or negative quantity up to the minimum", () => {
    expect(addProductToCart([], NECKLACE, 0)[0].qty).toBe(MIN_QUANTITY);
    expect(addProductToCart([], NECKLACE, -3)[0].qty).toBe(MIN_QUANTITY);
  });

  it("refuses to add an out-of-stock product", () => {
    expect(addProductToCart([], SOLD_OUT_RING, 1)).toEqual([]);
  });

  it("refreshes the snapshot from the catalogue on increment", () => {
    const staleItem: CartItem = {
      productId: "nk-001",
      name: "Old name",
      price: 1,
      image: "",
      qty: 1,
    };

    const items = addProductToCart([staleItem], NECKLACE, 1);

    expect(items[0]).toMatchObject({
      name: "Kundan Rani Haar",
      price: 1000,
      image: "/products/nk-001.webp",
      qty: 2,
    });
  });

  it("does not mutate the array it is given", () => {
    const items = [makeItem(NECKLACE, 1)];
    addProductToCart(items, EARRING, 1);
    addProductToCart(items, NECKLACE, 1);

    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(1);
  });
});

describe("removeProductFromCart", () => {
  it("removes only the named line", () => {
    const items = removeProductFromCart(
      [makeItem(NECKLACE, 2), makeItem(EARRING, 1)],
      "nk-001",
    );

    expect(items.map((item) => item.productId)).toEqual(["er-001"]);
  });

  it("leaves the cart alone for an unknown id", () => {
    const items = [makeItem(NECKLACE, 2)];
    expect(removeProductFromCart(items, "does-not-exist")).toEqual(items);
  });

  it("empties a single-line cart", () => {
    expect(removeProductFromCart([makeItem(NECKLACE, 2)], "nk-001")).toEqual([]);
  });
});

describe("setCartItemQuantity", () => {
  it("sets the quantity of the named line", () => {
    const items = setCartItemQuantity([makeItem(NECKLACE, 2)], "nk-001", 7);
    expect(items[0].qty).toBe(7);
  });

  it("clamps above the maximum and below the minimum", () => {
    expect(setCartItemQuantity([makeItem(NECKLACE, 2)], "nk-001", 50)[0].qty).toBe(
      MAX_QUANTITY,
    );
    expect(setCartItemQuantity([makeItem(NECKLACE, 2)], "nk-001", 0)[0].qty).toBe(
      MIN_QUANTITY,
    );
  });

  it("ignores an unknown id", () => {
    const items = [makeItem(NECKLACE, 2)];
    expect(setCartItemQuantity(items, "er-001", 5)).toEqual(items);
  });

  it("does not mutate the array it is given", () => {
    const items = [makeItem(NECKLACE, 2)];
    setCartItemQuantity(items, "nk-001", 9);
    expect(items[0].qty).toBe(2);
  });
});

describe("countCartItems", () => {
  it("sums quantities rather than counting lines", () => {
    expect(countCartItems([makeItem(NECKLACE, 3), makeItem(EARRING, 2)])).toBe(5);
  });

  it("is zero for an empty cart", () => {
    expect(countCartItems([])).toBe(0);
  });

  it("counts an out-of-stock line, which the cart still shows", () => {
    expect(countCartItems([makeItem(SOLD_OUT_RING, 2)])).toBe(2);
  });
});

describe("cart totals", () => {
  it("charges no shipping on an empty cart", () => {
    expect(totalsFor([])).toEqual({ subtotal: 0, shipping: 0, total: 0 });
  });

  it("charges flat shipping once for a single item", () => {
    expect(totalsFor([makeItem(NECKLACE, 1)])).toEqual({
      subtotal: 1000,
      shipping: FLAT_SHIPPING_RATE,
      total: 1000 + FLAT_SHIPPING_RATE,
    });
  });

  it("multiplies unit price by quantity", () => {
    expect(totalsFor([makeItem(NECKLACE, 3)]).subtotal).toBe(3000);
  });

  it("charges flat shipping once across several lines", () => {
    const totals = totalsFor([makeItem(NECKLACE, 2), makeItem(EARRING, 4)]);

    expect(totals.subtotal).toBe(2000 + 1000);
    expect(totals.shipping).toBe(FLAT_SHIPPING_RATE);
    expect(totals.total).toBe(3000 + FLAT_SHIPPING_RATE);
  });

  it("excludes an out-of-stock line from the payable totals", () => {
    const totals = totalsFor([makeItem(NECKLACE, 1), makeItem(SOLD_OUT_RING, 2)]);

    expect(totals.subtotal).toBe(1000);
    expect(totals.total).toBe(1000 + FLAT_SHIPPING_RATE);
  });

  it("charges nothing at all when every line is out of stock", () => {
    expect(totalsFor([makeItem(SOLD_OUT_RING, 2)])).toEqual({
      subtotal: 0,
      shipping: 0,
      total: 0,
    });
  });

  it("prices from the catalogue, never from the stored snapshot", () => {
    const tamperedItem: CartItem = { ...makeItem(NECKLACE, 1), price: 1 };

    expect(totalsFor([tamperedItem]).subtotal).toBe(NECKLACE.price);
  });

  it("never lets mrp reach a total", () => {
    const totals = totalsFor([makeItem(NECKLACE, 1)]);

    expect(totals.subtotal).not.toBe(NECKLACE.mrp);
    expect(totals.total).toBe(NECKLACE.price + FLAT_SHIPPING_RATE);
  });

  it("ignores an item whose product is not in the catalogue", () => {
    const orphanItem = makeItem(makeEntry({ id: "gone-999" }), 4);

    expect(buildCartLines([orphanItem], CATALOGUE)).toEqual([]);
    expect(totalsFor([orphanItem])).toEqual({ subtotal: 0, shipping: 0, total: 0 });
  });
});

describe("buildCartLines", () => {
  it("joins each item to its catalogue entry", () => {
    const [line] = buildCartLines([makeItem(NECKLACE, 2)], CATALOGUE);

    expect(line.entry).toEqual(NECKLACE);
    expect(line.unitPrice).toBe(1000);
    expect(line.lineTotal).toBe(2000);
    expect(line.isPayable).toBe(true);
  });

  it("still computes a line total for an unavailable line", () => {
    const [line] = buildCartLines([makeItem(SOLD_OUT_RING, 2)], CATALOGUE);

    expect(line.isPayable).toBe(false);
    expect(line.lineTotal).toBe(1400);
  });

  it("clamps a quantity that reached it unclamped", () => {
    const [line] = buildCartLines([makeItem(NECKLACE, 40)], CATALOGUE);

    expect(line.quantity).toBe(MAX_QUANTITY);
    expect(line.lineTotal).toBe(MAX_QUANTITY * 1000);
  });

  it("separates payable from unavailable lines", () => {
    const lines = buildCartLines(
      [makeItem(NECKLACE, 1), makeItem(SOLD_OUT_RING, 1)],
      CATALOGUE,
    );

    expect(selectPayableLines(lines).map((line) => line.entry.id)).toEqual(["nk-001"]);
    expect(hasUnavailableLine(lines)).toBe(true);
    expect(hasUnavailableLine(selectPayableLines(lines))).toBe(false);
  });
});

describe("reconcileCartWithCatalogue", () => {
  it("drops an item whose product has left the catalogue", () => {
    const items = reconcileCartWithCatalogue(
      [makeItem(NECKLACE, 1), makeItem(makeEntry({ id: "deleted-001" }), 2)],
      CATALOGUE,
    );

    expect(items.map((item) => item.productId)).toEqual(["nk-001"]);
  });

  it("re-clamps a persisted quantity above the maximum", () => {
    const items = reconcileCartWithCatalogue([makeItem(NECKLACE, 250)], CATALOGUE);
    expect(items[0].qty).toBe(MAX_QUANTITY);
  });

  it("re-clamps a persisted quantity below the minimum", () => {
    const items = reconcileCartWithCatalogue([makeItem(NECKLACE, 0)], CATALOGUE);
    expect(items[0].qty).toBe(MIN_QUANTITY);
  });

  it("refreshes a stale name, price, and image from the catalogue", () => {
    const staleItem: CartItem = {
      productId: "nk-001",
      name: "Renamed last season",
      price: 5,
      image: "/products/old.webp",
      qty: 2,
    };

    expect(reconcileCartWithCatalogue([staleItem], CATALOGUE)[0]).toEqual({
      productId: "nk-001",
      name: "Kundan Rani Haar",
      price: 1000,
      image: "/products/nk-001.webp",
      qty: 2,
    });
  });

  it("keeps an item that has since gone out of stock", () => {
    const items = reconcileCartWithCatalogue([makeItem(SOLD_OUT_RING, 2)], CATALOGUE);

    expect(items.map((item) => item.productId)).toEqual(["rg-001"]);
    expect(hasUnavailableLine(buildCartLines(items, CATALOGUE))).toBe(true);
  });

  it("merges duplicate lines for one product, clamping the result", () => {
    const items = reconcileCartWithCatalogue(
      [makeItem(NECKLACE, 3), makeItem(EARRING, 1), makeItem(NECKLACE, 9)],
      CATALOGUE,
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ productId: "nk-001", qty: MAX_QUANTITY });
    expect(items[1]).toMatchObject({ productId: "er-001", qty: 1 });
  });

  it("empties a cart whose products have all gone", () => {
    expect(reconcileCartWithCatalogue([makeItem(NECKLACE, 1)], [])).toEqual([]);
  });

  it("does not mutate the array it is given", () => {
    const items = [makeItem(NECKLACE, 99)];
    reconcileCartWithCatalogue(items, CATALOGUE);

    expect(items[0].qty).toBe(99);
  });
});

describe("parsePersistedCart", () => {
  it("returns an empty cart when nothing is stored", () => {
    expect(parsePersistedCart(null)).toEqual([]);
  });

  it("returns an empty cart for unparseable JSON", () => {
    expect(parsePersistedCart("{not json")).toEqual([]);
  });

  it("returns an empty cart for JSON that is not an array", () => {
    expect(parsePersistedCart('{"productId":"nk-001"}')).toEqual([]);
    expect(parsePersistedCart('"nk-001"')).toEqual([]);
    expect(parsePersistedCart("null")).toEqual([]);
  });

  it("reads a well-formed cart", () => {
    const stored = JSON.stringify([makeItem(NECKLACE, 2)]);

    expect(parsePersistedCart(stored)).toEqual([makeItem(NECKLACE, 2)]);
  });

  it("drops entries with no usable id or quantity", () => {
    const stored = JSON.stringify([
      makeItem(NECKLACE, 1),
      { productId: "", qty: 2 },
      { productId: "er-001" },
      { qty: 3 },
      null,
      "nk-001",
      { productId: "er-001", qty: "2" },
    ]);

    expect(parsePersistedCart(stored).map((item) => item.productId)).toEqual([
      "nk-001",
    ]);
  });

  it("clamps a tampered quantity as it reads it", () => {
    const stored = JSON.stringify([
      { productId: "nk-001", name: "x", price: 1, image: "", qty: 9999 },
      { productId: "er-001", name: "x", price: 1, image: "", qty: -4 },
    ]);
    const items = parsePersistedCart(stored);

    expect(items[0].qty).toBe(MAX_QUANTITY);
    expect(items[1].qty).toBe(MIN_QUANTITY);
  });

  it("survives a stored file with an unknown id and a stale price, end to end", () => {
    const stored = JSON.stringify([
      { productId: "nk-001", name: "Old", price: 3, image: "", qty: 40 },
      { productId: "removed-042", name: "Gone", price: 500, image: "", qty: 2 },
    ]);
    const items = reconcileCartWithCatalogue(parsePersistedCart(stored), CATALOGUE);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: "nk-001", qty: MAX_QUANTITY });
    expect(totalsFor(items)).toEqual({
      subtotal: MAX_QUANTITY * 1000,
      shipping: FLAT_SHIPPING_RATE,
      total: MAX_QUANTITY * 1000 + FLAT_SHIPPING_RATE,
    });
  });
});

describe("shipping rate", () => {
  it("is the flat rate from config, not a number written into the cart math", () => {
    expect(FLAT_SHIPPING_RATE).toBe(99);
  });
});
