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
import { ToastViewport } from "@/components/ToastViewport";

export const TOAST_DURATION_MS = 2800;

export interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface Toast {
  id: number;
  message: string;
}

/**
 * One toast at a time. A queue would let a shopper who taps Add to cart on four cards watch
 * four notices drain one after another, which reads as a backlog rather than as feedback —
 * the newest message replaces the current one and restarts its timer.
 */
export function ToastProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextToastId = useRef(0);

  const showToast = useCallback((message: string) => {
    nextToastId.current += 1;
    setToast({ id: nextToastId.current, message });
  }, []);

  useEffect(() => {
    if (toast === null) return;

    const dismissTimer = window.setTimeout(() => {
      setToast(null);
    }, TOAST_DURATION_MS);

    return () => window.clearTimeout(dismissTimer);
  }, [toast]);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport
        toastKey={toast === null ? null : toast.id}
        message={toast === null ? null : toast.message}
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
