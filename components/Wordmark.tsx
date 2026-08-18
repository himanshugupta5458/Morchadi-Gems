import Link from "next/link";

export type WordmarkTone = "ink" | "ivory";

export interface WordmarkProps {
  tone?: WordmarkTone;
  onNavigate?: () => void;
}

const romanToneClasses: Record<WordmarkTone, string> = {
  ink: "text-ink",
  ivory: "text-ivory",
};

export function Wordmark({ tone = "ink", onNavigate }: WordmarkProps): JSX.Element {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      aria-label="Morchadi Gems — home"
      className="font-display text-heading-sm leading-none"
    >
      <span className={`uppercase tracking-caps ${romanToneClasses[tone]}`}>
        Morchadi
      </span>{" "}
      <span className="italic text-gold">Gems</span>
    </Link>
  );
}
