import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "@/lib/clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-on-primary border-2 border-primary",
  secondary: "bg-transparent text-ink border-2 border-ink",
  danger: "bg-danger text-on-primary border-2 border-danger",
  ghost: "bg-transparent text-ink border-2 border-transparent",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg font-body text-[13px] font-bold uppercase tracking-[0.06em] transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "px-[18px] py-3" : "px-3 py-2 text-[11px]",
        VARIANT_CLASSES[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
