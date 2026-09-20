"use client";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { CrudTable } from "@/components/crud/CrudTable";
import { usePendingNav } from "@/components/ui/nav-progress";
import type { CuentaOut } from "@/backend/src/queries/maestros";
import {
  actualizarCuenta,
  eliminarCuenta,
  reordenarCuentas,
} from "@/backend/src/actions/maestros";
import { actualizarIncluirPrestamosEnBalance } from "@/backend/src/actions/cuenta";
import type { ColumnDef } from "@tanstack/react-table";
import { numberToCurrency } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { CurrencyFlag } from "@/components/ui/currency-flag";
import { toast } from "sonner";
import { OrdenarCuentas } from "./ordenar-cuentas";

interface Props {
  initialData: CuentaOut[];
  /** Origen de navegación (?origen=...). Si es "dashboard" se muestra el botón
      volver para regresar al dashboard al estilo mobile app. */
  origen?: string;
  /** ISO 4217 de la moneda predeterminada del usuario (export PDF). */
  currency?: string;
  /** Moneda predeterminada del usuario (la muestra la fila sintética). */
  monedaPredeterminada?: {
    nombre: string;
    codigoISO: string;
    codigoPais: string | null;
  } | null;
  /** Saldo neto de los préstamos pendientes en la moneda predeterminada (§13). */
  prestamosNeto?: number;
  /** Si ese neto forma parte del Balance Actual (§13). */
  incluirPrestamosEnBalance?: boolean;
}

/** Id centinela de la fila SINTÉTICA "Préstamos (neto)" (no es una cuenta). */
const ID_PRESTAMOS = -1;

type CuentaConSaldo = CuentaOut & { saldoEnMonedaPredeterminada: number };

/**
 * TARJETA de una cuenta en la grilla mobile (2026-09-19, mismo criterio que el
 * CRUD de trabajos): **nombre + saldo** arriba y, debajo, **tipo · moneda** (con
 * la bandera) más el **switch de Balance**.
 *
 * El **número de orden actual** va como chip discreto en el ángulo superior
 * derecho (junto al saldo): es la POSICIÓN en la lista (la que se cambia con
 * "Ordenar"), no el campo `orden` de la BD —ese puede venir en 0 en cuentas
 * creadas después del backfill y quedarían sin número—.
 *
 * ⚠️ El switch es un control interactivo dentro de la fila: `SwipeRowActions` no
 * inicia el gesto de fila cuando el toque arranca sobre un control, así el switch
 * no dispara la edición.
 */
function CuentaCard({
  cuenta: c,
  orden,
  pending,
  onToggleBalance,
}: {
  cuenta: CuentaOut;
  /** Posición 1-based en la lista (`undefined` = fila sintética, sin número). */
  orden?: number;
  /** Deshabilitado mientras la actualización optimista está en vuelo. */
  pending: boolean;
  onToggleBalance: (valor: boolean) => void;
}) {
  const tipo = c.tipo?.nombre ?? "";
  const moneda = c.moneda?.nombre ?? "";
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[14px] font-semibold text-header">
          {c.nombre}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-[14px] font-semibold text-value">
            {numberToCurrency(c.saldo, c.moneda?.codigoISO ?? "ARS")}
          </span>
          {orden != null && (
            <span
              title={`Orden ${orden}`}
              aria-label={`Orden ${orden}`}
              className="rounded-full border border-border bg-card px-1.5 text-[10px] leading-4 font-medium text-subtitle"
            >
              {orden}
            </span>
          )}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-subtitle">
          <CurrencyFlag pais={c.moneda?.codigoPais ?? null} />
          <span className="truncate">
            {tipo}
            {moneda ? ` · ${moneda}` : ""}
          </span>
        </span>
        <Switch
          checked={!!c.incluirEnBalance}
          disabled={pending}
          ariaLabel={
            c.incluirEnBalance
              ? "Incluida en el balance"
              : "No incluida en el balance"
          }
          onChange={onToggleBalance}
        />
      </div>
    </>
  );
}

