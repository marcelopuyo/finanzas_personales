"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

/**
 * ⚠️ **PÁGINA TEMPORAL DE DIAGNÓSTICO (plan OCR · fase F1)** — ver
 * `DeepSeek/plan-ocr-tickets.md` §6.
 *
 * Existe sólo para de-riesgar la cámara ANTES de construir el escáner: responde
 * "¿`getUserMedia` funciona en este dispositivo (sobre todo en la PWA standalone
 * de iOS), a qué resolución, con qué orientación y cuánto tarda?".
 *
 * **Borrar entera cuando F1 esté cerrada.** No la precachea el SW ni la toca
 * ningún flujo de la app.
 */

type Dato = { k: string; v: string };

type Estado = "inicial" | "pidiendo" | "abierta";

type ErrorCam = { nombre: string; mensaje: string };

/** `navigator.standalone` sólo existe en iOS (no está en los tipos del DOM). */
type NavigatorConStandalone = Navigator & { standalone?: boolean };

/** `getCapabilities` no siempre está tipado/usado: se lee por una forma propia. */
type FuenteCapacidades = {
  getCapabilities?: () => Record<string, unknown>;
};

const CLAVES_INTERES = [
  "focusMode",
  "focusDistance",
  "zoom",
  "torch",
  "width",
  "height",
  "frameRate",
  "facingMode",
  "aspectRatio",
];

function esStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const porMediaQuery = window.matchMedia("(display-mode: standalone)").matches;
  const porIOS = (navigator as NavigatorConStandalone).standalone === true;
  return porMediaQuery || porIOS;
}

/** Versión de iOS desde el UA. En iPadOS 13+ el UA dice "Macintosh" y no se puede. */
function versionIOS(ua: string): string {
  const m = ua.match(/OS (\d+)[_.](\d+)/);
  return m ? `${m[1]}.${m[2]}` : "—";
}

