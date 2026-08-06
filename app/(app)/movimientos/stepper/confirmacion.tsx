"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, X, ArrowLeft } from "lucide-react";
import { useMovimientoStepper } from "./stepper-context";
import { StepShell, Fila, formatFecha } from "./ui";
import { CONCEPTO_STEP, MOTIVOS_TRANSFERENCIA, type MovimientoConcepto } from "./types";
import { numberToCurrency } from "@/lib/utils";
import {
  cobrarSueldo,
  pagarPrestamo,
  ajustarCuenta,
  pagarGasto,
  gastoDirecto,
  transferir,
} from "@/backend/src/actions/movimientos";

const TITULOS: Record<MovimientoConcepto, string> = {
  CobroSueldo: "Revisar la información y confirmar el registro del cobro.",
  PagoPrestamo: "Revisar la información y confirmar el pago de préstamo.",
  AjusteCuenta: "Revisar la información y confirmar el registro del ajuste.",
  PagoGasto: "Revisar la información y confirmar el pago de gasto.",
  GastoDirecto: "Revisar la información y confirmar el gasto directo.",
  Transferencia: "Revisar la información y confirmar la transferencia.",
};

export function Confirmacion() {
  const { data, navigateTo, resetData, options } = useMovimientoStepper();
  const [submitting, setSubmitting] = useState(false);

  const concepto = data.concepto as MovimientoConcepto | "";
  const cuentaNombre = (id: number) =>
    options.cuentas.find((c) => c.id === id)?.nombre ?? "—";

  const periodo = options.periodosTrabajo.find(
    (p) => p.id === data.periodoTrabajo
  );
  const prestamo = options.prestamos.find((p) => p.id === data.idPrestamo);
  const gasto = options.gastos.find((g) => g.id === data.idGasto);
  const categoria = options.categoriasGasto.find(
    (c) => c.id === data.idCategoriaGasto
  );

  const filas: { label: string; value: string }[] = [];

  if (concepto === "CobroSueldo") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      {
        label: "Período de trabajo",
        value: periodo
          ? `${periodo.trabajo?.nombre ?? "Trabajo"}: ${formatFecha(periodo.fechaDesde)} al ${formatFecha(periodo.fechaHasta)}`
          : "—",
      },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      { label: "Monto", value: numberToCurrency(data.montoOrigen) }
    );
  } else if (concepto === "PagoPrestamo") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      { label: "Monto a pagar", value: numberToCurrency(data.montoOrigen) },
      {
        label: "Préstamo",
        value: prestamo
          ? `${prestamo.detalle ?? "Préstamo"} — Saldo ${numberToCurrency(prestamo.saldo)} (${prestamo.personaOrigen?.nombre ?? "—"} → ${prestamo.personaDestino?.nombre ?? "—"})`
          : "—",
      }
    );
  } else if (concepto === "AjusteCuenta") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      {
        label: "Monto",
        value: `${data.montoOrigen > 0 ? "+" : ""}${numberToCurrency(data.montoOrigen)}`,
      }
    );
  } else if (concepto === "PagoGasto") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      { label: "Monto a pagar", value: numberToCurrency(data.montoOrigen) },
      {
        label: "Gasto",
        value: gasto
          ? `${gasto.descripcion ?? "Gasto"} — Saldo ${numberToCurrency(gasto.saldo)} · Vence ${formatFecha(gasto.fechaVencimiento)}`
          : "—",
      }
    );
  } else if (concepto === "GastoDirecto") {
    filas.push(
      { label: "Descripción", value: data.descripcion || "—" },
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Cuenta", value: cuentaNombre(data.cuentaOrigen) },
      { label: "Monto", value: numberToCurrency(data.montoOrigen) },
      { label: "Categoría", value: categoria?.nombre ?? "—" }
    );
  } else if (concepto === "Transferencia") {
    filas.push(
      { label: "Fecha", value: formatFecha(data.fecha) },
      { label: "Motivo", value: data.motivo },
      { label: "Cuenta origen", value: cuentaNombre(data.cuentaOrigen) },
      { label: "Monto origen", value: numberToCurrency(data.montoOrigen) },
      { label: "Cuenta destino", value: cuentaNombre(data.cuentaDestino) },
      { label: "Monto destino", value: numberToCurrency(data.montoDestino) }
    );
  }

  const guardar = async () => {
    if (!concepto) return;
    setSubmitting(true);
    try {
      switch (concepto) {
        case "CobroSueldo":
          await cobrarSueldo({
            fecha: data.fecha,
            monto: data.montoOrigen,
            idCuenta: data.cuentaOrigen,
            idPeriodoTrabajo: data.periodoTrabajo,
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
            motivo: data.motivo as (typeof MOTIVOS_TRANSFERENCIA)[number],
            montoOrigen: data.montoOrigen,
            idCuentaOrigen: data.cuentaOrigen,
            montoDestino: data.montoDestino,
            idCuentaDestino: data.cuentaDestino,
          });
          break;
      }
      toast.success("Movimiento guardado correctamente");
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
