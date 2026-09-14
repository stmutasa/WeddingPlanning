import type { ReactNode } from "react";

// Route-group layout — see app/(app)/layout.tsx for why this doesn't use
// Next's generated LayoutProps.
export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      {children}
    </div>
  );
}
