import { Card, Skeleton } from "@/components/ui";

/** List skeleton: the shape of a card of rows, while the first fetch lands. */
export function RowsSkeleton({ rows = 4, title }: { rows?: number; title?: boolean }) {
  return (
    <Card>
      {title ? <Skeleton className="mb-3 h-3 w-24" /> : null}
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <Skeleton className="mb-3 h-3 w-32" />
      <Skeleton className="mb-3 h-9 w-48" />
      <Skeleton className="h-2 w-full" />
    </Card>
  );
}
