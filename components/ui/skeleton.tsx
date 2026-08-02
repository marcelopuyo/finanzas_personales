import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-muted", className)}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-3 w-24 bg-border" />
      <Skeleton className="h-6 w-36 bg-border" />
      <Skeleton className="h-3 w-20 bg-border" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-5">
      <div className="h-4 w-28 animate-pulse rounded bg-border" />
      <div className="h-64 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}
