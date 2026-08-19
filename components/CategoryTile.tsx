import Image from "next/image";
import Link from "next/link";
import type { CategoryOption } from "@/types/product";
import { buildCategoryHref, buildCategoryImageSrc } from "@/lib/navigation";

export interface CategoryTileProps {
  category: CategoryOption;
  priority?: boolean;
}

export function CategoryTile({
  category,
  priority = false,
}: CategoryTileProps): JSX.Element {
  return (
    <Link
      href={buildCategoryHref(category.slug)}
      className="group relative block overflow-hidden bg-ivory"
    >
      <div className="relative aspect-square w-full overflow-hidden sm:aspect-[4/5]">
        <Image
          src={buildCategoryImageSrc(category.slug)}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-charcoal/90 via-charcoal/55 to-transparent"
        />
      </div>

      <span className="absolute inset-x-0 bottom-0 px-2 py-3 text-center text-eyebrow uppercase tracking-caps text-ivory sm:px-4 sm:py-5 sm:text-label">
        {category.label}
      </span>
    </Link>
  );
}
