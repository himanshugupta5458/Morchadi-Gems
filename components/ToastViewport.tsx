"use client";

import { CheckIcon, ReturnArrowIcon } from "@/components/icons";

/** A way back out of what the toast is reporting. Today that is one thing: undoing a removal. */
export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastViewportProps {
  toastKey: number | null;
  message: string | null;
  action?: ToastAction;
  /** Called after the action runs, so the provider can take the toast down with it. */
  onActionTaken?: () => void;
}

/**
 * The live region is always mounted and always in the accessibility tree, so a screen reader
 * announces the message when it appears rather than announcing a region that just arrived.
 * `toastKey` remounts the pill for each new message so the entrance animation replays.
 *
 * The container stays `pointer-events-none` so a plain toast never intercepts a click meant for
 * the page under it; the pill takes pointer events back only when it carries an action, which
 * is the only time there is anything on it to press.
 */
export function ToastViewport({
  toastKey,
  message,
  action,
  onActionTaken,
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
          className={`inline-flex animate-toast-in items-center gap-3 border border-charcoal bg-charcoal py-3 pl-3 pr-5 text-ivory shadow-card-hover ${
            action === undefined ? "" : "pointer-events-auto"
          }`}
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-charcoal">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-label uppercase tracking-caps">{message}</span>
          {action === undefined ? null : (
            <button
              type="button"
              onClick={() => {
                action.onAction();
                onActionTaken?.();
              }}
              className="inline-flex items-center gap-1.5 border-l border-ivory/25 pl-4 text-label uppercase tracking-caps text-gold transition-colors duration-250 hover:text-ivory"
            >
              <ReturnArrowIcon className="h-3.5 w-3.5" />
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
