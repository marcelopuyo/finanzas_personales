"use client";

import { SparkLineChart } from "./sparkline-chart";
import { cn } from "@/lib/utils";

interface AccountCardProps {
  title: string;
  value: string;
  labels: string[];
  values: number[];
  className?: string;
}

export function AccountCard({
  title,
  value,
  labels,
  values,
  className,
}: AccountCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#3e3f42] bg-[#353638] p-4",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] leading-4 text-[#9a9b9e]">{title}</p>
          <p className="mt-0.5 text-[18px] font-semibold leading-7 tracking-tight text-[#ffffff]">
            {value}
          </p>
        </div>
      </div>
      {values.length > 0 && (
        <div className="mt-2">
          <SparkLineChart data={values} labels={labels} />
        </div>
      )}
    </div>
  );
}

export function AccountCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-[#3e3f42] bg-[#353638] p-4">
      <div className="mb-1.5 h-3 w-20 rounded bg-[#3e3f42]" />
      <div className="mb-3 h-6 w-28 rounded bg-[#3e3f42]" />
      <div className="h-10 w-full rounded bg-[#3e3f42]" />
    </div>
  );
}
