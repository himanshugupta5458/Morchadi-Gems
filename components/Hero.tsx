import Image from "next/image";
import { CATEGORIES } from "@/types/product";
import { getAllProducts } from "@/lib/products";
import { ButtonLink } from "@/components/ButtonLink";

const HERO_IMAGE_SRC = "/hero/home-hero.webp";

export interface HeroProps {
  categoryAnchorId: string;
}

export function Hero({ categoryAnchorId }: HeroProps): JSX.Element {
  const catalogueSize = getAllProducts().length;

  return (
    <section className="bg-ivory">
      <div className="container grid grid-cols-1 items-center gap-12 py-16 lg:grid-cols-12 lg:gap-16 lg:py-28">
        <div className="flex flex-col items-start gap-7 lg:col-span-7">
          <span className="text-eyebrow uppercase text-gold-deep">
            Anti-tarnish · Hand-finished · Shipped across India
          </span>

          <h1 className="font-display text-display leading-[1.06] sm:text-display-lg">
            <span className="uppercase tracking-caps text-ink">The Everyday</span>{" "}
            <span className="italic text-gold">Heirloom</span>
          </h1>

          <span aria-hidden className="block h-px w-20 bg-gold" />

          <p className="max-w-prose text-body-lg text-muted">
            Gold-plated, anti-tarnish and kind to skin — finished by hand in small
            batches, priced to be worn rather than locked away.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <ButtonLink href="/shop">Shop Collection</ButtonLink>
            <ButtonLink href={`#${categoryAnchorId}`} variant="secondary">
              Explore Categories
            </ButtonLink>
          </div>

          <p className="text-body-sm text-muted">
            {catalogueSize} pieces across {CATEGORIES.length} collections
          </p>
        </div>

        <div className="relative lg:col-span-5">
          <div className="relative aspect-[4/3] w-full overflow-hidden">
            <Image
              src={HERO_IMAGE_SRC}
              alt="Morchadi Gems artificial jewellery"
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-ivory/60 via-transparent to-ivory/40"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
