"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CategoryCounts } from "@/lib/shop";
import { countActiveFilters, type ShopQuery } from "@/lib/shop-query";
import { ShopFilterPanel } from "@/components/ShopFilterPanel";
import { CloseIcon, FilterIcon } from "@/components/icons";

export interface ShopFilterDrawerProps {
  query: ShopQuery;
  categoryCounts: CategoryCounts;
}

const DRAWER_ID = "shop-filter-drawer";
const FOCUSABLE_SELECTOR = "a[href], button:not([disabled]), input, select";

export function ShopFilterDrawer({
  query,
  categoryCounts,
}: ShopFilterDrawerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const activeCount = countActiveFilters(query);

  useEffect(() => {
    if (!isOpen) return;

    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function dismissAndRestoreFocus(): void {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      dismissAndRestoreFocus();
      return;
    }

    if (event.key !== "Tab") return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={DRAWER_ID}
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 border border-charcoal px-4 py-2 text-label uppercase tracking-caps text-charcoal transition-colors duration-250 hover:border-maroon hover:bg-maroon hover:text-ivory lg:hidden"
      >
        <FilterIcon className="h-4 w-4" />
        Filters
        {activeCount > 0 ? <span>({activeCount})</span> : null}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" onKeyDown={handleKeyDown}>
          <button
            type="button"
            onClick={dismissAndRestoreFocus}
            className="absolute inset-0 h-full w-full bg-charcoal/50"
          >
            <span className="sr-only">Close filters</span>
          </button>

          <div
            ref={panelRef}
            id={DRAWER_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-white shadow-card-hover"
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
              <h2 className="font-display text-heading-sm">Filters</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={dismissAndRestoreFocus}
                className="-mr-2 inline-flex items-center justify-center p-2 text-ink transition-colors duration-250 hover:text-gold-deep"
              >
                <CloseIcon className="h-5 w-5" />
                <span className="sr-only">Close filters</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              <ShopFilterPanel
                query={query}
                categoryCounts={categoryCounts}
                onNavigate={() => setIsOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
