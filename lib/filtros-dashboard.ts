/**
 * Rótulos de los filtros del dashboard para los ítems **"sin"**: son el valor que
 * viaja cuando el usuario elige "Sin categoría" / "Sin cuenta" / "Sin trabajo".
 *
 * ⚠️ Vive en un módulo **puro** (sin imports del backend) porque lo usan **los dos
 * lados**: la UI del dashboard (para armar las opciones y filtrar en memoria) y las
 * **consultas** del server (`getGastosPaginado`), que desde el 2026-10-03 también
 * filtra el listado. Un módulo de `backend/src/queries/**` no puede importarse
 * desde un componente de cliente (arrastra `next/headers`).
 */
export const SIN_CATEGORIA = "Sin categoría";
export const SIN_CUENTA = "Sin cuenta";
export const SIN_TRABAJO = "Sin trabajo";
