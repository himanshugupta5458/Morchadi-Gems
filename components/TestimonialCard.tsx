import type { Testimonial } from "@/types/testimonial";
import { Monogram, type MonogramAccent } from "@/components/Monogram";
import { StarRating } from "@/components/StarRating";

export type TestimonialAccent = MonogramAccent;

export interface TestimonialCardProps {
  testimonial: Testimonial;
  accent?: TestimonialAccent;
}

export function TestimonialCard({
  testimonial,
  accent = "gold",
}: TestimonialCardProps): JSX.Element {
  return (
    <figure className="flex h-full flex-col gap-3 border border-line bg-white p-4 sm:gap-4 sm:p-6">
      <StarRating value={testimonial.rating} size="md" />

      <blockquote className="flex-1 text-body-sm text-muted">
        {testimonial.text}
      </blockquote>

      <figcaption className="flex items-center gap-3 border-t border-line pt-3 sm:pt-4">
        <Monogram name={testimonial.name} accent={accent} />
        <span className="font-display text-body font-semibold text-ink">
          {testimonial.name}
        </span>
      </figcaption>
    </figure>
  );
}
