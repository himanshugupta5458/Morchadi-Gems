import type { ReactNode } from "react";

export interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  isOptional?: boolean;
  children: ReactNode;
}

export function fieldErrorId(id: string): string {
  return `${id}-error`;
}

export const fieldControlClasses =
  "w-full border bg-white px-4 py-3 font-sans text-body text-ink transition-colors duration-250 placeholder:text-muted/70 disabled:text-muted";

export function fieldBorderClasses(hasError: boolean): string {
  return hasError ? "border-sale" : "border-line";
}

/**
 * The label, the control slot, and the error message — the wiring that every field needs and
 * that is easy to get subtly wrong once per field. `TextField` and `SelectField` compose it;
 * nothing else should hand-roll a label and an error line.
 */
export function FormField({
  id,
  label,
  error,
  isOptional = false,
  children,
}: FormFieldProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-eyebrow uppercase text-muted">
        {label}
        {isOptional ? (
          <span className="ml-2 normal-case tracking-normal text-muted/70">
            optional
          </span>
        ) : null}
      </label>

      {children}

      {error === undefined ? null : (
        <p id={fieldErrorId(id)} className="text-body-sm text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
