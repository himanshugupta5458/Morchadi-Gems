import { HOME_CATEGORIES, type CategoryOption } from "@/types/product";
import { CategoryTile } from "@/components/CategoryTile";

export interface CategoryGridProps {
  /**
   * Which tiles to draw. Defaults to `HOME_CATEGORIES` — the ten the home page shows, which is
   * `SURFACED_CATEGORIES` minus the ones held back from the tile grid. The prop exists so the
   * style guide can render a short row without the grid deciding what a category is.
   */
  categories?: readonly CategoryOption[];
}

export function CategoryGrid({
  categories = HOME_CATEGORIES,
}: CategoryGridProps): JSX.Element {
  return (
    <ul className="scrollbar-none -mr-5 flex snap-x snap-mandatory gap-3 overflow-x-auto sm:mr-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-x-visible lg:grid-cols-5 lg:gap-6">
      {categories.map((category) => (
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
