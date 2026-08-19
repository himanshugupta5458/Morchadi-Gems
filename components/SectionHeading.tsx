export type SectionHeadingAlign = "left" | "center";
export type SectionHeadingTone = "light" | "honey";

export interface SectionHeadingProps {
  roman: string;
  accent: string;
  subtitle?: string;
  align?: SectionHeadingAlign;
  tone?: SectionHeadingTone;
  as?: "h1" | "h2" | "h3";
}

const alignmentClasses: Record<SectionHeadingAlign, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
};

interface SectionHeadingToneClasses {
  roman: string;
  accent: string;
  rule: string;
  subtitle: string;
}

const toneClasses: Record<SectionHeadingTone, SectionHeadingToneClasses> = {
  light: {
    roman: "text-ink",
    accent: "text-gold",
    rule: "bg-gold",
    subtitle: "text-muted",
  },
  honey: {
    roman: "text-ink",
    accent: "text-maroon",
    rule: "bg-maroon",
    subtitle: "text-maroon/80",
  },
};

export function SectionHeading({
  roman,
  accent,
  subtitle,
  align = "center",
  tone = "light",
  as: HeadingTag = "h2",
}: SectionHeadingProps): JSX.Element {
  const palette = toneClasses[tone];

  return (
    <div className={`flex flex-col gap-2 sm:gap-3 ${alignmentClasses[align]}`}>
      <HeadingTag className="font-display text-heading-sm sm:text-heading-lg">
        <span className={`uppercase tracking-caps ${palette.roman}`}>{roman}</span>{" "}
        <span className={`italic ${palette.accent}`}>{accent}</span>
      </HeadingTag>
      <span aria-hidden className={`block h-px w-16 ${palette.rule}`} />
      {subtitle ? (
        <p className={`max-w-prose text-body-sm ${palette.subtitle}`}>{subtitle}</p>
      ) : null}
    </div>
  );
}
