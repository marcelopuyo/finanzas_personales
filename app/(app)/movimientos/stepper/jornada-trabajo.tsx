"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { useMovimientoStepper } from "./stepper-context";
import {
  StepShellFintech,
  HeroeFintech,
  HeroeValor,
  BotonPrincipal,
  DateField,
  TimeField,
  NumberField,
  SelectField,
  formatFecha,
} from "./ui";
import { STEP_CONFIRMACION, type MovimientoData } from "./types";
import {
  decimalToTime,
  numberToCurrency,
  timeToDecimal,
  todayLocalISODate,
} from "@/lib/utils";
import { calcularMontoJornada } from "@/backend/src/lib/jornadas";
import { CamaraEscaner } from "@/components/ocr/camara-escaner";
import type { CamposJornada } from "@/lib/ocr/parsear-parte-trabajo";
import { useAliasDeCampo } from "@/components/voz/voz-provider";
import {
  useRegistrarPantallaDictable,
  type PantallaDictable,
  type ValoresPantalla,
} from "@/components/voz/dictado-pantalla";
import { aplicarDictadoSimple, escribirEnPantalla } from "./dictado-comun";
import { crearDictadoJornada } from "./dictado-trabajo";

/**
 * Paso del wizard: cargar una nueva jornada de trabajo.
 * Mismos campos que el CRUD de jornadas (sin "monto jornada", se calcula en el
 * servidor) + un select de cuenta. Si el usuario carga propina > 0, se deposita
 * en la cuenta seleccionada (la propina nunca suma a "Por cobrar/Actuales").
 */
