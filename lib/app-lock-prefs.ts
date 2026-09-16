// Preferencia del BLOQUEO DE LA APP: cuánto puede estar la app en segundo plano
// antes de pedir biometría al volver.
//
// Vive en una COOKIE y no en la BD por dos razones: es una preferencia **por
// dispositivo** (el bloqueo solo aplica en el celular) y así no hace falta migrar
// nada. Se escribe desde Perfil y la leen:
// - el servidor, para pintar la opción elegida en Perfil;
// - el propio `AppLock` en el cliente, en el momento de bloquear ⇒ el cambio rige
//   al instante, sin recargar ni esperar un `router.refresh()`.

export const LOCK_GRACE_COOKIE = "fp_lock_grace";
export const LOCK_GRACE_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

export interface OpcionGracia {
  /** Milisegundos que la app puede estar en segundo plano sin bloquearse. */
  valor: number;
  label: string;
}

/** Opciones que ofrece Perfil (agregar una es agregar una línea). */
export const OPCIONES_GRACIA: OpcionGracia[] = [
  { valor: 0, label: "Inmediato" },
  { valor: 60 * 1000, label: "1 minuto" },
  { valor: 5 * 60 * 1000, label: "5 minutos" },
];

/** Valor por defecto (sin cookie o con un valor raro): bloqueo inmediato. */
export const GRACIA_POR_DEFECTO = 0;

/** Etiqueta de la opción elegida (para textos y avisos). */
export function etiquetaGracia(valor: number): string {
  return (
    OPCIONES_GRACIA.find((o) => o.valor === valor)?.label ??
    OPCIONES_GRACIA[0].label
  );
}

/**
 * Valor de cookie → ms. Solo se aceptan las opciones conocidas (una cookie
 * manipulada no puede desactivar el bloqueo).
 */
export function graciaDeValor(valor: string | null | undefined): number {
  const n = Number(valor);
  return OPCIONES_GRACIA.some((o) => o.valor === n) ? n : GRACIA_POR_DEFECTO;
}

/**
 * Lee la preferencia en el CLIENTE. Es sincrónico a propósito: `AppLock` decide
 * si bloquea en el mismo evento `visibilitychange`, sin margen para un fetch.
 */
export function leerGraciaMs(): number {
  if (typeof document === "undefined") return GRACIA_POR_DEFECTO;
  const match = document.cookie
    .split("; ")
    .find((r) => r.startsWith(`${LOCK_GRACE_COOKIE}=`));
  if (!match) return GRACIA_POR_DEFECTO;
  return graciaDeValor(decodeURIComponent(match.split("=").slice(1).join("=")));
}

/** Escribe la preferencia (cliente). */
export function escribirGraciaMs(ms: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCK_GRACE_COOKIE}=${ms}; Path=/; Max-Age=${LOCK_GRACE_MAX_AGE}; SameSite=Lax`;
}
