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
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <Image
          src={buildCategoryImageSrc(category.slug)}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-charcoal/75 via-charcoal/15 to-transparent"
        />
      </div>

      <span className="absolute inset-x-0 bottom-0 px-4 py-5 text-center text-label uppercase tracking-caps text-ivory">
        {category.label}
      </span>
    </Link>
  );
}
