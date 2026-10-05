"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import { usePendingNav } from "@/components/ui/nav-progress";
import type { TrabajoOut } from "@/backend/src/queries/trabajos";
import { eliminarTrabajo } from "@/backend/src/actions/trabajos";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";
import { sufijoOrigen, volverDeOrigen } from "@/lib/origen-crud";
import { MODALIDAD_LABEL } from "./trabajo-form-config";
const columns: ColumnDef<TrabajoOut>[] = [
  { accessorKey: "nombre", header: "Nombre" },
  { accessorKey: "fechaInicio", header: "Inicio", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  {
    accessorKey: "modalidadCobro",
    header: "Modalidad",
    cell: ({ getValue }) =>
      MODALIDAD_LABEL[getValue<string>() ?? "horas_variables"] ??
      getValue<string>() ??
      "",
  },
  { accessorKey: "precioHora", header: "Precio Hora", meta: { align: "right" as const, isCurrency: true }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
];

/**
 * TARJETA de un trabajo en la grilla mobile (elegida por el usuario el
 * 2026-09-19 sobre 3 alternativas; ver `favicons/preview-crud-trabajos-tarjetas.html`):
 * **nombre + precio** arriba y, debajo en gris chico, **modalidad · inicio**.
 *
 * Con esto la tabla de 4 columnas no hace falta en el celular: la grilla de
 * escritorio sigue igual y en mobile cada fila es una tarjeta que aprovecha todo
 * el ancho (la fecha de inicio vuelve como dato secundario, que es lo que no
 * entraba en la grilla).
 *
 * ⚠️ **`por_tarea` y `fijo` NO muestran precio por hora** (2026-09-19, pedido del
 * usuario): ninguna de las dos modalidades "sin horas" lo usa. `por_tarea` se
 * cobra con el **monto de cada tarea** y `fijo` con el **monto cargado en cada
 * período** (backend: `crearPeriodoTrabajo` → `data.montoACobrar`; el precio por
 * hora solo se copia como snapshot en `horas_fijas`). En los dos casos
 * `precioHora` queda en 0 y mostrarlo era ruido. La tarjeta muestra solo el
 * nombre y el renglón de modalidad · inicio.
 */
function TrabajoCard({ t }: { t: TrabajoOut }) {
  const modalidad =
    MODALIDAD_LABEL[t.modalidadCobro ?? "horas_variables"] ?? t.modalidadCobro ?? "";
  const inicio = dateTimeToString(t.fechaInicio);
  // El precio por hora solo tiene sentido en las modalidades por hora.
  const mostraPrecio =
    t.modalidadCobro !== "por_tarea" && t.modalidadCobro !== "fijo";
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[14px] text-header">
          {t.nombre}
        </span>
        {mostraPrecio && (
          <span className="shrink-0 text-[14px] text-value">
            {numberToCurrency(t.precioHora ?? 0)}
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate text-[11.5px] text-subtitle">
        {modalidad}
        {inicio ? ` · ${inicio}` : ""}
      </p>
    </>
  );
}
interface Props {
  initialData: TrabajoOut[];
  /** Origen de navegación (?origen=<vista del dashboard>). De ahí sale la flecha
      "volver" del listado y se propaga al Nuevo/Editar (la mantiene al volver).
      Ver `lib/origen-crud.ts`. */
  origen?: string;
}
export function TrabajosListClient({ initialData, origen }: Props) {
  // La flecha "volver" va a la VISTA desde la que se abrió el CRUD (Ingresos, si
  // se llegó por el ⋯ de su panel) y el origen se propaga al "+" (wizard) y al editar.
  const volver = volverDeOrigen(origen);
  const origenQ = sufijoOrigen(origen);
  // Navegación con feedback (barra de progreso global) para el toque de fila.
  const { go: nav } = usePendingNav();
  return <CrudTable<TrabajoOut> title="Trabajos" columns={columns} mobileRow={(t) => <TrabajoCard t={t} />} initialData={initialData} sinPaginacion deleteItem={eliminarTrabajo} searchPlaceholder="Buscar trabajo..." createHref={`/cruds/trabajos/nuevo${origenQ}`} editHref={(id) => `/cruds/trabajos/${id}/editar${origenQ}`} getId={(i) => i.id} searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q)} mobileBottomNav mobileSwipe={{ onRowTap: (id) => nav(`/cruds/trabajos/${id}/editar${origenQ}`, "row") }} backHref={volver} />;
}
