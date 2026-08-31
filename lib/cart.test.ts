import { describe, expect, it } from "vitest";
import type { CartItem } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { FLAT_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD } from "@/lib/config";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/quantity";
import { lineKey } from "@/lib/options";
import {
  addProductToCart,
  cartItemKey,
  buildCartLines,
  calculateCartTotals,
  countCartItems,
  hasUnavailableLine,
  parsePersistedCart,
  reconcileCartWithCatalogue,
  removeProductFromCart,
  restoreCartItem,
  selectPayableLines,
  setCartItemQuantity,
} from "@/lib/cart";

function makeEntry(overrides: Partial<CatalogueEntry> = {}): CatalogueEntry {
  return {
    id: "nk-001",
    name: "Kundan Rani Haar",
    category: "necklaces",
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
  category: "necklaces",
  price: 250,
  mrp: 400,
  image: "/products/er-001.webp",
});
const SOLD_OUT_RING = makeEntry({
  id: "rg-001",
  name: "Temple Gold Ring",
  category: "necklaces",
  price: 700,
  mrp: 900,
  image: "/products/rg-001.webp",
  inStock: false,
});

const BANGLE = makeEntry({
  id: "bg-001",
  name: "Oxidised Silver Bangle",
  category: "necklaces",
  price: 1,
  mrp: 2,
  image: "/products/bg-001.webp",
});

const CATALOGUE: CatalogueEntry[] = [NECKLACE, EARRING, SOLD_OUT_RING, BANGLE];

function makeItem(entry: CatalogueEntry, qty: number): CartItem {
  return {
    productId: entry.id,
    name: entry.name,
    price: entry.price,
    image: entry.image ?? "",
    qty,
  };
}

/**
 * The cheapest way to say "a cart whose payable subtotal is exactly this much": one piece
 * priced at the target, since `MAX_QUANTITY` puts the boundary amounts out of reach of the
 * shared fixtures.
 */
