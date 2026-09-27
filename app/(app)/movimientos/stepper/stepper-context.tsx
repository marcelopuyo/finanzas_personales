"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { todayLocalISODate } from "@/lib/utils";
import { useMontado } from "@/lib/use-cliente";
import type { CategoriaGastoOut } from "@/backend/src/queries/gastos";
import {
  CONCEPTO_STEP,
  type MovimientoConcepto,
  type MovimientoData,
  type MovimientoInitial,
  type MovimientoOptions,
} from "./types";
import {
  idsDeItems,
  itemsDelTrabajo,
  modalidadDeclarada,
  seleccionDeItems,
} from "./cobro-items";

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
      // Cobrar trabajo (R2): ítems tildados + rango declarado/derivado.
      idsJornadas: [],
      idsTareas: [],
      horasPeriodo: 0,
      fechaDesde: "",
      fechaHasta: "",
    };
    if (!initial) return base;
    // En Jornada trabajo la cuenta precargada va al depósito de propina.
    const esJornada = initial.concepto === "JornadaTrabajo";
    // Cobrar trabajo: la tarjeta "Por cobrar" precarga la LIQUIDACIÓN (`?periodo=`),
    // que sirve para elegir el **trabajo**; sus ítems pendientes quedan tildados
    // y el monto es su suma (P7: el usuario destilda lo que no quiere cobrar).
    const liquidacionPre =
      initial.periodo != null && initial.concepto === "CobrarTrabajo"
        ? optionsIniciales.periodosTrabajo.find((p) => p.id === initial.periodo)
        : undefined;
    const idTrabajoPre = liquidacionPre?.trabajo?.id ?? 0;
    // En `fijo`/`horas_fijas` no hay ítems que tildar: el período se declara.
    const seleccionPre =
      idTrabajoPre &&
      !modalidadDeclarada(liquidacionPre?.trabajo?.modalidadCobro)
        ? (() => {
            const pend = itemsDelTrabajo(
              optionsIniciales.itemsPendientes,
              idTrabajoPre
            );
            return seleccionDeItems(pend, idsDeItems(pend));
          })()
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
      periodoTrabajo: liquidacionPre?.id ?? 0,
      idTrabajo: idTrabajoPre,
      idsJornadas: seleccionPre?.idsJornadas ?? [],
      idsTareas: seleccionPre?.idsTareas ?? [],
      fechaDesde: seleccionPre?.fechaDesde ?? "",
      fechaHasta: seleccionPre?.fechaHasta ?? "",
      idPrestamo: prestamoPre?.id ?? "",
      montoOrigen: seleccionPre
        ? seleccionPre.monto
        : prestamoPre
          ? prestamoPre.saldo
          : 0,
    };
  });

  // La fecha "hoy" provista por el servidor puede quedar corrida ±1 día si el
  // servidor corre en otra zona horaria (ej. Vercel en UTC y el usuario en
  // GMT-3 de noche: 23:00 local ya son las 02:00 del día siguiente en UTC).
  // `montado` es false en el SSR y en la hidratación (se usa `fechaHoy`: el HTML
  // del servidor y el primer render del cliente coinciden) y true después: ahí
  // se corrige con la fecha LOCAL del navegador (siempre la del usuario),
  // durante el render en lugar de un efecto con setState.
  const montado = useMontado();
  const [fechaCorregida, setFechaCorregida] = useState(false);
  if (montado && !fechaCorregida) {
    setFechaCorregida(true);
    setData((prev) => ({ ...prev, fecha: todayLocalISODate() }));
  }

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
      idsJornadas: [],
      idsTareas: [],
      horasPeriodo: 0,
      fechaDesde: "",
      fechaHasta: "",
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
      idsJornadas: [],
      idsTareas: [],
      horasPeriodo: 0,
      fechaDesde: "",
      fechaHasta: "",
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
