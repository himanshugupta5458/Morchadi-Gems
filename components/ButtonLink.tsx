import Link from "next/link";
import type { ReactNode } from "react";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/lib/button-styles";

/**
 * `data-control="action"` is what tells the floating WhatsApp button this anchor is a call to
 * action rather than ordinary link text, so it moves out from over it. A `<button>` announces
 * itself by its tag name; an anchor styled as a button has to say so. See
 * [ADR-069](/docs/decisions/ADR-069-floating-contact-clearance.md).
 */
export interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  fillHeight?: boolean;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  fillHeight = false,
  children,
}: ButtonLinkProps): JSX.Element {
  return (
    <Link
      href={href}
      data-control="action"
      className={buttonClasses({ variant, size, fullWidth, fillHeight })}
    >
      {children}
    </Link>
  );
}
