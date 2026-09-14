import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="label-tracked mb-2">{children}</p>;
}
