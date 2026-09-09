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
}
export function CuentasListClient({ initialData, origen, currency = "USD" }: Props) {
  // Estado local de las cuentas: CrudTable re-sincroniza `items` desde
  // `initialData` cuando cambia, así el toggle de Balance se refleja al instante.
  const [cuentas, setCuentas] = useState(initialData);
  const [pendingId, setPendingId] = useState<number | null>(null);
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
            disabled={pendingId === row.original.id}
            ariaLabel={getValue() ? "Incluida en el balance" : "No incluida en el balance"}
            onChange={(v) => toggleBalance(row.original.id, v)}
          />
        ),
      },
    ],
    [pendingId, toggleBalance, currency]
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
      initialData={cuentas}
      currency={currency}
      deleteItem={eliminarCuenta}
      searchPlaceholder="Buscar cuenta..."
      createHref={`/cruds/cuentas/nuevo${origenQ}`}
      editHref={(id) => `/cruds/cuentas/${id}/editar${origenQ}`}
      getId={(i) => i.id}
      searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q)}
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
