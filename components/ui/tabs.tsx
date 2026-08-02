"use client";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-tabs p-0.5">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-pressed={isActive}
            className={cn(
              "rounded-full px-3 py-1 text-[13px] leading-5 transition-all duration-150",
              isActive
                ? "bg-card text-card-foreground shadow-sm"
                : "text-subtitle hover:text-tabs-hover"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
