import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#3e3f42] bg-[#353638] p-4",
        className
      )}
    >
      <p className="text-[12px] leading-4 text-[#9a9b9e]">{title}</p>
      <p className="mt-0.5 text-[20px] font-semibold leading-7 tracking-tight text-[#ffffff]">
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-[12px] leading-4 text-[#808185]">{subtitle}</p>
      )}
      {trend && trendValue && (
        <p className="mt-1 text-[12px] leading-4">
          <span
            className={cn(
              trend === "up" && "text-[#51cf66]",
              trend === "down" && "text-[#ff6b6b]",
              trend === "neutral" && "text-[#9a9b9e]"
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
    <div className="animate-pulse rounded-lg border border-[#3e3f42] bg-[#353638] p-4">
      <div className="mb-1.5 h-3 w-20 rounded bg-[#3e3f42]" />
      <div className="mb-1.5 h-6 w-32 rounded bg-[#3e3f42]" />
      <div className="h-3 w-16 rounded bg-[#3e3f42]" />
    </div>
  );
}
