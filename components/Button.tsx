// Shared Button (design.md §5). Chunky 2px ink border, 12px radius, hard offset
// shadow, and the press interaction that slides the element into its shadow.
// Space Grotesk 600 labels via the shared `.btn` class.

import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "disabled";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  // Primary: blue fill, white text, hover blue-deep.
  primary: "bg-blue text-white shadow-hard-sm hover:bg-blue-deep",
  // Secondary: coin-gold fill, ink text.
  secondary: "bg-yellow text-ink shadow-hard-sm hover:brightness-95",
  // Ghost / outline: transparent, no shadow.
  ghost: "bg-transparent text-ink shadow-none hover:bg-cream-2 active:translate-x-0 active:translate-y-0",
  // Disabled: muted, no press animation.
  disabled:
    "bg-cream-2 border-[#CDC6B5] text-[#A6A0AE] shadow-[3px_3px_0_#CDC6B5] cursor-not-allowed active:translate-x-0 active:translate-y-0 active:shadow-[3px_3px_0_#CDC6B5]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-[15px]",
  lg: "px-6 py-3.5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  // A truthy `disabled` prop forces the disabled look regardless of variant.
  const effective: ButtonVariant = disabled ? "disabled" : variant;
  return (
    <button
      className={clsx("btn", SIZES[size], VARIANTS[effective], className)}
      disabled={disabled || variant === "disabled"}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

// A link styled exactly like a button — for nav/page links that act as buttons.
import type { AnchorHTMLAttributes } from "react";
import Link from "next/link";

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  href,
  leftIcon,
  rightIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={clsx("btn", SIZES[size], VARIANTS[variant], className)}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
