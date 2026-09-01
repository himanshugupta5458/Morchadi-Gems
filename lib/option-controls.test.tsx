/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductOption } from "@/types/product";
import { getSwatchInk } from "@/lib/swatches";
import { CHOOSE_A_VALUE_LABEL } from "@/components/OptionDropdown";
import { ProductOptionSelector } from "@/components/ProductOptionSelector";

const LETTER: ProductOption = {
  name: "Letter",
  type: "dropdown",
  values: "ABCDEFGHIJKLMNOPQRSTUVWYZ".split(""),
  default: "A",
};

const COLOUR: ProductOption = {
  name: "Colour",
  type: "swatch",
  values: ["Silver", "Golden"],
  default: "Silver",
};

const SIZE: ProductOption = {
  name: "Size",
  type: "pills",
  values: ["XS", "S", "M", "L"],
  default: "M",
};

const SHAPE: ProductOption = {
  name: "Shape",
  type: "chips",
  values: ["Oval", "Heart", "Rectangle", "Round"],
  default: "Oval",
};

const RADIO_OPTIONS = [COLOUR, SIZE, SHAPE];

function showControl(option: ProductOption, value = option.default): () => void {
  const onChange = vi.fn();
  render(
    <ProductOptionSelector option={option} value={value} onChange={onChange} />,
  );

  return onChange;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the dropdown control", () => {
  it("is a labelled select carrying every value", () => {
    showControl(LETTER);
    const select = screen.getByLabelText("Letter") as HTMLSelectElement;

    expect(select.tagName).toBe("SELECT");
    expect(select.value).toBe("A");
    expect(within(select).getAllByRole("option")).toHaveLength(LETTER.values.length);
  });

  it("reports the value the shopper picked", () => {
    const onChange = showControl(LETTER);

    fireEvent.change(screen.getByLabelText("Letter"), { target: { value: "M" } });

    expect(onChange).toHaveBeenCalledWith("M");
  });
});

