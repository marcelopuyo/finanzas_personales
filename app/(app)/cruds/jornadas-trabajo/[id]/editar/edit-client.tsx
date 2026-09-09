"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarJornadaTrabajo } from "@/backend/src/actions/trabajos";
import type { JornadaTrabajoOut } from "@/backend/src/queries/trabajos";
import {
  jornadaTrabajoSchema,
  jornadaTrabajoSchemaEnPeriodo,
  jornadaTrabajoFieldsEditar,
  jornadaTrabajoFieldsEditarEnPeriodo,
} from "../../jornada-trabajo-form-config";
import { decimalToTime, timeToDecimal } from "@/lib/utils";
const dt = (v: Date) => String(v).slice(0, 10);
interface Props {
  data: JornadaTrabajoOut & {
    periodoTrabajoId?: number;
    cuentaPropinaId?: number;
  };
  /** Edición lanzada desde la pantalla de un período: el período queda FIJO
      (sin selector) y al guardar/cancelar se vuelve a esa pantalla (volverA). */
  periodoFijo?: boolean;
  volverA?: string;
}
export function EditarJornadaTrabajoClient({
  data,
  periodoFijo = false,
  volverA,
}: Props) {
  const p = useParams();
  const back = volverA || "/cruds/jornadas-trabajo";
  // En modo período fijo el id del período sale de la jornada (el form no
  // tiene selector de período y la BD no permite "auto" desde acá).
  const idPeriodoFijo = data.periodoTrabajoId
    ? String(data.periodoTrabajoId)
    : undefined;
  return (
    <CrudForm
      title="Editar Jornada de Trabajo"
      fields={
        periodoFijo
          ? jornadaTrabajoFieldsEditarEnPeriodo
          : jornadaTrabajoFieldsEditar
      }
      schema={
        periodoFijo ? jornadaTrabajoSchemaEnPeriodo : jornadaTrabajoSchema
      }
      defaultValues={{
        fechaJornada: dt(data.fechaJornada),
        horaDesde: decimalToTime(data.horaDesde),
        horaHasta: decimalToTime(data.horaHasta),
        montoPropina: data.montoPropina,
        idPeriodo: idPeriodoFijo,
        idCuenta: data.cuentaPropinaId
          ? String(data.cuentaPropinaId)
          : undefined,
      }}
      onSubmit={async (f) => {
        const idPeriodo = periodoFijo
          ? idPeriodoFijo
          : (f.idPeriodo as string);
        const propina = Number(f.montoPropina ?? 0);
        await actualizarJornadaTrabajo(String(p.id), {
          fechaJornada: f.fechaJornada as string,
          horaDesde: timeToDecimal(f.horaDesde as string),
          horaHasta: timeToDecimal(f.horaHasta as string),
          montoPropina: propina,
          ...(propina > 0
            ? { idCuenta: f.idCuenta ? Number(f.idCuenta) : undefined }
            : {}),
          ...(idPeriodo === "auto"
            ? { crearPeriodoAutomatico: true, idTrabajo: Number(f.idTrabajo) }
            : idPeriodo
              ? { idPeriodo: Number(idPeriodo) }
              : {}),
        });
      }}
      cancelHref={back}
      successMessage="Jornada actualizada correctamente"
    />
  );
}
