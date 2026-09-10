"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { todayLocalISODate } from "@/lib/utils";
import type { CategoriaGastoOut } from "@/backend/src/queries/gastos";
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
  /** Destino de Cancelar/volver tras guardar en modo directo (si viene, ej. la
      pantalla del período que lanzó el wizard). */
  volverA?: string;
  handleSetData: (partial: Partial<MovimientoData>) => void;
  /** Suma a las opciones una categoría de gasto creada al vuelo (alta rápida). */
  addCategoriaGasto: (categoria: CategoriaGastoOut) => void;
  /** Selecciona el tipo de movimiento y limpia los campos del flujo anterior. */
  seleccionarConcepto: (concepto: MovimientoConcepto) => void;
  navigateTo: (step: number) => void;
  resetData: () => void;
}

const StepperContext = createContext<StepperContextValue | undefined>(
  undefined
);

export function MovimientoProvider({
  options: optionsIniciales,
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
  // Las opciones viven en estado para poder sumar maestros creados al vuelo
  // (alta rápida de categoría de gasto, ver §77-§78).
  const [options, setOptions] = useState<MovimientoOptions>(optionsIniciales);
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
      descripcionTarea: "",
      montoTarea: 0,
      horasTarea: 0,
    };
    if (!initial) return base;
    // En Jornada trabajo la cuenta precargada va al depósito de propina.
    const esJornada = initial.concepto === "JornadaTrabajo";
    // Período preseleccionado por fila: en Cobro (listado "Por cobrar") y en
    // jornada/tarea (columna por fila del popup "Actuales") se precarga el
    // período. El monto solo se precarga en Cobro (en jornada/tarea el monto se
    // ingresa o calcula por horas/tarea).
    const preseleccionaPeriodo =
      initial.periodo != null &&
      (initial.concepto === "CobroSueldo" ||
        initial.concepto === "JornadaTrabajo" ||
        initial.concepto === "CargarTarea");
    const periodoPre = preseleccionaPeriodo
      ? optionsIniciales.periodosTrabajo.find((p) => p.id === initial.periodo)
      : undefined;
    // Préstamo preseleccionado por fila (botón "Pagar" de la grilla de
    // préstamos): en PagoPrestamo se precarga el préstamo y su monto (saldo).
    const prestamoPre =
      initial.prestamo != null && initial.concepto === "PagoPrestamo"
        ? optionsIniciales.prestamos.find((p) => p.id === initial.prestamo)
        : undefined;
    return {
      ...base,
      concepto: initial.concepto,
      cuentaOrigen: esJornada ? 0 : (initial.cuenta ?? initial.origen ?? 0),
      cuentaDestino: initial.destino ?? 0,
      cuentaPropina: esJornada ? (initial.cuenta ?? 0) : 0,
      periodoTrabajo: periodoPre?.id ?? 0,
      idPrestamo: prestamoPre?.id ?? "",
      montoOrigen:
        initial.concepto === "CobroSueldo"
          ? (periodoPre?.montoACobrar ?? 0)
          : prestamoPre
            ? prestamoPre.saldo
            : 0,
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

  /** Alta rápida: suma la categoría recién creada a las opciones del stepper
      (queda seleccionable y la confirmación la muestra por nombre). */
  const addCategoriaGasto = (categoria: CategoriaGastoOut) =>
    setOptions((prev) =>
      prev.categoriasGasto.some((c) => c.id === categoria.id)
        ? prev
        : { ...prev, categoriasGasto: [...prev.categoriasGasto, categoria] }
    );

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
      descripcionTarea: "",
      montoTarea: 0,
      horasTarea: 0,
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
      descripcionTarea: "",
      montoTarea: 0,
      horasTarea: 0,
    }));

  return (
    <StepperContext.Provider
      value={{
        activeStep,
        data,
        options,
        direct,
        volverA: initial?.volverA,
        handleSetData,
        addCategoriaGasto,
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
