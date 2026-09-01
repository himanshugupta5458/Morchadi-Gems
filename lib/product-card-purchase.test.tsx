/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueEntry, ProductOption } from "@/types/product";
import { ADDED_TO_CART_LABEL } from "@/lib/add-to-cart-flow";
import { buildUnansweredPrompt } from "@/lib/add-to-cart-modal";
import { describeOptionGroups, selectCardPurchaseMode } from "@/lib/card-purchase";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { getAllProducts } from "@/lib/products";
import { ToastProvider } from "@/lib/toast-context";
import { ProductCardPurchase } from "@/components/ProductCardPurchase";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...anchorProps
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...anchorProps}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

/**
 * The three categories [ADR-067](/docs/decisions/ADR-067-card-variant-selection.md) split cards
 * into, kept here on purpose. ADR-073 replaced the split with one interaction, and the way to
 * show that is to run the same fixtures through it and watch them behave identically — a
 * one-tap add for the piece with nothing to ask, and the same modal, empty, for the other two.
 */
const BANGLE_SIZE: ProductOption = {
  name: "Size for bangles",
  type: "pills",
  values: ["2.4", "2.6", "2.8"],
  default: "2.4",
};

const LETTER: ProductOption = {
  name: "Letter",
  type: "dropdown",
  values: ["A", "B", "C", "D", "E"],
  default: "A",
};

const DESIGN: ProductOption = {
  name: "Design Number",
  type: "pills",
  values: ["1", "2"],
  default: "1",
};

const PLAIN: CatalogueEntry = {
  id: "P900",
  name: "Plain Pendant",
  category: "necklaces",
  price: 200,
  mrp: 300,
  image: "/products/P900.webp",
  inStock: true,
};

/** ADR-067's `choose-on-card`: one group, three values, a default that used to be pre-selected. */
const BANGLE: CatalogueEntry = { ...PLAIN, id: "P901", name: "Kada", options: [BANGLE_SIZE] };

/** ADR-067's `choose-on-page`, by value count. */
const LETTER_RING: CatalogueEntry = {
  ...PLAIN,
  id: "P902",
  name: "Initial Ring",
  options: [LETTER],
};

/** ADR-067's `choose-on-page`, by group count. */
const TWO_GROUPS: CatalogueEntry = {
  ...PLAIN,
  id: "P903",
  name: "Kada Set",
  options: [DESIGN, BANGLE_SIZE],
};

const SOLD_OUT_LETTER_RING: CatalogueEntry = { ...LETTER_RING, id: "P904", inStock: false };

const CATALOGUE = [PLAIN, BANGLE, LETTER_RING, TWO_GROUPS, SOLD_OUT_LETTER_RING];

const WITH_OPTIONS: readonly [string, CatalogueEntry][] = [
  ["one group of three values, ADR-067's choose-on-card", BANGLE],
  ["one group above ADR-067's value ceiling", LETTER_RING],
  ["more than one group", TWO_GROUPS],
];

function Card({ item }: { item: CatalogueEntry }): JSX.Element {
  return (
    <CartProvider catalogue={CATALOGUE}>
      <ToastProvider>
        <ProductCardPurchase item={item} />
      </ToastProvider>
    </CartProvider>
  );
}

async function renderCard(item: CatalogueEntry): Promise<void> {
  await act(async () => {
    render(<Card item={item} />);
  });
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function openModalFor(item: CatalogueEntry): Promise<void> {
  await renderCard(item);
  await click(screen.getByRole("button", { name: "Add to cart" }));
}

function readStoredCart(): { productId: string; selectedOptions?: Record<string, string> }[] {
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  return raw === null ? [] : JSON.parse(raw);
}

/** Every control in the modal that can carry a selection, whatever kind of control it is. */
function checkedValues(): string[] {
  const radios = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
  )
    .filter((radio) => radio.checked)
    .map((radio) => radio.value);

  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>("select"))
    .map((select) => select.value)
    .filter((value) => value.length > 0);

  return [...radios, ...selects];
}

