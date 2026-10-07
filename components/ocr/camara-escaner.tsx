"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reconocer } from "@/lib/ocr/motor";
import { marcoDesdeVideo } from "@/lib/ocr/preprocesar";

/**
 * Escáner de documentos: cámara en vivo + disparo manual + OCR en segundo plano
 * (plan `DeepSeek/plan-ocr-tickets.md` · F2/F3/F6, generalizado en §11).
 *
 * Es **genérico** a propósito: no sabe qué documento está leyendo. Cada pantalla
 * le pasa su `extraer()` (el parte de trabajo, el ticket de compra, …) y recibe
 * los campos ya interpretados, así que la cámara y el motor se escriben una sola
 * vez.
 *
 * Decisiones que se respetan acá (y por qué):
 * - **Sin ningún overlay sobre el video** y **sin pasos intermedios**: el usuario
 *   apunta, dispara y vuelve al formulario con los campos cargados. Lo único que
 *   se muestra es un aviso breve mientras trabaja el motor.
 * - **Resolución máxima medida** (`ideal` 4032×3024): sin esto iOS abre la cámara
 *   a 480×640 y no sirve para OCR (§1.6).
 * - **La cámara se apaga en cuanto se dispara**, antes de que arranque el OCR: no
 *   queda encendida mientras el motor piensa.
 * - **Un solo `drawImage` del cuadro grande** (con el recorte al papel y la
 *   reducción incluidos): nunca se materializa un buffer de 12 MP (memoria en
 *   iOS). Aparte va un dibujo **chico** —480 px— para que el recorte se decida con
 *   milisegundos de cuentas y no con el cuadro completo (§11.8).
 * - El OCR **nunca bloquea**: si no se lee nada, se devuelven los campos vacíos y
 *   el que decide qué hacer es la pantalla (con un aviso humano).
 */

/** Resolución máxima que concede iOS en el iPhone medido (plan §1.6). */
const CALIDAD_MAX: MediaTrackConstraints = {
  width: { ideal: 4032 },
  height: { ideal: 3024 },
};

type Props<T> = {
  /** Convierte el texto crudo del OCR en los campos de la pantalla. */
  extraer: (texto: string) => T;
  /** Se llama con lo que se pudo extraer (puede venir prácticamente vacío). */
  onListo: (campos: T) => void;
  onCerrar: () => void;
  /** Cómo se nombra el documento en los mensajes ("el parte", "el ticket"). */
  documento?: string;
};

type Estado = "iniciando" | "lista" | "leyendo" | "error";

/** Traduce el fallo de la cámara a algo que el usuario pueda entender. */
function mensajeDeError(error: unknown): string {
  const nombre = error instanceof DOMException ? error.name : "";
  switch (nombre) {
    case "NotAllowedError":
      return "No diste permiso para usar la cámara. Podés habilitarlo en los ajustes del navegador.";
    case "NotFoundError":
      return "No se encontró ninguna cámara en este dispositivo.";
    case "NotReadableError":
      return "La cámara está siendo usada por otra aplicación.";
    default:
      return "No se pudo abrir la cámara.";
  }
}

export function CamaraEscaner<T>({
  extraer,
  onListo,
  onCerrar,
  documento = "el documento",
}: Props<T>) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [estado, setEstado] = useState<Estado>("iniciando");
  const [error, setError] = useState<string | null>(null);

  /** Apaga la cámara: se llama al desmontar y en cuanto se dispara. */
  const soltarCamara = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, ...CALIDAD_MAX },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true; // React no siempre aplica el atributo `muted`.
          await video.play().catch(() => undefined);
        }
        setEstado("lista");
      } catch (e) {
        if (cancelado) return;
        setError(mensajeDeError(e));
        setEstado("error");
      }
    })();

    return () => {
      cancelado = true;
      soltarCamara();
    };
  }, [soltarCamara]);

  const disparar = useCallback(async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;

    setEstado("leyendo");
    try {
      const imagen = marcoDesdeVideo(video);
      soltarCamara();
      const { texto } = await reconocer(imagen.canvas);
      onListo(extraer(texto));
    } catch {
      setError(`No se pudo leer ${documento}. Probá otra vez.`);
      setEstado("error");
    }
  }, [documento, extraer, onListo, soltarCamara]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        className="min-h-0 w-full flex-1 object-contain"
      />

      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-white/80"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void disparar()}
          disabled={estado !== "lista"}
          className="rounded-full bg-white px-8 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          Disparar
        </button>
        <span className="w-20" aria-hidden />
      </div>

      {(estado === "iniciando" || estado === "leyendo") && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm font-medium text-white">
          {estado === "iniciando"
            ? "Abriendo la cámara…"
            : `Leyendo ${documento}…`}
        </p>
      )}

      {estado === "error" && (
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-xl bg-white/95 p-4 text-center">
          <p className="text-sm font-medium text-black">{error}</p>
          <button
            type="button"
            onClick={onCerrar}
            className="mt-3 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
