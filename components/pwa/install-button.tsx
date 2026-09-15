"use client";

import { useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { isIOS } from "@/lib/pwa";
import { useInstallPrompt } from "@/lib/pwa-install";

/**
 * Botón "Instalar app" para Perfil (PWA).
 *
 * - Android/escritorio: dispara el prompt nativo capturado en
 *   `lib/pwa-install.ts` (Chrome/Edge). Si el navegador todavía no lo ofreció
 *   (requiere algo de uso previo) o no lo soporta, muestra las instrucciones.
 * - iOS Safari: no existe prompt → instrucciones (Compartir → Añadir a pantalla
 *   de inicio).
 *
 * Cuando la app YA está instalada (standalone) el botón no se renderiza.
 * El tipo de instrucciones se decide en el clic (no en el render) para no leer
 * `navigator` durante el renderizado.
 */
export function InstallButton() {
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const [hint, setHint] = useState<null | "ios" | "generic">(null);

  if (installed) return null;

  async function handleClick() {
    if (!canPrompt) {
      setHint(isIOS() ? "ios" : "generic");
      return;
    }
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      toast.success("Instalando la app…");
      return;
    }
    // "dismissed": el usuario dijo que no por ahora. "unavailable": el evento ya
    // se consumió → mejor mostrarle cómo hacerlo a mano.
    if (outcome === "unavailable") setHint(isIOS() ? "ios" : "generic");
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-[13px] text-card-foreground transition-colors hover:bg-muted"
      >
        {canPrompt ? <Download className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
        {canPrompt ? "Instalar app" : "Cómo instalar la app"}
      </button>

      <Modal
        open={hint !== null}
        onClose={() => setHint(null)}
        title="Instalar la app"
      >
        {hint === "ios" ? (
          <ol className="space-y-3 text-[13px] text-card-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                1
              </span>
              <span>
                Tocá <Share className="inline h-3.5 w-3.5" /> <b>Compartir</b> en la
                barra de Safari.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                2
              </span>
              <span>
                Elegí <b>Añadir a pantalla de inicio</b>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                3
              </span>
              <span>
                Confirmá con <b>Agregar</b>: la app se abre sin las barras del
                navegador.
              </span>
            </li>
          </ol>
        ) : (
          <div className="space-y-3 text-[13px] text-card-foreground">
            <p>
              Abrí el menú del navegador y elegí <b>Instalar app</b> (en Chrome,
              un ícono de instalación también aparece en la barra de direcciones).
            </p>
            <p className="text-subtitle">
              Si esa opción no aparece todavía, seguí usando la app un momento y
              volvé a intentar: el navegador la habilita después de un rato de
              uso.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
