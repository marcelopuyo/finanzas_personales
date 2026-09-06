"use client";

// Wizard de ALTA de un trabajo (2026-09-05, §3.1 del plan).
// Ramas:
//   - Fijo por período     → datos → tipo de pago → confirmación (3 pasos)
//   - Por tarea            → datos → tipo de pago → confirmación (3 pasos)
//   - Por hora             → datos → tipo de pago → modalidad horas → precio → confirmación (5 pasos)
// Reutiliza las primitivas compartidas de `components/wizard/ui.tsx`
// (extraídas del wizard de movimientos, 2026-09-06).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { crearTrabajo } from "@/backend/src/actions/trabajos";
import {
  Campo,
  DateField,
  NavButtons,
  TextField,
  inputCls,
} from "@/components/wizard/ui";

type TipoPago = "" | "fijo" | "por_tarea" | "por_hora";
type ModalidadHoras = "" | "horas_variables" | "horas_fijas";

interface Estado {
  nombre: string;
  fechaInicio: string;
  memos: string;
  tipoPago: TipoPago;
  modalidadHoras: ModalidadHoras;
  precioHora: string;
}

function Tarjeta({
  activo,
  onClick,
  titulo,
  detalle,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        activo
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border",
          activo ? "border-primary bg-primary text-primary-foreground" : "border-subtitle"
        )}
      >
        {activo && <Check className="h-3 w-3" />}
      </span>
      <span>
        <span className="block text-[14px] font-medium text-header">{titulo}</span>
        <span className="block text-[12px] text-subtitle">{detalle}</span>
      </span>
    </button>
  );
}

