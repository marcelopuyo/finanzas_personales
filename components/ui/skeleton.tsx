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
    <div className="space-y-3 rounded-lg border border-[#3e3f42] bg-[#353638] p-4">
      <Skeleton className="h-3 w-24 bg-[#3e3f42]" />
      <Skeleton className="h-6 w-36 bg-[#3e3f42]" />
      <Skeleton className="h-3 w-20 bg-[#3e3f42]" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-[#3e3f42] bg-[#353638] p-5">
      <div className="h-4 w-28 animate-pulse rounded bg-[#3e3f42]" />
      <div className="h-64 w-full animate-pulse rounded bg-[#1e1e20]" />
    </div>
  );
}
