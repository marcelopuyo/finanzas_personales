/**
 * **Zoom del contenido** (2026-10-04) — preferencia **por dispositivo**.
 *
 * 🎯 Para qué: que se pueda **agrandar el contenido** (gráficos, tablas, números)
 * sin que las barras cambien de tamaño ni se muevan. El zoom nativo del navegador
 * (pinch) escala **todo** el visual viewport y no hay forma de exceptuar un
 * elemento; por eso el zoom se hace **dentro de la app**, aplicando `zoom` de CSS
 * **sólo a la capa de contenido** (`components/layout/zoom-contenido.tsx`), que
 * deja afuera la barra superior, la inferior y los FAB.
 *
 * 🔧 **Cómo deshacerlo** (el usuario lo pidió explícitamente): poner
 * `ZOOM_ACTIVO = false` en este archivo deja todo como estaba (la capa no se
 * monta, no se bloquea el pinch y el control desaparece del Perfil). El detalle de
 * los archivos involucrados está en `DeepSeek/bitacora.md` §218, y el pase del
 * control de «Más» al Perfil en §233.
 *
 * Estado compartido por dos componentes que no son parientes (la capa y el control
 * de «Más») ⇒ mismo patrón de store de módulo con suscriptores que
 * `lib/historial-cuentas.ts`. **No-op en el server** (`typeof window`).
 */

/** Interruptor general de la feature (ver «cómo deshacerlo» arriba). */
export const ZOOM_ACTIVO = true;

export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 2;
export const ZOOM_PASO = 0.1;
/** Clave del `localStorage`: es una preferencia del dispositivo, no del usuario. */
export const ZOOM_CLAVE = "fp_zoom_contenido";

let actual = 1;
let hidratado = false;
const oyentes = new Set<(k: number) => void>();

/** Acota y redondea a 2 decimales (evita `1.2000000000000002` en la etiqueta). */
export function acotarZoom(k: number) {
  if (!Number.isFinite(k)) return 1;
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k)) * 100) / 100;
}

const avisar = () => {
  for (const cb of oyentes) cb(actual);
};

/** Lee el zoom vigente **sin** tocar `localStorage` (seguro en el primer render). */
export function leerZoom() {
  return actual;
}

/**
 * Lee `localStorage` una sola vez y **avisa siempre** (aunque ya esté hidratado):
 * los componentes se suscriben antes de llamarla, así reciben el valor vigente sin
 * un `setState` directo dentro del efecto (§114 / `react-hooks/set-state-in-effect`).
 * No se llama durante el render: en el server no existe `localStorage` y leerlo ahí
 * sería un desajuste de hidratación.
 */
export function hidratarZoom() {
  if (typeof window === "undefined") return;
  if (!hidratado) {
    hidratado = true;
    const guardado = Number(window.localStorage.getItem(ZOOM_CLAVE));
    if (Number.isFinite(guardado) && guardado !== 0) {
      actual = acotarZoom(guardado);
    }
  }
  avisar();
}

/**
 * Fija el zoom, lo persiste y despierta a los suscriptores. La escritura en
 * `localStorage` va **debounced**: el gesto de pellizco y el `Ctrl + rueda` avisan
 * muchas veces por segundo y no tiene sentido escribir en cada cuadro.
 */
export function fijarZoom(k: number) {
  const nuevo = acotarZoom(k);
  if (nuevo === actual) return;
  actual = nuevo;
  avisar();
  if (typeof window === "undefined" || !hidratado) return;
  window.clearTimeout(persistencia);
  persistencia = window.setTimeout(() => {
    try {
      window.localStorage.setItem(ZOOM_CLAVE, String(actual));
    } catch {
      // Modo privado / storage lleno: el zoom vale para esta sesión.
    }
  }, 400);
}

let persistencia = 0;

export function suscribirZoom(cb: (k: number) => void) {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

/** Etiqueta del control: `1.25` → `125 %`. */
export function etiquetaZoom(k: number) {
  return `${Math.round(k * 100)} %`;
}
