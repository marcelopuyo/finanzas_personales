"use client";

import { Sun, Moon } from "lucide-react";
// ARCHIVADO: ruta ajustada al alias @/ porque este archivo ya no vive junto
// a theme-provider (ver archivo/README.md).
import { useTheme } from "@/components/layout/theme-provider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground transition-colors"
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
