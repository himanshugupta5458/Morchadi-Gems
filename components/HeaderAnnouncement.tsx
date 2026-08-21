"use client";

import { useEffect, useState } from "react";
import { FREE_SHIPPING_THRESHOLD, RETURN_WINDOW_DAYS } from "@/lib/config";
import { formatRupees } from "@/lib/format";

const ANNOUNCEMENTS = [
  `Free shipping over ${formatRupees(FREE_SHIPPING_THRESHOLD)} across India`,
  "Anti-tarnish, skin-friendly jewellery",
  `Easy ${RETURN_WINDOW_DAYS}-day returns`,
];

const ROTATION_INTERVAL_MS = 4000;

/**
 * The three promises, cross-fading in the middle of the header's logo row. They were a
 * charcoal strip of their own above the header until
 * [ADR-028](/docs/decisions/ADR-028-header-restructure.md), which stacked charcoal, white and
 * charcoal and left the widest part of the white row empty.
 *
 * All three messages are always rendered, stacked into one grid cell rather than positioned
 * absolutely. That is what makes the middle column exactly as wide as the *longest* promise
 * whichever one is currently visible, so a rotation cannot move the logo or the cart by a
 * pixel — and it keeps all three in the accessibility tree, as the strip did.
 *
 * Hidden below `lg`: the mobile row holds a hamburger, a logo, a track-order link and a
 * cart, and there is no middle left to put a tagline in.
 */
export function HeaderAnnouncement(): JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const rotation = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % ANNOUNCEMENTS.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(rotation);
  }, []);

  return (
    <div className="hidden lg:grid lg:justify-items-center">
      {ANNOUNCEMENTS.map((message, index) => (
        <span
          key={message}
          className={`col-start-1 row-start-1 whitespace-nowrap text-center text-eyebrow uppercase text-muted transition-opacity duration-700 motion-reduce:transition-none ${
            index === activeIndex ? "opacity-100" : "opacity-0"
          }`}
        >
          {message}
        </span>
      ))}
    </div>
  );
}
