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

/**
 * Everything a field control looks like except how tall it is: border, ground, horizontal
 * padding, ink, transition. The vertical padding and the type scale are held out so a caller
 * that needs a shorter control can state its own without two `py-*` utilities landing in one
 * class string — which Tailwind settles by the order it emits them in, not the order they are
 * written, exactly as [ADR-025](/docs/decisions/ADR-025-button-padding-tailwind-content.md)
 * found for buttons.
 */
export const fieldControlBaseClasses =
  "w-full border bg-white px-4 font-sans text-ink transition-colors duration-250 placeholder:text-muted/70 disabled:text-muted";

/** The full-height control every form field uses. */
export const fieldControlClasses = `${fieldControlBaseClasses} py-3 text-body`;

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
