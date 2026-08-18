"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { COMPANY_LINKS, NAV_MENUS } from "@/lib/navigation";
import { CartLink } from "@/components/CartLink";
import { Wordmark } from "@/components/Wordmark";
import { CaretDownIcon, CloseIcon, MenuIcon } from "@/components/icons";

const DRAWER_ID = "mobile-navigation-drawer";
const FOCUSABLE_SELECTOR = "a[href], button:not([disabled])";

export function MobileNav(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function dismiss(): void {
    setIsOpen(false);
    setExpandedKey(null);
  }

  function dismissAndRestoreFocus(): void {
    dismiss();
    toggleRef.current?.focus();
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
        ref={toggleRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={DRAWER_ID}
        onClick={() => setIsOpen(true)}
        className="-ml-2 inline-flex items-center justify-center p-2 text-ink transition-colors duration-250 hover:text-gold-deep lg:hidden"
      >
        <MenuIcon className="h-6 w-6" />
        <span className="sr-only">Open menu</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" onKeyDown={handleKeyDown}>
          <button
            type="button"
            onClick={dismissAndRestoreFocus}
            className="absolute inset-0 h-full w-full bg-charcoal/50"
          >
            <span className="sr-only">Close menu</span>
          </button>

          <div
            ref={panelRef}
            id={DRAWER_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-card-hover"
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
              <Wordmark onNavigate={dismiss} />
              <button
                ref={closeRef}
                type="button"
                onClick={dismissAndRestoreFocus}
                className="-mr-2 inline-flex items-center justify-center p-2 text-ink transition-colors duration-250 hover:text-gold-deep"
              >
                <CloseIcon className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </button>
            </div>

            <div className="border-b border-line px-5 py-4">
              <CartLink withLabel onNavigate={dismiss} />
            </div>

            <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-2">
              <ul className="flex flex-col">
                {NAV_MENUS.map((menu) => {
                  const isExpanded = expandedKey === menu.key;
                  const sectionId = `mobile-nav-${menu.key}`;

                  return (
                    <li key={menu.key} className="border-b border-line/70">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={sectionId}
                        onClick={() => setExpandedKey(isExpanded ? null : menu.key)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-3.5 text-label uppercase tracking-caps text-ink"
                      >
                        {menu.label}
                        <CaretDownIcon
                          className={`h-4 w-4 text-muted transition-transform duration-250 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isExpanded ? (
                        <ul id={sectionId} className="flex flex-col pb-2">
                          {menu.items.map((item) => (
                            <li key={item.key}>
                              <Link
                                href={item.href}
                                onClick={dismiss}
                                className="block bg-ivory px-5 py-2.5 text-body-sm text-muted transition-colors duration-250 hover:text-ink"
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}

                {COMPANY_LINKS.map((companyLink) => (
                  <li key={companyLink.href} className="border-b border-line/70">
                    <Link
                      href={companyLink.href}
                      onClick={dismiss}
                      className="block px-3 py-3.5 text-label uppercase tracking-caps text-ink"
                    >
                      {companyLink.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
