"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { norm } from "@/lib/voz/normalizar";
import { DESTINOS_APRENDIBLES } from "@/lib/voz/intenciones";
import {
  aliasDeCatalogo,
  conceptosDeSistema,
  fusionarAprendidos,
  type AliasOpcion,
  type ConceptoVoz,
} from "@/lib/voz/vocabulario";
import {
  aprenderAlias,
  olvidarAlias,
  olvidarTermino,
  registrarUsoAlias,
} from "@/backend/src/actions/voz";
import type { AliasVozOut, CuentaVozOut } from "@/backend/src/queries/voz";
import type { AmbitoVoz, OpcionVoz, UsoAliasDictado } from "@/lib/voz/tipos";

/**
 * **Vocabulario de voz en memoria** (G2 del plan de voz, §14.5).
 *
 * El layout del área protegida hace **una** query (`getVocabularioSeguro`) y pasa
 * las filas acá. Como el provider vive en el **layout**, el snapshot **sobrevive a
 * las navegaciones client-side** y se recarga en F5 / re-login.
 *
 * Dos capas en las filas:
 * - `usuarioId === null` ⇒ **sistema**: concepto + jerga (igual para todos).
 * - `usuarioId !== null` ⇒ **aprendido por el usuario**: término → **id** de su opción.
 *
 * 🔑 **Las pantallas no consultan la BD**: fusionan este vocabulario con las
 * opciones que ya cargaron (`useAliasDeCampo`).
 */

interface VozContexto {
  filas: AliasVozOut[];
  /** Capa de sistema agrupada por ámbito, lista para `aliasDeCatalogo`. */
  sistema: Record<string, ConceptoVoz[]>;
  /** Cuentas **del usuario**, destino de `ir-cuenta` (plan §15.2 b). */
  cuentas: CuentaVozOut[];
  /** Aprende (optimista). Revertir + avisar si la Server Action falla. */
  aprender: (input: AprenderLocal) => Promise<void>;
  /** Olvida un alias propio. */
  olvidar: (id: number) => Promise<void>;
  /** Olvida el término completo (lo que usa la ✕ del chip). */
  olvidarPorTermino: (input: { ambito: string; terminoNorm: string }) => Promise<void>;
  /**
   * Suma `usos` a los alias **propios** que resolvieron un dictado. Se llama
   * **al guardar** el formulario (nunca en el camino del dictado): "usar" es
   * haber guardado con ese término, y así el contador no paga una escritura por
   * cada frase entendida.
   */
  registrarUsos: (usos: UsoAliasDictado[]) => Promise<void>;
}

export interface AprenderLocal {
  ambito: AmbitoVoz;
  /** Lo que dijo el usuario, tal cual ("kiosco"). */
  termino: string;
  /** Id de la opción destino. */
  destinoValor: string;
  /** Etiqueta de la opción (para el optimista; el servidor recalcula la verdad). */
  destinoEtiqueta: string;
  origen: "ambiguedad" | "correccion";
}

const Contexto = createContext<VozContexto | null>(null);

