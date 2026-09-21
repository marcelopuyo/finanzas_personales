"use client";

import { useEffect, useRef, useState } from "react";
import { useMontado } from "@/lib/use-cliente";
import { VOZ_LANG } from "@/lib/voz/config";
import { parsearCampos } from "@/lib/voz/parse-campos";
import { parsearIntencion } from "@/lib/voz/parse-intencion";
import {
  iniciarDictado,
  soporteVoz,
  type ErrorVoz,
  type EstadoDictado,
  type SesionDictado,
} from "@/lib/voz/speech";
import type { OpcionVoz } from "@/lib/voz/tipos";
import { crearDictadoPrueba } from "./dictado-prueba";

/** Frases del §7.3 del plan: definen la expectativa real del parser. */
const EJEMPLOS = [
  "necesito ingresar un gasto",
  "gasté tres mil quinientos en el supermercado",
  "cargar gasto de dos mil quinientos en la cuenta Santander",
  "anotá un gasto, descripción farmacia, monto ocho mil cuatrocientos",
  "pagué mil doscientos con cincuenta de nafta",
  "necesito un préstamo",
];

const MENSAJE_ERROR: Record<ErrorVoz, string> = {
  permiso: "Permiso de micrófono denegado",
  "sin-habla": "No te escuché",
  "sin-red": "Sin conexión: el dictado necesita internet",
  "no-soportado": "Este navegador no soporta dictado",
  desconocido: "Error del reconocedor",
};

/** Diagnóstico del entorno: es lo que hay que medir en el iPhone (F0.5). */
function leerDiagnostico() {
  const ua = navigator.userAgent;
  const soporte = soporteVoz();
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as unknown as { standalone?: boolean }).standalone);
  const iOS = /iPad|iPhone|iPod/.test(ua);
  return { ua, ...soporte, standalone, iOS };
}

