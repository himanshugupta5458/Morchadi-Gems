"use client";

import { useEffect, useRef, useState } from "react";
import type { Testimonial } from "@/types/testimonial";
import { TestimonialCard } from "@/components/TestimonialCard";

export interface TestimonialCarouselProps {
  testimonials: Testimonial[];
}

const AUTO_ADVANCE_INTERVAL_MS = 6000;
const CAROUSEL_VIEWPORT_QUERY = "(max-width: 1023px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function scrollTrackToSlide(
  track: HTMLUListElement | null,
  slideIndex: number,
): void {
  if (!track) return;

  const slide = track.children[slideIndex];
  if (!(slide instanceof HTMLElement)) return;

  track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: "smooth" });
}

export function TestimonialCarousel({
  testimonials,
}: TestimonialCarouselProps): JSX.Element {
  const trackRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    if (!window.matchMedia(CAROUSEL_VIEWPORT_QUERY).matches) return;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

    const advance = window.setTimeout(() => {
      scrollTrackToSlide(trackRef.current, (activeIndex + 1) % testimonials.length);
    }, AUTO_ADVANCE_INTERVAL_MS);

    return () => window.clearTimeout(advance);
  }, [activeIndex, isPaused, testimonials.length]);

  function handleTrackScroll(): void {
    const track = trackRef.current;
    if (!track) return;

    const firstSlide = track.children[0];
    if (!(firstSlide instanceof HTMLElement)) return;

    const nearestIndex = Math.round(track.scrollLeft / firstSlide.offsetWidth);
    setActiveIndex(Math.min(Math.max(nearestIndex, 0), testimonials.length - 1));
  }

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <ul
        ref={trackRef}
        onScroll={handleTrackScroll}
        className="scrollbar-none -mr-5 flex snap-x snap-mandatory overflow-x-auto sm:-mr-6 lg:mr-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible"
      >
        {testimonials.map((testimonial, index) => (
          <li
            key={testimonial.name}
            className="w-full shrink-0 snap-start pr-6 sm:w-1/2 lg:w-auto lg:pr-0"
          >
            <TestimonialCard
              testimonial={testimonial}
              accent={index % 2 === 0 ? "gold" : "charcoal"}
            />
          </li>
        ))}
      </ul>

      <div className="mt-8 flex items-center justify-center gap-2.5 lg:hidden">
        {testimonials.map((testimonial, index) => (
          <button
            key={testimonial.name}
            type="button"
            aria-label={`Show testimonial ${index + 1} of ${testimonials.length}`}
            aria-current={index === activeIndex}
            onClick={() => scrollTrackToSlide(trackRef.current, index)}
            className={`h-2 w-2 rounded-full transition-colors duration-250 ${
              index === activeIndex ? "bg-maroon" : "bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
