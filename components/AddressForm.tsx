"use client";

import { useState, type FormEvent } from "react";
import { INDIAN_STATES, type Address } from "@/types/cart";
import {
  EMPTY_ADDRESS_FORM,
  findFirstInvalidField,
  validateAddressField,
  validateAddressForm,
  type AddressErrors,
  type AddressField,
  type AddressFormValues,
} from "@/lib/address";
import { Button } from "@/components/Button";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";

export interface AddressFormProps {
  initialValues?: AddressFormValues;
  onSubmit: (address: Address) => void;
}

export function addressFieldId(field: AddressField): string {
  return `address-${field}`;
}

const PHONE_MAX_LENGTH = 10;
const PINCODE_MAX_LENGTH = 6;

/**
 * Validation runs on blur and again on submit, and an already-flagged field re-validates as
 * it is typed so the message clears the moment it stops being true. It never runs on first
 * keystroke of an untouched field — telling someone their email is invalid when they have
 * typed one letter is noise, not help.
 *
 * There is no native form submission: `preventDefault` runs first and navigation is the
 * caller's decision.
 */
export function AddressForm({
  initialValues,
  onSubmit,
}: AddressFormProps): JSX.Element {
  const [values, setValues] = useState<AddressFormValues>(
    initialValues ?? EMPTY_ADDRESS_FORM,
  );
  const [errors, setErrors] = useState<AddressErrors>({});

  function handleChange(field: AddressField, value: string): void {
    setValues((currentValues) => ({ ...currentValues, [field]: value }));

    if (errors[field] !== undefined) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        [field]: validateAddressField(field, value),
      }));
    }
  }

  function handleBlur(field: AddressField): void {
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: validateAddressField(field, values[field]),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const { errors: submitErrors, address } = validateAddressForm(values);
    setErrors(submitErrors);

    if (address === null) {
      const firstInvalidField = findFirstInvalidField(submitErrors);
      if (firstInvalidField !== undefined) {
        document.getElementById(addressFieldId(firstInvalidField))?.focus();
      }
      return;
    }

    onSubmit(address);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-6">
      <TextField
        id={addressFieldId("name")}
        label="Full name"
        value={values.name}
        autoComplete="name"
        placeholder="Ananya Iyer"
        error={errors.name}
        onChange={(value) => handleChange("name", value)}
        onBlur={() => handleBlur("name")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <TextField
          id={addressFieldId("phone")}
          label="Mobile number"
          value={values.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="9876543210"
          maxLength={PHONE_MAX_LENGTH}
          error={errors.phone}
          onChange={(value) => handleChange("phone", value)}
          onBlur={() => handleBlur("phone")}
        />

        <TextField
          id={addressFieldId("email")}
          label="Email"
          value={values.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email}
          onChange={(value) => handleChange("email", value)}
          onBlur={() => handleBlur("email")}
        />
      </div>

      <TextField
        id={addressFieldId("line1")}
        label="Flat, house, building"
        value={values.line1}
        autoComplete="address-line1"
        error={errors.line1}
        onChange={(value) => handleChange("line1", value)}
        onBlur={() => handleBlur("line1")}
      />

      <TextField
        id={addressFieldId("line2")}
        label="Area, street, landmark"
        value={values.line2}
        autoComplete="address-line2"
        isOptional
        error={errors.line2}
        onChange={(value) => handleChange("line2", value)}
        onBlur={() => handleBlur("line2")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <TextField
          id={addressFieldId("city")}
          label="City or town"
          value={values.city}
          autoComplete="address-level2"
          error={errors.city}
          onChange={(value) => handleChange("city", value)}
          onBlur={() => handleBlur("city")}
        />

        <SelectField
          id={addressFieldId("state")}
          label="State"
          value={values.state}
          options={INDIAN_STATES}
          placeholder="Select a state"
          autoComplete="address-level1"
          error={errors.state}
          onChange={(value) => handleChange("state", value)}
          onBlur={() => handleBlur("state")}
        />
      </div>

      <div className="sm:max-w-[12rem]">
        <TextField
          id={addressFieldId("pincode")}
          label="PIN code"
          value={values.pincode}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="400001"
          maxLength={PINCODE_MAX_LENGTH}
          error={errors.pincode}
          onChange={(value) => handleChange("pincode", value)}
          onBlur={() => handleBlur("pincode")}
        />
      </div>

      <div className="pt-2">
        <Button type="submit" fullWidth>
          Continue to payment
        </Button>
      </div>
    </form>
  );
}
