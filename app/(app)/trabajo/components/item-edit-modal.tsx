"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { DateFieldInput } from "@/components/ui/date-picker";
import {
  actualizarJornadaTrabajo,
  actualizarTareaTrabajo,
} from "@/backend/src/actions/movimientos";
import { timeToDecimal } from "@/lib/utils";
import type { ItemEditable } from "../tipos";

const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40";

const btnCancelar =
  "rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted";

const btnGuardar =
  "rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

/** Convierte un input numérico (acepta "," decimal) a número. */
const aNumero = (v: string) => Number(v.replace(",", ".").trim() || 0);

/**
 * Formulario de edición de un ítem **pendiente** de la pantalla `/trabajo`
 * (jornada o tarea), en un **modal centrado** (2026-09-26).
 *
 * El modal reemplaza a las pantallas `/cruds/jornadas-trabajo/[id]/editar` y
 * `/cruds/tareas-trabajo/[id]/editar`, que se archivaron con el rediseño de
 * liquidaciones (R3/R4). Los campos son los mismos del wizard de carga, **sin el
 * trabajo**: un ítem no cambia de trabajo.
 *
 * ⚠️ Sólo edita ítems **pendientes**: el guard real está en las acciones
 * (un ítem ya liquidado está congelado).
 */
export function ItemEditModal({
  item,
  cuentas,
  onClose,
  onSaved,
}: {
  item: ItemEditable;
  /** Cuentas del usuario (para el depósito de la propina). */
  cuentas: { id: number; nombre: string }[];
  onClose: () => void;
  /** Cierre con éxito (la lista se refresca sola: la acción revalida). */
  onSaved: () => void;
}) {
  const esJornada = item.tipo === "jornada";
  // Un estado por campo: el formulario es chico y no necesita react-hook-form.
  const [fecha, setFecha] = useState(item.fecha);
  const [horaDesde, setHoraDesde] = useState(item.horaDesde ?? "09:00");
  const [horaHasta, setHoraHasta] = useState(item.horaHasta ?? "17:00");
  const [propina, setPropina] = useState(String(item.montoPropina || 0));
  const [cuentaId, setCuentaId] = useState(
    item.cuentaPropinaId ? String(item.cuentaPropinaId) : ""
  );
  const [hora, setHora] = useState(item.hora ?? "09:00");
  const [descripcion, setDescripcion] = useState(item.descripcion ?? "");
  const [horas, setHoras] = useState(
    item.horasTarea != null ? String(item.horasTarea) : ""
  );
  const [monto, setMonto] = useState(String(item.monto || 0));
  const [guardando, setGuardando] = useState(false);

  const propinaNum = aNumero(propina);
  const montoNum = aNumero(monto);
  const horasNum = aNumero(horas);
  const puedeGuardar = esJornada
    ? !!fecha &&
      !!horaDesde &&
      !!horaHasta &&
      horaDesde < horaHasta &&
      (propinaNum <= 0 || !!cuentaId)
    : !!fecha && montoNum > 0;

  const guardar = async () => {
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    try {
      if (esJornada) {
        await actualizarJornadaTrabajo(item.id, {
          fecha,
          horaDesde: timeToDecimal(horaDesde),
          horaHasta: timeToDecimal(horaHasta),
          montoPropina: propinaNum,
          idCuenta: propinaNum > 0 ? Number(cuentaId) : undefined,
        });
        toast.success("Jornada actualizada");
      } else {
        await actualizarTareaTrabajo(item.id, {
          // Mismo armado que el wizard: instante LOCAL desde fecha + hora.
          fechaHoraTarea: new Date(`${fecha}T${hora || "00:00"}`).toISOString(),
          fechaTarea: fecha,
          descripcion: descripcion.trim() || undefined,
          horasTarea: horasNum > 0 ? horasNum : undefined,
          montoTarea: montoNum,
        });
        toast.success("Tarea actualizada");
      }
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el ítem"
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open
      centrado
      onClose={() => {
        if (!guardando) onClose();
      }}
      title={esJornada ? "Editar jornada" : "Editar tarea"}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className={btnCancelar}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={!puedeGuardar || guardando}
            className={btnGuardar}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-header">
            {esJornada ? "Fecha" : "Fecha de la tarea"}
          </span>
          <DateFieldInput
            ariaLabel={esJornada ? "Fecha" : "Fecha de la tarea"}
            value={fecha}
            onChange={setFecha}
            buttonClassName={inputCls}
          />
        </div>

        {esJornada ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="item-desde"
                  className="mb-1.5 block text-[13px] font-medium text-header"
                >
                  Hora desde
                </label>
                <input
                  id="item-desde"
                  type="time"
                  value={horaDesde}
                  onChange={(e) => setHoraDesde(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label
                  htmlFor="item-hasta"
                  className="mb-1.5 block text-[13px] font-medium text-header"
                >
                  Hora hasta
                </label>
                <input
                  id="item-hasta"
                  type="time"
                  value={horaHasta}
                  onChange={(e) => setHoraHasta(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="item-propina"
                className="mb-1.5 block text-[13px] font-medium text-header"
              >
                Propina
              </label>
              <input
                id="item-propina"
                type="text"
                inputMode="decimal"
                value={propina}
                onChange={(e) => setPropina(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] leading-4 text-subtitle">
                La propina no entra en la liquidación: se deposita en la cuenta
                que elijas.
              </p>
            </div>

            {propinaNum > 0 && (
              <div>
                <label
                  htmlFor="item-cuenta"
                  className="mb-1.5 block text-[13px] font-medium text-header"
                >
                  Cuenta (propina)
                </label>
                <select
                  id="item-cuenta"
                  value={cuentaId}
                  onChange={(e) => setCuentaId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Seleccionar...</option>
                  {cuentas.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <p className="text-[11px] leading-4 text-subtitle">
              El monto de la jornada se recalcula con el precio por hora del
              trabajo al momento de la carga.
            </p>
          </>
        ) : (
          <>
            <div>
              <label
                htmlFor="item-hora"
                className="mb-1.5 block text-[13px] font-medium text-header"
              >
                Hora
              </label>
              <input
                id="item-hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label
                htmlFor="item-desc"
                className="mb-1.5 block text-[13px] font-medium text-header"
              >
                Descripción
              </label>
              <input
                id="item-desc"
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej. Logo para cliente X"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="item-monto"
                  className="mb-1.5 block text-[13px] font-medium text-header"
                >
                  Monto ganado
                </label>
                <input
                  id="item-monto"
                  type="text"
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label
                  htmlFor="item-horas"
                  className="mb-1.5 block text-[13px] font-medium text-header"
                >
                  Horas (informativas)
                </label>
                <input
                  id="item-horas"
                  type="text"
                  inputMode="decimal"
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
