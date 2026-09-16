import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  centered?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  centered,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        centered && "text-center",
        className
      )}
    >
      <p className="text-[12px] leading-4 text-label">{title}</p>
      <p className="mt-0.5 text-[20px] font-semibold leading-7 tracking-tight text-value">
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-[12px] leading-4 text-subtitle">{subtitle}</p>
      )}
      {trend && trendValue && (
        <p className="mt-1 text-[12px] leading-4">
          <span
            className={cn(
              trend === "up" && "text-success",
              trend === "down" && "text-danger",
              trend === "neutral" && "text-label"
            )}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}{" "}
            {trendValue}
          </span>
        </p>
      )}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card p-4">
      <div className="mb-1.5 h-3 w-20 rounded bg-border" />
      <div className="mb-1.5 h-6 w-32 rounded bg-border" />
      <div className="h-3 w-16 rounded bg-border" />
    </div>
  );
}
