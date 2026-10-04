// Caché en memoria (por pestaña) de la PRIMERA página del historial de cada
// cuenta. La usa el carrusel de Inicio para no volver a pedirle la página al
// server cuando se re-monta el listado (cambio de tarjeta, tab, wizard...).
//
// ℹ️ Vive a nivel de MÓDULO a propósito: sobrevive al remontaje de los
// componentes dentro de la misma sesión de la pestaña. Se vacía sola al recargar
// la app y cuando una mutación invalida la cuenta (`invalidarHistoriales`).
//
// ⚠️ Se cachean SOLO DATOS, y solo la 1ª página (20 filas): las páginas
// siguientes del scroll infinito se piden al bajar y no se guardan (para no
// acumular memoria). Los listados sí pueden desmontarse: al volver se montan de
// nuevo y abren con la página cacheada, sin pedirla.
//
// ⚠️ No hay fuga entre usuarios: en el server estas funciones son no-op
// (`typeof window`), así que nunca se guarda nada en el proceso compartido del
// servidor; las props que resuelve el server se leen aparte.

import type { HistorialPagina } from "@/backend/src/queries/movimientos";

/** Filas de la primera tanda del historial (compartida server/cliente). */
export const PRIMERA_PAGINA_FILAS = 20;

const paginas = new Map<number, HistorialPagina>();
const oyentes = new Set<() => void>();

const esCliente = () => typeof window !== "undefined";

function avisar() {
  for (const fn of oyentes) fn();
}

/** Se suscribe a los cambios de la caché (devuelve la baja). */
export function suscribirHistoriales(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/** 1ª página cacheada de una cuenta, si la hay. */
export function leerPrimeraPagina(
  cuentaId: number
): HistorialPagina | undefined {
  if (!esCliente()) return undefined;
  return paginas.get(cuentaId);
}

/** Guarda (o actualiza) la 1ª página cacheada de una cuenta. */
export function guardarPrimeraPagina(
  cuentaId: number,
  pagina: HistorialPagina
): void {
  if (!esCliente()) return;
  paginas.set(cuentaId, pagina);
  avisar();
}

/**
 * Descarta la 1ª página cacheada: de las cuentas indicadas o **todas** si no se
 * pasan ids. Se llama tras una mutación que pudo cambiar los movimientos de la
 * cuenta (gasto, transferencia, ajuste, anulación). Así, sin movimientos nuevos
 * nunca se vuelve a pedir la página, y con ellos se pide una sola vez.
 */
export function invalidarHistoriales(cuentaIds?: number[]): void {
  if (!esCliente()) return;
  if (!cuentaIds) {
    if (paginas.size === 0) return;
    paginas.clear();
  } else {
    let cambio = false;
    for (const id of cuentaIds) {
      if (paginas.delete(id)) cambio = true;
    }
    if (!cambio) return;
  }
  avisar();
}
