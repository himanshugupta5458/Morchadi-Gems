"use client";

import {
  FormField,
  fieldBorderClasses,
  fieldControlClasses,
  fieldErrorId,
} from "@/components/FormField";

export interface TextAreaFieldProps {
  id: string;
  label: string;
  value: string;
  rows?: number;
  placeholder?: string;
  error?: string;
  isOptional?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export function TextAreaField({
  id,
  label,
  value,
  rows = 5,
  placeholder,
  error,
  isOptional = false,
  onChange,
  onBlur,
}: TextAreaFieldProps): JSX.Element {
  const hasError = error !== undefined;

  return (
    <FormField id={id} label={label} error={error} isOptional={isOptional}>
      <textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={hasError}
        aria-describedby={hasError ? fieldErrorId(id) : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`${fieldControlClasses} ${fieldBorderClasses(hasError)} resize-y`}
      />
    </FormField>
  );
}
