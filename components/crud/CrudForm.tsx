"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { QuickCreateModal } from "@/components/ui/quick-create-modal";
import type { ZodSchema } from "zod";

export interface FormField {
  name: string;
  /** Rótulo del campo. Puede ser una función de los valores del formulario
      (p. ej. el campo de contraparte de un préstamo cambia según el sentido). */
  label: string | ((values: Record<string, unknown>) => string);
  /** Aclaración opcional debajo del control (también puede ser función). */
  hint?: string | ((values: Record<string, unknown>) => string);
  type:
    | "text"
    | "select"
    | "combobox"
    | "textarea"
    | "date"
    | "datetime"
    | "number"
    | "time"
    | "password"
    | "boolean";
  options?: ComboboxOption[];
  optionsFrom?: () => Promise<ComboboxOption[]>;
  placeholder?: string;
  /** Opciones extra que se agregan al final del select (además de options/optionsFrom). */
  extraOptions?: { value: string; label: string }[];
  /** Alta rápida del maestro desde el propio campo (solo `combobox`): agrega
      una fila "＋ …" al pie del desplegable que abre un modal con un único
      campo "Nombre". Al crear, la opción se agrega a la lista y queda
      SELECCIONADA, sin salir del formulario (no se pierde lo ya cargado). */
  quickCreate?: {
    /** Texto de la fila del desplegable (p. ej. "Nueva categoría"). */
    label: string;
    /** Título del modal de alta. */
    title: string;
    placeholder?: string;
    /** Crea el registro y devuelve la opción lista para seleccionar. */
    create: (nombre: string) => Promise<ComboboxOption>;
  };
  /** Muestra el campo solo si la condición sobre los valores del formulario es true. */
  showIf?: (values: Record<string, unknown>) => boolean;
}

interface CrudFormProps {
  title: string;
  fields: FormField[];
  schema: ZodSchema;
  defaultValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  /** Destino de Cancelar / volver (flecha). */
  cancelHref: string;
  /** Destino opcional tras guardar con éxito (si no se pasa, usa `cancelHref`). */
  successHref?: string;
  successMessage: string;
}

/**
 * Sanea un campo numérico: solo dígitos y un único separador decimal
 * (acepta `.` o `,` y lo normaliza a `.`). Evita que el teclado móvil
 * bloquee los decimales (ver NumberField del stepper).
 */
function sanitizeNumber(raw: string): string {
  let s = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const i = s.indexOf(".");
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
  return s;
}

/** Resuelve un texto de config que puede ser fijo o función de los valores. */
function resolverTexto(
  valor: string | ((values: Record<string, unknown>) => string) | undefined,
  values: Record<string, unknown>
): string {
  if (!valor) return "";
  return typeof valor === "function" ? valor(values) : valor;
}

/**
 * Formulario CRUD genérico reutilizable (crear y editar).
 * Usa react-hook-form + zod para validación. Diseño mobile-first.
 */
