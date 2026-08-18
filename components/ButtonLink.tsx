import Link from "next/link";
import type { ReactNode } from "react";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/lib/button-styles";

export interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  children,
}: ButtonLinkProps): JSX.Element {
  return (
    <Link href={href} className={buttonClasses({ variant, size, fullWidth })}>
      {children}
    </Link>
  );
}
