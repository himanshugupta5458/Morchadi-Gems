/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductOption } from "@/types/product";
import { getSwatchInk } from "@/lib/swatches";
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
