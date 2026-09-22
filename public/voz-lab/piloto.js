"use strict";

/* ==========================================================================
   Piloto de voz offline (sherpa-onnx WASM) — LABORATORIO (temporal)
   --------------------------------------------------------------------------
   Ver `DeepSeek/plan-voz-offline-sherpa.md`. Se borra con el experimento.

   Qué hace: carga el motor WASM de sherpa-onnx (`/voz-lab/sherpa/`), baja los
   pesos de Whisper (encoder + decoder troceado), los escribe en el FS de
   Emscripten, y corre VAD + ASR **en el dispositivo** (sin backend).

   ⚠️ Reglas que NO se pueden romper (verificadas contra el runtime generado):

   1. El runtime es un script CLÁSICO con `Module` global:
      `var Module = typeof Module != "undefined" ? Module : {}`. Hay que dejarlo
      en `window.Module` ANTES de inyectar `sherpa-onnx-wasm-main-vad-asr.js`.
   2. `Module.locateFile` decide de dónde salen `.wasm` y `.data`: el packager
      llama `Module.locateFile("sherpa-onnx-wasm-main-vad-asr.data", "")` con
      `scriptDirectory` VACÍO, así que hay que devolver la URL completa.
   3. Los archivos se crean en el FS con la MISMA llamada que usa el packager:
      `Module.FS_createDataFile("/ruta", null, bytes, true, true, true)`.
      Con `name = null` el primer argumento es la ruta absoluta, y `canOwn = true`
      hace que el nodo del FS **aliasé** el `Uint8Array` (no lo copia al heap):
      si no, los 89 MB del decoder quedarían duplicados en memoria.
   4. `.data` ya preloada `/silero_vad.onnx` y `/tokens.txt` (build `assets@.`),
      así que esos dos NO se bajan. El modelo Whisper sí (tope de 50 MB/archivo
      en Supabase Free ⇒ decoder en 2 partes que se concatenan en orden).
   5. `CircularBuffer`/`OfflineRecognizer`/`Vad` son `class` top-level: sólo se
      ven entre scripts clásicos del mismo realm (no desde un `type="module"`).

   Contrato de los artefactos (GitHub Actions, run 35688383156):
     sherpa-onnx v1.13.8 · emsdk 4.0.23 · whisper-tiny int8 multilingüe
   ========================================================================== */

/** Directorio del motor (repo): `public/voz-lab/sherpa`. */
const DIR_MOTOR = "/voz-lab/sherpa";

/** Base por defecto de los pesos: copia local (gitignoreada). */
const BASE_POR_DEFECTO = "/voz-lab/modelo/";

/**
 * Bucket público de Supabase Storage (B3a). Es la base que hay que usar en el
 * celular: HTTPS, CORS `*` y ETag (revalida con 304, así no rebaja los 103 MB en
 * cada carga). El proyecto es público por diseño — la clave anon viaja al cliente.
 */
const BASE_BUCKET =
  "https://gskuyeldzsqisdhumkth.supabase.co/storage/v1/object/public/voz-lab/";

/** `localStorage` de la base elegida (el lab es de un solo usuario). */
const CLAVE_BASE = "fp-voz-lab-base";

const SAMPLE_RATE = 16000;

/**
 * Pesos + hashes publicados por el workflow (`BUILD-INFO.txt` / `MANIFEST.txt`).
 * Los tamaños son los esperados: si una descarga corta, se detecta antes de
 * escribir basura en el FS.
 */
const ENCODER = {
  archivo: "whisper-encoder.onnx",
  bytes: 12937772,
  sha256: "d24fb083ae3b1041fc24e97971d60e280c9342201fbb67b0ab428a8b4a51a434",
};

const DECODER = {
  /** Nombre con el que el motor lo busca en el FS (`./whisper-decoder.onnx`). */
  archivo: "whisper-decoder.onnx",
  bytes: 89855401,
  sha256: "d2fece8dd42771f1df975c6c0445770d0c292bf7547c2cae04a6c0cc57540925",
  /** El decoder no entra en 1 objeto (< 50 MB): se baja troceado y se concatena. */
  partes: [
    {
      archivo: "whisper-decoder.part00",
      bytes: 47185920,
      sha256: "f5131fb437e42198b5c3dad271eca1a6d220f825dc092c7edf90f5ddb6586e4c",
      /** Tramo de la barra de progreso (para que no retroceda entre partes). */
      barra: [45, 66],
    },
    {
      archivo: "whisper-decoder.part01",
      bytes: 42669481,
      sha256: "d35672b872ca66841c46fdc025f1cb3d22b91494a2f7d313a0aab0198be1412e",
      barra: [66, 85],
    },
  ],
};

