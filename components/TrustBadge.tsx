import type { ReactNode } from "react";

export interface TrustBadgeProps {
  icon: ReactNode;
  label: string;
  detail?: string;
}

export function TrustBadge({ icon, label, detail }: TrustBadgeProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-line bg-white px-3 py-5 text-center sm:gap-3 sm:px-5 sm:py-7">
      <span className="text-gold-deep">{icon}</span>
      <span className="font-display text-label uppercase tracking-caps text-maroon">
        {label}
      </span>
      {detail ? (
        <span className="text-body-sm text-muted">{detail}</span>
      ) : null}
    </div>
  );
}
