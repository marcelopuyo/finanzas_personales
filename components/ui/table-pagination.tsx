"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TablePaginationProps {
  /** Índice de la página actual (0-based). */
  pageIndex: number;
  /** Cantidad total de páginas. */
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  /** Espaciado/posición del contenedor (cada grilla aporta el suyo). */
  className?: string;
}

/**
 * Paginador reutilizable: "Página X de Y" a la izquierda y los chevrons a la
 * derecha. Antes este markup estaba duplicado en `DataTable` y en la grilla
 * mobile de `CrudTable` (2026-09-20: se extrajo acá y ahora lo usan los tres:
 * escritorio, tarjetas de los CRUD y la lista mobile del historial de cuenta).
 */
export function TablePagination({
  pageIndex,
  pageCount,
  onPrev,
  onNext,
  className,
}: TablePaginationProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-border text-[12px] text-subtitle",
        className
      )}
    >
      <span>
        Página {pageIndex + 1} de {Math.max(pageCount, 1)}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={pageIndex <= 0}
          aria-label="Página anterior"
          className="rounded p-1 text-card-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={pageIndex >= pageCount - 1}
          aria-label="Página siguiente"
          className="rounded p-1 text-card-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
