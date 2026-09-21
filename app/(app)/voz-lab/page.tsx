import { getMovimientoOptions } from "../movimientos/movimiento-data";
import { VozLabClient } from "./voz-lab-client";

/**
 * Laboratorio del dictado por voz (F0 del plan `DeepSeek/plan-dictado-voz.md`).
 *
 * ⚠️ **Página temporal de desarrollo.** Existe para dos cosas:
 * 1. Iterar el parser sin tocar pantallas reales (escribiendo la frase a mano).
 * 2. **Medir en el iPhone** si la Web Speech API funciona dentro de la PWA
 *    (gate F0.5): por eso está disponible también en producción, detrás del
 *    login, y no solo en dev. **Se borra al cerrar el experimento (F4).**
 *
 * No escribe nada: solo parsea texto.
 */
export const dynamic = "force-dynamic";

export default async function VozLabPage() {
  // Las opciones son las REALES del wizard: así el match por voz se prueba
  // contra los nombres de cuenta y de categoría que existen de verdad.
  const options = await getMovimientoOptions();

  return (
    <VozLabClient
      cuentas={options.cuentas.map((c) => ({ value: String(c.id), label: c.nombre }))}
      categorias={options.categoriasGasto.map((c) => ({
        value: String(c.id),
        label: c.nombre,
      }))}
    />
  );
}