function confirmButton(): HTMLButtonElement {
  const dialog = screen.getByRole("dialog");
  const buttons = Array.from(dialog.querySelectorAll("button")).filter(
    (button) => button.textContent === "Add to cart",
  );
  if (buttons.length !== 1) throw new Error(`expected one confirm button, found ${buttons.length}`);
  return buttons[0] as HTMLButtonElement;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("selectCardPurchaseMode", () => {
  it("adds straight away when there are no options", () => {
    expect(selectCardPurchaseMode(undefined).kind).toBe("add");
    expect(selectCardPurchaseMode([]).kind).toBe("add");
  });

  it("asks for every product that has any options at all, in any shape", () => {
    for (const options of [[BANGLE_SIZE], [LETTER], [DESIGN, BANGLE_SIZE]]) {
      expect(selectCardPurchaseMode(options)).toEqual({ kind: "choose", options });
    }
  });
});

describe("describeOptionGroups", () => {
  it("says nothing for a product with nothing to choose", () => {
    expect(describeOptionGroups(undefined)).toBeNull();
    expect(describeOptionGroups([])).toBeNull();
  });

  it("counts values when there is one group, and names sizes as sizes", () => {
    expect(describeOptionGroups([BANGLE_SIZE])).toBe("3 sizes");
    expect(describeOptionGroups([LETTER])).toBe("5 options");
  });

  it("counts groups when there is more than one", () => {
    expect(describeOptionGroups([DESIGN, BANGLE_SIZE])).toBe("2 options");
  });
});

describe("a product with no options", () => {
  it("adds in one tap, exactly as before, with no modal in the way", async () => {
    await renderCard(PLAIN);

    await click(screen.getByRole("button", { name: "Add to cart" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readStoredCart()).toEqual([
      expect.objectContaining({ productId: "P900", qty: 1 }),
    ]);
    expect(readStoredCart()[0].selectedOptions).toBeUndefined();
  });

  it("confirms in place on the button as well as in the toast", async () => {
    await renderCard(PLAIN);

    await click(screen.getByRole("button", { name: "Add to cart" }));

    expect(screen.getByRole("button", { name: ADDED_TO_CART_LABEL })).toBeTruthy();
    expect(screen.getAllByText("Added to cart").length).toBeGreaterThan(0);
  });
});

describe("every product that has options, whatever shape they take", () => {
  it.each(WITH_OPTIONS)("shows the card no values at all, for %s", async (_label, item) => {
    await renderCard(item);

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeTruthy();
  });

  it.each(WITH_OPTIONS)("opens the modal rather than adding, for %s", async (_label, item) => {
    await openModalFor(item);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(readStoredCart()).toEqual([]);
  });

  /**
   * The property ADR-067 was opened for, now holding for every option count rather than only
   * for the counts it routed away from the card. Nothing is checked, no select carries a value,
   * and the catalogue's declared `default` is nowhere in the dialog's state.
   */
  it.each(WITH_OPTIONS)("pre-selects nothing, for %s", async (_label, item) => {
    await openModalFor(item);

    expect(checkedValues()).toEqual([]);
  });

  it.each(WITH_OPTIONS)("keeps the confirm button disabled until every group is answered, for %s", async (
    _label,
    item,
  ) => {
    await openModalFor(item);

    const groups = item.options ?? [];
    expect(confirmButton().disabled).toBe(true);

    for (const [index, option] of groups.entries()) {
      expect(screen.getByText(buildUnansweredPrompt(option))).toBeTruthy();

      await answer(option);

      const isLast = index === groups.length - 1;
      expect(confirmButton().disabled).toBe(!isLast);
    }
  });

  it.each(WITH_OPTIONS)("adds exactly what was chosen, for %s", async (_label, item) => {
    await openModalFor(item);

    const chosen: Record<string, string> = {};
    for (const option of item.options ?? []) {
      const value = option.values[option.values.length - 1];
      chosen[option.name] = value;
      await answer(option, value);
    }

    await click(confirmButton());

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readStoredCart()[0].selectedOptions).toEqual(chosen);
  });

  it.each(WITH_OPTIONS)("adds nothing when it is dismissed, for %s", async (_label, item) => {
    await openModalFor(item);

    await answer((item.options ?? [])[0]);
    await click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readStoredCart()).toEqual([]);
  });

  it.each(WITH_OPTIONS)("forgets a half-made choice when it is reopened, for %s", async (
    _label,
    item,
  ) => {
    await openModalFor(item);
    await answer((item.options ?? [])[0]);
    await click(screen.getByRole("button", { name: "Close" }));

    await click(screen.getByRole("button", { name: "Add to cart" }));

    expect(checkedValues()).toEqual([]);
    expect(confirmButton().disabled).toBe(true);
  });
});

/** Answers one group through whichever control the catalogue asked for. */
async function answer(option: ProductOption, value?: string): Promise<void> {
  const chosen = value ?? option.values[0];

  if (option.type === "dropdown") {
    const select = screen
      .getAllByRole("combobox")
      .find((candidate) =>
        Array.from((candidate as HTMLSelectElement).options).some(
          (entry) => entry.value === chosen,
        ),
      );
    if (select === undefined) throw new Error(`no select offers ${chosen}`);
    await act(async () => {
      fireEvent.change(select, { target: { value: chosen } });
    });
    return;
  }

  await click(screen.getByRole("radio", { name: chosen }));
}

describe("a piece with nothing left to sell", () => {
  it("says sold out and opens nothing", async () => {
    await renderCard(SOLD_OUT_LETTER_RING);

    const button = screen.getByRole("button", { name: "Sold out" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    await click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(readStoredCart()).toEqual([]);
  });
});

describe("the real catalogue under the one rule", () => {
  it("asks about every product that carries a group, and none that does not", () => {
    let asked = 0;
    let added = 0;

    for (const product of getAllProducts()) {
      const mode = selectCardPurchaseMode(product.options);
      if (mode.kind === "choose") {
        asked += 1;
        expect((product.options ?? []).length).toBeGreaterThan(0);
      } else {
        added += 1;
        expect(product.options ?? []).toEqual([]);
      }
    }

    expect(asked).toBeGreaterThan(0);
    expect(added).toBeGreaterThan(0);
  });

  /**
   * The three products ADR-067 named as the defect it could not fully close — the bangles and
   * rings whose smallest size was pre-selected on the card, the birthstone pendant, the letter
   * rings. Every one of them is now asked about with nothing selected.
   */
  it("leaves nothing pre-selected for the pieces ADR-067 could not close", () => {
    const atRisk = getAllProducts().filter((product) =>
      (product.options ?? []).some(
        (option) =>
          option.name === "Letter" ||
          option.name === "Stone" ||
          /size/i.test(option.name),
      ),
    );

    expect(atRisk.length).toBeGreaterThan(0);
    for (const product of atRisk) {
      expect(selectCardPurchaseMode(product.options).kind).toBe("choose");
    }
  });
});
