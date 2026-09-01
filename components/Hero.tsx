import Image from "next/image";
import { ButtonLink } from "@/components/ButtonLink";
import { TrustStripCompact } from "@/components/TrustStrip";

const HERO_IMAGE_SRC = "/hero/home-hero.webp";
const HERO_IMAGE_ALT =
  "Gold-toned rings, studs and pendant chains laid out on cream silk";

export interface HeroProps {
  categoryAnchorId: string;
}

/**
 * The photograph is composed with its left third empty, so the copy sits in that gap rather
 * than on top of the jewellery. Between `sm` and `lg` the frame drops under the copy at a
 * fixed aspect ratio; from `lg` up the same element goes absolute and becomes the section's
 * ground, which is why the image is declared once and repositioned rather than rendered
 * twice.
 *
 * Below `sm` it is not shown at all and the hero is purely typographic (ADR-033). `priority`
 * preloads an image whether or not it is displayed, so `hidden` alone would still have cost a
 * phone the full-width photograph; the `sizes` hint is what actually prevents the download,
 * by pointing the preload at a candidate the phone will never need. The unit matters: Next
 * builds the source set from the `vw` values it finds in `sizes`, so a `px` fallback leaves
 * 640w as the smallest candidate and the phone still pays for it. `1vw` is what pulls the
 * small widths into the set. Above the breakpoint the hint resolves to `100vw`, exactly as
 * before, so desktop selects the same source it always did.
 */
export function Hero({ categoryAnchorId }: HeroProps): JSX.Element {
  return (
    <section className="relative isolate flex flex-col-reverse overflow-hidden bg-ivory lg:block">
      <div className="relative hidden aspect-[2/1] w-full sm:block sm:aspect-[16/7] lg:absolute lg:inset-0 lg:aspect-auto">
        <Image
          src={HERO_IMAGE_SRC}
          alt={HERO_IMAGE_ALT}
          fill
          priority
          sizes="(min-width: 640px) 100vw, 1vw"
          className="object-cover object-right lg:object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 hidden bg-gradient-to-r from-ivory via-ivory/85 to-transparent lg:block"
        />
      </div>

      <div className="container relative z-10 py-12 sm:py-14 lg:min-h-[36rem] lg:py-32">
        <div className="flex max-w-xl flex-col items-start gap-4 sm:gap-7">
          <span className="text-eyebrow uppercase text-gold-deep">
            Anti-tarnish · Hand-finished · Shipped across India
          </span>

          <h1 className="font-display text-display-sm leading-[1.06] sm:text-display-lg">
            <span className="uppercase tracking-caps text-ink">Everyday</span>{" "}
            <span className="italic text-gold">Sparkle</span>
          </h1>

          <span aria-hidden className="block h-px w-20 bg-gold" />

          <p className="max-w-prose text-body text-muted sm:text-body-lg">
            Anti-tarnish jewellery made to wear every day, priced so you actually
            can.
          </p>

          <div className="grid w-full grid-cols-1 gap-4 sm:w-auto sm:grid-cols-[repeat(2,minmax(17rem,1fr))]">
            <ButtonLink href="/shop" fullWidth>
              Shop Collection
            </ButtonLink>
            <ButtonLink
              href={`#${categoryAnchorId}`}
              variant="secondary"
              fullWidth
            >
              Explore Categories
            </ButtonLink>
          </div>

          {/**
           * The four promises, directly under the two calls to action rather than in a band
           * below the hero.
           *
           * They are the answer to the question the buttons raise — can this shop be trusted
           * with a card number — and a shopper who has to scroll past the fold to find it has
           * already decided without it. The full promise band stays further down the page for
           * anyone reading top to bottom; this is the same four facts, from the same array, at
           * the moment they are first useful. See
           * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
           */}
          <div className="w-full border-t border-line/70 pt-4 sm:pt-5">
            <TrustStripCompact />
          </div>
        </div>
      </div>
    </section>
  );
}
