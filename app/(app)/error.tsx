"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

/**
 * Route-level error boundary for the app group. This Next version hands the
 * boundary a `retry` callback (node_modules/next/dist/docs — error.js).
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[screen]", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 pt-8">
      <Card>
        <h1 className="mb-2 font-display text-[20px] font-bold text-ink">That screen did not load</h1>
        <p className="mb-4 text-sm text-ink-soft">
          {error.message || "Something went wrong on the way to this page."}
        </p>
        <Button onClick={() => retry()}>Try again</Button>
      </Card>
    </div>
  );
}
