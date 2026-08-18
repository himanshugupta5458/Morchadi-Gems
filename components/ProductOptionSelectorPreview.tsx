"use client";

import { useState } from "react";
import type { ProductOption } from "@/types/product";
import { formatSelectedOptions } from "@/lib/options";
import { PersonalizedNote } from "@/components/PersonalizedNote";
import { ProductOptionSelector } from "@/components/ProductOptionSelector";

const SHAPE: ProductOption = {
  name: "Shape",
  values: ["Oval", "Heart", "Rectangle", "Round"],
};

const LETTER: ProductOption = {
  name: "Letter",
  values: "ABCDEFGHIJKLMNOPQRSTUVWYZ".split(""),
};

/**
 * Exists only so `/style-guide` can render both selector layouts, and the note that always
 * accompanies them, without the style guide itself becoming a Client Component.
 */
export function ProductOptionSelectorPreview(): JSX.Element {
  const [shape, setShape] = useState(SHAPE.values[0]);
  const [letter, setLetter] = useState(LETTER.values[0]);

  return (
    <div className="flex flex-col gap-6">
      <ProductOptionSelector option={SHAPE} value={shape} onChange={setShape} />
      <ProductOptionSelector option={LETTER} value={letter} onChange={setLetter} />

      <p className="text-body-sm text-muted">
        <span className="text-eyebrow uppercase text-muted">Your choice</span>{" "}
        {formatSelectedOptions({ Shape: shape, Letter: letter })}
      </p>

      <PersonalizedNote withExplanation />
      <PersonalizedNote />
    </div>
  );
}
