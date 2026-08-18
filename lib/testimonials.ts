import storeTestimonials from "@/data/testimonials.json";
import type { Testimonial } from "@/types/testimonial";

const testimonials = storeTestimonials as Testimonial[];

export function getTestimonials(): Testimonial[] {
  return testimonials;
}
