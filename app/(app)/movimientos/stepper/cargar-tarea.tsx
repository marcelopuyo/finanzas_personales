"use client";

// Paso del wizard: cargar una nueva TAREA de trabajo (modalidad por_tarea).
// Espejo del flujo "Jornada trabajo", pero SIN propina ni depósito: se registra
// la tarea (fecha/hora efectiva, descripción, horas informativas y monto ganado)
// dentro de un período del trabajo por_tarea (existente o automático).
import { useEffect } from "react";
import { useMovimientoStepper } from "./stepper-context";
import {
  StepShell,
  NavButtons,
  DateField,
  TimeField,
  TextField,
  NumberField,
  SelectField,
  formatFecha,
} from "./ui";
import { STEP_CONFIRMACION } from "./types";
import { numberToCurrency, todayLocalISODate } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

export function CargarTarea() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  // Al abrir el asistente (primera vez en este paso) se precargan la FECHA y la
  // HORA ACTUALES de la tarea, y la descripción por defecto "Tarea · dd/mm hh:mm"
  // queda autocompletada (no requiere que el usuario escriba). Si el usuario ya
  // eligió una hora (p. ej. volvió desde Confirmación) no se pisa su valor.
  useEffect(() => {
    if (data.horaDesde) return;
    const ahora = new Date();
    const hh = pad(ahora.getHours());
    const mi = pad(ahora.getMinutes());
    const hora = `${hh}:${mi}`;
    handleSetData({
      fecha: todayLocalISODate(),
      horaDesde: hora,
      descripcionTarea: `Tarea · ${pad(ahora.getDate())}/${pad(
        ahora.getMonth() + 1
      )} ${hora}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo trabajos/períodos de modalidad por_tarea admiten tareas (2026-09-05).
  const periodosPorTarea = options.periodosTrabajo.filter(
    (p) => (p.trabajo?.modalidadCobro ?? "horas_variables") === "por_tarea"
  );
  const trabajosPorTarea = options.trabajos.filter(
    (t) => (t.modalidadCobro ?? "horas_variables") === "por_tarea"
  );

  const periodoValido = data.crearPeriodoAutomatico
    ? data.idTrabajo > 0
    : data.periodoTrabajo > 0;
  const horaValida = !!data.horaDesde;
  const montoValido = data.montoTarea > 0;

  // Al cambiar fecha/hora, precargar la descripción (editable).
  const definirFechaHora = (fecha: string, hora: string) => {
    if (!data.descripcionTarea && fecha && hora) {
      const [, m, d] = fecha.split("-");
      handleSetData({
        fecha,
        horaDesde: hora,
        descripcionTarea: `Tarea · ${pad(parseInt(d, 10))}/${pad(
          parseInt(m, 10)
        )} ${hora}`,
      });
      return;
    }
    handleSetData({ fecha, horaDesde: hora });
  };

  const isValid = !!data.fecha && horaValida && periodoValido && montoValido;

  return (
    <StepShell
      title="Por favor ingrese la información de la tarea:"
      step={2}
      total={3}
      footer={
        <NavButtons
          onBack={() => navigateTo(0)}
          onNext={() => navigateTo(STEP_CONFIRMACION)}
          nextDisabled={!isValid}
        />
      }
    >
      {!trabajosPorTarea.length && (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-[13px] text-subtitle">
          No tenés trabajos con modalidad por tarea. Las tareas solo se cargan en
          ese tipo de trabajo.
        </div>
      )}

      <SelectField
        label="Período de trabajo"
        value={
          data.crearPeriodoAutomatico
            ? "auto"
            : data.periodoTrabajo
            ? String(data.periodoTrabajo)
            : ""
        }
        onChange={(v) => {
          if (v === "auto") {
            handleSetData({ periodoTrabajo: 0, crearPeriodoAutomatico: true });
          } else {
            handleSetData({
              periodoTrabajo: v ? Number(v) : 0,
              crearPeriodoAutomatico: false,
            });
          }
        }}
        options={[
          ...periodosPorTarea.map((p) => ({
            value: String(p.id),
            label: `${p.trabajo?.nombre ?? "Trabajo"}: ${formatFecha(
              p.fechaDesde
            )} al ${formatFecha(p.fechaHasta)} — ${numberToCurrency(
              p.montoACobrar ?? 0
            )}`,
          })),
          { value: "auto", label: "Cargar período automático" },
        ]}
      />

      {data.crearPeriodoAutomatico && (
        <SelectField
          label="Trabajo"
          value={data.idTrabajo ? String(data.idTrabajo) : ""}
          onChange={(v) => handleSetData({ idTrabajo: Number(v) })}
          options={trabajosPorTarea.map((t) => ({
            value: String(t.id),
            label: t.nombre,
          }))}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <DateField
          label="Fecha de la tarea"
          value={data.fecha}
          onChange={(v) => definirFechaHora(v, data.horaDesde)}
        />
        <TimeField
          label="Hora"
          value={data.horaDesde}
          onChange={(v) => definirFechaHora(data.fecha, v)}
        />
      </div>

      <TextField
        label="Descripción"
        value={data.descripcionTarea}
        onChange={(v) => handleSetData({ descripcionTarea: v })}
        placeholder="Ej. Logo para cliente X (se precarga con la fecha/hora)"
      />

      <NumberField
        label="Monto ganado"
        value={data.montoTarea}
        onChange={(v) => handleSetData({ montoTarea: v })}
      />

      <NumberField
        label="Horas (informativas)"
        value={data.horasTarea}
        onChange={(v) => handleSetData({ horasTarea: v })}
      />

      {!trabajosPorTarea.length && (
        <p className="text-[12px] text-subtitle">
          Creá primero un trabajo con modalidad &quot;Por tarea&quot; para poder
          cargar tareas.
        </p>
      )}
    </StepShell>
  );
}
