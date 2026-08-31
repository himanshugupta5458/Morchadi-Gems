"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildWhatsAppLink } from "@/lib/config";
import {
  CONTACT_OBSTACLE_SELECTOR,
  liftClearingObstacles,
  type ContactBox,
} from "@/lib/floating-contact";
import { WhatsAppIcon } from "@/components/icons";

/**
 * How long the page must be still before the button comes back and takes a position.
 *
 * Long enough that a flick-scroll through a grid is one disappearance rather than a strobe,
 * short enough that a shopper who has stopped to read does not notice waiting for it.
 */
const SETTLE_DELAY_MS = 160;

/**
 * The floating way to reach the shop, and the one element on the storefront that is allowed
 * to sit on top of the page.
 *
 * It does two things nothing else here does, and both exist because a `fixed` element covers
 * whatever scrolls under it:
 *
 * 1. **While the page is moving it is not on the page.** Scrolling is when a shopper is
 *    reading past things, and it is the whole window during which a static corner button
 *    sweeps across every control in the layout. It fades out on the first scroll event and
 *    comes back once the page has been still for `SETTLE_DELAY_MS`.
 * 2. **At rest it moves out from over any call to action it landed on.** `liftClearingObstacles`
 *    is handed the button's own rectangle and the rectangles of everything matching
 *    `CONTACT_OBSTACLE_SELECTOR`, and answers how far up to go. A product grid puts a row of
 *    actions every card-height, so the clear space is always a short hop away.
 *
 * Together those are the general form of the bug measured against
 * `/shop?category=rings&min=199&max=199&sort=name-desc`, where the button covered 29% of a
 * card's "Choose Your Options". Nudging the offset would have moved that overlap onto the card
 * above it. See [ADR-069](/docs/decisions/ADR-069-floating-contact-clearance.md).
 *
 * Keyboard users never reach the hidden state: focus restores it, because a shopper tabbing to
 * the button is not scrolling and a focusable element that cannot be seen is a trap.
 */
export function WhatsAppButton(): JSX.Element {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const [lift, setLift] = useState(0);
  const [isSettled, setIsSettled] = useState(true);
  /**
   * The applied lift, read back while measuring. It is a ref as well as state because
   * `getBoundingClientRect` reports the button where the transform has already put it, and
   * undoing that is how the resting rectangle is recovered — reading it from state would make
   * the callback change identity on every move and re-subscribe the listeners with it.
   */
  const liftRef = useRef(0);

  const takePosition = useCallback((): void => {
    const anchor = anchorRef.current;
    if (anchor === null) return;

    const applied = liftRef.current;
    const measured = anchor.getBoundingClientRect();
    const resting: ContactBox = {
      top: measured.top + applied,
      left: measured.left,
      right: measured.right,
      bottom: measured.bottom + applied,
    };

    const obstacles = Array.from(
      document.querySelectorAll<HTMLElement>(CONTACT_OBSTACLE_SELECTOR),
    ).map((element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, left: box.left, right: box.right, bottom: box.bottom };
    });

    const cleared = liftClearingObstacles(resting, obstacles);
    liftRef.current = cleared;
    setLift(cleared);
    setIsSettled(true);
  }, []);

  useEffect(() => {
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    function handleMovement(): void {
      setIsSettled(false);
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      settleTimer = setTimeout(takePosition, SETTLE_DELAY_MS);
    }

    takePosition();
    window.addEventListener("scroll", handleMovement, { passive: true });
    window.addEventListener("resize", handleMovement);

    return () => {
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      window.removeEventListener("scroll", handleMovement);
      window.removeEventListener("resize", handleMovement);
    };
  }, [takePosition]);

  return (
    <a
      ref={anchorRef}
      href={buildWhatsAppLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      data-floating-contact
      onFocus={() => setIsSettled(true)}
      style={{ transform: `translateY(-${lift}px)` }}
      className={`fixed bottom-4 right-4 z-30 inline-flex items-center gap-2.5 rounded-full bg-whatsapp py-3 pl-3 pr-3 text-white shadow-card-hover transition-opacity duration-250 motion-reduce:transition-none sm:bottom-6 sm:right-6 sm:pr-5 ${
        isSettled ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <WhatsAppIcon className="h-6 w-6 shrink-0" />
      <span className="hidden text-label uppercase tracking-caps sm:inline">
        Chat with us
      </span>
    </a>
  );
}
