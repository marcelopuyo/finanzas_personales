"use client";

// Alta de Período de Trabajo condicional a la modalidad del trabajo elegido
// (2026-09-05, §7.2): fijo → Monto del período · horas_fijas → Horas del
// período (el sistema calcula el monto) · horas_variables/por_tarea → sin valor
// (el monto llega de jornadas/tareas).
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { crearPeriodoTrabajo } from "@/backend/src/actions/trabajos";
import { fetchTrabajosModalidad } from "../../options";

const inputCls =
  "w-full rounded-md border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle border-border focus:outline-none focus:ring-2 focus:ring-primary/40";

export function NuevoPeriodoDeTrabajo({ origen }: { origen?: string }) {
  const router = useRouter();
  // Si se abrió desde la tarjeta sintética del dashboard (quick action
  // "Nuevo período"), tras guardar/volver se regresa al dashboard; desde el
  // listado del CRUD se vuelve al listado.
  const destino = origen === "dashboard" ? "/dashboard" : "/cruds/periodos-trabajo";
  const [trabajos, setTrabajos] = useState<
    { nombre: string; modalidadCobro: string }[]
  >([]);
  const [trabajo, setTrabajo] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [fechaEstimada, setFechaEstimada] = useState("");
  const [valor, setValor] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetchTrabajosModalidad()
      .then(setTrabajos)
      .catch(() => {});
  }, []);

  const modalidad = useMemo(
    () => trabajos.find((t) => t.nombre === trabajo)?.modalidadCobro ?? "",
    [trabajos, trabajo]
  );
  const esFijo = modalidad === "fijo";
  const esHorasFijas = modalidad === "horas_fijas";
  const pideValor = esFijo || esHorasFijas;

  const volver = () => router.push(destino);

  const guardar = async () => {
    if (!fechaDesde || !fechaHasta) {
      toast.error("Indicá el rango de fechas del período");
      return;
    }
    if (!trabajo) {
      toast.error("Seleccioná el trabajo");
      return;
    }
    if (pideValor && (!valor || Number(valor) <= 0)) {
      toast.error(
        esFijo
          ? "Indicá el monto del período"
          : "Indicá las horas del período"
      );
      return;
    }
    setCargando(true);
    try {
      await crearPeriodoTrabajo({
        fechaDesde,
        fechaHasta,
        fechaEstimadaCobro: fechaEstimada || undefined,
        nombreTrabajo: trabajo,
        ...(esFijo ? { montoACobrar: Number(valor) } : {}),
        ...(esHorasFijas ? { horasPeriodo: Number(valor) } : {}),
      });
      toast.success("Período creado correctamente");
      router.push(destino);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el período"
      );
    } finally {
      setCargando(false);
    }
  };

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
        <h1 className="text-[18px] font-semibold text-header">
          Nuevo Período de Trabajo
        </h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-header">
              Trabajo
            </label>
            <select
              className={inputCls}
              value={trabajo}
              onChange={(e) => {
                setTrabajo(e.target.value);
                setValor("");
              }}
            >
              <option value="">Seleccionar...</option>
              {trabajos.map((t) => (
                <option key={t.nombre} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          {modalidad && (
            <p className={cn("text-[12px] text-subtitle")}>
              Modalidad:{" "}
              {modalidad === "fijo"
                ? "Monto fijo por período"
                : modalidad === "horas_fijas"
                ? "Horas fijas por período"
                : modalidad === "por_tarea"
                ? "Por tarea"
                : "Horas variables"}
              {!pideValor &&
                " · El monto se calcula de jornadas/tareas cargadas."}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-header">
                Desde
              </label>
              <input
                type="date"
                className={inputCls}
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-header">
                Hasta
              </label>
              <input
                type="date"
                className={inputCls}
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
          </div>
          {pideValor && (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-header">
                {esFijo ? "Monto del período" : "Horas del período"}
              </label>
              <input
                className={inputCls}
                inputMode="decimal"
                value={valor}
                onChange={(e) =>
                  setValor(e.target.value.replace(/[^0-9.,]/g, ""))
                }
                placeholder="0.00"
              />
              {esHorasFijas && (
                <p className="mt-1 text-[12px] text-subtitle">
                  El monto se calcula con el precio por hora del trabajo.
                </p>
              )}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-header">
              Estimación de Cobro
            </label>
            <input
              type="date"
              className={inputCls}
              value={fechaEstimada}
              onChange={(e) => setFechaEstimada(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={volver}
            disabled={cargando}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