export function CrudForm({
  title,
  fields,
  schema,
  defaultValues,
  onSubmit,
  cancelHref,
  successHref,
  successMessage,
}: CrudFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [asyncOptions, setAsyncOptions] = useState<
    Record<string, ComboboxOption[]>
  >({});
  // Alta rápida (opción A): campo que la disparó + texto buscado (prefill).
  const [quickCreate, setQuickCreate] = useState<{
    field: FormField;
    prefill: string;
  } | null>(null);

  // Cargar opciones asíncronas de los selects (ej. categorías, períodos)
  useEffect(() => {
    fields.forEach((field) => {
      if (!field.optionsFrom) return;
      field
        .optionsFrom()
        .then((opts) =>
          setAsyncOptions((prev) => ({ ...prev, [field.name]: opts }))
        )
        .catch(() => {});
    });
  }, [fields]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {},
  });

  // Valores actuales del formulario (reactivos): se usan para evaluar la
  // visibilidad condicional de los campos (showIf).
  const values = useWatch({ control });

  const onSubmitHandler = async (
    data: Record<string, unknown>
  ) => {
    setSubmitting(true);
    try {
      await onSubmit(data);
      toast.success(successMessage);
      router.push(successHref ?? cancelHref);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar los datos"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = cn(
    "w-full rounded-md border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle",
    "border-border",
    "focus:outline-none focus:ring-2 focus:ring-primary/40"
  );

  /**
   * Alta rápida resuelta (creada ahora o ya existente): agrega la opción a la
   * lista del campo y la deja seleccionada, sin perder lo ya cargado.
   */
  const handleQuickCreated = (option: ComboboxOption) => {
    const field = quickCreate?.field;
    if (!field) return;
    setAsyncOptions((prev) => {
      const list = prev[field.name] ?? field.options ?? [];
      return {
        ...prev,
        [field.name]: list.some((o) => o.value === option.value)
          ? list
          : [...list, option],
      };
    });
    setValue(field.name, option.value, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setQuickCreate(null);
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {/* Header con volver */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-[18px] font-semibold text-header">{title}</h1>
      </div>

      {/* Form */}
      <div className="rounded-lg border border-border bg-card p-5">
        <form
          onSubmit={handleSubmit(onSubmitHandler)}
          className="space-y-4"
          noValidate
        >
          {fields
            .filter((field) => !field.showIf || field.showIf(values))
            .map((field) => (
            <div key={field.name}>
              <label
                htmlFor={field.name}
                className="mb-1.5 block text-[13px] font-medium text-header"
              >
                {resolverTexto(field.label, values)}
              </label>
              {field.type === "select" ? (
                <Controller
                  name={field.name}
                  control={control}
                  render={({ field: controllerField }) => (
                    <select
                      id={field.name}
                      name={controllerField.name}
                      value={controllerField.value ?? ""}
                      onChange={(e) => controllerField.onChange(e.target.value)}
                      onBlur={controllerField.onBlur}
                      ref={controllerField.ref}
                      className={inputClasses}
                    >
                      {/* Opción placeholder: sin ella, un select sin valor
                          muestra la PRIMERA opción como si estuviera elegida,
                          pero su valor real es "" y la validación falla. */}
                      <option value="">
                        {field.placeholder || "Seleccionar..."}
                      </option>
                      {(asyncOptions[field.name] || field.options || []).map(
                        (opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        )
                      )}
                      {field.extraOptions?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
              ) : field.type === "combobox" ? (
                <Controller
                  name={field.name}
                  control={control}
                  render={({ field: controllerField }) => (
                    <Combobox
                      id={field.name}
                      name={controllerField.name}
                      value={controllerField.value ?? ""}
                      onBlur={controllerField.onBlur}
                      onChange={(v) => controllerField.onChange(v)}
                      options={asyncOptions[field.name] || field.options || []}
                      placeholder={field.placeholder}
                      onCreate={
                        field.quickCreate
                          ? (prefill) => setQuickCreate({ field, prefill })
                          : undefined
                      }
                      createLabel={field.quickCreate?.label}
                    />
                  )}
                />
              ) : field.type === "boolean" ? (
                <Controller
                  name={field.name}
                  control={control}
                  render={({ field: controllerField }) => (
                    <Switch
                      id={field.name}
                      checked={controllerField.value === "true"}
                      onChange={(checked) =>
                        controllerField.onChange(checked ? "true" : "false")
                      }
                    />
                  )}
                />
              ) : field.type === "datetime" ? (
                <input
                  id={field.name}
                  type="datetime-local"
                  {...register(field.name)}
                  className={inputClasses}
                />
              ) : field.type === "textarea" ? (
                <textarea
                  id={field.name}
                  {...register(field.name)}
                  placeholder={field.placeholder}
                  rows={3}
                  className={inputClasses}
                />
              ) : field.type === "number" ? (
                <input
                  id={field.name}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  {...register(field.name)}
                  onChange={(e) => {
                    e.target.value = sanitizeNumber(e.target.value);
                    register(field.name).onChange(e);
                  }}
                  placeholder={field.placeholder}
                  className={inputClasses}
                />
              ) : (
                <input
                  id={field.name}
                  type={field.type}
                  {...register(field.name)}
                  placeholder={field.placeholder}
                  className={inputClasses}
                />
              )}
              {resolverTexto(field.hint, values) && (
                <p className="mt-1 text-[12px] text-subtitle">
                  {resolverTexto(field.hint, values)}
                </p>
              )}
              {errors[field.name] && (
                <p className="mt-1 text-[12px] text-danger">
                  {String(errors[field.name]?.message || "")}
                </p>
              )}
            </div>
          ))}

          {/* Footer acciones */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.push(cancelHref)}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>

      {/* Alta rápida (opción A): crear el maestro sin salir del formulario. Va
          fuera del <form> para que Enter no dispare el submit del gasto. */}
      {quickCreate?.field.quickCreate && (
        <QuickCreateModal
          open
          title={quickCreate.field.quickCreate.title}
          placeholder={quickCreate.field.quickCreate.placeholder}
          initialName={quickCreate.prefill}
          existing={
            asyncOptions[quickCreate.field.name] ??
            quickCreate.field.options ??
            []
          }
          create={quickCreate.field.quickCreate.create}
          onCreated={handleQuickCreated}
          onClose={() => setQuickCreate(null)}
        />
      )}
    </div>
  );
}
