"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import type { ZodSchema } from "zod";

export interface FormField {
  name: string;
  label: string;
  type:
    | "text"
    | "select"
    | "textarea"
    | "date"
    | "number"
    | "time"
    | "password"
    | "boolean";
  options?: { value: string; label: string }[];
  optionsFrom?: () => Promise<{ value: string; label: string }[]>;
  placeholder?: string;
  /** Opciones extra que se agregan al final del select (además de options/optionsFrom). */
  extraOptions?: { value: string; label: string }[];
  /** Muestra el campo solo si la condición sobre los valores del formulario es true. */
  showIf?: (values: Record<string, unknown>) => boolean;
}

interface CrudFormProps {
  title: string;
  fields: FormField[];
  schema: ZodSchema;
  defaultValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  cancelHref: string;
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
  successMessage,
}: CrudFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [asyncOptions, setAsyncOptions] = useState<
    Record<string, { value: string; label: string }[]>
  >({});

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
      router.push(cancelHref);
    } catch {
      toast.error("Error al guardar los datos");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = cn(
    "w-full rounded-md border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle",
    "border-border",
    "focus:outline-none focus:ring-2 focus:ring-primary/40"
  );

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
                {field.label}
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
    </div>
  );
}
