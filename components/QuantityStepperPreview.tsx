"use client";

import { useState } from "react";
import { MIN_QUANTITY } from "@/lib/quantity";
import { QuantityStepper } from "@/components/QuantityStepper";

/**
 * Exists only so `/style-guide` can render the controlled `QuantityStepper` without the
 * style guide itself becoming a Client Component.
 */
export function QuantityStepperPreview(): JSX.Element {
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const [disabledQuantity] = useState(MIN_QUANTITY);

  return (
    <div className="flex flex-col gap-6">
      <QuantityStepper value={quantity} onChange={setQuantity} />
      <QuantityStepper value={disabledQuantity} disabled onChange={() => undefined} />
    </div>
  );
}
