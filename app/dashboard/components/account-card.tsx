"use client";

import { ChevronRight } from "lucide-react";
import { SparkLineChart } from "./sparkline-chart";
import { cn } from "@/lib/utils";

interface AccountCardProps {
  id?: number;
  title: string;
  value: string;
  labels: string[];
  values: number[];
  className?: string;
  /** Se invoca al hacer click en una tarjeta de cuenta real (abre el historial). */
  onOpen?: () => void;
}

export function AccountCard({
  id,
  title,
  value,
  labels,
  values,
  className,
  onOpen,
}: AccountCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] leading-4 text-label">{title}</p>
          <p className="mt-0.5 text-[18px] font-semibold leading-7 tracking-tight text-value">
            {value}
          </p>
        </div>
        {id != null && <ChevronRight className="h-4 w-4 text-subtitle" />}
      </div>
      {values.length > 0 && (
        <div className="mt-2">
          <SparkLineChart data={values} labels={labels} />
        </div>
      )}
    </>
  );

  const base =
    "rounded-lg border border-border bg-card p-4 transition-colors";

  // Si la tarjeta representa una cuenta real, al hacer click abre el historial.
  if (id != null && onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          base,
          "w-full text-left hover:border-primary/40 hover:bg-muted",
          className
        )}
      >
        {content}
      </button>
    );
  }
  return <div className={cn(base, className)}>{content}</div>;
}

export function AccountCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-card p-4">
      <div className="mb-1.5 h-3 w-20 rounded bg-border" />
      <div className="mb-3 h-6 w-28 rounded bg-border" />
      <div className="h-10 w-full rounded bg-border" />
    </div>
  );
}
