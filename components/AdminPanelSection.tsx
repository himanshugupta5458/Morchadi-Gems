import type { ReactNode } from "react";

export interface AdminPanelSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

/**
 * One bordered block of the order detail page: a heading, an optional line saying what the
 * block is for, and its content.
 *
 * The page is a dozen unrelated facts about one order — what was bought, who it is going to,
 * where the money is, what has happened to it — and a single unbroken column of them cannot be
 * scanned. Every section on the page is this component so the rhythm is identical and no block
 * can quietly invent its own padding.
 */
export function AdminPanelSection({
  title,
  description,
  action,
  children,
}: AdminPanelSectionProps): JSX.Element {
  return (
    <section className="flex flex-col border border-line">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ivory px-5 py-3.5">
        <div className="flex flex-col gap-1">
          <h2 className="font-sans text-label uppercase tracking-caps text-ink">{title}</h2>
          {description === undefined ? null : (
            <p className="text-body-sm text-muted">{description}</p>
          )}
        </div>
        {action}
      </header>

      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export interface AdminFactRowProps {
  label: string;
  children: ReactNode;
}

/**
 * A label and its value on one line. Used for every "name: value" fact on the page so the
 * labels line up down a column rather than each block choosing its own alignment.
 */
export function AdminFactRow({ label, children }: AdminFactRowProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-1.5">
      <span className="text-eyebrow uppercase tracking-caps-wide text-muted">{label}</span>
      <span className="text-body-sm text-ink">{children}</span>
    </div>
  );
}