function esIPad(ua: string): boolean {
  return (
    /iPad/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/** Sólo las capacidades que importan para un escáner (las demás son ruido). */
function capacidadesDe(track: MediaStreamTrack): Dato[] {
  const fuente = track as unknown as FuenteCapacidades;
  const caps = fuente.getCapabilities?.();
  if (!caps) return [{ k: "getCapabilities", v: "no disponible" }];
  return Object.keys(caps)
    .filter((k) => CLAVES_INTERES.includes(k))
    .map((k) => ({ k, v: JSON.stringify(caps[k]) }));
}

/** Suscripción vacía: el entorno del dispositivo no cambia mientras la página vive. */
const suscribirNada = () => () => {};

/** Snapshot del servidor: vacío y con referencia estable. */
const SIN_ENTORNO: Dato[] = [];

/** Snapshot cacheado: `useSyncExternalStore` exige la MISMA referencia. */
let entornoCache: Dato[] | null = null;

/**
 * Entorno del dispositivo. Se lee **sólo en el cliente** vía
 * `useSyncExternalStore` (patrón del repo, ver `lib/use-cliente.ts`): el HTML del
 * SSR y el primer render de hidratación coinciden y **no hay `setState` dentro de
 * un efecto** (regla de lint del proyecto).
 */
function leerEntorno(): Dato[] {
  if (entornoCache) return entornoCache;
  const ua = navigator.userAgent;
  const md = navigator.mediaDevices;
  let constraints = 0;
  try {
    constraints = Object.keys(md?.getSupportedConstraints?.() ?? {}).length;
  } catch {
    constraints = 0;
  }
  entornoCache = [
    { k: "userAgent", v: ua },
    { k: "iOS", v: versionIOS(ua) },
    { k: "iPad (o Mac táctil)", v: esIPad(ua) ? "sí" : "no" },
    { k: "PWA standalone", v: esStandalone() ? "SÍ" : "no" },
    { k: "isSecureContext", v: String(window.isSecureContext) },
    { k: "navigator.mediaDevices", v: md ? "presente" : "NO EXISTE" },
    {
      k: "getUserMedia",
      v: typeof md?.getUserMedia === "function" ? "disponible" : "NO EXISTE",
    },
    {
      k: "enumerateDevices",
      v: typeof md?.enumerateDevices === "function" ? "disponible" : "no",
    },
    { k: "devicePixelRatio", v: String(window.devicePixelRatio) },
    { k: "viewport (al montar)", v: `${window.innerWidth}×${window.innerHeight}` },
    {
      k: "constraints soportados",
      v: constraints ? `${constraints} claves` : "—",
    },
  ];
  return entornoCache;
}

export default function OcrSpikePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fotoUrlRef = useRef<string | null>(null);

  const entorno = useSyncExternalStore(
    suscribirNada,
    leerEntorno,
    () => SIN_ENTORNO
  );
  const [estado, setEstado] = useState<Estado>("inicial");
  const [error, setError] = useState<ErrorCam | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [aperturaMs, setAperturaMs] = useState<number | null>(null);
  const [ajustes, setAjustes] = useState<Dato[]>([]);
  const [capacidades, setCapacidades] = useState<Dato[]>([]);
  const [dispositivos, setDispositivos] = useState<string[]>([]);
  const [videoNativo, setVideoNativo] = useState<string>("—");
  const [foto, setFoto] = useState<{
    url: string;
    w: number;
    h: number;
    kb: number;
  } | null>(null);

  const registrar = useCallback((msg: string) => {
    const t = new Date().toISOString().slice(11, 23);
    setLog((prev) => [...prev, `${t}  ${msg}`]);
  }, []);

  // Entorno: se lee con `useSyncExternalStore` (arriba), no en un efecto.
  const cerrarCamara = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
    registrar(
      `cámara cerrada · estado de las pistas: ${stream
        .getTracks()
        .map((t) => t.readyState)
        .join(", ")}`
    );
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setEstado("inicial");
  }, [registrar]);

  // Limpieza al salir de la página: nunca dejar la cámara encendida.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (fotoUrlRef.current) URL.revokeObjectURL(fotoUrlRef.current);
    };
  }, []);

  const abrirCamara = useCallback(async () => {
    setError(null);
    setAperturaMs(null);
    setEstado("pidiendo");
    const t0 = performance.now();
    registrar("pidiendo cámara (facingMode ideal: environment)");

    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) {
      setError({
        nombre: "SinAPI",
        mensaje:
          "navigator.mediaDevices.getUserMedia no existe. En iOS suele pasar cuando el contexto NO es seguro (hace falta https:// o localhost) o cuando la página no corre en un contexto de navegador completo.",
      });
      setEstado("inicial");
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await md.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (e) {
        // Distingue "no me gustó la restricción" de "no hay permiso".
        if (e instanceof DOMException && e.name === "OverconstrainedError") {
          registrar("OverconstrainedError → reintento sin facingMode");
          stream = await md.getUserMedia({ video: true, audio: false });
        } else {
          throw e;
        }
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true; // React no siempre aplica el atributo `muted`.
        await video.play().catch(() => undefined);
      }

      const track = stream.getVideoTracks()[0];
      const s = track.getSettings();
      setAjustes([
        { k: "deviceId", v: s.deviceId ? `${s.deviceId.slice(0, 8)}…` : "—" },
        { k: "facingMode", v: String(s.facingMode ?? "—") },
        { k: "resolución", v: `${s.width ?? "?"}×${s.height ?? "?"}` },
        { k: "frameRate", v: String(s.frameRate ?? "—") },
        { k: "aspectRatio", v: String(s.aspectRatio ?? "—") },
        { k: "label", v: track.label || "(vacío hasta tener permiso)" },
      ]);
      setCapacidades(capacidadesDe(track));
      setVideoNativo(`${video?.videoWidth ?? 0}×${video?.videoHeight ?? 0}`);
      const ms = Math.round(performance.now() - t0);
      setAperturaMs(ms);
      setEstado("abierta");
      registrar(
        `cámara ABIERTA en ${ms} ms (${s.width ?? "?"}×${s.height ?? "?"} @ ${s.frameRate ?? "?"} fps)`
      );

      try {
        const todos = await md.enumerateDevices();
        setDispositivos(
          todos
            .filter((d) => d.kind === "videoinput")
            .map((d) => d.label || "(sin etiqueta)")
        );
      } catch {
        setDispositivos([]);
      }
    } catch (e) {
      const nombre = e instanceof DOMException ? e.name : "Error";
      const mensaje = e instanceof Error ? e.message : String(e);
      setError({ nombre, mensaje });
      setEstado("inicial");
      registrar(`ERROR ${nombre}: ${mensaje}`);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [registrar]);

  /** Dispara: copia el frame actual a un canvas y lo muestra (verifica orientación). */
  const disparar = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      registrar("no puedo disparar: el video todavía no tiene tamaño");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const cabecera = "data:image/jpeg;base64,";
    const kb = Math.round(((dataUrl.length - cabecera.length) * 3) / 4 / 1024);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (fotoUrlRef.current) URL.revokeObjectURL(fotoUrlRef.current);
        const url = URL.createObjectURL(blob);
        fotoUrlRef.current = url;
        setFoto({ url, w: canvas.width, h: canvas.height, kb });
        registrar(`foto capturada: ${canvas.width}×${canvas.height} · ~${kb} KB`);
      },
      "image/jpeg",
      0.8
    );
  }, [registrar]);

  const informe = useMemo(() => {
    const lineas: string[] = ["=== SPIKE CÁMARA (F1) ==="];
    lineas.push("[ENTORNO]", ...entorno.map((d) => `  ${d.k}: ${d.v}`));
    if (aperturaMs !== null) {
      lineas.push("[APERTURA]", `  tardó: ${aperturaMs} ms`);
    }
    if (ajustes.length) {
      lineas.push("[TRACK]", ...ajustes.map((d) => `  ${d.k}: ${d.v}`));
    }
    if (capacidades.length) {
      lineas.push("[CAPACIDADES]", ...capacidades.map((d) => `  ${d.k}: ${d.v}`));
    }
    if (videoNativo !== "—") {
      lineas.push("[VIDEO]", `  videoWidth×videoHeight: ${videoNativo}`);
    }
    if (dispositivos.length) {
      lineas.push("[DISPOSITIVOS]", ...dispositivos.map((d) => `  ${d}`));
    }
    if (foto) {
      lineas.push(
        "[FOTO]",
        `  ${foto.w}×${foto.h} · ~${foto.kb} KB`,
        "  orientación correcta: (mirar la foto y responder)"
      );
    }
    if (error) lineas.push("[ERROR]", `  ${error.nombre}: ${error.mensaje}`);
    if (log.length) lineas.push("[LOG]", ...log.map((l) => `  ${l}`));
    return lineas.join("\n");
  }, [
    entorno,
    aperturaMs,
    ajustes,
    capacidades,
    videoNativo,
    dispositivos,
    foto,
    error,
    log,
  ]);

  const copiarInforme = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(informe);
      registrar("informe copiado al portapapeles");
    } catch {
      registrar("no se pudo copiar (revisar permiso de portapapeles)");
    }
  }, [informe, registrar]);

  return (
    <main className="min-h-dvh bg-background px-4 py-6 pb-[env(safe-area-inset-bottom)]">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">
          Spike de cámara · F1
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Página temporal para verificar getUserMedia en este dispositivo antes
          de construir el escáner. Borrar cuando F1 cierre.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-danger bg-card p-3">
          <p className="text-sm font-semibold text-danger">
            ERROR: {error.nombre}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{error.mensaje}</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void abrirCamara()}
          disabled={estado !== "inicial"}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Abrir cámara
        </button>
        <button
          type="button"
          onClick={disparar}
          disabled={estado !== "abierta"}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Disparar
        </button>
        <button
          type="button"
          onClick={cerrarCamara}
          disabled={estado === "inicial"}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Cerrar cámara
        </button>
        <button
          type="button"
          onClick={() => void copiarInforme()}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium"
        >
          Copiar informe
        </button>
      </div>

      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        className={`w-full rounded-lg border border-border bg-black object-contain ${
          estado === "abierta" ? "" : "hidden"
        }`}
      />

      {aperturaMs !== null && (
        <p className="mt-2 text-sm text-success">Abrió en {aperturaMs} ms</p>
      )}

      <Tabla titulo="Entorno" datos={entorno} />
      {ajustes.length > 0 && <Tabla titulo="Track" datos={ajustes} />}
      {capacidades.length > 0 && (
        <Tabla titulo="Capacidades" datos={capacidades} />
      )}
      {videoNativo !== "—" && (
        <Tabla
          titulo="Video"
          datos={[{ k: "videoWidth×Height", v: videoNativo }]}
        />
      )}
      {dispositivos.length > 0 && (
        <Tabla
          titulo="Cámaras"
          datos={dispositivos.map((d, i) => ({ k: String(i + 1), v: d }))}
        />
      )}

      {foto && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Foto ({foto.w}×{foto.h} · ~{foto.kb} KB) — ¿se ve derecha?
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto.url}
            alt="Frame capturado de la cámara"
            className="w-full rounded-lg border border-border"
          />
        </section>
      )}

      {log.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Log</h2>
          <pre className="overflow-x-auto rounded-lg border border-border bg-card p-3 text-[11px] leading-relaxed text-muted-foreground">
            {log.join("\n")}
          </pre>
        </section>
      )}
    </main>
  );
}

function Tabla({ titulo, datos }: { titulo: string; datos: Dato[] }) {
  if (!datos.length) return null;
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{titulo}</h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {datos.map((d, i) => (
          <div
            key={`${d.k}-${i}`}
            className="flex gap-3 border-b border-border px-3 py-2 last:border-b-0"
          >
            <span className="w-40 shrink-0 text-xs font-medium text-muted-foreground">
              {d.k}
            </span>
            <span className="min-w-0 flex-1 break-all text-xs text-foreground">
              {d.v}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