function totalsForSubtotal(subtotal: number): ReturnType<typeof calculateCartTotals> {
  const piece = makeEntry({ id: `boundary-${subtotal}`, price: subtotal });
  return calculateCartTotals(buildCartLines([makeItem(piece, 1)], [piece]));
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

/**
 * The other half of `removeProductFromCart`, and what the cart's Undo toast is built on. Its job
 * is to replay a line rather than to add a product again: the quantity and the recorded choices
 * come back as they were, and so does the position, because a line that reappeared at the bottom
 * of the list would read as a different removal.
 */
describe("restoreCartItem", () => {
  it("puts the line back where it was", () => {
    const removed = makeItem(NECKLACE, 2);
    const remaining = [makeItem(EARRING, 1), makeItem(BANGLE, 1)];

    const restored = restoreCartItem(remaining, removed, 0);

    expect(restored.map((item) => item.productId)).toEqual([
      "nk-001",
      "er-001",
      "bg-001",
    ]);
  });

  it("brings the quantity and the recorded choices back untouched", () => {
    const removed = { ...makeItem(NECKLACE, 5), selectedOptions: { Letter: "B" } };

    const [restored] = restoreCartItem([], removed, 0);

    expect(restored.qty).toBe(5);
    expect(restored.selectedOptions).toEqual({ Letter: "B" });
  });

  it("appends when the cart has shrunk past the position it held", () => {
    const removed = makeItem(NECKLACE, 1);

    const restored = restoreCartItem([makeItem(EARRING, 1)], removed, 7);

    expect(restored.map((item) => item.productId)).toEqual(["er-001", "nk-001"]);
  });

  it("merges into a line the shopper re-added by hand rather than duplicating it", () => {
    const removed = makeItem(NECKLACE, 2);

    const restored = restoreCartItem([makeItem(NECKLACE, 1)], removed, 0);

    expect(restored).toHaveLength(1);
    expect(restored[0].qty).toBe(3);
  });

  it("still clamps a merge that would exceed the per-line maximum", () => {
    const removed = makeItem(NECKLACE, MAX_QUANTITY);

    const restored = restoreCartItem([makeItem(NECKLACE, MAX_QUANTITY)], removed, 0);

    expect(restored[0].qty).toBe(MAX_QUANTITY);
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

  it("charges flat shipping on a subtotal one rupee below the threshold", () => {
    expect(totalsForSubtotal(FREE_SHIPPING_THRESHOLD - 1)).toEqual({
      subtotal: 798,
      shipping: FLAT_SHIPPING_RATE,
      total: 798 + FLAT_SHIPPING_RATE,
    });
  });

  it("ships free on a subtotal exactly at the threshold, which is inclusive", () => {
    expect(totalsForSubtotal(FREE_SHIPPING_THRESHOLD)).toEqual({
      subtotal: 799,
      shipping: 0,
      total: 799,
    });
  });

  it("ships free on a subtotal one rupee above the threshold", () => {
    expect(totalsForSubtotal(FREE_SHIPPING_THRESHOLD + 1)).toEqual({
      subtotal: 800,
      shipping: 0,
      total: 800,
    });
  });

  it("charges flat shipping once for a single below-threshold item", () => {
    expect(totalsFor([makeItem(EARRING, 1)])).toEqual({
      subtotal: 250,
      shipping: FLAT_SHIPPING_RATE,
      total: 250 + FLAT_SHIPPING_RATE,
    });
  });

  it("multiplies unit price by quantity", () => {
    expect(totalsFor([makeItem(NECKLACE, 3)]).subtotal).toBe(3000);
  });

  it("charges shipping once across several lines, on their combined subtotal", () => {
    const belowThreshold = totalsFor([makeItem(EARRING, 2), makeItem(BANGLE, 5)]);
    const aboveThreshold = totalsFor([makeItem(NECKLACE, 2), makeItem(EARRING, 4)]);

    expect(belowThreshold.subtotal).toBe(500 + 5);
    expect(belowThreshold.shipping).toBe(FLAT_SHIPPING_RATE);
    expect(belowThreshold.total).toBe(505 + FLAT_SHIPPING_RATE);

    expect(aboveThreshold.subtotal).toBe(2000 + 1000);
    expect(aboveThreshold.shipping).toBe(0);
    expect(aboveThreshold.total).toBe(3000);
  });

  it("decides shipping on the payable subtotal, ignoring an out-of-stock line", () => {
    const totals = totalsFor([makeItem(EARRING, 1), makeItem(SOLD_OUT_RING, 2)]);

    expect(totals.subtotal).toBe(250);
    expect(totals.shipping).toBe(FLAT_SHIPPING_RATE);
    expect(totals.total).toBe(250 + FLAT_SHIPPING_RATE);
  });

  it("does not let a sold-out line buy its way past the free-shipping threshold", () => {
    const totals = totalsFor([makeItem(EARRING, 1), makeItem(SOLD_OUT_RING, 10)]);

    expect(totals.subtotal).toBe(250);
    expect(totals.shipping).toBe(FLAT_SHIPPING_RATE);
    expect(totals.total).toBe(250 + FLAT_SHIPPING_RATE);
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
    expect(totals.total).toBe(NECKLACE.price);
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
      shipping: 0,
      total: MAX_QUANTITY * 1000,
    });
  });
});

describe("shipping rule", () => {
  it("reads both numbers from config rather than writing them into the cart math", () => {
    expect(FLAT_SHIPPING_RATE).toBe(99);
    expect(FREE_SHIPPING_THRESHOLD).toBe(799);
  });
});

const INITIAL_RING = makeEntry({
  id: "P001",
  name: "Wave Band Initial Ring",
  category: "necklaces",
  price: 400,
  mrp: 600,
  image: "/products/P001.webp",
  options: [
    { name: "Letter", type: "dropdown", values: ["A", "B", "C"], default: "A" },
  ],
});

const WATCH_RING = makeEntry({
  id: "P010",
  name: "Mini Watch Ring",
  category: "necklaces",
  price: 300,
  mrp: 500,
  image: "/products/P010.webp",
  options: [
    { name: "Colour", type: "swatch", values: ["Silver", "Golden"], default: "Silver" },
    { name: "Letter", type: "dropdown", values: ["A", "B"], default: "A" },
  ],
});

const OPTIONED_CATALOGUE: CatalogueEntry[] = [INITIAL_RING, WATCH_RING, NECKLACE];

function optionedTotals(items: CartItem[]): ReturnType<typeof calculateCartTotals> {
  return calculateCartTotals(buildCartLines(items, OPTIONED_CATALOGUE));
}

describe("options — line identity", () => {
  it("records the defaults for a shopper who never touched a selector", () => {
    const items = addProductToCart([], INITIAL_RING, 1);

    expect(items[0].selectedOptions).toEqual({ Letter: "A" });
  });

  it("records every group's default, not just the first group's", () => {
    expect(addProductToCart([], WATCH_RING, 1)[0].selectedOptions).toEqual({
      Colour: "Silver",
      Letter: "A",
    });
  });

  it("leaves a product without options exactly as it was", () => {
    expect(addProductToCart([], NECKLACE, 2)[0]).not.toHaveProperty("selectedOptions");
  });

  it("makes two selections of one product two lines", () => {
    const items = addProductToCart(
      addProductToCart([], INITIAL_RING, 1, { Letter: "A" }),
      INITIAL_RING,
      1,
      { Letter: "B" },
    );

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.selectedOptions)).toEqual([
      { Letter: "A" },
      { Letter: "B" },
    ]);
  });

  it("increments the existing line when the selection is the same", () => {
    const items = addProductToCart(
      addProductToCart([], INITIAL_RING, 2, { Letter: "B" }),
      INITIAL_RING,
      3,
      { Letter: "B" },
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ qty: 5, selectedOptions: { Letter: "B" } });
  });

  it("increments the defaulted line when the same defaults are added again", () => {
    const items = addProductToCart(addProductToCart([], INITIAL_RING, 1), INITIAL_RING, 1, {
      Letter: "A",
    });

    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(2);
  });

  it("clamps a merged line at the maximum, as it does without options", () => {
    const items = addProductToCart(
      addProductToCart([], INITIAL_RING, MAX_QUANTITY, { Letter: "C" }),
      INITIAL_RING,
      MAX_QUANTITY,
      { Letter: "C" },
    );

    expect(items[0].qty).toBe(MAX_QUANTITY);
  });

  it("resolves a requested value the catalogue does not offer to the default", () => {
    const items = addProductToCart([], INITIAL_RING, 1, { Letter: "Z" });

    expect(items[0].selectedOptions).toEqual({ Letter: "A" });
  });

  it("keys a line the same however the requested record was ordered", () => {
    const oneWay = addProductToCart([], WATCH_RING, 1, {
      Letter: "B",
      Colour: "Golden",
    });
    const otherWay = addProductToCart([], WATCH_RING, 1, {
      Colour: "Golden",
      Letter: "B",
    });

    expect(cartItemKey(oneWay[0])).toBe(cartItemKey(otherWay[0]));
  });

  it("removes only the line that was asked for", () => {
    const items = addProductToCart(
      addProductToCart([], INITIAL_RING, 1, { Letter: "A" }),
      INITIAL_RING,
      1,
      { Letter: "B" },
    );

    const remaining = removeProductFromCart(items, lineKey("P001", { Letter: "A" }));

    expect(remaining).toHaveLength(1);
    expect(remaining[0].selectedOptions).toEqual({ Letter: "B" });
  });

  it("sets the quantity of only the line that was asked for", () => {
    const items = setCartItemQuantity(
      addProductToCart(
        addProductToCart([], INITIAL_RING, 1, { Letter: "A" }),
        INITIAL_RING,
        1,
        { Letter: "B" },
      ),
      lineKey("P001", { Letter: "B" }),
      4,
    );

    expect(items.map((item) => item.qty)).toEqual([1, 4]);
  });

  it("gives every cart line a key the display can address", () => {
    const lines = buildCartLines(
      addProductToCart(
        addProductToCart([], INITIAL_RING, 1, { Letter: "A" }),
        INITIAL_RING,
        1,
        { Letter: "B" },
      ),
      OPTIONED_CATALOGUE,
    );

    expect(lines.map((line) => line.key)).toEqual([
      lineKey("P001", { Letter: "A" }),
      lineKey("P001", { Letter: "B" }),
    ]);
    expect(lines.map((line) => line.selectedOptions)).toEqual([
      { Letter: "A" },
      { Letter: "B" },
    ]);
  });
});

