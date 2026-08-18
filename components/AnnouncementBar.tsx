"use client";

import { useEffect, useState } from "react";

const ANNOUNCEMENTS = [
  "Flat ₹99 shipping across India",
  "Certified & hallmarked jewellery",
  "Easy 7-day returns",
];

const ROTATION_INTERVAL_MS = 4000;

export function AnnouncementBar(): JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const rotation = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % ANNOUNCEMENTS.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(rotation);
  }, []);

  return (
    <div className="bg-charcoal text-ivory">
      <div className="container relative flex h-9 items-center justify-center overflow-hidden">
        {ANNOUNCEMENTS.map((message, index) => (
          <span
            key={message}
            className={`absolute inset-x-0 text-center text-eyebrow uppercase transition-opacity duration-700 motion-reduce:transition-none ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            {message}
          </span>
        ))}
      </div>
    </div>
  );
}
