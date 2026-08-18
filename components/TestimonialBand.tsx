import { getTestimonials } from "@/lib/testimonials";
import { SectionHeading } from "@/components/SectionHeading";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";

export function TestimonialBand(): JSX.Element {
  const testimonials = getTestimonials();

  return (
    <section className="bg-honey py-16 lg:py-20">
      <div className="container flex flex-col gap-10">
        <SectionHeading
          roman="Customer"
          accent="Speak"
          tone="honey"
          subtitle="What people tell us after the box arrives."
        />
        <TestimonialCarousel testimonials={testimonials} />
      </div>
    </section>
  );
}
