"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { ConfigDictado, ResultadoDictado } from "@/lib/voz/tipos";

/**
 * **Puente entre la pantalla y el FAB 🎤** (fase G3 del plan de voz).
 *
 * La pantalla **se declara** (qué campos se pueden llenar y cómo aplicarlos) y el
 * FAB, que es global, la consulta cuando el usuario dicta. Es la pieza que hace
 * que un solo botón sirva para todas las pantallas sin que ninguna lo sepa.
 *
 * ⚠️ El provider va en `AppLayout`, envolviendo **al contenido y al FAB**: así el
 * registro y la lectura comparten el mismo contexto.
 */

/** Valores a escribir en el formulario. `undefined` = volver a vacío. */
export type ValoresPantalla = Record<string, string | number | undefined>;

export interface PantallaDictable {
  /** Qué campos se pueden llenar y de dónde salen las opciones. */
  config: ConfigDictado;
  /**
   * Aplica lo que se entendió y devuelve el **snapshot del "antes"** por campo,
   * para poder deshacer (un campo con la ✕, o todo con "Deshacer").
   *
   * Puede ser async: la pantalla de gasto consulta el **último gasto** con la
   * misma descripción para completar lo que la frase no dijo.
   */
  aplicar: (resultado: ResultadoDictado) => ValoresPantalla | Promise<ValoresPantalla>;
  /** Escribe valores sueltos sin pasar por el parser (deshacer / elegir candidato). */
  escribir: (valores: ValoresPantalla) => void;
}

/** Lo que se aplicó la última vez: para los chips, el deshacer y la vía B. */
export interface UltimoDictado {
  resultado: ResultadoDictado;
  /** Cómo estaba cada campo **antes** de aplicar (para deshacer). */
  antes: ValoresPantalla;
}

interface Contexto {
  pantalla: PantallaDictable | null;
  registrar: (pantalla: PantallaDictable | null) => void;
  /**
   * Último dictado aplicado. Vive en el **contexto** (y no en el FAB) para que la
   * pantalla pueda leerlo **al guardar** y aprender las correcciones (vía B).
   */
  ultimo: UltimoDictado | null;
  setUltimo: Dispatch<SetStateAction<UltimoDictado | null>>;
}

const ContextoPantalla = createContext<Contexto | null>(null);

export function VozPantallaProvider({ children }: { children: ReactNode }) {
  const [pantalla, setPantalla] = useState<PantallaDictable | null>(null);
  const [ultimo, setUltimo] = useState<UltimoDictado | null>(null);
  const valor = useMemo<Contexto>(
    () => ({ pantalla, registrar: setPantalla, ultimo, setUltimo }),
    [pantalla, ultimo]
  );
  return (
    <ContextoPantalla.Provider value={valor}>{children}</ContextoPantalla.Provider>
  );
}

/** La pantalla registrada (o `null`): lo que lee el FAB. */
export function usePantallaDictable(): PantallaDictable | null {
  return useContext(ContextoPantalla)?.pantalla ?? null;
}

/**
 * Último dictado aplicado, con su setter.
 *
 * - El **FAB** lo escribe (aplicar, deshacer, elegir candidato).
 * - La **pantalla** lo lee al confirmar/guardar para aprender correcciones (vía B).
 */
const NADA = () => {};

export function useUltimoDictado(): {
  ultimo: UltimoDictado | null;
  setUltimo: Dispatch<SetStateAction<UltimoDictado | null>>;
} {
  const ctx = useContext(ContextoPantalla);
  return {
    ultimo: ctx?.ultimo ?? null,
    // ⚠️ `NADA` es de módulo a propósito: un `() => {}` inline crearía una función
    // nueva en cada render y rompería las dependencias de los `useCallback`.
    setUltimo: ctx?.setUltimo ?? NADA,
  };
}

/**
 * **Declara** esta pantalla como dictable mientras está montada.
 *
 * ⚠️ `pantalla` tiene que venir **memoizada** (`useMemo`): es la clave del
 * registro, y una identidad nueva en cada render re-registraría la pantalla.
 */
export function useRegistrarPantallaDictable(pantalla: PantallaDictable) {
  const ctx = useContext(ContextoPantalla);
  const registrar = ctx?.registrar;

  useEffect(() => {
    if (!registrar) return;
    registrar(pantalla);
    return () => registrar(null);
  }, [registrar, pantalla]);
}
