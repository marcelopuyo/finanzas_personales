// Cálculos compartidos de jornadas de trabajo. Módulo PURO (sin "use server"):
// lo usan actions/trabajos (CRUD) y actions/movimientos (wizard).

/**
 * Convierte horas decimales (formato HH.MM, ej. 17.3 = 17:30) y devuelve el
 * monto de la jornada (horaHasta - horaDesde en horas × precioHora).
 */
export function calcularMontoJornada(
  horaDesde: number,
  horaHasta: number,
  precioHora: number
): number {
  const horaDesdeDecimal =
    ((horaDesde - Math.floor(horaDesde)) * 100) / 60 + Math.trunc(horaDesde);
  const horaHastaDecimal =
    ((horaHasta - Math.floor(horaHasta)) * 100) / 60 + Math.trunc(horaHasta);
  return (horaHastaDecimal - horaDesdeDecimal) * precioHora;
}

/**
 * Suma el monto a cobrar de un período a partir de sus jornadas NO eliminadas.
 * IMPORTANTE (decisión 2026-08-06): la propina NO se incluye. Las tarjetas
 * "Períodos a Cobrar" / "Períodos Actuales" del dashboard no contabilizan la
 * propina; la propina se deposita aparte en una cuenta (wizard "Jornada trabajo").
 */
export function calcularMontoACobrar(
  jornadas: { eliminado: boolean; montoJornada: number }[]
): number {
  let total = 0;
  for (const jornada of jornadas) {
    if (!jornada.eliminado) {
      total += jornada.montoJornada;
    }
  }
  return total;
}
