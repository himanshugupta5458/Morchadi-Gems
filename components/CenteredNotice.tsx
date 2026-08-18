import type { ReactNode } from "react";

export interface CenteredNoticeProps {
  icon: ReactNode;
  title: string;
  message: string;
  /** Rendered between the message and the actions — a detail list, a receipt, a summary. */
  children?: ReactNode;
  /** Buttons or links: a row on wide screens, stacked on narrow ones. */
  actions?: ReactNode;
  /** Small print under the actions — a contact line, a caveat, a reassurance. */
  footnote?: ReactNode;
  /**
   * Marks the panel as a live region, for a state that resolves while the shopper is looking
   * at it — a payment being confirmed announces itself; a static guard has nothing to announce.
   */
  isLiveRegion?: boolean;
}

/**
 * The full-width bordered panel every whole-page state in this project is built from: a mark,
 * a heading, a gold rule, a sentence, and a way forward. A checkout that has stopped — because
 * the cart is empty, because a payment failed, because one succeeded — should look like the
 * same site doing the same thing, which is why the shell is one component rather than one per
 * state.
 */
export function CenteredNotice({
  icon,
  title,
  message,
  children,
  actions,
  footnote,
  isLiveRegion = false,
}: CenteredNoticeProps): JSX.Element {
  return (
    <div
      role={isLiveRegion ? "status" : undefined}
      className="flex flex-col items-center gap-7 border border-line bg-ivory px-6 py-20 text-center lg:py-24"
    >
      {icon}

      <h2 className="font-display text-heading text-ink sm:text-heading-lg">{title}</h2>

      <span aria-hidden className="block h-px w-16 bg-gold" />

      <p className="max-w-prose text-body text-muted">{message}</p>

      {children}

      {actions === undefined ? null : (
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">{actions}</div>
      )}

      {footnote === undefined ? null : (
        <p className="max-w-prose text-body-sm text-muted">{footnote}</p>
      )}
    </div>
  );
}
