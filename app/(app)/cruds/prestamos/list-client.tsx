"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, HandCoins } from "lucide-react";
import { CrudTable } from "@/components/crud/CrudTable";
import { LinkNavStatus, usePendingNav } from "@/components/ui/nav-progress";
import type { PrestamoOut } from "@/backend/src/queries/prestamos";
import { eliminarPrestamo } from "@/backend/src/actions/prestamos";
import type { ColumnDef } from "@tanstack/react-table";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";
import { fraseContraparte } from "@/lib/prestamos";
import { useTap } from "@/lib/tap";
const columns: ColumnDef<PrestamoOut>[] = [
  { accessorKey: "detalle", header: "Detalle", cell: ({ getValue }) => getValue<string|null>() ?? "—" },
  { accessorKey: "fecha", header: "Fecha", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "monto", header: "Monto", meta: { align: "right" as const, isCurrency: true, exportValue: (row: PrestamoOut) => numberToCurrency(row.monto, row.monedaISO ?? "ARS") }, cell: ({ getValue, row }) => numberToCurrency(getValue<number>() ?? 0, row.original.monedaISO ?? "ARS") },
  { accessorKey: "saldo", header: "Saldo", meta: { align: "right" as const, isCurrency: true, exportValue: (row: PrestamoOut) => numberToCurrency(row.saldo, row.monedaISO ?? "ARS") }, cell: ({ getValue, row }) => numberToCurrency(getValue<number>() ?? 0, row.original.monedaISO ?? "ARS") },
  // Una sola columna para la contraparte: el nombre y, debajo, la relación
  // ("te debe" si yo presté, "le debés" si me prestaron). Reemplaza a
  // Origen + Destino + Sentido → la grilla entra mucho mejor en mobile.
  {
    id: "personaContraparte",
    header: "Contraparte",
    accessorFn: (r) =>
      `${r.personaContraparte?.nombre ?? ""} ${fraseContraparte(r.sentido)}`,
    cell: ({ row }) => (
      <span className="flex flex-col">
        <span>{row.original.personaContraparte?.nombre ?? "—"}</span>
        <span className="text-[12px] text-subtitle">
          {fraseContraparte(row.original.sentido)}
        </span>
      </span>
    ),
  },
];
/**
 * Color de FUENTE de la fila: ROJO cuando el préstamo tiene **saldo pendiente**
 * (impago total o parcialmente); los ya saldados quedan con el color normal.
 * Se pinta el TEXTO, no el fondo de la fila (mismo criterio que el CRUD de
 * períodos de trabajo, §87).
 * ⚠️ `[&>td]:text-inherit` es necesario porque `DataTable` pinta cada `<td>` con
 * `text-card-foreground` (propio); sin eso el color del `<tr>` no llega a las
 * celdas.
 */
function filaSaldoCls(p: PrestamoOut): string {
  return (p.saldo ?? 0) > 0 ? "text-danger [&>td]:text-inherit" : "";
}

/**
 * Destino del pago de un préstamo: abre el wizard con el préstamo preseleccionado
 * y `volverA` al CRUD (así Cancelar/guardar vuelven acá, conservando el `origen`).
 * Lo usan la columna "Pagar" (desktop) y la acción "Pagar" del swipe (mobile).
 */
function pagarHref(id: string, origenQ: string): string {
  return `/movimientos/nuevo/pago-prestamo?prestamo=${id}&volverA=${encodeURIComponent(
    `/cruds/prestamos${origenQ}`
  )}`;
}

/**
 * TARJETA de un préstamo en la grilla mobile (2026-09-19, mismo criterio que
 * trabajos y cuentas): **detalle** arriba, debajo la **contraparte · relación ·
 * fecha** en gris chico y, separadas por una línea, las **dos cifras**:
 *
 * ```
 * Prestamo Psicologo
 * Federica · te debe · 19-06-2026
 * ──────────────────────────────────
 * MONTO                 SALDO
 * $ 42.000,00           $ 0,00
 * ```
 *
 * - **MONTO ORIGINAL** a la izquierda, en secundario (gris): de cuánto era el
 *   préstamo.
 * - **SALDO ACTUAL** a la derecha y como **protagonista**: `16px` semibold,
 *   **rojo** mientras quede algo por pagar y neutro si ya está saldado (la
 *   grilla muestrea por defecto solo los pendientes, así que el color sigue
 *   siendo informativo en la vista "todos").
 *
 * Se muestran **siempre las dos** cifras (aunque coincidan en un préstamo
 * impago): el usuario pidió que se lean claramente las dos, con el saldo
 * destacado. Micro-etiquetas en mayúsculas como en el donut y los chips de
 * períodos (`text-[10px] tracking-wide uppercase text-subtitle`).
 *
 * El **detalle** va en su propia línea y **sin truncar**: si es largo hace
 * varias líneas (el título se lee completo). Antes compartía línea con el saldo
 * y se cortaba con puntos suspensivos.
 */
