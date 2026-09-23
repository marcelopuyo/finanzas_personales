/**
 * Registro de **intenciones globales** (el botón flotante / la entrada por URL
 * interpretan qué quiere hacer el usuario, no los campos de un formulario).
 *
 * ➕ **Agregar una intención = agregar una entrada acá.** Nada más.
 * El alcance del experimento es solo la carga de gastos (D9 del plan).
 */

import type { Intencion } from "./tipos";

/**
 * Verbos de acción válidos para las intenciones de **NAVEGACIÓN** ("G1" del
 * replanteo §14). Van en **forma normalizada** (sin tildes, minúsculas), que es
 * lo que produce `norm()` antes de comparar.
 */
const VERBOS_IR = [
  "ir",
  "vamos",
  "ve",
  "ver",
  "abrir",
  "abrime",
  "mostrar",
  "mostrame",
  "muestra",
  "llevar",
  "llevame",
  "lleva",
  "volver",
  "volve",
  "anda",
  "dame",
  "quiero",
  "necesito",
];

export const INTENCIONES: Intencion[] = [
  {
    id: "cargar-gasto",
    // Ojo: "pago/pagar" se mapean acá porque el concepto "Pago Gasto" está
    // oculto en el wizard (ver `stepper/selector.tsx`): en la práctica, "pagar
    // un gasto" es cargar uno. Si algún día vuelve "PagoGasto", se separa.
    // "gaste"/"gastar" van como disparadores TAMBIÉN: la frase más natural
    // ("gasté tres mil quinientos en el super") no dice el sustantivo "gasto", y
    // sin esto el FAB respondería "no entendí" justo a la frase más usada.
    sustantivos: ["gasto", "gastos", "gaste", "gastar"],
    verbos: [
      "cargar",
      "carga",
      "cargue",
      "ingresar",
      "ingresa",
      "ingreso",
      "registrar",
      "registra",
      "registro",
      "anotar",
      "anota",
      "anote",
      "agregar",
      "agrega",
      "agregue",
      "crear",
      "crea",
      "nuevo",
      "nueva",
      "sumar",
      "suma",
      "poner",
      "pone",
      "meter",
      "mete",
      "pagar",
      "paga",
      "pague",
      "pago",
      "gaste",
      "gastar",
      "necesito",
      "quiero",
    ],
    // Ruta directa con precarga: el wizard en "modo directo" ya existe y no
    // necesita estado compartido (ver `app/(app)/movimientos/nuevo/[tipo]/page.tsx`).
    href: () => "/movimientos/nuevo/gasto",
    requiereCuenta: true,
    // El sobrante ("de tres mil en el super") viaja a la pantalla destino para
    // que lo parsee contra sus campos (ver `lib/voz/handoff.ts`).
    llevaTexto: true,
    ejemplo: "cargar un gasto",
  },

  // ─── Navegación (G1 del replanteo §14: R7) ────────────────────────────────
  // Solo las pantallas elegidas por el usuario. Agregar una = agregar una
  // entrada acá (el `id` solo se usa para el feedback de navegación).
  {
    id: "ir-resumen",
    sustantivos: ["resumen", "dashboard", "inicio", "panel", "home"],
    verbos: VERBOS_IR,
    href: () => "/dashboard",
    ejemplo: "andá al resumen",
  },
  {
    id: "ir-prestamos",
    sustantivos: ["prestamo", "prestamos"],
    verbos: VERBOS_IR,
    href: () => "/cruds/prestamos",
    ejemplo: "mostrame los préstamos",
  },
  {
    id: "ir-periodos",
    // Normalizado: "períodos" → "periodos" (lo que ve el matcher).
    sustantivos: ["periodo", "periodos"],
    verbos: VERBOS_IR,
    href: () => "/cruds/periodos-trabajo",
    ejemplo: "andá a los períodos",
  },
];
