import Image from "next/image";
import { ButtonLink } from "@/components/ButtonLink";

const HERO_IMAGE_SRC = "/hero/home-hero.webp";
const HERO_IMAGE_ALT =
  "Gold-toned rings, studs and pendant chains laid out on cream silk";

export interface HeroProps {
  categoryAnchorId: string;
}

/**
 * The photograph is composed with its left third empty, so the copy sits in that gap rather
 * than on top of the jewellery. Below `lg` the frame drops under the copy at a fixed aspect
 * ratio; from `lg` up the same element goes absolute and becomes the section's ground, which
 * is why the image is declared once and repositioned rather than rendered twice.
 */
export function Hero({ categoryAnchorId }: HeroProps): JSX.Element {
  return (
    <section className="relative isolate flex flex-col-reverse overflow-hidden bg-ivory lg:block">
      <div className="relative aspect-[16/10] w-full sm:aspect-[16/7] lg:absolute lg:inset-0 lg:aspect-auto">
        <Image
          src={HERO_IMAGE_SRC}
          alt={HERO_IMAGE_ALT}
          fill
          priority
          sizes="100vw"
          className="object-cover object-right lg:object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden bg-gradient-to-r from-ivory via-ivory/85 to-transparent lg:block"
        />
      </div>

      <div className="container relative z-10 py-14 lg:min-h-[36rem] lg:py-32">
        <div className="flex max-w-xl flex-col items-start gap-7">
          <span className="text-eyebrow uppercase text-gold-deep">
            Anti-tarnish · Hand-finished · Shipped across India
          </span>

          <h1 className="font-display text-display leading-[1.06] sm:text-display-lg">
            <span className="uppercase tracking-caps text-ink">Everyday</span>{" "}
            <span className="italic text-gold">Sparkle</span>
          </h1>

          <span aria-hidden className="block h-px w-20 bg-gold" />

          <p className="max-w-prose text-body-lg text-muted">
            Anti-tarnish jewellery made to wear every day, priced so you actually
            can.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <ButtonLink href="/shop">Shop Collection</ButtonLink>
            <ButtonLink href={`#${categoryAnchorId}`} variant="secondary">
              Explore Categories
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
