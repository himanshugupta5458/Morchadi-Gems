import { getInitials } from "@/lib/format";

export type MonogramAccent = "gold" | "charcoal";

export interface MonogramProps {
  name: string;
  accent?: MonogramAccent;
}

const accentClasses: Record<MonogramAccent, string> = {
  gold: "bg-gold text-white",
  charcoal: "bg-charcoal text-ivory",
};

export function Monogram({ name, accent = "gold" }: MonogramProps): JSX.Element {
  return (
    <span
      aria-hidden
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-body-sm ${accentClasses[accent]}`}
    >
      {getInitials(name)}
    </span>
  );
}
