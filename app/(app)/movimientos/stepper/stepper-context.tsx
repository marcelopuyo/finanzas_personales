"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { MovimientoConcepto, MovimientoData, MovimientoOptions } from "./types";

interface StepperContextValue {
  activeStep: number;
  data: MovimientoData;
  options: MovimientoOptions;
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
  children,
}: {
  options: MovimientoOptions;
  /** Fecha por defecto (YYYY-MM-DD) provista por el Server Component para evitar hydration mismatch. */
  fechaHoy: string;
  children: ReactNode;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [data, setData] = useState<MovimientoData>(() => ({
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
  }));

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
    }));

  return (
    <StepperContext.Provider
      value={{
        activeStep,
        data,
        options,
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
