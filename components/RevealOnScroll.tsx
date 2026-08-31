"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface RevealOnScrollProps {
  children: ReactNode;
  /** Milliseconds to stagger this item behind its neighbours. */
  delayMs?: number;
}

/**
 * Fades and lifts its children into place the first time they scroll into view, then stops
 * watching.
 *
 * It exists because a band of tiles that is identical before and after the shopper reaches it
 * reads as a screenshot. The movement is small on purpose — eight pixels and a fade — and it
 * happens **once**: an element that re-animates every time it re-enters the viewport turns
 * scrolling back up into a light show.
 *
 * Anyone who has asked their system not to animate gets the finished state immediately, via
 * `prefers-reduced-motion` checked in script rather than in CSS, because the initial state
 * here is invisible and a media query that only governed the transition would leave them
 * looking at nothing.
 *
 * Without JavaScript the children are visible: the hidden state is applied by this component
 * after it mounts, so the server-rendered markup is the finished one.
 */
export function RevealOnScroll({ children, delayMs = 0 }: RevealOnScrollProps): JSX.Element {
  const frameRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      setState("shown");
      return;
    }

    setState("hidden");

    const observer = new IntersectionObserver(
      (observed) => {
        if (!observed.some((entry) => entry.isIntersecting)) return;
        setState("shown");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      style={state === "hidden" ? undefined : { transitionDelay: `${delayMs}ms` }}
      className={`h-full transition-all duration-500 ease-out ${
        state === "hidden" ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      {children}
    </div>
  );
}
