import { CATEGORIES } from "@/types/product";
import { CategoryTile } from "@/components/CategoryTile";

export function CategoryGrid(): JSX.Element {
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
      {CATEGORIES.map((category) => (
        <li key={category.slug}>
          <CategoryTile category={category} />
        </li>
      ))}
    </ul>
  );
}
