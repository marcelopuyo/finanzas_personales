#!/usr/bin/env node
/**
 * Sube los pesos del laboratorio de voz offline al bucket público `voz-lab`
 * de Supabase Storage.
 *
 * ⚠️ Por qué existe este script (y no un `curl` a mano): los objetos tienen que
 * llegar troceados y con los TAMAÑOS y SHA-256 del build, porque el cliente
 * (`public/voz-lab/piloto.js`) concatena las partes del decoder en orden y
 * verifica el hash. Subir un archivo equivocado no se nota hasta que el piloto
 * falla raro en el celular. Ver `DeepSeek/plan-voz-offline-sherpa.md` §6 (B3a).
 *
 * Uso
 * ---
 *   # 1) con la clave publicable y una policy temporal de INSERT:
 *   $env:SUPABASE_ANON_KEY = "eyJhbGciOi..."
 *   node backend/scripts/subir-modelo-voz-lab.mjs
 *
 *   # 2) con la service_role (no hace falta tocar policies):
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOi..."
 *   node backend/scripts/subir-modelo-voz-lab.mjs
 *
 * Variables: `SUPABASE_URL` (por defecto, el proyecto de PROD) y
 * `MODO_MODELO` (por defecto `public/voz-lab/modelo`).
 *
 * ⚠️ Con la opción 1 hay que **borrar la policy** al terminar:
 *   drop policy "voz_lab_subida_temporal" on storage.objects;
 */

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const URL_BASE = process.env.SUPABASE_URL ?? "https://gskuyeldzsqisdhumkth.supabase.co";
const BUCKET = "voz-lab";
const DIR_MODELO = process.env.MODO_MODELO ?? path.join("public", "voz-lab", "modelo");

/** Debe coincidir con `MANIFEST.txt` del artifact del workflow. */
const OBJETOS = [
  {
    archivo: "whisper-encoder.onnx",
    bytes: 12937772,
    sha256: "d24fb083ae3b1041fc24e97971d60e280c9342201fbb67b0ab428a8b4a51a434",
  },
  {
    archivo: "whisper-decoder.part00",
    bytes: 47185920,
    sha256: "f5131fb437e42198b5c3dad271eca1a6d220f825dc092c7edf90f5ddb6586e4c",
  },
  {
    archivo: "whisper-decoder.part01",
    bytes: 42669481,
    sha256: "d35672b872ca66841c46fdc025f1cb3d22b91494a2f7d313a0aab0198be1412e",
  },
];

const OK = "\u2713";
const MAL = "\u2717";

const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
if (!clave) {
  console.error(
    `${MAL} Falta SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY en el entorno.`
  );
  process.exit(1);
}

const mb = (bytes) => (bytes / 1048576).toFixed(2);

/** Lee el archivo y comprueba tamaño + sha256 contra el manifest del build. */
async function leerVerificado({ archivo, bytes, sha256 }) {
  const ruta = path.join(DIR_MODELO, archivo);
  const { size } = await stat(ruta);
  if (size !== bytes) {
    throw new Error(
      `${archivo}: el archivo local pesa ${size} B y el build declara ${bytes} B`
    );
  }
  const contenido = await readFile(ruta);
  const hash = createHash("sha256").update(contenido).digest("hex");
  if (hash !== sha256) {
    throw new Error(`${archivo}: sha256 local ${hash.slice(0, 12)}… ≠ ${sha256.slice(0, 12)}…`);
  }
  return contenido;
}

async function subir(contenido, archivo) {
  const url = `${URL_BASE}/storage/v1/object/${BUCKET}/${archivo}`;
  const t0 = Date.now();
  // ⚠️ Sin `x-upsert`: el upsert de Storage es `insert … on conflict do update`
  // y PostgreSQL exige también la policy de UPDATE (que no creamos a propósito).
  // Si el objeto ya existe, primero hay que borrarlo (o subir con service_role).
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      apikey: clave,
      "Content-Type": "application/octet-stream",
    },
    body: contenido,
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    throw new Error(
      `${archivo}: HTTP ${res.status} ${res.statusText} · ${await res.text()}`
    );
  }
  console.log(
    `  ${OK} subido ${archivo} · ${mb(contenido.length)} MB en ${ms} ms ` +
      `(${(contenido.length / 1048576 / (ms / 1000)).toFixed(1)} MB/s)`
  );
}

/** Comprueba la URL pública (lectura anónima, sin credenciales). */
async function verificarPublico({ archivo, bytes }) {
  const url = `${URL_BASE}/storage/v1/object/public/${BUCKET}/${archivo}`;
  const res = await fetch(url, { method: "HEAD" });
  const len = Number(res.headers.get("content-length") ?? 0);
  if (!res.ok || len !== bytes) {
    throw new Error(
      `${archivo}: la URL pública respondió ${res.status} con ${len} B (se esperaban ${bytes})`
    );
  }
  console.log(`  ${OK} público ${url} · ${mb(len)} MB`);
}

for (const objeto of OBJETOS) {
  const contenido = await leerVerificado(objeto);
  await subir(contenido, objeto.archivo);
  await verificarPublico(objeto);
}

console.log(`\n${OK} Bucket ${BUCKET} listo: 3 objetos, ${mb(94192773)} MB.`);
console.log(`  Base para el piloto: ${URL_BASE}/storage/v1/object/public/${BUCKET}/`);
