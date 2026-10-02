"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, X, ArrowLeft } from "lucide-react";
import { useMovimientoStepper } from "./stepper-context";
import { StepShell, Fila, formatFecha } from "./ui";
import { CONCEPTO_STEP, type MovimientoConcepto } from "./types";
import { numberToCurrency, timeToDecimal } from "@/lib/utils";
import { fraseContraparte } from "@/lib/prestamos";
import {
  cobrarTrabajo,
  pagarPrestamo,
  ajustarCuenta,
  pagarGasto,
  gastoDirecto,
  transferir,
  cargarJornadaTrabajo,
  cargarTareaTrabajo,
} from "@/backend/src/actions/movimientos";
import {
  itemsDelTrabajo,
  modalidadDeclarada,
  seleccionDeItems,
} from "./cobro-items";
import { useUltimoDictado } from "@/components/voz/dictado-pantalla";
import { useVoz } from "@/components/voz/voz-provider";
import { correccionesDeDictado } from "@/lib/voz/vocabulario";

const TITULOS: Record<MovimientoConcepto, string> = {
  CobrarTrabajo: "Revisar la información y confirmar el registro del cobro.",
  PagoPrestamo: "Revisar la información y confirmar el pago de préstamo.",
  AjusteCuenta: "Revisar la información y confirmar el registro del ajuste.",
  PagoGasto: "Revisar la información y confirmar el pago de gasto.",
  GastoDirecto: "Revisar la información y confirmar el gasto directo.",
  Transferencia: "Revisar la información y confirmar la transferencia.",
  JornadaTrabajo: "Revisar la información y confirmar la carga de la jornada.",
  CargarTarea: "Revisar la información y confirmar la carga de la tarea.",
};

