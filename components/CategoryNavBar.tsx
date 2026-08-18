"use client";

import Link from "next/link";
import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import type { Category } from "@/types/product";
import { NAV_CATEGORIES, type NavCategory } from "@/lib/navigation";
import { CaretDownIcon } from "@/components/icons";

interface CategoryNavItemProps {
  category: NavCategory;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function CategoryNavItem({
  category,
  isOpen,
  onOpen,
  onClose,
}: CategoryNavItemProps): JSX.Element {
  const itemRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `category-panel-${category.slug}`;

  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>): void {
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation();
      onClose();
      triggerRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown" && !isOpen) {
      event.preventDefault();
      onOpen();
    }
  }

  function handleBlur(event: FocusEvent<HTMLLIElement>): void {
    const nextFocused = event.relatedTarget;
    const staysInsideItem =
      nextFocused instanceof Node && itemRef.current?.contains(nextFocused);

    if (!staysInsideItem) onClose();
  }

  return (
    <li
      ref={itemRef}
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={isOpen ? onClose : onOpen}
        className="flex items-center gap-1.5 whitespace-nowrap px-3 py-3.5 text-eyebrow uppercase text-ivory transition-colors duration-250 hover:text-gold focus-visible:ring-offset-charcoal aria-expanded:text-gold xl:px-4"
      >
        {category.label}
        <CaretDownIcon
          className={`h-3 w-3 transition-transform duration-250 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? (
        <div
          id={panelId}
          className="absolute left-0 top-full z-40 min-w-[14rem] border border-line bg-white py-2 shadow-card-hover"
        >
          <ul className="flex flex-col">
            {category.quickFilters.map((quickFilter) => (
              <li key={quickFilter.key}>
                <Link
                  href={quickFilter.href}
                  className="block px-4 py-2 text-body-sm text-muted transition-colors duration-250 hover:bg-ivory hover:text-ink"
                >
                  {quickFilter.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function CategoryNavBar(): JSX.Element {
  const [openSlug, setOpenSlug] = useState<Category | null>(null);

  return (
    <nav
      aria-label="Product categories"
      className="hidden border-t border-charcoal bg-charcoal lg:block"
    >
      <div className="container">
        <ul className="flex items-stretch justify-center">
          {NAV_CATEGORIES.map((category) => (
            <CategoryNavItem
              key={category.slug}
              category={category}
              isOpen={openSlug === category.slug}
              onOpen={() => setOpenSlug(category.slug)}
              onClose={() => setOpenSlug(null)}
            />
          ))}
        </ul>
      </div>
    </nav>
  );
}
