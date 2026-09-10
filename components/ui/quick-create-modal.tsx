"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import type { ComboboxOption } from "@/components/ui/combobox";

interface QuickCreateModalProps {
  open: boolean;
  title: string;
  placeholder?: string;
  /** Nombre con el que abre precargado (p. ej. el texto buscado en el combo). */
  initialName?: string;
  /** Opciones ya cargadas: si el nombre coincide se SELECCIONA en vez de crear
      (evita el error de unicidad de la BD: mismo nombre + usuario). */
  existing?: ComboboxOption[];
  /** Crea el registro con ese nombre y devuelve la opción para seleccionar. */
  create: (nombre: string) => Promise<ComboboxOption>;
  /** Opción a seleccionar: la recién creada o la que ya existía. */
  onCreated: (option: ComboboxOption) => void;
  onClose: () => void;
}

/**
 * Alta rápida reutilizable (opción A): modal con un único campo "Nombre" para
 * crear un registro maestro (categoría, persona, …) sin salir del formulario,
 * de modo que no se pierda lo que ya se venía cargando. En mobile se comporta
 * como bottom sheet (lo resuelve `Modal`).
 *
 * Se usa junto al `Combobox` con `onCreate` (fila "＋ …" al pie del
 * desplegable): el consumidor guarda el texto buscado como `initialName` y, en
 * `onCreated`, agrega la opción a su lista y la deja seleccionada.
 *
 * ⚠️ Se monta/desmonta por apertura (no se deja montado con `open=false`): así
 * `initialName` se toma al montar, sin necesidad de un effect que sincronice
 * estado (evita el lint `react-hooks/set-state-in-effect`).
 */
export function QuickCreateModal({
  open,
  title,
  placeholder,
  initialName,
  existing,
  create,
  onCreated,
  onClose,
}: QuickCreateModalProps) {
  const [nombre, setNombre] = useState(initialName ?? "");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const valor = nombre.trim();
    if (!valor || creating) return;
    const yaExiste = (existing ?? []).find(
      (o) => o.label.trim().toLowerCase() === valor.toLowerCase()
    );
    if (yaExiste) {
      toast.info(`"${yaExiste.label}" ya existía: se seleccionó`);
      onCreated(yaExiste);
      return;
    }
    setCreating(true);
    try {
      const option = await create(valor);
      toast.success(`Se creó "${option.label}"`);
      onCreated(option);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo crear el registro"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!creating) onClose();
      }}
      title={title}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !nombre.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creando..." : "Crear"}
          </button>
        </div>
      }
    >
      <label
        htmlFor="quick-create-name"
        className="mb-1.5 block text-[13px] font-medium text-header"
      >
        Nombre
      </label>
      <input
        id="quick-create-name"
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleCreate();
          }
        }}
        placeholder={placeholder ?? "Nombre"}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </Modal>
  );
}