export function Confirmacion() {
  const { data, navigateTo, resetData, options, direct, volverA } =
    useMovimientoStepper();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  // Dictado aplicado (si el usuario llenó esta pantalla por voz): al guardar se
  // le suman `usos` a los alias propios que resolvieron valores.
  const { ultimo, setUltimo } = useUltimoDictado();
  const voz = useVoz();

  const concepto = data.concepto as MovimientoConcepto | "";
  const cuentaNombre = (id: number) =>
    options.cuentas.find((c) => c.id === id)?.nombre ?? "—";
  // ISO de la moneda de una cuenta (formatea los montos con el símbolo correcto
  // según la moneda de la cuenta en la confirmación).
  const cuentaISO = (id: number) =>
    options.cuentas.find((c) => c.id === id)?.moneda?.codigoISO ?? "ARS";

  const prestamo = options.prestamos.find((p) => p.id === data.idPrestamo);
  const gasto = options.gastos.find((g) => g.id === data.idGasto);
  const categoria = options.categoriasGasto.find(
    (c) => c.id === data.idCategoriaGasto
  );

  const filas: { label: string; value: string }[] = [];

  if (concepto === "CobrarTrabajo") {
    const trabajoC = options.trabajos.find((t) => t.id === data.idTrabajo);
    const modalidad = trabajoC?.modalidadCobro ?? "horas_variables";
    const esHorasFijas = modalidad === "horas_fijas";
    const declarada = modalidadDeclarada(modalidad);
    const items = itemsDelTrabajo(options.itemsPendientes, data.idTrabajo);
    const seleccion = seleccionDeItems(items, [
      ...data.idsJornadas,
      ...data.idsTareas,
    ]);
    // Mismo cálculo que el paso y que el backend: Σ ítems · horas × precio · monto en `fijo`.
    const calculado = declarada
      ? esHorasFijas
        ? Number((data.horasPeriodo * (trabajoC?.precioHora ?? 0)).toFixed(2))
        : data.montoOrigen
      : seleccion.monto;

    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Trabajo", value: trabajoC?.nombre ?? "—" },
      {
        label: "Período",
        value:
          data.fechaDesde && data.fechaHasta
            ? `${formatFecha(data.fechaDesde)} al ${formatFecha(data.fechaHasta)}`
            : "—",
      }
    );
    if (esHorasFijas) {
      filas.push({
        label: "Horas",
        value: `${data.horasPeriodo} h × ${numberToCurrency(trabajoC?.precioHora ?? 0)}`,
      });
    } else if (!declarada) {
      filas.push({
        label: "Ítems",
        value: `${seleccion.idsJornadas.length} jornada(s) · ${seleccion.idsTareas.length} tarea(s)`,
      });
    }
    // El calculado se muestra sólo si difiere: en `fijo` son el mismo número y en
    // los demás casos igualarlo significa que no hubo ajuste (P2: la diferencia es
    // un snapshot, no se sigue ni ajusta el ingreso).
    if (calculado !== data.montoOrigen) {
      filas.push({
        label: "Calculado",
        value: numberToCurrency(calculado, cuentaISO(data.cuentaOrigen)),
      });
    }
    filas.push(
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Cobrado",
        value: numberToCurrency(data.montoOrigen, cuentaISO(data.cuentaOrigen)),
      }
    );
  } else if (concepto === "PagoPrestamo") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto a pagar",
        value: numberToCurrency(data.montoOrigen, cuentaISO(data.cuentaOrigen)),
      },
      {
        label: "Préstamo",
        value: prestamo
          ? `${prestamo.detalle ?? "Préstamo"} — ${prestamo.personaContraparte?.nombre ?? "—"} (${fraseContraparte(prestamo.sentido)}) · Saldo ${numberToCurrency(
              prestamo.saldo,
              prestamo.monedaISO ?? cuentaISO(data.cuentaOrigen)
            )}`
          : "—",
      }
    );
  } else if (concepto === "AjusteCuenta") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto",
        value: `${data.montoOrigen > 0 ? "+" : ""}${numberToCurrency(
          data.montoOrigen,
          cuentaISO(data.cuentaOrigen)
        )}`,
      }
    );
  } else if (concepto === "PagoGasto") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto a pagar",
        value: numberToCurrency(data.montoOrigen, cuentaISO(data.cuentaOrigen)),
      },
      {
        label: "Gasto",
        value: gasto
          ? `${gasto.descripcion ?? "Gasto"} — Saldo ${numberToCurrency(
              gasto.saldo,
              cuentaISO(data.cuentaOrigen)
            )} · Vence ${formatFecha(gasto.fechaVencimiento)}`
          : "—",
      }
    );
  } else if (concepto === "GastoDirecto") {
    filas.push(
      { label: "Descripción", value: data.descripcion || "—" },
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto",
        value: numberToCurrency(data.montoOrigen, cuentaISO(data.cuentaOrigen)),
      },
      { label: "Categoría", value: categoria?.nombre ?? "—" }
    );
  } else if (concepto === "Transferencia") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Motivo", value: data.motivo },
      { label: "Cuenta origen", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto origen",
        value: numberToCurrency(data.montoOrigen, cuentaISO(data.cuentaOrigen)),
      },
      { label: "Cuenta destino", value: cuentaNombre(data.cuentaDestino) },
      {
        label: "Monto destino",
        value: numberToCurrency(data.montoDestino, cuentaISO(data.cuentaDestino)),
      }
    );
  } else if (concepto === "JornadaTrabajo") {
    const trabajoJ = options.trabajos.find((t) => t.id === data.idTrabajo);
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Trabajo", value: trabajoJ?.nombre ?? "—" },
      { label: "Hora desde", value: data.horaDesde || "—" },
      { label: "Hora hasta", value: data.horaHasta || "—" }
    );
    if (data.montoPropina > 0) {
      filas.push(
        {
          label: "Propina",
          value: numberToCurrency(data.montoPropina, cuentaISO(data.cuentaPropina)),
        },
        { label: "Cuenta (propina)", value: cuentaNombre(data.cuentaPropina) }
      );
    }
  } else if (concepto === "CargarTarea") {
    const trabajoT = options.trabajos.find((t) => t.id === data.idTrabajo);
    filas.push(
      {
        label: "Fecha/hora",
        value: `${formatFecha(data.fecha)} ${data.horaDesde || "—"}`,
      },
      { label: "Trabajo", value: trabajoT?.nombre ?? "—" },
      { label: "Descripción", value: data.descripcionTarea || "—" }
    );
    if (data.horasTarea > 0) {
      filas.push({ label: "Horas", value: String(data.horasTarea) });
    }
    filas.push({ label: "Monto ganado", value: numberToCurrency(data.montoTarea) });
  }

  const guardar = async () => {
    if (!concepto) return;
    setSubmitting(true);
    try {
      switch (concepto) {
        case "CobrarTrabajo":
          await cobrarTrabajo({
            fecha: data.fecha,
            idTrabajo: data.idTrabajo,
            idCuenta: data.cuentaOrigen,
            // El monto es el COBRADO (editable); el calculado lo arma el backend.
            monto: data.montoOrigen,
            // El rango declarado sólo viaja en `fijo`/`horas_fijas`: en las
            // variables el backend lo deriva de los ítems tildados.
            fechaDesde: data.fechaDesde || undefined,
            fechaHasta: data.fechaHasta || undefined,
            horasPeriodo: data.horasPeriodo > 0 ? data.horasPeriodo : undefined,
            idsJornadas: data.idsJornadas,
            idsTareas: data.idsTareas,
          });
          break;
        case "PagoPrestamo":
          await pagarPrestamo({
            fecha: data.fecha,
            monto: data.montoOrigen,
            idCuenta: data.cuentaOrigen,
            idPrestamo: data.idPrestamo,
          });
          break;
        case "AjusteCuenta":
          await ajustarCuenta({
            fecha: data.fecha,
            monto: data.montoOrigen,
            idCuenta: data.cuentaOrigen,
          });
          break;
        case "PagoGasto":
          await pagarGasto({
            fecha: data.fecha,
            monto: data.montoOrigen,
            idCuenta: data.cuentaOrigen,
            idGasto: data.idGasto,
          });
          break;
        case "GastoDirecto":
          await gastoDirecto({
            descripcion: data.descripcion,
            fecha: data.fecha,
            monto: data.montoOrigen,
            idCuenta: data.cuentaOrigen,
            idCategoriaGasto: data.idCategoriaGasto,
          });
          break;
        case "Transferencia":
          await transferir({
            fecha: data.fecha,
            motivo: data.motivo,
            montoOrigen: data.montoOrigen,
            idCuentaOrigen: data.cuentaOrigen,
            montoDestino: data.montoDestino,
            idCuentaDestino: data.cuentaDestino,
          });
          break;
        case "JornadaTrabajo":
          await cargarJornadaTrabajo({
            fecha: data.fecha,
            horaDesde: timeToDecimal(data.horaDesde),
            horaHasta: timeToDecimal(data.horaHasta),
            montoPropina: data.montoPropina,
            idCuenta: data.montoPropina > 0 ? data.cuentaPropina : undefined,
            // Único vínculo: la jornada nace **pendiente de liquidar**.
            idTrabajo: data.idTrabajo,
          });
          break;
        case "CargarTarea": {
          const fechaHoraTarea = new Date(
            `${data.fecha}T${data.horaDesde || "00:00"}`
          ).toISOString();
          await cargarTareaTrabajo({
            fechaHoraTarea,
            // Fecha CALENDARIO LOCAL (la que eligió el usuario en el wizard).
            fechaTarea: data.fecha,
            descripcion: (data.descripcionTarea ?? "").trim() || undefined,
            horasTarea: data.horasTarea > 0 ? data.horasTarea : undefined,
            montoTarea: data.montoTarea,
            // Único vínculo: la tarea nace **pendiente de liquidar**.
            idTrabajo: data.idTrabajo,
          });
          break;
        }
      }
      toast.success("Movimiento guardado correctamente");
      // **Vía B** (aprender la corrección) — movida acá el 2026-09-24: se aprende
      // **al guardar con éxito**, no al tocar Siguiente. Si el guardado falla, no
      // se aprende nada. Compara lo que la voz había llenado contra lo que quedó
      // en el formulario (`correccionesDeDictado` ya ignora vacíos e iguales).
      if (ultimo) {
        for (const c of correccionesDeDictado(
          ultimo.resultado,
          data as unknown as Record<string, unknown>,
          (campo) => ultimo.campos.find((c) => c.campo === campo)
        )) {
          void voz?.aprender({ ...c, origen: "correccion" });
        }
      }
      // `usos` del vocabulario: se suma **acá** (al guardar) y no en el camino
      // del dictado. No se espera: es un contador de diagnóstico y no debe
      // demorar la salida del wizard. El dictado se consume (si no, quedaría la
      // burbuja con chips viejos al volver al paso 1).
      if (ultimo?.usos.length) void voz?.registrarUsos(ultimo.usos);
      setUltimo(null);
      // En modo directo (sin stepper) se vuelve al origen que lanzó el wizard
      // (volverA, ej. la pantalla del período) o al dashboard por defecto.
      if (direct) {
        router.push(volverA ?? "/dashboard");
        return;
      }
      resetData();
      navigateTo(0);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el movimiento"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Acciones del pie (las comparten el layout nuevo del gasto y el de siempre).
  const irAtras = () => navigateTo(concepto ? CONCEPTO_STEP[concepto] : 0);
  const cancelar = () => {
    if (direct) {
      router.push(volverA ?? "/dashboard");
      return;
    }
    resetData();
    navigateTo(0);
  };
  const btnSecundario =
    "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-[14px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header disabled:opacity-50";

  // ── Confirmación "fintech" del GASTO (coherente con el paso 2, §210) ───────
  // Solo Gasto directo: el resto de los movimientos sigue con el `StepShell`.
  if (concepto === "GastoDirecto") {
    const iso = cuentaISO(data.cuentaOrigen);
    const cuentaN = options.cuentas.find((c) => c.id === data.cuentaOrigen);
    const categoriaN = options.categoriasGasto.find(
      (c) => c.id === data.idCategoriaGasto
    );
    const filasSinMonto = filas.filter((f) => f.label !== "Monto");
    return (
      <div className="mx-auto max-w-xl py-4">
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={irAtras}
            disabled={submitting}
            aria-label="Atrás"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-subtitle transition-colors hover:text-header disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-[17px] font-semibold text-header">Confirmar</h1>
          {!direct && (
            <span className="ml-auto text-[12px] text-subtitle">3/3</span>
          )}
        </div>

        {/* Monto protagonista (solo lectura, mismo lenguaje que el paso 2). */}
        <div className="mb-5">
          <div className="text-center text-[34px] font-semibold leading-none tracking-tight text-header">
            {numberToCurrency(data.montoOrigen, iso)}
          </div>
          <p className="mt-2 text-center text-[12px] text-subtitle">
            Monto · {iso}
          </p>
          {(cuentaN || categoriaN) && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {cuentaN && (
                <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11.5px] text-subtitle">
                  {cuentaN.nombre}
                </span>
              )}
              {categoriaN && (
                <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11.5px] text-subtitle">
                  {categoriaN.nombre}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Resumen en filas label/valor. */}
        {filasSinMonto.length > 0 && (
          <div className="rounded-xl border border-border bg-card px-4 py-1">
            {filasSinMonto.map((f) => (
              <Fila key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        )}

        {/* Acciones APILADAS: primaria full-width + Atrás/Cancelar en una 2ª
            fila. Antes las 3 iban en una sola fila y "Guardar" se salía de la
            pantalla a 390px. Mantiene `data-pie-accion` para el FAB de voz. */}
        <div className="mt-4 space-y-2" data-pie-accion="">
          <button
            type="button"
            onClick={guardar}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {submitting ? "Guardando..." : "Guardar"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={irAtras}
              disabled={submitting}
              className={`${btnSecundario} flex-1`}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Atrás
            </button>
            <button
              type="button"
              onClick={cancelar}
              disabled={submitting}
              className={`${btnSecundario} flex-1`}
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StepShell
      title={concepto ? TITULOS[concepto] : "Confirmar movimiento"}
      step={3}
      total={3}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigateTo(concepto ? CONCEPTO_STEP[concepto] : 0)}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header disabled:opacity-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Atrás
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (direct) {
                  router.push(volverA ?? "/dashboard");
                  return;
                }
                resetData();
                navigateTo(0);
              }}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      }
    >
      {filas.length > 0 ? (
        filas.map((f) => <Fila key={f.label} label={f.label} value={f.value} />)
      ) : (
        <p className="text-[13px] text-subtitle">
          No hay datos para confirmar.
        </p>
      )}
    </StepShell>
  );
}
