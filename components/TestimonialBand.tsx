import { getTestimonials } from "@/lib/testimonials";
import { SectionHeading } from "@/components/SectionHeading";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";

export interface TestimonialBandProps {
  roman?: string;
  accent?: string;
  subtitle?: string;
}

/**
 * The heading words are props so a second page can run the same band under its own title
 * without duplicating the ground, the tone and the carousel wiring. The data source is not a
 * prop — the JSON import stays server-side here.
 */
export function TestimonialBand({
  roman = "Customer",
  accent = "Speak",
  subtitle = "What people tell us after the box arrives.",
}: TestimonialBandProps = {}): JSX.Element {
  const testimonials = getTestimonials();

  return (
    <section className="bg-honey py-10 sm:py-16 lg:py-20">
      <div className="container flex flex-col gap-6 sm:gap-10">
        <SectionHeading
          roman={roman}
          accent={accent}
          tone="honey"
          subtitle={subtitle}
        />
        <TestimonialCarousel testimonials={testimonials} />
      </div>
    </section>
  );
}
