"use client";

import { useState } from "react";
import { parsearCampos } from "@/lib/voz/parse-campos";
import type {
  Asignacion,
  CampoDictable,
  ConfigDictado,
  ResultadoDictado,
} from "@/lib/voz/tipos";
import { ChipAsignacion } from "./chip-asignacion";

/**
 * **Dictado por pantalla**: un campo de texto donde el usuario dicta (con el
 * micrófono del teclado del sistema) o tipea, y un botón "Interpretar" que pasa
 * ese texto por el parser y deja que la pantalla llene sus campos.
 *
 * 🔑 **Por qué un campo de texto y no un micrófono:** en iOS el micrófono del
 * navegador (`webkitSpeechRecognition`) funciona **una sola vez por carga de
 * página** y vuelve a pedir permiso en cada carga (medido el 2026-09-21). El
 * **micrófono del teclado de iOS** no tiene ese problema: es el dictado del
 * sistema, no pide permisos y no depende de Safari ni de la PWA.
 *
 * ⚠️ **El campo se renderiza siempre** (no se muestra bajo un botón): en iOS el
 * teclado solo se abre si el `focus()` ocurre **dentro del gesto** del usuario, y
 * un campo que aparece después de un `setState` ya no califica. Por eso es un
 * campo visible que el usuario toca directamente.
 *
 * El componente es **genérico**: recibe la `ConfigDictado` de la pantalla y
 * devuelve el resultado del parser; no sabe nada de gastos ni del wizard.
 */
export function DictadoCampos({
  config,
  textoInicial = "",
  onInterpretar,
  aplicado,
  onDeshacer,
}: {
  config: ConfigDictado;
  /** Texto que llega ya dictado desde afuera (p. ej. `?dicho=` del Atajo de Apple). */
  textoInicial?: string;
  /** Resultado del parser, ya listo para volcar en el formulario. */
  onInterpretar: (resultado: ResultadoDictado) => void;
  /** Último resultado aplicado (para mostrar los chips), o `null`. */
  aplicado: ResultadoDictado | null;
  onDeshacer: () => void;
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [aviso, setAviso] = useState("");
  // El texto vino dictado desde afuera (URL): se avisa que hay que interpretarlo.
  const [pendiente, setPendiente] = useState(Boolean(textoInicial.trim()));

  const campoDe = (nombre: string): CampoDictable | undefined =>
    config.campos.find((c) => c.campo === nombre);

  /** Valor "lindo" para el chip: etiqueta de la opción, monto, fecha… */
  const valorVisible = (a: Asignacion): string => {
    const campo = campoDe(a.campo);
    if (!campo) return String(a.valor);
    if (campo.tipo === "opcion") {
      const op = campo.opciones?.().find((o) => o.value === String(a.valor));
      return op?.label ?? a.texto;
    }
    if (campo.tipo === "monto") {
      return `$ ${Number(a.valor).toLocaleString("es-AR")}`;
    }
    if (campo.tipo === "fecha") {
      const [anio, mes, dia] = String(a.valor).split("-");
      return `${dia}/${mes}/${anio}`;
    }
    return String(a.valor);
  };

  const interpretar = () => {
    const resultado = parsearCampos(texto, config);
    if (resultado.asignaciones.length === 0) {
      setAviso(
        "No pude completar ningún campo. Probá nombrando el monto, la categoría o la cuenta."
      );
      return;
    }
    setAviso("");
    setPendiente(false);
    onInterpretar(resultado);
  };

  const limpiar = () => {
    setTexto("");
    setAviso("");
    setPendiente(false);
    onDeshacer();
  };

  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <p className="mb-1 text-[12px] font-medium text-header">Cargar por voz</p>
      <p className="mb-2 text-[11px] text-subtitle">
        Tocá el campo, dictá con el <strong>micrófono del teclado</strong> (o
        escribí) y después tocá «Interpretar».
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej: gasté tres mil quinientos en el supermercado"
          // Tipografía 16px para que iOS no haga zoom al enfocar.
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-[16px] text-card-foreground placeholder:text-subtitle sm:text-[13px]"
        />
        <button
          type="button"
          onClick={interpretar}
          disabled={!texto.trim()}
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
        >
          Interpretar
        </button>
      </div>

      {pendiente && (
        <p className="mt-2 text-[12px] text-header">
          Llegó dictado desde el atajo: revisá el texto y tocá «Interpretar».
        </p>
      )}

      {aviso && <p className="mt-2 text-[12px] text-warning">{aviso}</p>}

      {aplicado && aplicado.asignaciones.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {aplicado.asignaciones.map((a) => (
            <ChipAsignacion
              key={a.campo}
              etiqueta={campoDe(a.campo)?.etiqueta ?? a.campo}
              valor={valorVisible(a)}
            />
          ))}
          <button
            type="button"
            onClick={limpiar}
            className="text-[11px] text-subtitle underline"
          >
            Deshacer
          </button>
        </div>
      )}
    </div>
  );
}
