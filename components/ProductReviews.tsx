import type { Review } from "@/types/product";
import { Monogram } from "@/components/Monogram";
import { StarRating } from "@/components/StarRating";

export interface ProductReviewsProps {
  reviews: Review[];
  rating: number;
  reviewCount: number;
}

/**
 * Reviews of one product, written about that piece. Distinct from the store-level
 * `Testimonial` on the home page, which answers "is this shop trustworthy" rather than
 * "is this piece good" — the two share a monogram treatment and nothing else.
 */
export function ProductReviews({
  reviews,
  rating,
  reviewCount,
}: ProductReviewsProps): JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <StarRating value={rating} size="md" />
        <p className="text-body-sm text-muted">
          <span className="text-ink">{rating.toFixed(1)}</span> · {reviewCount}{" "}
          reviews
        </p>
      </div>

      <ul className="flex flex-col gap-px bg-line">
        {reviews.map((review, index) => (
          <li
            key={`${review.name}-${index}`}
            className="flex flex-col gap-4 bg-white py-6 sm:flex-row sm:gap-6"
          >
            <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
              <Monogram
                name={review.name}
                accent={index % 2 === 0 ? "gold" : "charcoal"}
              />
              <div className="flex flex-col gap-1">
                <span className="font-display text-body font-semibold text-ink">
                  {review.name}
                </span>
                <StarRating value={review.rating} />
              </div>
            </div>

            <p className="flex-1 text-body-sm text-muted sm:pt-1.5">{review.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