export function JornadaTrabajo() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();
  /** Escáner de partes: se abre con el botón y se cierra al leer o al cancelar. */
  const [escanerAbierto, setEscanerAbierto] = useState(false);

  /**
   * Solo trabajos de modalidad `horas_variables` admiten jornadas.
   *
   * ⚠️ **Memoizado a propósito**: `filter` devuelve un array **nuevo** en cada render
   * y alimenta las dependencias de la config de voz ⇒ sin esto la pantalla se
   * **re-registraba** ante el FAB en cada render y el wizard entraba en un bucle
   * ("Maximum update depth exceeded", visto en el celular el 2026-09-27).
   */
  const trabajosHoras = useMemo(
    () =>
      options.trabajos.filter(
        (t) => (t.modalidadCobro ?? "horas_variables") === "horas_variables"
      ),
    [options.trabajos]
  );

  /**
   * **Dictado por voz (2026-09-27)**: la pantalla se declara dictable ante el FAB 🎤
   * ("trabajé en publix el 25 de 9 a 17", "cargá una jornada de 13 a 17 con 100 de
   * propina en billetera"). Usa las piezas compartidas de `dictado-comun.ts`
   * (regla 7 + snapshot), igual que transferencia y ajuste.
   */
  const opcionesCuentaVoz = useMemo(
    () => options.cuentas.map((c) => ({ value: String(c.id), label: c.nombre })),
    [options.cuentas]
  );
  const aliasCuenta = useAliasDeCampo("cuenta", opcionesCuentaVoz);
  const configVoz = useMemo(() => {
    const base = crearDictadoJornada({
      trabajos: trabajosHoras.map((t) => ({ id: t.id, nombre: t.nombre })),
      cuentas: options.cuentas.map((c) => ({ id: c.id, nombre: c.nombre })),
    });
    return {
      ...base,
      campos: base.campos.map((campo) =>
        campo.campo === "cuentaPropina" ? { ...campo, alias: aliasCuenta } : campo
      ),
    };
  }, [trabajosHoras, options.cuentas, aliasCuenta]);
  // Los datos frescos sin recrear la pantalla a cada tecla (si no, el FAB
  // re-registraría la pantalla en cada cambio de un campo).
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

  const horaValida =
    !!data.horaDesde && !!data.horaHasta && data.horaDesde < data.horaHasta;
  const requiereCuenta = data.montoPropina > 0;
  // El **trabajo** es el único vínculo: la jornada queda **pendiente de
  // liquidar** (sin período) y se cobra después con la liquidación.
  const trabajoValido = data.idTrabajo > 0;

  const trabajoNombre = trabajosHoras.find(
    (t) => t.id === data.idTrabajo
  )?.nombre;
  const desdeNum = timeToDecimal(data.horaDesde);
  const hastaNum = timeToDecimal(data.horaHasta);
  const jornadaSolapada =
    !!data.fecha && !!trabajoNombre && horaValida
      ? options.jornadas.find(
          (j) =>
            j.trabajo === trabajoNombre &&
            String(j.fechaJornada).slice(0, 10) === data.fecha &&
            j.horaDesde < hastaNum &&
            j.horaHasta > desdeNum
        )
      : undefined;
  const haySolapamiento = !!jornadaSolapada;

  const isValid =
    !!data.fecha &&
    horaValida &&
    trabajoValido &&
    !haySolapamiento &&
    (!requiereCuenta || data.cuentaPropina > 0);

  // ── Layout "fintech" (diseño D, 2026-10-03) ─────────────────────────────
  // El héroe es el **monto estimado** de la jornada (horas × precio del trabajo):
  // es el número que el usuario quiere ver antes de guardar. El monto real lo
  // calcula el backend con **el mismo helper** (`calcularMontoJornada`).
  const trabajoElegido = trabajosHoras.find((t) => t.id === data.idTrabajo);
  const horasJornada =
    horaValida && desdeNum < hastaNum
      ? calcularMontoJornada(desdeNum, hastaNum, 1)
      : 0;
  const montoEstimado =
    trabajoElegido && horasJornada > 0
      ? calcularMontoJornada(desdeNum, hastaNum, trabajoElegido.precioHora)
      : 0;
  const etiquetaEstimado = `Monto estimado${
    horasJornada > 0
      ? ` · ${horasJornada.toLocaleString("es-AR", { maximumFractionDigits: 2 })} h`
      : ""
  }`;

  /**
   * Aplica lo que salió del parte **sin pisar lo que el usuario ya cargó** (mismo
   * criterio que el campo Descripción de Gasto): la Fecha sólo si sigue siendo la
   * de hoy, las horas sólo si están vacías y el Trabajo sólo si no hay uno
   * elegido. **Nunca guarda**: eso lo sigue haciendo el botón del wizard.
   */
  const aplicarParte = useCallback(
    (campos: CamposJornada) => {
      setEscanerAbierto(false);

      const patch: Partial<MovimientoData> = {};
      const completados: string[] = [];
      const respetados: string[] = [];

      if (campos.fecha) {
        if (data.fecha === todayLocalISODate()) {
          patch.fecha = campos.fecha;
          completados.push("Fecha");
        } else {
          respetados.push("Fecha");
        }
      }
      if (campos.horaDesde) {
        if (data.horaDesde) {
          respetados.push("Hora desde");
        } else {
          patch.horaDesde = campos.horaDesde;
          completados.push("Hora desde");
        }
      }
      if (campos.horaHasta) {
        if (data.horaHasta) {
          respetados.push("Hora hasta");
        } else {
          patch.horaHasta = campos.horaHasta;
          completados.push("Hora hasta");
        }
      }
      if (campos.idTrabajo) {
        if (data.idTrabajo) {
          respetados.push("Trabajo");
        } else {
          patch.idTrabajo = campos.idTrabajo;
          completados.push("Trabajo");
        }
      }

      if (completados.length > 0) handleSetData(patch);

      if (completados.length === 0 && respetados.length === 0) {
        toast.info("No pude leer datos del parte. Cargalos a mano.");
        return;
      }
      if (completados.length === 0) {
        toast.info(`Ya tenías cargado: ${respetados.join(", ")}.`);
        return;
      }
      toast.success(
        `Se completó: ${completados.join(", ")}.` +
          (respetados.length > 0
            ? ` No se tocó ${respetados.join(", ")} (ya lo tenías).`
            : "") +
          " Revisá antes de guardar."
      );
    },
    [data.fecha, data.horaDesde, data.horaHasta, data.idTrabajo, handleSetData]
  );

  return (
    <StepShellFintech
      titulo="Jornada"
      step={2}
      total={3}
      accion={
        // Escáner del parte (plan OCR): sólo icono, al ras del título. Completa
        // Fecha y Horas (y el Trabajo si el nombre coincide con uno de los tuyos).
        <button
          type="button"
          onClick={() => setEscanerAbierto(true)}
          disabled={!trabajosHoras.length}
          aria-label="Escanear el parte de trabajo"
          title="Escanear el parte de trabajo"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-subtitle transition-colors hover:bg-muted hover:text-header disabled:opacity-40"
        >
          <Camera className="h-5 w-5" />
        </button>
      }
      heroe={
        <HeroeFintech etiqueta={etiquetaEstimado}>
          <HeroeValor>
            {montoEstimado > 0
              ? numberToCurrency(montoEstimado, options.monedaISO)
              : "—"}
          </HeroeValor>
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
      {!trabajosHoras.length && (
        <div className="mb-4 rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-subtitle">
          No tenés trabajos con modalidad por hora (horas variables). Las
          jornadas solo se cargan en ese tipo de trabajo.
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        {/* El **trabajo** es el único vínculo de la jornada: no hay período que
            elegir (la liquidación nace al cobrar). Va primero porque de él sale
            el precio de la hora del monto estimado. */}
        <SelectField
          label="Trabajo"
          value={data.idTrabajo ? String(data.idTrabajo) : ""}
          onChange={(v) => handleSetData({ idTrabajo: Number(v) })}
          options={trabajosHoras.map((t) => ({
            value: String(t.id),
            label: t.nombre,
          }))}
        />

        <DateField
          label="Fecha"
          value={data.fecha}
          onChange={(v) => handleSetData({ fecha: v })}
        />

        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label="Hora desde"
            value={data.horaDesde}
            onChange={(v) => handleSetData({ horaDesde: v })}
          />

          <TimeField
            label="Hora hasta"
            value={data.horaHasta}
            onChange={(v) => handleSetData({ horaHasta: v })}
          />
        </div>

        <NumberField
          label="Monto Propina"
          value={data.montoPropina}
          onChange={(v) => handleSetData({ montoPropina: v })}
        />

        {/* El select de cuenta se muestra SOLO si la propina es mayor que 0
            (si no hay propina no hay nada que depositar). */}
        {requiereCuenta && (
          <SelectField
            label="Cuenta (propina)"
            value={data.cuentaPropina ? String(data.cuentaPropina) : ""}
            onChange={(v) => handleSetData({ cuentaPropina: Number(v) })}
            options={options.cuentas.map((c) => ({
              value: String(c.id),
              label: c.moneda ? `${c.nombre} (${c.moneda.codigoISO})` : c.nombre,
            }))}
          />
        )}
      </div>

      {/* Aviso de solapamiento: ya existe otra jornada del mismo trabajo en el
          mismo día con horas superpuestas ("Siguiente" queda deshabilitado). */}
      {haySolapamiento && jornadaSolapada && (
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          Ya existe una jornada de &quot;{trabajoNombre}&quot; el {formatFecha(data.fecha)}{" "}
          de {decimalToTime(jornadaSolapada.horaDesde)} a{" "}
          {decimalToTime(jornadaSolapada.horaHasta)}. No se pueden superponer
          horas del mismo trabajo.
        </div>
      )}

      {escanerAbierto && (
        <CamaraEscaner
          trabajos={trabajosHoras.map((t) => ({ id: t.id, nombre: t.nombre }))}
          onListo={aplicarParte}
          onCerrar={() => setEscanerAbierto(false)}
        />
      )}
    </StepShellFintech>
  );
}
