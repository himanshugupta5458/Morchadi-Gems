"use client";

import Link from "next/link";
import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { COMPANY_LINKS, NAV_MENUS, type NavMenu } from "@/lib/navigation";
import { CaretDownIcon } from "@/components/icons";

interface NavMenuItemProps {
  menu: NavMenu;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function NavDropdown({ menu, isOpen, onOpen, onClose }: NavMenuItemProps): JSX.Element {
  const itemRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `nav-panel-${menu.key}`;

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
        className="flex items-center gap-1.5 whitespace-nowrap px-4 py-3.5 text-eyebrow uppercase text-ivory transition-colors duration-250 hover:text-gold focus-visible:ring-offset-charcoal aria-expanded:text-gold"
      >
        {menu.label}
        <CaretDownIcon
          className={`h-3 w-3 transition-transform duration-250 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? (
        <div
          id={panelId}
          className="absolute left-0 top-full z-40 min-w-[15rem] border border-line bg-white py-2 shadow-card-hover"
        >
          <ul className="flex flex-col">
            {menu.items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="block px-4 py-2 text-body-sm text-muted transition-colors duration-250 hover:bg-ivory hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function PrimaryNav(): JSX.Element {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <nav
      aria-label="Primary"
      className="hidden border-t border-charcoal bg-charcoal lg:block"
    >
      <div className="container">
        <ul className="flex items-stretch justify-center">
          {NAV_MENUS.map((menu) => (
            <NavDropdown
              key={menu.key}
              menu={menu}
              isOpen={openKey === menu.key}
              onOpen={() => setOpenKey(menu.key)}
              onClose={() => setOpenKey(null)}
            />
          ))}

          {COMPANY_LINKS.map((companyLink) => (
            <li key={companyLink.href} className="flex">
              <Link
                href={companyLink.href}
                className="flex items-center whitespace-nowrap px-4 py-3.5 text-eyebrow uppercase text-ivory transition-colors duration-250 hover:text-gold focus-visible:ring-offset-charcoal"
              >
                {companyLink.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
