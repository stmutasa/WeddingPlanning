import type { HTMLAttributes, ReactNode } from "react";
import { clsx } from "@/lib/clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** "budget" is the one filled card in the system (DESIGN.md §5.3). */
  variant?: "default" | "budget";
}

export function Card({ children, className, variant = "default", ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-[10px] p-4",
        variant === "default" && "card-frame bg-card text-ink",
        variant === "budget" && "budget-card rounded-[10px]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
