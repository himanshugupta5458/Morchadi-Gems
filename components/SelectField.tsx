"use client";

import {
  FormField,
  fieldBorderClasses,
  fieldControlClasses,
  fieldErrorId,
} from "@/components/FormField";
import { CaretDownIcon } from "@/components/icons";

export interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  autoComplete?: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export function SelectField({
  id,
  label,
  value,
  options,
  placeholder,
  autoComplete,
  error,
  onChange,
  onBlur,
}: SelectFieldProps): JSX.Element {
  const hasError = error !== undefined;

  return (
    <FormField id={id} label={label} error={error}>
      <div className="relative">
        <select
          id={id}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={hasError}
          aria-describedby={hasError ? fieldErrorId(id) : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          className={`${fieldControlClasses} ${fieldBorderClasses(hasError)} appearance-none pr-11`}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <CaretDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </FormField>
  );
}