/* ------------------------------------------------------------------ estado */

/** @type {any} runtime de Emscripten ya inicializado */
let modulo = null;
/** @type {any} detector de actividad (VAD) de silero */
let vad = null;
/** @type {any} buffer circular de muestras (ventanas del VAD) */
let bufferCircular = null;
/** @type {any} reconocedor offline (Whisper) */
let reconocedor = null;

let audioCtx = null;
let fuente = null;
let procesador = null;
let flujoMic = null;
let sampleRateMic = 0;
let grabando = false;
let hablando = false;

const t0 = performance.now();

/* ------------------------------------------------------------------- utils */

const $ = (id) => document.getElementById(id);

function ms() {
  return Math.round(performance.now() - t0);
}

function mb(bytes) {
  return (bytes / 1048576).toFixed(2);
}

/**
 * Agrega una línea al registro del lab. Es el entregable del piloto: los
 * tiempos de cada fase son lo que decide si esto es viable en un celular.
 */
function log(texto, tipo) {
  const li = document.createElement("li");
  li.textContent = `${String(ms()).padStart(6)} ms · ${texto}`;
  if (tipo) li.className = tipo;
  const lista = $("log");
  lista.appendChild(li);
  lista.scrollTop = lista.scrollHeight;
}

function fase(texto, porcentaje) {
  $("fase").textContent = texto;
  if (typeof porcentaje === "number") $("barra").value = porcentaje;
}

/** Inyecta un script clásico y espera a que cargue (no son módulos). */
function inyectarScript(url) {
  return new Promise((resolver, rechazar) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => resolver();
    s.onerror = () => rechazar(new Error(`No se pudo cargar ${url}`));
    document.head.appendChild(s);
  });
}

/**
 * Baja `url` y lo escribe **dentro** de `destino` desde `offset` (sin buffers
 * intermedios: en el celular el pico de memoria es el asunto).
 */