function PrestamoCard({ p }: { p: PrestamoOut }) {
  const saldo = p.saldo ?? 0;
  const montoOriginal = p.monto ?? 0;
  const moneda = p.monedaISO ?? "ARS";
  return (
    <>
      <span className="block text-[14px] leading-snug font-semibold break-words text-header">
        {p.detalle ?? "—"}
      </span>
      <p className="mt-0.5 truncate text-[11.5px] text-subtitle">
        {p.personaContraparte?.nombre ?? "—"} · {fraseContraparte(p.sentido)}
        {p.fecha ? ` · ${dateTimeToString(p.fecha)}` : ""}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-3 border-t border-border/60 pt-1.5">
        <span className="flex min-w-0 flex-col">
          <span className="text-[10px] tracking-wide text-subtitle uppercase">
            Monto
          </span>
          <span className="truncate text-[12.5px] text-card-foreground">
            {numberToCurrency(montoOriginal, moneda)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-[10px] tracking-wide text-subtitle uppercase">
            Saldo
          </span>
          <span
            className={cn(
              "text-[16px] leading-tight font-semibold",
              saldo > 0 ? "text-danger" : "text-value"
            )}
          >
            {numberToCurrency(saldo, moneda)}
          </span>
        </span>
      </div>
    </>
  );
}

interface Props {
  initialData: PrestamoOut[];
  /** Origen de navegación (?origen=...). Si es "dashboard" se muestra el botón
      volver al dashboard y el "+"/editar conservan el origen (patrón mobile app). */
  origen?: string;
}
export function PrestamosListClient({ initialData, origen }: Props) {
  const desdeDashboard = origen === "dashboard";
  const origenQ = desdeDashboard ? "?origen=dashboard" : "";
  // Navegación con feedback (barra de progreso global).
  const { go: nav } = usePendingNav();
  // Mobile: por defecto solo las tarjetas de los préstamos con SALDO pendiente;
  // el botón del pie muestra/oculta los ya saldados.
  const [soloPendientes, setSoloPendientes] = useState(true);
  const conSaldo = initialData.filter((p) => (p.saldo ?? 0) > 0).length;
  const saldados = initialData.length - conSaldo;
  // El conmutador responde al toque (en iOS el `click` puede no llegar: §119).
  const tapFiltro = useTap(() => setSoloPendientes((v) => !v));
  // Botón "Pagar" por fila (última columna de la grilla): solo si el préstamo
  // está impago total o parcialmente (saldo > 0). Lanza el wizard de pago con
  // ese préstamo preseleccionado (mismo estilo que "Cobrar" en los períodos de
  // trabajo cerrados del dashboard). Desde el 2026-09-17 es un `<Link>`: Next
  // prefetchea el wizard cuando la fila entra en pantalla.
  const pagarColumn = useMemo<ColumnDef<PrestamoOut>[]>(
    () => [
      {
        id: "pagar",
        header: "Pagar",
        meta: { align: "center" as const },
        cell: ({ row }) => {
          const p = row.original;
          if ((p.saldo ?? 0) <= 0) {
            return <span className="text-subtitle">—</span>;
          }
          return (
            <Link
              href={pagarHref(p.id, origenQ)}
              title="Pagar préstamo"
              aria-label={`Pagar préstamo ${p.detalle ?? ""}`.trim()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-primary transition-colors hover:bg-primary/15"
            >
              <HandCoins className="h-4 w-4" />
              <LinkNavStatus />
            </Link>
          );
        },
      } as ColumnDef<PrestamoOut>,
    ],
    [origenQ]
  );
  return (
    <CrudTable<PrestamoOut, string>
      title="Préstamos"
      columns={columns}
      trailingColumns={pagarColumn}
      initialData={initialData}
      deleteItem={eliminarPrestamo}
      searchPlaceholder="Buscar préstamo..."
      createHref={`/cruds/prestamos/nuevo${origenQ}`}
      editHref={(id) => `/cruds/prestamos/${id}/editar${origenQ}`}
      getId={(i) => i.id}
      searchPredicate={(i, q) => (i.detalle ?? "").toLowerCase().includes(q)}
      rowClassName={filaSaldoCls}
      backHref={desdeDashboard ? "/dashboard" : undefined}
      mobileBottomNav
      // Mobile: cada préstamo es una TARJETA y se listan solo los que tienen
      // saldo; el pie permite ver también los saldados.
      mobileRow={(p) => <PrestamoCard p={p} />}
      mobileRowFilter={(p) => !soloPendientes || (p.saldo ?? 0) > 0}
      mobileRowFooter={
        <button
          type="button"
          {...tapFiltro}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[12px] font-medium text-subtitle transition-colors hover:bg-muted"
        >
          {soloPendientes
            ? `Ver todos los préstamos (${saldados} saldados)`
            : "Ver solo los pendientes"}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              !soloPendientes && "rotate-180"
            )}
          />
        </button>
      }
      // Swipe: "Pagar" (solo si queda saldo) + Editar/Eliminar (los agrega
      // `CrudTable`). El toque en la tarjeta abre la edición.
      mobileSwipe={{
        onRowTap: (id) => nav(`/cruds/prestamos/${id}/editar${origenQ}`, "row"),
        extraActions: (id) => {
          const p = initialData.find((x) => x.id === id);
          if (!p || (p.saldo ?? 0) <= 0) return [];
          return [
            {
              key: "pagar",
              label: "Pagar",
              icon: HandCoins,
              tone: "success",
              onClick: () => nav(pagarHref(p.id, origenQ), "pagar"),
            },
          ];
        },
      }}
    />
  );
}