export function VozLabClient({
  cuentas,
  categorias,
}: {
  cuentas: OpcionVoz[];
  categorias: OpcionVoz[];
}) {
  const montado = useMontado();
  const [texto, setTexto] = useState("");
  const [parcial, setParcial] = useState("");
  const [estado, setEstado] = useState<EstadoDictado>("listo");
  const [error, setError] = useState<ErrorVoz | null>(null);
  const [detalle, setDetalle] = useState("");
  const [resumen, setResumen] = useState<{ reinicios: number; ms: number } | null>(null);
  const [permiso, setPermiso] = useState("");
  const sesion = useRef<SesionDictado | null>(null);

  const diag = montado ? leerDiagnostico() : null;
  // El parser es puro: se recalcula en cada render, sin estado intermedio.
  const config = crearDictadoPrueba({ cuentas, categorias });
  const intencion = texto ? parsearIntencion(texto) : null;
  const campos = texto ? parsearCampos(texto, config) : null;

  // Estado del permiso de micrófono (Safari puede no soportar `permissions`).
  useEffect(() => {
    if (!("permissions" in navigator)) return;
    let vivo = true;
    navigator.permissions
      .query({ name: "microphone" } as unknown as PermissionDescriptor)
      .then((p) => {
        if (vivo) setPermiso(p.state);
      })
      .catch(() => {
        if (vivo) setPermiso("no consultable");
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Al salir de la página, cortar cualquier dictado en curso.
  useEffect(() => () => sesion.current?.detener(), []);

  const dictar = () => {
    if (sesion.current) {
      sesion.current.detener();
      return;
    }
    setParcial("");
    setError(null);
    setDetalle("");
    setResumen(null);

    // Holder mutable: evita leer `s` antes de que termine la asignación.
    const holder: { s: SesionDictado | null } = { s: null };
    const capturar = () => {
      const s = holder.s;
      if (s) setResumen({ reinicios: s.reinicios(), ms: s.transcurrido() });
    };
    let termino = false;

    const s = iniciarDictado({
      lang: VOZ_LANG,
      onParcial: setParcial,
      onEstado: (e) => {
        setEstado(e);
        if (e === "listo") {
          termino = true;
          sesion.current = null;
        }
      },
      onError: (e, d) => {
        capturar();
        setError(e);
        setDetalle(d ?? "");
      },
      onTexto: (t) => {
        capturar();
        setTexto(t);
        setParcial("");
      },
    });

    holder.s = s;
    sesion.current = s && !termino ? s : null;
  };

  const escuchando = estado === "escuchando" || estado === "iniciando";

  return (
    <div className="space-y-4 pb-6">
      <header className="space-y-1">
        <h1 className="text-[15px] font-semibold text-header">
          🎙️ Laboratorio de dictado por voz
        </h1>
        <p className="text-[12px] text-subtitle">
          Página <strong>temporal de desarrollo</strong> (F0). No guarda nada: solo
          interpreta texto. Se borra al cerrar el experimento.
        </p>
      </header>

      {/* ── Diagnóstico del entorno ─────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-[13px] font-semibold text-header">
          1 · Diagnóstico del entorno
        </h2>
        {!diag ? (
          <p className="text-[12px] text-subtitle">Leyendo…</p>
        ) : (
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-[12px]">
            <dt className="text-subtitle">Soporte de dictado</dt>
            <dd className={diag.disponible ? "text-success" : "text-danger"}>
              {diag.disponible ? "disponible" : "no disponible"}
            </dd>
            <dt className="text-subtitle">Constructor sin prefijo</dt>
            <dd className="text-header">{diag.sinPrefijo ? "sí (Chrome/Edge)" : "no"}</dd>
            <dt className="text-subtitle">Constructor con prefijo</dt>
            <dd className="text-header">
              {diag.conPrefijo ? "sí (webkit → Safari/iOS)" : "no"}
            </dd>
            <dt className="text-subtitle">Permiso de micrófono</dt>
            <dd className="text-header">{permiso || "—"}</dd>
            <dt className="text-subtitle">¿iOS?</dt>
            <dd className="text-header">{diag.iOS ? "sí" : "no"}</dd>
            <dt className="text-subtitle">¿Instalada (PWA)?</dt>
            <dd className="text-header">{diag.standalone ? "sí (standalone)" : "no"}</dd>
            <dt className="text-subtitle">User agent</dt>
            <dd className="break-all text-muted-foreground">{diag.ua}</dd>
          </dl>
        )}
      </section>

      {/* ── Frase ──────────────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-[13px] font-semibold text-header">2 · La frase</h2>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="Escribí o dictá lo que diría el usuario…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={dictar}
            disabled={!diag?.disponible}
            className={
              escuchando
                ? "rounded-md bg-danger px-3 py-2 text-[13px] font-medium text-white"
                : "rounded-md bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
            }
          >
            {escuchando ? "⏹ Detener" : "🎤 Dictar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTexto("");
              setParcial("");
              setError(null);
            }}
            className="rounded-md border border-border px-3 py-2 text-[13px] text-header"
          >
            Limpiar
          </button>
          <span className="text-[12px] text-subtitle">
            estado: {estado}
            {resumen ? ` · ${resumen.ms} ms · ${resumen.reinicios} reinicios` : ""}
          </span>
        </div>

        {(parcial || escuchando) && (
          <p className="mt-2 rounded-md bg-muted px-3 py-2 text-[13px] text-card-foreground">
            <span className="text-subtitle">en vivo: </span>
            {parcial || "…"}
          </p>
        )}

        {error && (
          <p className="mt-2 rounded-md bg-muted px-3 py-2 text-[12px] text-danger">
            {MENSAJE_ERROR[error]}
            {detalle ? ` (${detalle})` : ""}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {EJEMPLOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setTexto(e)}
              className="rounded-full border border-border bg-muted px-2 py-1 text-[11px] text-subtitle"
            >
              {e}
            </button>
          ))}
        </div>
      </section>

      {/* ── Intención global ───────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-[13px] font-semibold text-header">
          3 · Intención global (botón flotante / URL)
        </h2>
        {!intencion ? (
          <p className="text-[12px] text-subtitle">—</p>
        ) : intencion.intencion ? (
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-[12px]">
            <dt className="text-subtitle">Intención</dt>
            <dd className="text-success">{intencion.intencion.id}</dd>
            <dt className="text-subtitle">Ir a</dt>
            <dd className="text-header">{intencion.intencion.href()}</dd>
            <dt className="text-subtitle">Texto sobrante</dt>
            <dd className="text-header">{intencion.resto || "(vacío)"}</dd>
          </dl>
        ) : (
          <p className="text-[12px] text-danger">
            No se reconoció ninguna intención ⇒ <strong>no se navega</strong>.
          </p>
        )}
      </section>

      {/* ── Campos ─────────────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-[13px] font-semibold text-header">
          4 · Campos del formulario
        </h2>
        {!campos ? (
          <p className="text-[12px] text-subtitle">—</p>
        ) : (
          <div className="space-y-3">
            {campos.asignaciones.length === 0 ? (
              <p className="text-[12px] text-subtitle">Ningún campo se pudo completar.</p>
            ) : (
              <ul className="space-y-1">
                {campos.asignaciones.map((a) => (
                  <li key={a.campo} className="text-[12px]">
                    <span className="font-mono text-header">{a.campo}</span>
                    <span className="text-subtitle"> = </span>
                    <span className="text-success">{String(a.valor)}</span>
                    <span className="text-subtitle">
                      {" "}
                      · «{a.texto}» · {a.origen} · {a.puntaje.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {campos.candidatos.length > 0 && (
              <div className="space-y-1">
                {campos.candidatos.map((c) => (
                  <p key={c.campo} className="text-[12px] text-warning">
                    {c.campo}: ambiguo ⇒ {c.opciones.map((o) => o.label).join(" · ")}
                  </p>
                ))}
              </div>
            )}

            {campos.noEntendido.length > 0 && (
              <p className="text-[12px] text-subtitle">
                Sin ubicar: {campos.noEntendido.join(" · ")}
              </p>
            )}

            <div>
              <p className="mb-1 text-[12px] text-subtitle">
                Valores que se escribirían en el formulario:
              </p>
              <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-[12px] text-card-foreground">
                {JSON.stringify(campos.valores, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
