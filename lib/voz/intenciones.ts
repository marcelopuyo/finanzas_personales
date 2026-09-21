/**
 * Registro de **intenciones globales** (el botón flotante / la entrada por URL
 * interpretan qué quiere hacer el usuario, no los campos de un formulario).
 *
 * ➕ **Agregar una intención = agregar una entrada acá.** Nada más.
 * El alcance del experimento es solo la carga de gastos (D9 del plan).
 */

import type { Intencion } from "./tipos";

export const INTENCIONES: Intencion[] = [
  {
    id: "cargar-gasto",
    // Ojo: "pago/pagar" se mapean acá porque el concepto "Pago Gasto" está
    // oculto en el wizard (ver `stepper/selector.tsx`): en la práctica, "pagar
    // un gasto" es cargar uno. Si algún día vuelve "PagoGasto", se separa.
    sustantivos: ["gasto", "gastos"],
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
  },
];