describe("options — money is untouched", () => {
  it("prices two selections of one product exactly as two of the same piece", () => {
    const withOptions = optionedTotals(
      addProductToCart(
        addProductToCart([], INITIAL_RING, 1, { Letter: "A" }),
        INITIAL_RING,
        1,
        { Letter: "B" },
      ),
    );
    const withoutOptions = optionedTotals(addProductToCart([], INITIAL_RING, 2));

    expect(withOptions).toEqual(withoutOptions);
  });

  it("charges the same whichever value is chosen", () => {
    const letterA = optionedTotals(addProductToCart([], INITIAL_RING, 3, { Letter: "A" }));
    const letterC = optionedTotals(addProductToCart([], INITIAL_RING, 3, { Letter: "C" }));

    expect(letterA).toEqual(letterC);
    expect(letterA.subtotal).toBe(INITIAL_RING.price * 3);
  });

  it("counts a personalized line by its quantity, like any other", () => {
    const items = addProductToCart(
      addProductToCart([], INITIAL_RING, 2, { Letter: "A" }),
      INITIAL_RING,
      3,
      { Letter: "B" },
    );

    expect(countCartItems(items)).toBe(5);
  });

  it("leaves the unit price and line total reading from the catalogue", () => {
    const [line] = buildCartLines(
      addProductToCart([], INITIAL_RING, 2, { Letter: "C" }),
      OPTIONED_CATALOGUE,
    );

    expect(line.unitPrice).toBe(INITIAL_RING.price);
    expect(line.lineTotal).toBe(INITIAL_RING.price * 2);
  });
});

