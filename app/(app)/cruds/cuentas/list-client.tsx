"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CrudTable } from "@/components/crud/CrudTable";
import type { CuentaOut } from "@/backend/src/queries/maestros";
import { actualizarCuenta, eliminarCuenta } from "@/backend/src/actions/maestros";
import type { ColumnDef } from "@tanstack/react-table";
import { numberToCurrency } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Props { initialData: CuentaOut[] }
export function CuentasListClient({ initialData }: Props) {
  // Estado local de las cuentas: CrudTable re-sincroniza `items` desde
  // `initialData` cuando cambia, así el toggle de Balance se refleja al instante.
  const [cuentas, setCuentas] = useState(initialData);
  const [pendingId, setPendingId] = useState<number | null>(null);

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
      { accessorKey: "saldo", header: "Saldo", meta: { align: "right" as const, isCurrency: true, exportValue: (row: CuentaOut) => numberToCurrency(row.saldo, row.moneda?.codigoISO ?? "ARS") }, cell: ({ getValue, row }) => numberToCurrency(getValue<number>() ?? 0, row.original.moneda?.codigoISO ?? "ARS") },
      { accessorFn: (r) => r.tipo?.nombre ?? "", id: "tipo", header: "Tipo" },
      { accessorFn: (r) => r.moneda?.nombre ?? "", id: "moneda", header: "Moneda" },
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
    [pendingId, toggleBalance]
  );

  return <CrudTable<CuentaOut> title="Cuentas" columns={columns} initialData={cuentas} deleteItem={eliminarCuenta} searchPlaceholder="Buscar cuenta..." createHref="/cruds/cuentas/nuevo" editHref={(id) => `/cruds/cuentas/${id}/editar`} getId={(i) => i.id} searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q)} />;
}
