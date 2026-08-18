import type { ReactNode } from "react";

/**
 * Long-form typography for pages written as prose rather than composed from components. It
 * styles its descendants by element, so a policy or story page writes plain semantic HTML and
 * gets the design system's type scale, gold list markers and link treatment without importing
 * a component per paragraph.
 *
 * The measure is capped at `max-w-prose` (68ch) — the readable line length the type scale was
 * set for.
 */
export function Prose({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      className="max-w-prose text-body text-muted [&>*:first-child]:mt-0 [&_a]:text-ink [&_a]:underline [&_a]:decoration-gold [&_a]:underline-offset-4 [&_a]:transition-colors [&_a]:duration-250 hover:[&_a]:text-gold-deep [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-heading-sm [&_h2]:text-ink [&_code]:bg-ivory [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-body-sm [&_code]:text-ink [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-body-lg [&_h3]:text-ink [&_li]:mt-2 [&_li]:marker:text-gold [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-5 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5"
    >
      {children}
    </div>
  );
}
