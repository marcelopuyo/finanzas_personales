import { getSessionUser } from "@/backend/src/lib/auth";
import { getMovimientoOptions } from "@/app/(app)/movimientos/movimiento-data";
import { VozLabClient } from "./voz-lab-client";

/**
 * Laboratorio del dictado por voz (F0 del plan `DeepSeek/plan-dictado-voz.md`).
 *
 * ⚠️ **Página temporal de desarrollo.** Existe para dos cosas:
 * 1. Iterar el parser sin tocar pantallas reales (escribiendo la frase a mano).
 * 2. **Medir en el iPhone** si la Web Speech API funciona (gate F0.5) y si el
 *    permiso de micrófono persiste entre cargas. **Se borra al cerrar el
 *    experimento (F4).**
 *
 * ⚠️ **Vive FUERA del grupo `(app)` a propósito** (2026-09-22, decisión del
 * usuario): ese layout redirige a `/login` cuando no hay sesión, y el lab tiene
 * que poder abrirse en el celular sin login (el permiso del micrófono en iOS
 * está atado al sitio, así que conviene medir sin ruido de sesión). El proxy
 * también lo deja fuera del guard.
 *
 * **Sin sesión no consulta la BD**: el parser se prueba contra las cuentas y
 * categorías reales solo si hay login; si no, van vacías (la página es pública
 * y no tiene por qué servir esos nombres a quien abra la URL).
 *
 * No escribe nada: solo parsea texto.
 */
export const dynamic = "force-dynamic";

export default async function VozLabPage() {
  // Con sesión, las opciones son las REALES del wizard: así el match por voz se
  // prueba contra los nombres de cuenta y de categoría que existen de verdad.
  const user = await getSessionUser();
  const options = user ? await getMovimientoOptions() : null;

  return (
    <VozLabClient
      conSesion={Boolean(user)}
      cuentas={(options?.cuentas ?? []).map((c) => ({
        id: c.id,
        nombre: c.nombre,
      }))}
      categorias={(options?.categoriasGasto ?? []).map((c) => ({
        id: c.id,
        nombre: c.nombre,
      }))}
    />
  );
}