export function VozProvider({
  rows,
  cuentas = [],
  children,
}: {
  rows: AliasVozOut[];
  // Cuentas navegables por voz: vienen del layout (consulta propia, capa opcional).
  cuentas?: CuentaVozOut[];
  children: ReactNode;
}) {
  const [filas, setFilas] = useState<AliasVozOut[]>(rows);

  // Ajuste de props→estado **durante el render** (no en un efecto): si el layout
  // se re-renderiza con un snapshot nuevo (F5, re-login), el estado se sincroniza.
  const [snapshot, setSnapshot] = useState<AliasVozOut[]>(rows);
  if (snapshot !== rows) {
    setSnapshot(rows);
    setFilas(rows);
  }

  /**
   * Copia de las filas vivas para **revertir** si una Server Action falla.
   * Se sincroniza en un efecto (escribir un ref no es estado: no rompe el lint
   * ni la hidratación) y se lee **antes** de tocar el estado en cada acción.
   */
  const filasRef = useRef(filas);
  useEffect(() => {
    filasRef.current = filas;
  }, [filas]);

  const sistema = useMemo(() => conceptosDeSistema(filas), [filas]);

  const aprender = useCallback(async (input: AprenderLocal) => {
    const terminoNorm = norm(input.termino);
    if (!terminoNorm) return;

    const previas = filasRef.current;
    const optimista: AliasVozOut = {
      id: -1,
      usuarioId: 0,
      ambito: input.ambito,
      termino: input.termino,
      terminoNorm,
      destinoValor: input.destinoValor,
      destinoEtiqueta: input.destinoEtiqueta,
      origen: input.origen,
      usos: 0,
      correcciones: 0,
    };
    // Optimista: la fila vieja del MISMO término se va y entra la nueva (el
    // servidor hace el soft delete de la anterior y el upsert de la nueva).
    const esMismoTermino = (f: AliasVozOut) =>
      f.usuarioId !== null &&
      f.ambito === input.ambito &&
      f.terminoNorm === terminoNorm;
    setFilas([...previas.filter((f) => !esMismoTermino(f)), optimista]);

    try {
      const res = await aprenderAlias({
        ambito: input.ambito,
        termino: input.termino,
        destinoValor: input.destinoValor,
        origen: input.origen,
      });
      // Se reemplaza el id provisorio por el real (lo necesita "olvidar").
      setFilas((actuales) =>
        actuales.map((f) => (f.id === -1 ? { ...f, id: res.id } : f))
      );
    } catch (error) {
      console.error("voz: no se pudo aprender el alias", error);
      setFilas(previas);
      toast.error("No se pudo guardar lo que aprendí");
    }
  }, []);

  const olvidar = useCallback(async (id: number) => {
    const previas = filasRef.current;
    setFilas(previas.filter((f) => f.id !== id));
    try {
      await olvidarAlias(id);
    } catch (error) {
      console.error("voz: no se pudo olvidar el alias", error);
      setFilas(previas);
      toast.error("No se pudo olvidar ese término");
    }
  }, []);

  const olvidarPorTermino = useCallback(
    async (input: { ambito: string; terminoNorm: string }) => {
      const previas = filasRef.current;
      setFilas(
        previas.filter(
          (f) =>
            !(
              f.usuarioId !== null &&
              f.ambito === input.ambito &&
              f.terminoNorm === input.terminoNorm
            )
        )
      );
      try {
        await olvidarTermino(input);
      } catch (error) {
        console.error("voz: no se pudo olvidar el término", error);
        setFilas(previas);
        toast.error("No se pudo olvidar ese término");
      }
    },
    []
  );

  /**
   * Suma `usos` (optimista y **silencioso**: el guardado ya salió bien, no se le
   * avisa al usuario por un contador). Sirve para detectar alias de un solo uso.
   */
  const registrarUsos = useCallback(async (usos: UsoAliasDictado[]) => {
    if (!usos.length) return;
    const previas = filasRef.current;
    const clave = (u: { ambito: string; terminoNorm: string }) =>
      `${u.ambito}|${u.terminoNorm}`;
    const set = new Set(usos.map(clave));
    setFilas(
      previas.map((f) =>
        f.usuarioId !== null && set.has(clave(f))
          ? { ...f, usos: f.usos + 1 }
          : f
      )
    );
    try {
      for (const u of usos) await registrarUsoAlias(u);
    } catch (error) {
      console.error("voz: no se pudo registrar el uso del alias", error);
      setFilas(previas);
    }
  }, []);

  const valor = useMemo<VozContexto>(
    () => ({
      filas,
      sistema,
      cuentas,
      aprender,
      olvidar,
      olvidarPorTermino,
      registrarUsos,
    }),
    [filas, sistema, cuentas, aprender, olvidar, olvidarPorTermino, registrarUsos]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Contexto del vocabulario. `null` fuera del área protegida (admin, público). */
export function useVoz(): VozContexto | null {
  return useContext(Contexto);
}

/**
 * **Alias de un campo**: fusiona la capa de **sistema** (concepto → tus opciones,
 * por tokens de la etiqueta, `lib/voz/vocabulario.ts`) con la capa **aprendida**
 * (término → id, que **pisa** todo).
 *
 * ⚠️ `opciones` debe venir **estable** (memoizado por quien llama) para no
 * recalcular el mapa en cada render.
 *
 * ℹ️ Funciona **sin** `VozProvider` (área admin): devuelve solo la capa aprendida
 * vacía. El sistema sin provider no se puede resolver (no hay snapshot).
 */
export function useAliasDeCampo(
  ambito: string,
  opciones: OpcionVoz[]
): Map<string, AliasOpcion[]> {
  const ctx = useVoz();
  const filas = ctx?.filas ?? null;
  const sistema = ctx?.sistema ?? null;

  return useMemo(() => {
    const mapa = aliasDeCatalogo(opciones, sistema?.[ambito] ?? []);
    if (!filas) return mapa;
    return fusionarAprendidos(mapa, filas, opciones, ambito);
  }, [filas, sistema, opciones, ambito]);
}

/**
 * **Cuentas navegables por voz** (`ir-cuenta`, plan §15.2 b): arma el mapa
 * término dictado → cuentas del usuario con **la misma lógica** que los campos
 * (diccionario de sistema del ámbito `cuenta` + lo aprendido) y devuelve, además,
 * la moneda de cada una para el **calificador** ("galicia pesos").
 *
 * 🔑 Es genérico a propósito: **cada usuario tiene cuentas con nombres distintos**
 * y la traducción se hace contra los tokens de **sus** etiquetas.
 */
export function useCuentasNavegables(): {
  alias: Map<string, AliasOpcion[]>;
  monedas: Record<string, string>;
  opciones: OpcionVoz[];
} {
  const ctx = useVoz();
  const filas = ctx?.filas ?? null;
  const sistema = ctx?.sistema ?? null;
  const cuentas = ctx?.cuentas ?? null;

  const opciones = useMemo<OpcionVoz[]>(
    () => (cuentas ?? []).map((c) => ({ value: c.id, label: c.nombre })),
    [cuentas]
  );

  const monedas = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const c of cuentas ?? []) out[c.id] = c.moneda;
    return out;
  }, [cuentas]);

  const alias = useMemo(() => {
    const mapa = aliasDeCatalogo(opciones, sistema?.cuenta ?? []);
    if (!filas) return mapa;
    return fusionarAprendidos(mapa, filas, opciones, "cuenta");
  }, [filas, sistema, opciones]);

  return { alias, monedas, opciones };
}

/**
 * **Órdenes de navegación aprendidas** (plan §15.6): término → **id de la
 * intención**. Es la misma capa aprendida que un campo, pero con el destino siendo
 * un id estable de código (no un id de catálogo).
 */
export function useNavegacionAprendida(): Map<string, AliasOpcion[]> {
  const ctx = useVoz();
  const filas = ctx?.filas ?? null;

  return useMemo(() => {
    const opciones: OpcionVoz[] = DESTINOS_APRENDIBLES.map((i) => ({
      value: i.id,
      label: i.etiqueta ?? i.id,
    }));
    if (!filas) return new Map<string, AliasOpcion[]>();
    return fusionarAprendidos(new Map(), filas, opciones, "navegacion");
  }, [filas]);
}
