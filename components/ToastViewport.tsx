"use client";

import { CheckIcon } from "@/components/icons";

export interface ToastViewportProps {
  toastKey: number | null;
  message: string | null;
}

/**
 * The live region is always mounted and always in the accessibility tree, so a screen reader
 * announces the message when it appears rather than announcing a region that just arrived.
 * `toastKey` remounts the pill for each new message so the entrance animation replays.
 */
export function ToastViewport({
  toastKey,
  message,
}: ToastViewportProps): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-4 z-50 sm:bottom-6 sm:left-6"
    >
      {message === null ? null : (
        <div
          key={toastKey}
          className="inline-flex animate-toast-in items-center gap-3 border border-charcoal bg-charcoal py-3 pl-3 pr-5 text-ivory shadow-card-hover"
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-charcoal">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-label uppercase tracking-caps">{message}</span>
        </div>
      )}
    </div>
  );
}
