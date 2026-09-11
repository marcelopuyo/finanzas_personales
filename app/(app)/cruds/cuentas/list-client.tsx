"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { CrudTable } from "@/components/crud/CrudTable";
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

export function CuentasListClient({
  initialData,
  origen,
  currency = "USD",
  monedaPredeterminada = null,
  prestamosNeto = 0,
  incluirPrestamosEnBalance: incluirInicial = false,
}: Props) {
  // Estado local de las cuentas: CrudTable re-sincroniza `items` desde
  // `initialData` cuando cambia, así el toggle de Balance se refleja al instante.
  const [cuentas, setCuentas] = useState(initialData);
  const [pendingId, setPendingId] = useState<number | null>(null);
  // §13: si el saldo neto de los préstamos forma parte del Balance Actual.
  const [incluirPrestamos, setIncluirPrestamos] = useState(incluirInicial);
  const [pendingPrestamos, setPendingPrestamos] = useState(false);
  const router = useRouter();
  // Modo "reordenar": muestra la lista con arrastre (dedo/mouse) en lugar de la
  // grilla. El orden se persiste en la BD por cada arrastre.
  const [reorderMode, setReorderMode] = useState(false);

  // Mantener el estado en sync si la página refresca (mismo comportamiento que CrudTable).
  useEffect(() => {
    setCuentas(initialData);
  }, [initialData]);

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
      extraAction={{
        label: "Ordenar",
        icon: GripVertical,
        onClick: () => setReorderMode(true),
      }}
    />
  );
}
