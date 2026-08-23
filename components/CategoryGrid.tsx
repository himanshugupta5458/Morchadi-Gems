import { SURFACED_CATEGORIES } from "@/types/product";
import { CategoryTile } from "@/components/CategoryTile";

export function CategoryGrid(): JSX.Element {
  return (
    <ul className="scrollbar-none -mr-5 flex snap-x snap-mandatory gap-3 overflow-x-auto sm:mr-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-x-visible lg:grid-cols-5 lg:gap-6">
      {SURFACED_CATEGORIES.map((category) => (
        <li
          key={category.slug}
          className="w-[40%] shrink-0 snap-start sm:w-auto sm:shrink sm:snap-align-none"
        >
          <CategoryTile category={category} />
        </li>
      ))}
    </ul>
  );
}
