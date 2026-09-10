import type { FormField } from "@/components/crud/CrudForm";
import { crearPersona } from "@/backend/src/actions/maestros";

/**
 * Alta rápida de persona (opción A) para los formularios que eligen la persona
 * por NOMBRE — Préstamo (Prestador/Destinatario) y Movimiento de tarjeta
 * (Persona): la crea desde el propio campo y la deja seleccionada, sin salir
 * del formulario (no se pierde lo que se venía cargando).
 *
 * `crearPersona` sólo exige el nombre (teléfono y mail son opcionales: se
 * completan después en el CRUD de Personas).
 */
export const personaQuickCreate: FormField["quickCreate"] = {
  label: "Nueva persona",
  title: "Nueva persona",
  placeholder: "Ej. Juan Pérez",
  create: async (nombre) => {
    const creada = await crearPersona({ nombre });
    if (!creada) throw new Error("No se pudo crear la persona");
    return { value: creada.nombre, label: creada.nombre };
  },
};
