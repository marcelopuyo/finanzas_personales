"use client";

import { useEffect } from "react";

// Posición de scroll del dashboard en una VARIABLE INTERNA del módulo (memoria
// del cliente): sobrevive a la navegación interna porque el módulo JS no se
// recarga al cambiar de ruta, pero se resetea con un refresh completo de la
// página → al recargar el dashboard siempre arranca en el tope. NO usa
// localStorage, sessionStorage ni cookies.
let dashboardScrollTop = 0;

/**
 * Restaura la posición de scroll del dashboard al volver desde otro CRUD
 * (p. ej. el botón "volver" de la grilla con ?origen=dashboard).
 *
 * El scroll de la app vive en el <main> interno (overflow-y-auto del AppLayout),
 * NO en la ventana: la restauración automática del navegador/Next no aplica y
 * hay que guardar/restaurar el scrollTop a mano.
 *
 * Mientras el dashboard está montado guarda continuamente el scrollTop en la
 * variable interna (leerlo en el unmount no es confiable porque el DOM del
 * <main> ya puede haber cambiado al swap de ruta); al montarse de nuevo (al
 * volver a /dashboard) restaura la posición tras el paint. Vive únicamente en
 * la página del dashboard.
 */
export function DashboardScrollKeeper() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main");
    if (!main) return;

    const save = () => {
      dashboardScrollTop = main.scrollTop;
    };

    const restore = () => {
      if (dashboardScrollTop > 0) main.scrollTo(0, dashboardScrollTop);
    };

    // Restaurar SOLO si hay algo guardado del último paso por el dashboard.
    // OJO: no llamar a save() antes de restaurar: al montar el <main> arranca en
    // scrollTop 0 y pisaría el valor guardado (por eso nunca restauraba).
    // Doble rAF: espera a que el contenido del dashboard esté pintado/medido.
    let raf = requestAnimationFrame(() => {
      restore();
      raf = requestAnimationFrame(restore);
    });

    // Guardar solo cuando el usuario scrollea estando en el dashboard.
    main.addEventListener("scroll", save, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      main.removeEventListener("scroll", save);
    };
  }, []);

  return null;
}