describe("the swatch control", () => {
  it("names every finish in text, never colour alone", () => {
    showControl(COLOUR);

    for (const value of COLOUR.values) {
      expect(screen.getByRole("radio", { name: value })).toBeDefined();
    }
  });

  it("checks the stated default and reports a change", () => {
    const onChange = showControl(COLOUR);
    const golden = screen.getByRole("radio", { name: "Golden" }) as HTMLInputElement;

    expect((screen.getByRole("radio", { name: "Silver" }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(golden.checked).toBe(false);

    fireEvent.click(golden);
    expect(onChange).toHaveBeenCalledWith("Golden");
  });

  it("paints the finishes it has ink for and stays readable for the ones it does not", () => {
    expect(getSwatchInk("Golden")).toBe("#C6A24C");
    expect(getSwatchInk("golden")).toBe("#C6A24C");
    expect(getSwatchInk("Peacock Enamel")).toBeNull();
  });
});

describe("the pills control", () => {
  it("renders a radio per value, defaulted to the stated one rather than the first", () => {
    showControl(SIZE);

    expect(screen.getAllByRole("radio")).toHaveLength(SIZE.values.length);
    expect((screen.getByRole("radio", { name: "M" }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect((screen.getByRole("radio", { name: "XS" }) as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it("reports the value the shopper picked", () => {
    const onChange = showControl(SIZE);

    fireEvent.click(screen.getByRole("radio", { name: "L" }));

    expect(onChange).toHaveBeenCalledWith("L");
  });
});

describe("the chips control", () => {
  it("renders a radio per value and reports a change", () => {
    const onChange = showControl(SHAPE);

    expect(screen.getAllByRole("radio")).toHaveLength(SHAPE.values.length);
    fireEvent.click(screen.getByRole("radio", { name: "Heart" }));

    expect(onChange).toHaveBeenCalledWith("Heart");
  });
});

describe("every control", () => {
  it("gives its group an accessible name a screen reader announces", () => {
    showControl(LETTER);
    expect(screen.getByLabelText("Letter")).toBeDefined();
    cleanup();

    for (const option of RADIO_OPTIONS) {
      showControl(option);
      expect(screen.getByRole("group", { name: option.name })).toBeDefined();
      cleanup();
    }
  });

  it("is reachable and operable from the keyboard", () => {
    for (const option of RADIO_OPTIONS) {
      const onChange = showControl(option);
      const notDefault = option.values.find((value) => value !== option.default) ?? "";
      const radio = screen.getByRole("radio", { name: notDefault });

      radio.focus();
      expect(document.activeElement).toBe(radio);

      fireEvent.click(radio);
      expect(onChange).toHaveBeenCalledWith(notDefault);
      cleanup();
    }
  });

  it("disables every value when the piece is sold out", () => {
    for (const option of RADIO_OPTIONS) {
      render(
        <ProductOptionSelector
          option={option}
          value={option.default}
          disabled
          onChange={vi.fn()}
        />,
      );

      for (const radio of screen.getAllByRole("radio")) {
        expect((radio as HTMLInputElement).disabled).toBe(true);
      }
      cleanup();
    }

    render(
      <ProductOptionSelector
        option={LETTER}
        value={LETTER.default}
        disabled
        onChange={vi.fn()}
      />,
    );
    expect((screen.getByLabelText("Letter") as HTMLSelectElement).disabled).toBe(true);
  });
});

/**
 * The two props the add-to-cart modal added. Both are about presentation, and neither can change
 * which control a group gets — that stays `option.type`, which is ADR-027's rule. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
describe("the label override", () => {
  it.each([...RADIO_OPTIONS, LETTER])(
    "renames the group without changing what draws it, for $name",
    (option) => {
      render(
        <ProductOptionSelector
          option={option}
          value={option.default}
          label={`Select ${option.name}`}
          onChange={vi.fn()}
        />,
      );

      const named =
        option.type === "dropdown"
          ? screen.getByLabelText(`Select ${option.name}`)
          : screen.getByRole("group", { name: `Select ${option.name}` });

      expect(named).toBeTruthy();
      expect(screen.queryByText(option.name)).toBeNull();
    },
  );

  /** One string, not a visible label beside a hidden legend, so the two cannot say different things. */
  it("names the group the same way for a screen reader as for an eye", () => {
    const { container } = render(
      <ProductOptionSelector
        option={SIZE}
        value={SIZE.default}
        label="Select Size"
        onChange={vi.fn()}
      />,
    );

    expect(container.querySelector("legend")?.textContent).toBe("Select Size");
    expect(screen.getByRole("group", { name: "Select Size" })).toBeTruthy();
  });
});

describe("the compact layout", () => {
  it.each(RADIO_OPTIONS)("puts every value on the 38px baseline, for $name", (option) => {
    const { container } = render(
      <ProductOptionSelector
        option={option}
        value={option.default}
        layout="compact"
        onChange={vi.fn()}
      />,
    );

    for (const label of Array.from(container.querySelectorAll("label"))) {
      expect(label.className).toContain("h-[2.375rem]");
      expect(label.className).toContain("min-w-[2.375rem]");
    }
  });

  it("leaves the flow layout sized to its own labels", () => {
    const { container } = render(
      <ProductOptionSelector option={SHAPE} value={SHAPE.default} onChange={vi.fn()} />,
    );

    for (const label of Array.from(container.querySelectorAll("label"))) {
      expect(label.className).not.toContain("h-[2.375rem]");
    }
  });

  it("keeps a dropdown a dropdown, because 25 letters are not chips", () => {
    render(
      <ProductOptionSelector
        option={LETTER}
        value={LETTER.default}
        layout="compact"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

/**
 * A select handed a value its group does not offer displays its first option, which on a letter
 * ring is `A`. That is the silent default the modal exists to prevent, drawn by the browser
 * instead of by us — so an unanswered dropdown carries a disabled placeholder instead.
 */
describe("an unanswered dropdown", () => {
  it("shows a placeholder rather than resolving to the first value", () => {
    render(<ProductOptionSelector option={LETTER} value="" onChange={vi.fn()} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;

    expect(select.value).toBe("");
    expect(select.options[0].text).toBe(CHOOSE_A_VALUE_LABEL);
    expect(select.options[0].disabled).toBe(true);
  });

  it("drops the placeholder once a value is chosen", () => {
    render(<ProductOptionSelector option={LETTER} value="C" onChange={vi.fn()} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;

    expect(select.value).toBe("C");
    expect(Array.from(select.options).map((entry) => entry.value)).toEqual(LETTER.values);
  });
});
