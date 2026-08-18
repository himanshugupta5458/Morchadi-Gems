"use client";

import { useState } from "react";
import { INDIAN_STATES } from "@/types/cart";
import { validatePhone } from "@/lib/address";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";

/**
 * `/style-guide` is a Server Component and these fields are controlled, so the QA surface
 * needs a client host to hold their state — the same arrangement as `QuantityStepperPreview`.
 * The phone field is wired to the real validator so the error state on show is the one the
 * checkout actually produces.
 */
export function FormFieldPreview(): JSX.Element {
  const [name, setName] = useState("Ananya Iyer");
  const [landmark, setLandmark] = useState("");
  const [phone, setPhone] = useState("12345");
  const [state, setState] = useState("Maharashtra");
  const [isPhoneTouched, setIsPhoneTouched] = useState(true);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <TextField
        id="preview-name"
        label="Full name"
        value={name}
        autoComplete="off"
        onChange={setName}
        onBlur={() => undefined}
      />

      <TextField
        id="preview-landmark"
        label="Area, street, landmark"
        value={landmark}
        autoComplete="off"
        isOptional
        onChange={setLandmark}
        onBlur={() => undefined}
      />

      <TextField
        id="preview-phone"
        label="Mobile number"
        value={phone}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        maxLength={10}
        error={isPhoneTouched ? validatePhone(phone) : undefined}
        onChange={setPhone}
        onBlur={() => setIsPhoneTouched(true)}
      />

      <SelectField
        id="preview-state"
        label="State"
        value={state}
        options={INDIAN_STATES}
        placeholder="Select a state"
        onChange={setState}
        onBlur={() => undefined}
      />
    </div>
  );
}
