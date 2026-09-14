import { Card, Skeleton } from "@/components/ui";

/** Global route-level loading UI for every screen in the app group. */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-4 pt-4" aria-busy>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-56" />
      <Card>
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="mb-3 h-9 w-48" />
        <Skeleton className="h-2 w-full" />
      </Card>
      <Card>
        <Skeleton className="mb-3 h-3 w-24" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
