"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/lib/button-styles";

export type { ButtonSize, ButtonVariant };

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  fillHeight?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  fillHeight = false,
  type = "button",
  children,
  ...buttonProps
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth, fillHeight })}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
