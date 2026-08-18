import type { ReactNode } from "react";

/**
 * A quiet bordered panel for a one-line state — loading, or a step that cannot proceed. Big
 * enough that the page does not visibly collapse when it replaces real content.
 */
export function PanelNotice({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p className="border border-line bg-ivory px-6 py-20 text-center text-body text-muted lg:py-24">
      {children}
    </p>
  );
}
