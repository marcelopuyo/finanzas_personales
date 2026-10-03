"use client";

// Paso del wizard: cargar una nueva TAREA de trabajo (modalidad por_tarea).
// Espejo del flujo "Jornada trabajo", pero SIN propina ni depósito: se registra
// la tarea (fecha/hora efectiva, descripción, horas informativas y monto ganado)
// dentro de un período del trabajo por_tarea (existente o automático).
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMovimientoStepper } from "./stepper-context";
import {
  StepShellFintech,
  HeroeFintech,
  BotonPrincipal,
  DateField,
  TimeField,
  TextField,
  NumberField,
  SelectField,
} from "./ui";
import { STEP_CONFIRMACION, type MovimientoData } from "./types";
import { simboloMoneda, todayLocalISODate } from "@/lib/utils";
import {
  useRegistrarPantallaDictable,
  type PantallaDictable,
  type ValoresPantalla,
} from "@/components/voz/dictado-pantalla";
import { aplicarDictadoSimple, escribirEnPantalla } from "./dictado-comun";
import { crearDictadoTarea } from "./dictado-trabajo";

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

  /**
   * Solo trabajos de modalidad `por_tarea` admiten tareas.
   *
   * ⚠️ **Memoizado a propósito**: `filter` devuelve un array **nuevo** en cada render
   * y alimenta las dependencias de la config de voz ⇒ sin esto la pantalla se
   * **re-registraba** ante el FAB en cada render y el wizard entraba en un bucle
   * ("Maximum update depth exceeded", visto en el celular el 2026-09-27).
   */
  const trabajosPorTarea = useMemo(
    () =>
      options.trabajos.filter(
        (t) => (t.modalidadCobro ?? "horas_variables") === "por_tarea"
      ),
    [options.trabajos]
  );

  // El **trabajo** es el único vínculo: la tarea nace pendiente de liquidar.
  const trabajoValido = data.idTrabajo > 0;
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

  const isValid = !!data.fecha && horaValida && trabajoValido && montoValido;

  /**
   * **Dictado por voz (2026-09-27)**: la pantalla se declara dictable ante el FAB 🎤
   * ("hice una tarea en labado autos de 3 horas por 400"). El trabajo se resuelve
   * por su **nombre propio** (opciones del select) y por los sinónimos del flujo.
   * Piezas compartidas de `dictado-comun.ts`, igual que transferencia y ajuste.
   */
  const configVoz = useMemo(
    () =>
      crearDictadoTarea({
        trabajos: trabajosPorTarea.map((t) => ({ id: t.id, nombre: t.nombre })),
        cuentas: [],
      }),
    [trabajosPorTarea]
  );
  // Los datos frescos sin recrear la pantalla a cada tecla.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const escribirVoz = useCallback(
    (valores: ValoresPantalla) => {
      handleSetData(valores as unknown as Partial<MovimientoData>);
    },
    [handleSetData]
  );
  const pantallaVoz = useMemo<PantallaDictable>(
    () => ({
      config: configVoz,
      aplicar: (resultado) =>
        aplicarDictadoSimple(
          resultado,
          configVoz,
          dataRef.current as unknown as Record<string, unknown>,
          escribirVoz
        ),
      escribir: (valores) =>
        escribirEnPantalla(
          valores,
          dataRef.current as unknown as Record<string, unknown>,
          escribirVoz
        ),
    }),
    [configVoz, escribirVoz]
  );
  useRegistrarPantallaDictable(pantallaVoz);

  return (
    <StepShellFintech
      titulo="Tarea"
      step={2}
      total={3}
      heroe={
        <HeroeFintech etiqueta={`Monto ganado · ${options.monedaISO}`}>
          <NumberField
            hero
            heroPrefix={simboloMoneda(options.monedaISO)}
            label="Monto ganado"
            value={data.montoTarea}
            onChange={(v) => handleSetData({ montoTarea: v })}
          />
        </HeroeFintech>
      }
      footer={
        <BotonPrincipal
          onClick={() => navigateTo(STEP_CONFIRMACION)}
          disabled={!isValid}
        >
          Siguiente
        </BotonPrincipal>
      }
    >
      {!trabajosPorTarea.length && (
        <div className="mb-4 rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-subtitle">
          No tenés trabajos con modalidad por tarea. Las tareas solo se cargan en
          ese tipo de trabajo: creá uno desde el menú ⋯ de la pantalla y volvé a
          intentar.
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        {/* El **trabajo** es el único vínculo de la tarea: no hay período que
            elegir (la liquidación nace al cobrar). */}
        <SelectField
          label="Trabajo"
          value={data.idTrabajo ? String(data.idTrabajo) : ""}
          onChange={(v) => handleSetData({ idTrabajo: Number(v) })}
          options={trabajosPorTarea.map((t) => ({
            value: String(t.id),
            label: t.nombre,
          }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <DateField
            label="Fecha"
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
          label="Horas (informativas)"
          value={data.horasTarea}
          onChange={(v) => handleSetData({ horasTarea: v })}
        />
      </div>
    </StepShellFintech>
  );
}