describe("options — reconciling a persisted cart", () => {
  it("drops a line whose chosen value has been withdrawn", () => {
    const stored = addProductToCart([], INITIAL_RING, 1, { Letter: "C" });
    const trimmedCatalogue: CatalogueEntry[] = [
      {
        ...INITIAL_RING,
        options: [
          { name: "Letter", type: "dropdown", values: ["A", "B"], default: "A" },
        ],
      },
      NECKLACE,
    ];

    expect(reconcileCartWithCatalogue(stored, trimmedCatalogue)).toEqual([]);
  });

  it("drops a line whose whole group has been removed", () => {
    const stored = addProductToCart([], INITIAL_RING, 1, { Letter: "A" });
    const renamedGroup: CatalogueEntry[] = [
      {
        ...INITIAL_RING,
        options: [
          { name: "Initial", type: "dropdown", values: ["A", "B"], default: "A" },
        ],
      },
    ];

    expect(reconcileCartWithCatalogue(stored, renamedGroup)).toEqual([]);
  });

  it("drops a line whose product no longer has options at all", () => {
    const stored = addProductToCart([], INITIAL_RING, 1, { Letter: "A" });
    const plainRing: CatalogueEntry[] = [makeEntry({ id: "P001", name: "Wave Band Ring" })];

    expect(reconcileCartWithCatalogue(stored, plainRing)).toEqual([]);
  });

  it("keeps the sibling line whose choice is still offered", () => {
    const stored = addProductToCart(
      addProductToCart([], INITIAL_RING, 1, { Letter: "A" }),
      INITIAL_RING,
      2,
      { Letter: "C" },
    );
    const trimmedCatalogue: CatalogueEntry[] = [
      {
        ...INITIAL_RING,
        options: [
          { name: "Letter", type: "dropdown", values: ["A", "B"], default: "A" },
        ],
      },
    ];

    const items = reconcileCartWithCatalogue(stored, trimmedCatalogue);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ qty: 1, selectedOptions: { Letter: "A" } });
  });

  it("fills in the default for a line stored before the product gained a group", () => {
    const preOptionsItem: CartItem = {
      productId: "P001",
      name: "Wave Band Initial Ring",
      price: 400,
      image: "/products/P001.webp",
      qty: 2,
    };

    expect(reconcileCartWithCatalogue([preOptionsItem], OPTIONED_CATALOGUE)[0]).toMatchObject(
      { qty: 2, selectedOptions: { Letter: "A" } },
    );
  });

  it("merges duplicates of one selection without merging different selections", () => {
    const stored = [
      ...addProductToCart([], INITIAL_RING, 3, { Letter: "A" }),
      ...addProductToCart([], INITIAL_RING, 2, { Letter: "A" }),
      ...addProductToCart([], INITIAL_RING, 1, { Letter: "B" }),
    ];

    const items = reconcileCartWithCatalogue(stored, OPTIONED_CATALOGUE);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ qty: 5, selectedOptions: { Letter: "A" } });
    expect(items[1]).toMatchObject({ qty: 1, selectedOptions: { Letter: "B" } });
  });

  it("reads a stored selection back out of localStorage", () => {
    const stored = JSON.stringify(addProductToCart([], INITIAL_RING, 1, { Letter: "B" }));

    expect(parsePersistedCart(stored)[0].selectedOptions).toEqual({ Letter: "B" });
  });

  it("keeps a line whose stored selection is unreadable, minus the selection", () => {
    const stored = JSON.stringify([
      { productId: "P001", name: "Wave Band Initial Ring", price: 400, image: "", qty: 1, selectedOptions: "Letter=B" },
    ]);

    const parsed = parsePersistedCart(stored);

    expect(parsed[0]).not.toHaveProperty("selectedOptions");
    expect(reconcileCartWithCatalogue(parsed, OPTIONED_CATALOGUE)[0]).toMatchObject({
      selectedOptions: { Letter: "A" },
    });
  });
});