export function CuentasListClient({
  initialData,
  origen,
  currency = "USD",
  monedaPredeterminada = null,
  prestamosNeto = 0,
  incluirPrestamosEnBalance: incluirInicial = false,
}: Props) {
  // Estado local de las cuentas: se re-sincroniza desde `initialData` cuando la
  // página refresca, así el toggle de Balance se refleja al instante. La
  // sincronización se hace DURANTE el render (patrón de React "ajustar estado
  // cuando cambia una prop"): no necesita un efecto y no hay un render
  // intermedio con los datos viejos.
  const [cuentas, setCuentas] = useState(initialData);
  const [initialDataPrevia, setInitialDataPrevia] = useState(initialData);
  if (initialDataPrevia !== initialData) {
    setInitialDataPrevia(initialData);
    setCuentas(initialData);
  }
  const [pendingId, setPendingId] = useState<number | null>(null);
  // §13: si el saldo neto de los préstamos forma parte del Balance Actual.
  const [incluirPrestamos, setIncluirPrestamos] = useState(incluirInicial);
  const [pendingPrestamos, setPendingPrestamos] = useState(false);
  const router = useRouter();
  // Navegación con feedback (barra de progreso global) para el toque de fila.
  const { go: nav } = usePendingNav();
  // Modo "reordenar": muestra la lista con arrastre (dedo/mouse) en lugar de la
  // grilla. El orden se persiste en la BD por cada arrastre.
  const [reorderMode, setReorderMode] = useState(false);

  // Cambia `incluirEnBalance` en la BD directo desde el listado (optimista:
  // refleja el cambio al instante y revierte si la action falla).
  const toggleBalance = useCallback(async (id: number, nuevoValor: boolean) => {
    setCuentas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, incluirEnBalance: nuevoValor } : c))
    );
    setPendingId(id);
    try {
      await actualizarCuenta(id, { incluirEnBalance: nuevoValor });
    } catch {
      setCuentas((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, incluirEnBalance: !nuevoValor } : c
        )
      );
      toast.error("Error al actualizar el balance de la cuenta");
    } finally {
      setPendingId(null);
    }
  }, []);

  // §13: activa/desactiva que el neto de los préstamos entre en el Balance
  // Actual (optimista, como el switch de las cuentas).
  const togglePrestamos = useCallback(async (nuevoValor: boolean) => {
    setIncluirPrestamos(nuevoValor);
    setPendingPrestamos(true);
    try {
      await actualizarIncluirPrestamosEnBalance({ incluir: nuevoValor });
    } catch {
      setIncluirPrestamos(!nuevoValor);
      toast.error("Error al actualizar el neto de préstamos en el balance");
    } finally {
      setPendingPrestamos(false);
    }
  }, []);

  const columns = useMemo<ColumnDef<CuentaOut>[]>(
    () => [
      { accessorKey: "nombre", header: "Nombre" },
      {
        id: "saldo",
        header: "Saldo",
        // El valor subyacente (orden/sort y EXPORT PDF + total) es el saldo
        // CONVERTIDO a la moneda predeterminada del usuario: así la sumatoria
        // del PDF no mezcla monedas. La celda sigue mostrando el saldo en la
        // moneda de cada cuenta.
        accessorFn: (r) => r.saldoEnMonedaPredeterminada ?? r.saldo,
        meta: {
          align: "right" as const,
          isCurrency: true,
          exportValue: (row: CuentaOut) =>
            numberToCurrency(
              row.saldoEnMonedaPredeterminada ?? row.saldo,
              currency
            ),
        },
        cell: ({ row }) =>
          numberToCurrency(
            row.original.saldo,
            row.original.moneda?.codigoISO ?? "ARS"
          ),
      },
      { accessorFn: (r) => r.tipo?.nombre ?? "", id: "tipo", header: "Tipo" },
      {
        accessorFn: (r) => r.moneda?.nombre ?? "",
        id: "moneda",
        header: "Moneda",
        cell: ({ row }) => {
          const m = row.original.moneda;
          return (
            <span className="inline-flex items-center gap-1.5">
              <CurrencyFlag pais={m?.codigoPais} />
              {m?.nombre ?? ""}
            </span>
          );
        },
      },
      {
        accessorKey: "incluirEnBalance",
        header: "Balance",
        meta: { exportValue: (r: CuentaOut) => (r.incluirEnBalance ? "Sí" : "No") },
        cell: ({ getValue, row }) => (
          <Switch
            checked={!!getValue()}
            disabled={
              row.original.id === ID_PRESTAMOS
                ? pendingPrestamos
                : pendingId === row.original.id
            }
            ariaLabel={getValue() ? "Incluida en el balance" : "No incluida en el balance"}
            onChange={(v) =>
              row.original.id === ID_PRESTAMOS
                ? togglePrestamos(v)
                : toggleBalance(row.original.id, v)
            }
          />
        ),
      },
    ],
    [pendingId, pendingPrestamos, toggleBalance, togglePrestamos, currency]
  );

  // §13 — Fila SINTÉTICA con el saldo neto de los préstamos: NO es una fila de
  // `cuenta` (se agrega sólo a la grilla, no al modo Ordenar ni a la BD) y su
  // switch decide si ese neto suma al Balance Actual.
  const filaPrestamos: CuentaConSaldo = useMemo(
    () => ({
      id: ID_PRESTAMOS,
      nombre: "Préstamos (neto)",
      saldo: prestamosNeto,
      incluirEnBalance: incluirPrestamos,
      orden: 0,
      saldoEnMonedaPredeterminada: prestamosNeto,
      tipo: { nombre: "Préstamos" },
      tarjeta: null,
      moneda: monedaPredeterminada,
    }),
    [prestamosNeto, incluirPrestamos, monedaPredeterminada]
  );

  // Posición (1-based) de cada cuenta en la lista: es el "orden actual" que se
  // muestra en la tarjeta. Se calcula sobre `cuentas` (el orden real que devuelve
  // el server: `orden, id`) y NO sobre la grilla filtrada, así al buscar los
  // números no se renumeran. La fila sintética no entra.
  const posicionPorId = useMemo(() => {
    const m = new Map<number, number>();
    cuentas.forEach((c, i) => m.set(c.id, i + 1));
    return m;
  }, [cuentas]);

  // Datos de la grilla: cuentas reales + la fila sintética (memoizado para no
  // re-disparar el re-sync de `CrudTable` en cada render).
  const dataGrilla = useMemo(
    () => [...cuentas, filaPrestamos],
    [cuentas, filaPrestamos]
  );

  // Al venir del dashboard (?origen=dashboard) se propaga el parámetro a
  // Nuevo/Editar para que, al cancelar/volver, la grilla conserve el botón
  // "volver" al dashboard (patrón mobile app).
  const desdeDashboard = origen === "dashboard";
  const origenQ = desdeDashboard ? "?origen=dashboard" : "";

  // Modo reordenar: pantalla de arrastre (dnd-kit). Cada arrastre persiste el
  // orden; al cerrar se refresca la grilla para que quede en el nuevo orden.
  if (reorderMode) {
    return (
      <OrdenarCuentas
        cuentas={cuentas}
        onReorder={async (ids) => {
          try {
            await reordenarCuentas(ids);
          } catch (err) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Error al reordenar las cuentas"
            );
            throw err;
          }
        }}
        onDone={() => {
          setReorderMode(false);
          router.refresh();
        }}
      />
    );
  }

  return (
    <CrudTable<CuentaOut>
      title="Cuentas"
      columns={columns}
      mobileRow={(c) => (
        <CuentaCard
          cuenta={c}
          orden={posicionPorId.get(c.id)}
          pending={
            c.id === ID_PRESTAMOS
              ? pendingPrestamos
              : pendingId === c.id
          }
          onToggleBalance={(v) =>
            c.id === ID_PRESTAMOS ? togglePrestamos(v) : toggleBalance(c.id, v)
          }
        />
      )}
      initialData={dataGrilla}
      currency={currency}
      deleteItem={eliminarCuenta}
      searchPlaceholder="Buscar cuenta..."
      createHref={`/cruds/cuentas/nuevo${origenQ}`}
      editHref={(id) => `/cruds/cuentas/${id}/editar${origenQ}`}
      getId={(i) => i.id}
      searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q)}
      // La fila "Préstamos (neto)" no es un registro real: sin acciones y sin
      // selección en mobile.
      isSyntheticRow={(i) => i.id === ID_PRESTAMOS}
      backHref={desdeDashboard ? "/dashboard" : undefined}
      mobileBottomNav
      // Mobile: swipe por fila (Editar / Eliminar vienen de `CrudTable`) con
      // **Ordenar** como acción propia; el toque abre la edición.
      mobileSwipe={{
        onRowTap: (id) => nav(`/cruds/cuentas/${id}/editar${origenQ}`, "row"),
        extraActions: (id) =>
          id === ID_PRESTAMOS
            ? []
            : [
                {
                  key: "ordenar",
                  label: "Ordenar",
                  icon: GripVertical,
                  tone: "neutral",
                  onClick: () => setReorderMode(true),
                },
              ],
      }}
      // Desktop: "Ordenar" sigue en la barra de herramientas (en mobile el botón
      // de la barra inferior ya no existe: la acción vive en el swipe).
      extraAction={{
        label: "Ordenar",
        icon: GripVertical,
        onClick: () => setReorderMode(true),
      }}
    />
  );
}
