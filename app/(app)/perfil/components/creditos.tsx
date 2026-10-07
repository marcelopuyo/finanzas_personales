"use client";

import { useState } from "react";
import { Award, ExternalLink } from "lucide-react";
import { Modal } from "@/components/ui/modal";

/**
 * **Créditos de los recursos de terceros** (2026-10-07).
 *
 * 🔑 Existe por una **obligación de licencia**, no por cortesía: los iconos
 * **Solar** son de **480 Design** y están bajo **CC BY 4.0** (el paquete npm es
 * MIT, pero la licencia de los iconos **exige atribución**). El resto de la lista
 * se publica por la misma razón (fuentes, banderas, motor de OCR).
 *
 * Se abre desde una fila de la sección **Opciones** del Perfil y usa el `Modal`
 * compartido (bottom sheet en mobile, diálogo centrado en `sm+`).
 *
 * ⚠️ Si se cambia un set de iconos, una fuente o se agrega un asset con licencia
 * que pida crédito, **esta lista es el lugar**.
 */
interface Credito {
  nombre: string;
  /** Autor / proyecto. */
  autor: string;
  /** Para qué se usa en la app. */
  para: string;
  /** Licencia + link a su texto. */
  licencia: string;
  urlLicencia: string;
  /** Link principal (opcional: el paquete o el set). */
  url?: string;
}

const CREDITOS: Credito[] = [
  {
    nombre: "Solar Icons Set",
    autor: "480 Design",
    para: "Iconos de la barra inferior y del panel de Inicio.",
    licencia: "CC BY 4.0",
    urlLicencia: "https://creativecommons.org/licenses/by/4.0/",
    url: "https://www.figma.com/community/file/1166831539721848736",
  },
  {
    nombre: "Lucide",
    autor: "Lucide Contributors",
    para: "Iconos de las secciones, los listados y las acciones.",
    licencia: "ISC",
    urlLicencia: "https://github.com/lucide-icons/lucide/blob/main/LICENSE",
    url: "https://lucide.dev",
  },
  {
    nombre: "flag-icons",
    autor: "Panayiotis Lipiridis",
    para: "Banderas de las monedas.",
    licencia: "MIT",
    urlLicencia: "https://github.com/lipis/flag-icons/blob/main/LICENSE",
    url: "https://github.com/lipis/flag-icons",
  },
  {
    nombre: "Inter",
    autor: "Rasmus Andersson",
    para: "Tipografía de la interfaz.",
    licencia: "SIL OFL 1.1",
    urlLicencia: "https://openfontlicense.org",
    url: "https://fonts.google.com/specimen/Inter",
  },
  {
    nombre: "Unbounded",
    autor: "Google Fonts",
    para: "Tipografía del logo («finanzas personales»).",
    licencia: "SIL OFL 1.1",
    urlLicencia: "https://openfontlicense.org",
    url: "https://fonts.google.com/specimen/Unbounded",
  },
  {
    nombre: "Tesseract.js",
    autor: "naptha · Tesseract OCR",
    para: "Lectura de tickets de compra y partes de trabajo (OCR local, en el dispositivo).",
    licencia: "Apache-2.0",
    urlLicencia: "https://github.com/naptha/tesseract.js/blob/master/LICENSE.md",
    url: "https://github.com/naptha/tesseract.js",
  },
  {
    nombre: "Datos de idioma — español · inglés",
    autor: "tesseract-ocr · @tesseract.js-data",
    para: "Los modelos que usa el OCR para reconocer texto.",
    licencia: "MIT",
    urlLicencia: "https://github.com/naptha/tessdata/blob/gh-pages/LICENSE",
    url: "https://github.com/tesseract-ocr/tessdata",
  },
];

/** Fila de la sección Opciones que abre el popup de créditos. */
export function Creditos() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-[13px] text-card-foreground transition-colors hover:bg-muted"
      >
        <Award className="h-4 w-4" /> Créditos
      </button>

      <Modal open={abierto} onClose={() => setAbierto(false)} title="Créditos">
        <p className="text-[12.5px] text-subtitle">
          Esta app usa estos recursos de terceros:
        </p>
        <ul className="mt-3 space-y-2">
          {CREDITOS.map((c) => (
            <li
              key={c.nombre}
              className="rounded-lg border border-border bg-muted/40 px-3 py-2.5"
            >
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-header">
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-primary hover:underline"
                  >
                    {c.nombre}
                  </a>
                ) : (
                  c.nombre
                )}
                <span className="text-[11.5px] text-subtitle">{c.autor}</span>
              </p>
              <p className="mt-1 text-[12px] text-card-foreground">{c.para}</p>
              <a
                href={c.urlLicencia}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-primary hover:underline"
              >
                {c.licencia}
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] text-subtitle">
          El resto son librerías de código abierto (MIT, Apache-2.0,
          BSD-3-Clause).
        </p>
      </Modal>
    </>
  );
}
