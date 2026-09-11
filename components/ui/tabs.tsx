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
              // Mobile: pastilla compacta (px-1/text-[12px]) para que en la
              // fila de controles del panel quepan pestañas + botones en 320px.
              // Desktop (sm+): medida original (px-3/text-[13px]).
              "rounded-full px-1 py-1 text-[12px] leading-5 transition-all duration-150 sm:px-3 sm:text-[13px]",
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
