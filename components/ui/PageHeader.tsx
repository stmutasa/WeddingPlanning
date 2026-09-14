import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
