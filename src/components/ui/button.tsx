"use client";

import { clsx } from "clsx";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type Variant = "primary" | "secondary" | "cta" | "ghost-danger";

type AppButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    className?: string;
  }
>;

const variantClass: Record<Variant, string> = {
  primary: "action-btn btn-primary",
  secondary: "action-btn btn-secondary",
  cta: "action-btn text-[#fff7ed] border-transparent bg-[linear-gradient(120deg,var(--cta),var(--cta-dark))]",
  "ghost-danger": "action-btn btn-ghost-danger",
};

export function AppButton({ variant = "secondary", className, children, ...props }: AppButtonProps) {
  return (
    <button className={clsx(variantClass[variant], className)} {...props}>
      {children}
    </button>
  );
}
