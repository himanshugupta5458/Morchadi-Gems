"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ToastViewport, type ToastAction } from "@/components/ToastViewport";

/**
 * How long a plain confirmation stays up. Long enough to be read after the eye has moved back
 * to the grid, short enough not to sit over the next card a shopper is reaching for — and
 * shorter than it was, because the button that raised it now also says "Added ✓" in place.
 */
export const TOAST_DURATION_MS = 2200;

/**
 * How long a toast carrying an action stays up. More than twice the plain duration, because a
 * toast that only confirms something is read at a glance while one that offers a way back has
 * to be noticed, understood and reached for — and an Undo that expires before the shopper's
 * hand arrives is worse than no Undo, since it teaches that the offer cannot be relied on.
 */
export const TOAST_ACTION_DURATION_MS = 7000;

export type { ToastAction };

export interface ToastContextValue {
  /**
   * `action` is optional and changes what the toast is: without one it reports that something
   * happened, with one it offers a way back out of it. The action's own click dismisses the
   * toast, so a caller never has to.
   */
  showToast: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
}

/**
 * One toast at a time. A queue would let a shopper who taps Add to cart on four cards watch
 * four notices drain one after another, which reads as a backlog rather than as feedback —
 * the newest message replaces the current one and restarts its timer.
 *
 * Replacement applies to an action toast too, and that is deliberate rather than overlooked:
 * removing two lines in quick succession offers Undo on the second, because the second removal
 * is what the shopper is looking at. The first is recovered from the product page, which is
 * where it was before this existed.
 */
export function ToastProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextToastId = useRef(0);

  const showToast = useCallback((message: string, action?: ToastAction) => {
    nextToastId.current += 1;
    setToast({
      id: nextToastId.current,
      message,
      ...(action === undefined ? {} : { action }),
    });
  }, []);

  useEffect(() => {
    if (toast === null) return;

    const dismissTimer = window.setTimeout(
      () => {
        setToast(null);
      },
      toast.action === undefined ? TOAST_DURATION_MS : TOAST_ACTION_DURATION_MS,
    );

    return () => window.clearTimeout(dismissTimer);
  }, [toast]);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  const dismiss = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport
        toastKey={toast === null ? null : toast.id}
        message={toast === null ? null : toast.message}
        action={toast?.action}
        onActionTaken={dismiss}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}
