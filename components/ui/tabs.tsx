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
    <div className="flex gap-0.5 rounded-md bg-[#1e1e20] p-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "rounded px-3 py-1 text-[13px] transition-colors",
            activeTab === tab.id
              ? "bg-[#353638] text-[#e2e4f0]"
              : "text-[#808185] hover:text-[#d0d1d4]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
