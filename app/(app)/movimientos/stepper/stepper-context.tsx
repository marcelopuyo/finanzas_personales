"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { todayLocalISODate } from "@/lib/utils";
import {
  CONCEPTO_STEP,
  type MovimientoConcepto,
  type MovimientoData,
  type MovimientoInitial,
  type MovimientoOptions,
} from "./types";

interface StepperContextValue {
  activeStep: number;
  data: MovimientoData;
  options: MovimientoOptions;
  /** Modo directo (sin stepper): oculta el progreso y la navegación de pasos. */
  direct: boolean;
  handleSetData: (partial: Partial<MovimientoData>) => void;
  /** Selecciona el tipo de movimiento y limpia los campos del flujo anterior. */
  seleccionarConcepto: (concepto: MovimientoConcepto) => void;
  navigateTo: (step: number) => void;
  resetData: () => void;
}

const StepperContext = createContext<StepperContextValue | undefined>(
  undefined
);

export function MovimientoProvider({
  options,
  fechaHoy,
  initial,
  direct = false,
  children,
}: {
  options: MovimientoOptions;
  /** Fecha por defecto (YYYY-MM-DD) provista por el Server Component para evitar hydration mismatch. */
  fechaHoy: string;
  /** Pre-carga opcional desde query params (tarjetas del dashboard): salta al paso del concepto y precarga la cuenta. */
  initial?: MovimientoInitial;
  /** Modo directo (sin stepper): oculta selector/progreso; el flujo es formulario → confirmación. */
  direct?: boolean;
  children: ReactNode;
}) {
  const [activeStep, setActiveStep] = useState(() =>
    initial ? CONCEPTO_STEP[initial.concepto] : 0
  );
  const [data, setData] = useState<MovimientoData>(() => {
    const base: MovimientoData = {
      concepto: "",
      fecha: fechaHoy,
      montoOrigen: 0,
      montoDestino: 0,
      cuentaOrigen: 0,
      cuentaDestino: 0,
      periodoTrabajo: 0,
      idPrestamo: "",
      idGasto: "",
      idCategoriaGasto: 0,
      motivo: "",
      descripcion: "",
      horaDesde: "",
      horaHasta: "",
      montoPropina: 0,
      cuentaPropina: 0,
      crearPeriodoAutomatico: false,
      idTrabajo: 0,
    };
    if (!initial) return base;
    // En Jornada trabajo la cuenta precargada va al depósito de propina.
    const esJornada = initial.concepto === "JornadaTrabajo";
    return {
      ...base,
      concepto: initial.concepto,
      cuentaOrigen: esJornada ? 0 : (initial.cuenta ?? initial.origen ?? 0),
      cuentaDestino: initial.destino ?? 0,
      cuentaPropina: esJornada ? (initial.cuenta ?? 0) : 0,
    };
  });

  // La fecha "hoy" provista por el servidor puede quedar corrida ±1 día si el
  // servidor corre en otra zona horaria (ej. Vercel en UTC y el usuario en
  // GMT-3 de noche: 23:00 local ya son las 02:00 del día siguiente en UTC).
  // Al montar se corrige con la fecha LOCAL del navegador (siempre la del
  // usuario). No rompe la hidratación: el SSR y el primer render usan fechaHoy.
  useEffect(() => {
    setData((prev) => ({ ...prev, fecha: todayLocalISODate() }));
  }, []);

  const handleSetData = (partial: Partial<MovimientoData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  const resetData = () =>
    setData((prev) => ({
      ...prev,
      concepto: "",
      montoOrigen: 0,
      montoDestino: 0,
      cuentaOrigen: 0,
      cuentaDestino: 0,
      periodoTrabajo: 0,
      idPrestamo: "",
      idGasto: "",
      idCategoriaGasto: 0,
      motivo: "",
      descripcion: "",
      horaDesde: "",
      horaHasta: "",
      montoPropina: 0,
      cuentaPropina: 0,
      crearPeriodoAutomatico: false,
      idTrabajo: 0,
    }));

  const navigateTo = (step: number) => setActiveStep(step);

  const seleccionarConcepto = (concepto: MovimientoConcepto) =>
    setData((prev) => ({
      ...prev,
      concepto,
      montoOrigen: 0,
      montoDestino: 0,
      cuentaOrigen: 0,
      cuentaDestino: 0,
      periodoTrabajo: 0,
      idPrestamo: "",
      idGasto: "",
      idCategoriaGasto: 0,
      motivo: "",
      descripcion: "",
      horaDesde: "",
      horaHasta: "",
      montoPropina: 0,
      cuentaPropina: 0,
      crearPeriodoAutomatico: false,
      idTrabajo: 0,
    }));

  return (
    <StepperContext.Provider
      value={{
        activeStep,
        data,
        options,
        direct,
        handleSetData,
        seleccionarConcepto,
        navigateTo,
        resetData,
      }}
    >
      {children}
    </StepperContext.Provider>
  );
}

export function useMovimientoStepper(): StepperContextValue {
  const ctx = useContext(StepperContext);
  if (!ctx)
    throw new Error(
      "useMovimientoStepper debe usarse dentro de MovimientoProvider"
    );
  return ctx;
}