export function TrabajoWizard() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({
    nombre: "",
    fechaInicio: "",
    memos: "",
    tipoPago: "",
    modalidadHoras: "",
    precioHora: "",
  });
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const ramaCorta = estado.tipoPago === "fijo" || estado.tipoPago === "por_tarea";
  // Secuencia de pasos según la rama.
  const totalPasos = () => (ramaCorta ? 3 : 5);
  const set = (patch: Partial<Estado>) => setEstado((e) => ({ ...e, ...patch }));

  const volver = () => {
    if (paso === 0) {
      router.push("/cruds/trabajos");
      return;
    }
    setPaso((p) => p - 1);
  };

  const siguiente = () => {
    // Validaciones por paso
    if (paso === 0 && !estado.nombre.trim()) {
      toast.error("Indicá el nombre del trabajo");
      return;
    }
    if (paso === 0 && !estado.fechaInicio) {
      toast.error("Indicá la fecha de inicio");
      return;
    }
    if (paso === 1 && !estado.tipoPago) {
      toast.error("Elegí el tipo de pago");
      return;
    }
    if (paso === 2 && !ramaCorta && !estado.modalidadHoras) {
      toast.error("Elegí la modalidad de horas");
      return;
    }
    if (paso === 3 && !ramaCorta && (!estado.precioHora || Number(estado.precioHora) <= 0)) {
      toast.error("Indicá el precio por hora");
      return;
    }
    if (!ramaCorta && paso === 4) {
      // Paso de confirmación (5to) → guardar
      guardar();
      return;
    }
    if (ramaCorta && paso === 2) {
      guardar();
      return;
    }
    // En la rama corta, del paso 1 (tipo de pago) se pasa directo a confirmación (paso 2).
    setPaso((p) => p + 1);
  };

  const guardar = async () => {
    setGuardando(true);
    const porHora = estado.tipoPago === "por_hora";
    const modalidadCobro = (
      ramaCorta
        ? estado.tipoPago // 'fijo' | 'por_tarea'
        : estado.modalidadHoras // 'horas_variables' | 'horas_fijas'
    ) as "fijo" | "por_tarea" | "horas_variables" | "horas_fijas";
    try {
      await crearTrabajo({
        nombre: estado.nombre.trim(),
        fechaInicio: estado.fechaInicio,
        modalidadCobro,
        ...(porHora ? { precioHora: Number(estado.precioHora) } : {}),
        memos: estado.memos.trim() || undefined,
      });
      toast.success("Trabajo creado correctamente");
      router.push("/cruds/trabajos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el trabajo");
    } finally {
      setGuardando(false);
    }
  };

  const tituloPaso =
    paso === 0
      ? "Datos generales"
      : paso === 1
      ? "Tipo de pago"
      : paso === 2
      ? ramaCorta
        ? "Confirmación"
        : "Modalidad de horas"
      : paso === 3
      ? "Precio por hora"
      : "Confirmación";

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={volver}
          className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-[18px] font-semibold text-header">Nuevo Trabajo</h1>
      </div>

      {/* Indicador de pasos */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[12px] text-subtitle">
          Paso {paso + 1} de {totalPasos()} · {tituloPaso}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {Array.from({ length: totalPasos() }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full",
                i <= paso ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        {paso === 0 && (
          <div className="space-y-4">
            <TextField
              label="Nombre"
              value={estado.nombre}
              onChange={(v) => set({ nombre: v })}
              placeholder="Ej. Grand Cafe"
            />
            <DateField
              label="Fecha de inicio"
              value={estado.fechaInicio}
              onChange={(v) => set({ fechaInicio: v })}
            />
            <Campo label="Memos">
              <textarea
                rows={3}
                className={inputCls}
                value={estado.memos}
                onChange={(e) => set({ memos: e.target.value })}
                placeholder="Notas..."
              />
            </Campo>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-3">
            <Tarjeta
              activo={estado.tipoPago === "fijo"}
              onClick={() => {
                set({ tipoPago: "fijo", modalidadHoras: "", precioHora: "" });
                setPaso(2); // rama corta → confirmación
              }}
              titulo="Fijo por período"
              detalle="Cobrás un monto fijo por cada período, sin importar horas ni jornadas."
            />
            <Tarjeta
              activo={estado.tipoPago === "por_tarea"}
              onClick={() => {
                set({ tipoPago: "por_tarea", modalidadHoras: "", precioHora: "" });
                setPaso(2); // rama corta → confirmación
              }}
              titulo="Por tarea"
              detalle="Cada tarea se paga con su propio monto, sin depender del tiempo."
            />
            <Tarjeta
              activo={estado.tipoPago === "por_hora"}
              onClick={() => {
                set({ tipoPago: "por_hora" });
                setPaso(2); // rama larga → modalidad de horas
              }}
              titulo="Por hora"
              detalle="Se cobra según horas (fijas por período o variables por jornadas)."
            />
          </div>
        )}

        {paso === 2 && !ramaCorta && (
          <div className="space-y-3">
            <Tarjeta
              activo={estado.modalidadHoras === "horas_fijas"}
              onClick={() => set({ modalidadHoras: "horas_fijas" })}
              titulo="Horas fijas por período"
              detalle="La cantidad de horas se carga junto con el período (sin jornadas)."
            />
            <Tarjeta
              activo={estado.modalidadHoras === "horas_variables"}
              onClick={() => set({ modalidadHoras: "horas_variables" })}
              titulo="Horas variables (jornadas)"
              detalle="Se cargan horas en cada jornada + propina."
            />
          </div>
        )}

        {paso === 3 && !ramaCorta && (
          <Campo label="Precio por hora">
            <input
              className={inputCls}
              inputMode="decimal"
              value={estado.precioHora}
              onChange={(e) =>
                set({ precioHora: e.target.value.replace(/[^0-9.,]/g, "") })
              }
              placeholder="0.00"
            />
            <p className="mt-1 text-[12px] text-subtitle">
              Si elegís horas variables, este precio se usa al cargar cada jornada.
            </p>
          </Campo>
        )}

        {(paso === 4 || (paso === 2 && ramaCorta)) && (
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-subtitle">Nombre</span>
              <span className="font-medium text-header">{estado.nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-subtitle">Fecha de inicio</span>
              <span className="text-header">{estado.fechaInicio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-subtitle">Tipo de pago</span>
              <span className="text-header">
                {estado.tipoPago === "fijo"
                  ? "Fijo por período"
                  : estado.tipoPago === "por_tarea"
                  ? "Por tarea"
                  : "Por hora"}
              </span>
            </div>
            {!ramaCorta && (
              <>
                <div className="flex justify-between">
                  <span className="text-subtitle">Modalidad</span>
                  <span className="text-header">
                    {estado.modalidadHoras === "horas_fijas"
                      ? "Horas fijas por período"
                      : "Horas variables (jornadas)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-subtitle">Precio por hora</span>
                  <span className="text-header">{estado.precioHora}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer acciones (primitiva compartida) */}
        <div className="mt-6">
          <NavButtons
            onCancel={
              paso === 0 ? () => router.push("/cruds/trabajos") : undefined
            }
            onBack={paso === 0 ? undefined : volver}
            onNext={siguiente}
            nextDisabled={guardando}
            nextLabel={
              guardando
                ? "Guardando..."
                : paso === 4 || (paso === 2 && ramaCorta)
                ? "Crear trabajo"
                : "Siguiente"
            }
          />
        </div>
      </div>
    </div>
  );
}
