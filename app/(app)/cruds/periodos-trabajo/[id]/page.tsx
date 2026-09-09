import { getPeriodoTrabajoById } from "@/backend/src/queries/trabajos";
import { getSessionUser } from "@/backend/src/lib/auth";
import { PeriodoTrabajoDetalleClient } from "./detalle-client";

/**
 * Pantalla de un período de trabajo: resumen del período arriba, grilla de sus
 * jornadas (horas_variables) o tareas (por_tarea) en el medio y la barra CRUD
 * abajo. Se abre desde los popups "Por cobrar"/"Actuales" del dashboard y
 * desde el gráfico de actividad de Ingresos → Detalle (?origen=dashboard).
 *
 * Un período cobrado se muestra SOLO LECTURA (histórico): el cliente oculta
 * agregar/editar/eliminar y el botón Cobrar.
 */
export default async function PeriodoTrabajoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ origen?: string; periodos?: string }>;
}) {
  const [{ id }, { origen, periodos }] = await Promise.all([
    params,
    searchParams,
  ]);
  const [periodo, sessionUser] = await Promise.all([
    getPeriodoTrabajoById(Number(id)),
    getSessionUser(),
  ]);

  if (!periodo) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-danger">Período no encontrado</p>
      </div>
    );
  }

  const monedaISO = sessionUser?.monedaPredeterminada?.codigoISO ?? "USD";
  return (
    <PeriodoTrabajoDetalleClient
      periodo={periodo}
      currency={monedaISO}
      origen={origen}
      periodos={periodos}
    />
  );
}