async function bajarEn(url, destino, offset, onProgreso) {
  // ⚠️ Sin `cache: "no-store"`: el bucket responde `no-cache` + ETag, así que la
  // revalidación da 304 y el navegador NO rebaja los 89 MB en cada carga (con
  // `no-store` se ignoraría el ETag y se gastaría el egress del plan Free).
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} al bajar ${url}`);
  const total = Number(r.headers.get("content-length") || 0);
  if (!r.body) {
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > destino.length - offset) {
      throw new Error(`${url} no entra en el buffer destino`);
    }
    destino.set(bytes, offset);
    onProgreso?.(bytes.length, total || bytes.length);
    return bytes.length;
  }
  const lector = r.body.getReader();
  let cargado = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    if (value.length > destino.length - offset - cargado) {
      throw new Error(`${url} devolvió más bytes de los esperados`);
    }
    destino.set(value, offset + cargado);
    cargado += value.length;
    onProgreso?.(cargado, total);
  }
  return cargado;
}

/** Verifica el sha256 publicado por el workflow. Requiere contexto seguro. */
async function verificarSha(bytes, esperado, etiqueta) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("crypto.subtle no está disponible (¿falta HTTPS?)");
  }
  const t = performance.now();
  const resumen = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(resumen))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex !== esperado) {
    throw new Error(
      `${etiqueta}: sha256 ${hex.slice(0, 12)}… ≠ ${esperado.slice(0, 12)}…`
    );
  }
  log(`${etiqueta}: sha256 OK (${Math.round(performance.now() - t)} ms)`, "ok");
}

/** Escribe un archivo en el FS del WASM (misma llamada que el packager). */
function escribirEnFS(ruta, bytes) {
  const crear = modulo.FS_createDataFile;
  if (typeof crear !== "function") {
    throw new Error("El runtime no expone FS_createDataFile");
  }
  const t = performance.now();
  // canOwn = true ⇒ el nodo del FS aliasé `bytes` en vez de copiarlo al heap.
  crear(ruta, null, bytes, true, true, true);
  log(
    `FS ${ruta} · ${mb(bytes.length)} MB escrito (${Math.round(
      performance.now() - t
    )} ms)`,
    "ok"
  );
}

/** Memoria JS, si el navegador la reporta (Chrome/Edge; Safari no). */
function memoria() {
  const m = performance.memory;
  if (!m) return "no reportada";
  return `${mb(m.usedJSHeapSize)} MB usados de ${mb(m.jsHeapSizeLimit)} MB`;
}

/* --------------------------------------------------------------- entorno UI */

function pintarEntorno() {
  const dl = $("entorno");
  dl.textContent = "";
  const filas = [
    ["Contexto seguro", yesNo(window.isSecureContext)],
    ["URL", location.origin + location.pathname],
    ["Aislado (COOP/COEP)", yesNo(window.crossOriginIsolated)],
    ["Idioma del navegador", navigator.language],
    ["Memoria del dispositivo", `${navigator.deviceMemory ?? "?"} GB`],
    ["Núcleos", String(navigator.hardwareConcurrency ?? "?")],
    ["Memoria JS", memoria()],
    ["Motor", "sherpa-onnx v1.13.8 · emsdk 4.0.23 · whisper-tiny int8"],
  ];
  for (const [clave, valor] of filas) {
    const dt = document.createElement("dt");
    dt.textContent = clave;
    const dd = document.createElement("dd");
    dd.textContent = valor;
    dl.append(dt, dd);
  }
}

function yesNo(v) {
  return v ? "sí" : "no";
}

/* --------------------------------------------------------- comprobar URLs */

async function comprobarUrls() {
  const base = $("base").value.trim() || BASE_POR_DEFECTO;
  const objetivos = [
    `${DIR_MOTOR}/sherpa-onnx-wasm-main-vad-asr.wasm`,
    `${DIR_MOTOR}/sherpa-onnx-wasm-main-vad-asr.data`,
    base + ENCODER.archivo,
    ...DECODER.partes.map((p) => base + p.archivo),
  ];
  $("btn-head").disabled = true;
  try {
    for (const url of objetivos) {
      const t = performance.now();
      const r = await fetch(url, { method: "HEAD", cache: "no-store" });
      const len = Number(r.headers.get("content-length") || 0);
      log(
        `HEAD ${r.status} · ${url} · ${
          len ? `${mb(len)} MB` : "sin content-length"
        } (${Math.round(performance.now() - t)} ms)`,
        r.ok ? "" : "err"
      );
    }
  } catch (e) {
    log(`Error comprobando URLs: ${e.message}`, "err");
  } finally {
    $("btn-head").disabled = false;
  }
}

/* ------------------------------------------------------------- cargar motor */

async function cargarMotor() {
  if (modulo) return modulo;
  const base = $("base").value.trim() || BASE_POR_DEFECTO;
  const verificar = $("verificar").checked;
  $("btn-cargar").disabled = true;

  try {
    // 1) Bibliotecas de la API (deben entrar antes que el runtime).
    fase("Cargando API de sherpa-onnx…", 5);
    let t = performance.now();
    await inyectarScript(`${DIR_MOTOR}/sherpa-onnx-asr.js`);
    await inyectarScript(`${DIR_MOTOR}/sherpa-onnx-vad.js`);
    log(`API cargada (${Math.round(performance.now() - t)} ms)`, "ok");

    // 2) `Module` ANTES del runtime: es la única costura que expone Emscripten.
    fase("Preparando runtime…", 10);
    let resolverListo;
    let rechazarListo;
    const listo = new Promise((res, rej) => {
      resolverListo = res;
      rechazarListo = rej;
    });

    window.Module = {
      // El packager lo llama con scriptDirectory vacío ⇒ hay que armar la URL.
      locateFile: (ruta) =>
        ruta.startsWith("/") || ruta.startsWith("http")
          ? ruta
          : `${DIR_MOTOR}/${ruta}`,
      setStatus: (texto) => {
        if (texto) fase(texto, undefined);
      },
      print: (texto) => log(`motor: ${texto}`),
      printErr: (texto) => log(`motor(err): ${texto}`, "err"),
      onRuntimeInitialized: async () => {
        // El runtime ya está listo: es el momento de inyectar el modelo ANTES
        // de crear el reconocedor (si no, no encuentra `whisper-encoder.onnx`).
        try {
          await bajarModelo(base, verificar);
          crearMotor();
          resolverListo(window.Module);
        } catch (e) {
          rechazarListo(e);
        }
      },
    };

    t = performance.now();
    await inyectarScript(`${DIR_MOTOR}/sherpa-onnx-wasm-main-vad-asr.js`);
    fase("Compilando WASM…", 25);
    modulo = await listo;
    log(`Runtime listo (${Math.round(performance.now() - t)} ms)`, "ok");

    fase("Motor cargado.", 100);
    $("btn-cargar").textContent = "Motor cargado ✓";
    $("btn-mic").disabled = false;
    $("estado").textContent = "motor listo";
    log(`Memoria después de cargar: ${memoria()}`);
  } catch (e) {
    fase(`Error: ${e.message}`);
    log(`Error cargando el motor: ${e.message}`, "err");
    $("btn-cargar").disabled = false;
  }
}

/** Baja los pesos (encoder + decoder troceado) y los deja en el FS. */
async function bajarModelo(base, verificar) {
  fase("Bajando el encoder (12,34 MB)…", 30);
  const encoder = new Uint8Array(ENCODER.bytes);
  let t = performance.now();
  const leidos = await bajarEn(base + ENCODER.archivo, encoder, 0, (hecho, total) =>
    faseDescarga("encoder", hecho, total, 30, 45)
  );
  if (leidos !== ENCODER.bytes) {
    throw new Error(
      `El encoder llegó incompleto: ${leidos} ≠ ${ENCODER.bytes} bytes`
    );
  }
  log(
    `encoder: ${mb(leidos)} MB en ${Math.round(performance.now() - t)} ms (${
      (leidos / 1048576 / ((performance.now() - t) / 1000)).toFixed(1)
    } MB/s)`
  );
  if (verificar) await verificarSha(encoder, ENCODER.sha256, "encoder");
  escribirEnFS(`/${ENCODER.archivo}`, encoder);

  // El decoder se baja en 2 partes y se concatena en el MISMO buffer destino
  // (así sólo existe una copia de los 89 MB en JS; el FS no copia por canOwn).
  fase("Bajando el decoder (85,69 MB en 2 partes)…", 45);
  const decoder = new Uint8Array(DECODER.bytes);
  let offset = 0;
  for (const parte of DECODER.partes) {
    t = performance.now();
    const escritos = await bajarEn(
      base + parte.archivo,
      decoder,
      offset,
      (hecho, total) =>
        faseDescarga(parte.archivo, hecho, total, parte.barra[0], parte.barra[1])
    );
    if (escritos !== parte.bytes) {
      throw new Error(
        `${parte.archivo} llegó incompleto: ${escritos} ≠ ${parte.bytes} bytes`
      );
    }
    log(
      `${parte.archivo}: ${mb(escritos)} MB en ${Math.round(
        performance.now() - t
      )} ms`
    );
    if (verificar) {
      await verificarSha(
        decoder.subarray(offset, offset + escritos),
        parte.sha256,
        parte.archivo
      );
    }
    offset += escritos;
  }
  if (verificar) {
    await verificarSha(decoder, DECODER.sha256, "decoder completo");
  }

  fase("Escribiendo el modelo en el FS del WASM…", 90);
  t = performance.now();
  escribirEnFS(`/${DECODER.archivo}`, decoder);
  log(`escritura del decoder: ${Math.round(performance.now() - t)} ms`);
}

function faseDescarga(etiqueta, hecho, total, desde, hasta) {
  const porcentaje = total
    ? desde + (hasta - desde) * (hecho / total)
    : undefined;
  fase(
    `Bajando ${etiqueta}… ${mb(hecho)}${total ? ` / ${mb(total)}` : ""} MB`,
    porcentaje
  );
}

/** Crea VAD + buffer + reconocedor (equivalente a `initOfflineRecognizer`). */
function crearMotor() {
  fase("Creando VAD y reconocedor…", 95);
  let t = performance.now();
  vad = createVad(modulo);
  bufferCircular = new CircularBuffer(30 * SAMPLE_RATE, modulo);
  log(`VAD + buffer creados (${Math.round(performance.now() - t)} ms)`, "ok");

  const idioma = $("idioma").value;
  const config = {
    modelConfig: {
      debug: 1,
      tokens: "./tokens.txt",
      whisper: {
        encoder: "./whisper-encoder.onnx",
        decoder: "./whisper-decoder.onnx",
        // Vacío = detección automática (multilingüe). Forzarlo ayuda si mezcla
        // idiomas en frases cortas.
        language: idioma,
        task: "transcribe",
      },
    },
  };

  t = performance.now();
  reconocedor = new OfflineRecognizer(config, modulo);
  log(
    `Reconocedor listo (${Math.round(performance.now() - t)} ms)${
      idioma ? ` · idioma forzado: ${idioma}` : " · idioma automático"
    }`,
    "ok"
  );
  log(`Memoria con el modelo cargado: ${memoria()}`);
}

/* ------------------------------------------------------------------ micrófono */

async function iniciarMic() {
  if (!reconocedor) return;
  $("btn-mic").disabled = true;
  try {
    flujoMic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    // El AudioContext se crea/resume DENTRO del gesto del usuario: en iOS, si no,
    // queda `suspended` y no entra audio.
    audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    await audioCtx.resume();
    sampleRateMic = audioCtx.sampleRate;

    fuente = audioCtx.createMediaStreamSource(flujoMic);
    const nodo = audioCtx.createScriptProcessor
      ? audioCtx.createScriptProcessor(4096, 1, 2)
      : audioCtx.createJavaScriptNode(4096, 1, 2);
    procesador = nodo;
    nodo.onaudioprocess = (e) => {
      let muestras = new Float32Array(e.inputBuffer.getChannelData(0));
      muestras = remuestrear(muestras, SAMPLE_RATE, sampleRateMic);
      procesar(muestras);
    };
    fuente.connect(nodo);
    nodo.connect(audioCtx.destination);

    grabando = true;
    vad.reset();
    bufferCircular.reset();
    $("estado").textContent = "grabando";
    $("estado").className = "grabando";
    $("btn-mic").textContent = "⏹ Detener";
    log(`Micrófono abierto · AudioContext a ${sampleRateMic} Hz`, "ok");
  } catch (e) {
    log(`No se pudo abrir el micrófono: ${e.message}`, "err");
    $("estado").textContent = "error de micrófono";
  } finally {
    $("btn-mic").disabled = false;
  }
}

function detenerMic() {
  grabando = false;
  try {
    procesador?.disconnect();
    fuente?.disconnect();
    flujoMic?.getTracks().forEach((p) => p.stop());
    audioCtx?.close();
  } catch {
    /* el desmontaje no debería romper la página */
  }
  procesador = fuente = flujoMic = audioCtx = null;
  vad?.reset();
  bufferCircular?.reset();
  $("btn-mic").textContent = "🎤 Iniciar";
  $("estado").textContent = "detenido";
  $("estado").className = "";
  log("Micrófono cerrado");
}

/**
 * Bucle del VAD: trocea las muestras en ventanas de 512 (lo que espera silero),
 * detecta el fin de cada frase y la manda a Whisper de una sola vez.
 * Portado de `app-vad-asr.js` (demo oficial del motor).
 */
function procesar(muestras) {
  bufferCircular.push(muestras);
  while (bufferCircular.size() > vad.config.sileroVad.windowSize) {
    const ventana = bufferCircular.get(
      bufferCircular.head(),
      vad.config.sileroVad.windowSize
    );
    vad.acceptWaveform(ventana);
    bufferCircular.pop(vad.config.sileroVad.windowSize);

    const detectado = vad.isDetected();
    if (detectado !== hablando) {
      hablando = detectado;
      $("estado").textContent = detectado ? "escuchando…" : "grabando";
      $("estado").className = detectado ? "hablando" : "grabando";
    }

    while (!vad.isEmpty()) {
      const segmento = vad.front();
      vad.pop();
      transcribir(segmento);
    }
  }
}

/** Decodifica un segmento. Es sincrónico: bloquea la UI mientras dura. */
function transcribir(segmento) {
  const duracion = segmento.samples.length / SAMPLE_RATE;
  const t = performance.now();
  let texto = "";
  let error = null;
  try {
    const stream = reconocedor.createStream();
    stream.acceptWaveform(SAMPLE_RATE, segmento.samples);
    reconocedor.decode(stream);
    texto = reconocedor.getResult(stream).text || "";
    stream.free();
  } catch (e) {
    error = e;
  }
  const msDecode = Math.round(performance.now() - t);
  agregarSegmento(duracion, msDecode, texto, error);
  // El factor de tiempo real es el dato que decide si sirve en el celular.
  log(
    `segmento ${duracion.toFixed(2)} s decodificado en ${msDecode} ms (x${(
      duracion /
      (msDecode / 1000)
    ).toFixed(1)} tiempo real)${error ? ` · ERROR ${error.message}` : ""}`,
    error ? "err" : ""
  );
}

function agregarSegmento(duracion, msDecode, texto, error) {
  const li = document.createElement("li");
  const cuerpo = document.createElement("span");
  cuerpo.className = "meta";
  cuerpo.textContent = `${duracion.toFixed(2)} s de audio · ${msDecode} ms de decodificación · ${memoria()}`;
  li.textContent = error ? `⚠️ ${error.message}` : texto || "(sin texto)";
  if (!texto && !error) li.className = "vacio";
  li.appendChild(cuerpo);
  $("transcripcion").appendChild(li);
}

/** Remuestreo por promedio (portado de la demo; iOS ignora el sampleRate pedido). */
function remuestrear(muestras, destino, origen) {
  if (origen === destino) return muestras;
  const ratio = origen / destino;
  const nuevo = new Float32Array(Math.round(muestras.length / ratio));
  let salida = 0;
  let entrada = 0;
  while (salida < nuevo.length) {
    const siguiente = Math.round((salida + 1) * ratio);
    let acum = 0;
    let cuenta = 0;
    for (let i = entrada; i < siguiente && i < muestras.length; i++) {
      acum += muestras[i];
      cuenta++;
    }
    nuevo[salida] = acum / cuenta;
    salida++;
    entrada = siguiente;
  }
  return nuevo;
}

/* ------------------------------------------------------------------- arranque */

(function init() {
  // El tema de la app vive en la cookie `theme` (lib/theme.ts).
  const cookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith("theme="));
  const oscuro = cookie
    ? cookie.slice("theme=".length) === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  if (oscuro) document.documentElement.classList.add("dark");

  $("dir-motor").value = DIR_MOTOR;
  // En localhost se usa la copia local (rápida y sin red); fuera de localhost
  // esa carpeta NO se despliega, así que el default es el bucket de Supabase.
  const esLocal = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  const guardada = localStorage.getItem(CLAVE_BASE);
  $("base").value = guardada || (esLocal ? BASE_POR_DEFECTO : BASE_BUCKET);
  const ponerBase = (valor) => {
    $("base").value = valor;
    localStorage.setItem(CLAVE_BASE, valor);
    if (modulo) log("La URL del modelo se aplica al recargar la página.", "err");
  };
  $("base").addEventListener("change", () => ponerBase($("base").value.trim()));
  $("btn-base-local").addEventListener("click", () => ponerBase(BASE_POR_DEFECTO));
  $("btn-base-bucket").addEventListener("click", () => ponerBase(BASE_BUCKET));

  pintarEntorno();
  $("btn-head").addEventListener("click", comprobarUrls);
  $("btn-cargar").addEventListener("click", cargarMotor);
  $("btn-mic").addEventListener("click", () => {
    if (grabando) detenerMic();
    else iniciarMic();
  });
  $("btn-limpiar").addEventListener("click", () => {
    $("transcripcion").textContent = "";
  });
  // El idioma se lee al crear el reconocedor: cambiarlo exige recargar la página.
  $("idioma").addEventListener("change", () => {
    log("El idioma se aplica al volver a cargar el motor (recargá la página).");
  });
  window.addEventListener("pagehide", () => {
    if (grabando) detenerMic();
  });

  log(`Piloto listo · ${location.host}`);
  // La carga NO es automática a propósito: son ~103 MB de descarga y en el
  // celular conviene que la dispare el usuario (y así el tiempo no se mezcla
  // con el de la página).
  $("btn-cargar").disabled = false;
  log("Tocá «Cargar motor» para bajar el runtime y los pesos.");
})();
