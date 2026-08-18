"use client";

import type { HTMLInputTypeAttribute } from "react";
import {
  FormField,
  fieldBorderClasses,
  fieldControlClasses,
  fieldErrorId,
} from "@/components/FormField";

export interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  type?: HTMLInputTypeAttribute;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  error?: string;
  isOptional?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

export function TextField({
  id,
  label,
  value,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
  maxLength,
  error,
  isOptional = false,
  onChange,
  onBlur,
}: TextFieldProps): JSX.Element {
  const hasError = error !== undefined;

  return (
    <FormField id={id} label={label} error={error} isOptional={isOptional}>
      <input
        id={id}
        type={type}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={hasError}
        aria-describedby={hasError ? fieldErrorId(id) : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`${fieldControlClasses} ${fieldBorderClasses(hasError)}`}
      />
    </FormField>
  );
}
