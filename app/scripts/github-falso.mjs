// GitHub DE MENTIRAS para probar la app sin tocar el repositorio real.
// Reemplaza a `fetch` dentro del Worker (worker/index.ts): responde como la
// API de GitHub (issues, comentarios, corridas del workflow, pasos), como
// raw.githubusercontent.com (catálogo) y como las descargas de releases
// (video.mp4 con rangos y hoja.jpg). Lo usan:
//   - tests/worker.test.ts (prueba de punta a punta del Worker)
//   - scripts/mock-server.mjs (la app en el navegador, para las capturas)
// Datos de muestra: 1 video listo, 1 armándose y 1 con problema.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = "daytonamotosports/motocine-estudio-public";
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API = `https://api.github.com/repos/${REPO}`;
const DESCARGA = `https://github.com/${REPO}/releases/download`;

/** Video y hoja de muestra: los de un video real ya armado (si existen en
 * este equipo), o lo que se pase en `muestras`. */
export function buscarMuestras() {
  for (const p of ["adivina-falla", "adivina-cadena", "mecanico-10s"]) {
    const dir = join(RAIZ, "projects", p, "output");
    const mp4 = join(dir, `${p}.mp4`);
    const hoja = join(dir, `${p}_hoja.jpg`);
    if (existsSync(mp4) && existsSync(hoja)) return { mp4, hoja };
  }
  return null;
}

function catalogo() {
  const dir = join(RAIZ, "catalogo", "fallas");
  if (!existsSync(dir)) return [{ id: "balancines", nombre: "Balancines desajustados", explicacion: "La leva mueve el balancín, y este empuja la válvula." }];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .map((f) => ({ id: f.id, nombre: f.nombre, pregunta: f.pregunta, explicacion: f.explicacion, solucion: f.solucion }));
}

const cuerpo = (falla, escenario, letra, nombre) =>
  `### Formato\n\nAdivina la falla por el sonido\n\n### Falla\n\n${falla}\n\n### Escenario\n\n${escenario}\n\n### Letra correcta\n\n${letra}\n\n### Nombre del video (opcional)\n\n${nombre || "_No response_"}`;

/** Estado inicial (las horas se cuentan desde `ahora`). */
export function crearGithubFalso({ ahora = Date.now(), muestras = buscarMuestras() } = {}) {
  const t = (min) => new Date(ahora + min * 60000).toISOString();
  const issues = [
    { number: 12, title: "Video: frenos", body: cuerpo("frenos", "Patio", "Aleatoria", ""), created_at: t(-26 * 60) },
    { number: 13, title: "Arreglar el logo del final", body: "Una tarea que no es un video.", created_at: t(-25 * 60) },
    { number: 14, title: "Video: balancines-octubre", body: cuerpo("balancines", "Taller", "A", "balancines-octubre"), created_at: t(-185) },
    { number: 15, title: "Video: cadena floja patio", body: cuerpo("cadena", "Patio", "B", "cadena floja patio"), created_at: t(-7) },
  ];
  const URL14 = `${DESCARGA}/video-14-7`;
  const comentarios = [
    { issue: 12, body: "⏳ Empecé a armar tu video (15–25 min). Te aviso aquí cuando esté.", created_at: t(-26 * 60 + 1.5) },
    {
      issue: 12,
      created_at: t(-26 * 60 + 6),
      body: [
        "⚠️ **No se pudo armar el video.**",
        "",
        "**Pedido:** Adivina la falla por el sonido · frenos · Patio · letra aleatoria",
        "",
        "**Guion:** ¿Qué falla tiene esta moto? Escucha bien el chillido…",
        "",
        "**Viralidad:** 78/100",
        "- ⚠ La pregunta llega después de los 2 primeros segundos (dato 2.6 s)",
        "- ⚠ Falta la pausa antes de la respuesta",
        "",
        "❌ No armé el video: el guion no llega a 85/100. Ajusta el pedido o pide una falla distinta.",
      ].join("\n"),
    },
    { issue: 14, body: "⏳ Empecé a armar tu video (15–25 min). Te aviso aquí cuando esté.", created_at: t(-183) },
    {
      issue: 14,
      created_at: t(-164),
      body: [
        "✅ **¡Tu video está listo!**",
        "",
        `🎬 [Descargar el video](${URL14}/video.mp4)`,
        "",
        `![cuadros](${URL14}/hoja.jpg)`,
        "",
        "**Pedido:** Adivina la falla por el sonido · balancines · Taller · letra A",
        "",
        "**Guion:** ¿Qué falla tiene esta moto? Escucha bien ese tic tic… ¿A, B o C?",
        "",
        "**Viralidad:** 94/100",
        "- ⚠ El texto del final dura un poco menos de lo ideal (dato 1.6 s)",
        "",
        "**Revisores:**",
        "- Vigilante de viralidad: 94/100 · 15/16 reglas (references/viral.md)",
        "- Vigilante adivina-falla.mp4: puntaje 91/100 · gancho 88/100 · bajones 1",
        "- Vigilante de diseño: 89/100 · imagen 90 (luz 0.52, color 0.61)",
        "- Vigilante de sincronía: 96/100 · mecánico visible al hablar 82%",
        "- QA adivina-falla.mp4: 31.2 s · 1080x1920 · audio aac · -14.1 LUFS · 21.6 MB",
      ].join("\n"),
    },
    { issue: 15, body: "⏳ Empecé a armar tu video (15–25 min). Te aviso aquí cuando esté.", created_at: t(-5.5) },
  ];
  const corridas = [
    { id: 9015, event: "issues", status: "in_progress", conclusion: null, display_title: "Video: cadena floja patio", created_at: t(-6.9) },
    { id: 9014, event: "issues", status: "completed", conclusion: "success", display_title: "Video: balancines-octubre", created_at: t(-184.8) },
    { id: 9012, event: "issues", status: "completed", conclusion: "success", display_title: "Video: frenos", created_at: t(-26 * 60 + 0.2) },
  ];
  const pasos = {
    9015: [
      { name: "Set up job", status: "completed", conclusion: "success", started_at: t(-6.9) },
      { name: "Instalar programas", status: "completed", conclusion: "success", started_at: t(-6.8) },
      { name: "Avisar que empezó", status: "completed", conclusion: "success", started_at: t(-5.5) },
      { name: "Leer el pedido", status: "completed", conclusion: "success", started_at: t(-5.4) },
      { name: "Armar el video", status: "in_progress", conclusion: null, started_at: t(-5.3) },
      { name: "Entregar", status: "queued", conclusion: null, started_at: null },
    ],
  };
  const archivos = muestras ? { [`${URL14}/video.mp4`]: { ruta: muestras.mp4, tipo: "video/mp4" }, [`${URL14}/hoja.jpg`]: { ruta: muestras.hoja, tipo: "image/jpeg" } } : {};
  const registro = []; // lo que la app le pidió a GitHub (para las pruebas)

  const json = (datos, status = 200) => new Response(status === 204 ? null : JSON.stringify(datos), { status, headers: { "Content-Type": "application/json" } });
  const issueApi = (i) => ({ ...i, comments: comentarios.filter((c) => c.issue === i.number).length, html_url: `https://github.com/${REPO}/issues/${i.number}` });
  const comentarioApi = (c, n) => ({ id: n + 1, body: c.body, created_at: c.created_at, issue_url: `${API}/issues/${c.issue}` });

  function archivo(url, request) {
    const a = archivos[url];
    if (!a) return new Response("Not Found", { status: 404 });
    const total = statSync(a.ruta).size;
    const datos = readFileSync(a.ruta);
    const rango = /bytes=(\d*)-(\d*)/.exec(request.headers.get("Range") ?? "");
    if (rango) {
      const inicio = rango[1] ? Number(rango[1]) : Math.max(0, total - Number(rango[2]));
      const fin = rango[1] && rango[2] ? Math.min(Number(rango[2]), total - 1) : total - 1;
      if (inicio >= total) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
      return new Response(datos.subarray(inicio, fin + 1), { status: 206, headers: { "Content-Type": "application/octet-stream", "Accept-Ranges": "bytes", "Content-Length": String(fin - inicio + 1), "Content-Range": `bytes ${inicio}-${fin}/${total}` } });
    }
    return new Response(request.method === "HEAD" ? null : datos, { headers: { "Content-Type": "application/octet-stream", "Accept-Ranges": "bytes", "Content-Length": String(total) } });
  }

  async function fetchFalso(entrada, init = {}) {
    const request = new Request(entrada, init);
    const url = new URL(request.url);
    const metodo = request.method;
    registro.push({ metodo, url: request.url, auth: request.headers.get("Authorization"), cuerpo: metodo === "POST" ? await request.clone().text() : null });
    if (url.hostname === "raw.githubusercontent.com") {
      if (url.pathname === `/${REPO}/main/catalogo/indice.json`) return json(catalogo());
      return new Response("404", { status: 404 });
    }
    if (url.hostname === "github.com") return archivo(`${url.origin}${url.pathname}`, request);
    if (url.hostname !== "api.github.com" || !url.pathname.startsWith(`/repos/${REPO}`)) return new Response("no", { status: 404 });
    if (request.headers.get("Authorization") !== "Bearer token-de-prueba") return json({ message: "Bad credentials" }, 401);
    const p = url.pathname.slice(`/repos/${REPO}`.length);
    let m;
    if (p === "/issues" && metodo === "GET") return json([...issues].reverse().map(issueApi));
    if (p === "/issues" && metodo === "POST") {
      const datos = await request.json();
      const nuevo = { number: Math.max(...issues.map((i) => i.number)) + 1, title: datos.title, body: datos.body, created_at: new Date().toISOString() };
      issues.push(nuevo);
      corridas.unshift({ id: 9000 + nuevo.number, event: "issues", status: "queued", conclusion: null, display_title: nuevo.title, created_at: new Date().toISOString() });
      return json(issueApi(nuevo), 201);
    }
    if (p === "/issues/comments") return json([...comentarios].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(comentarioApi));
    if ((m = /^\/issues\/(\d+)$/.exec(p))) {
      const i = issues.find((x) => x.number === Number(m[1]));
      return i ? json(issueApi(i)) : json({ message: "Not Found" }, 404);
    }
    if ((m = /^\/issues\/(\d+)\/comments$/.exec(p))) {
      const n = Number(m[1]);
      if (metodo === "POST") {
        const c = { issue: n, body: (await request.json()).body, created_at: new Date().toISOString() };
        comentarios.push(c);
        return json(comentarioApi(c, comentarios.length), 201);
      }
      return json(comentarios.filter((c) => c.issue === n).map(comentarioApi));
    }
    if (p === "/actions/workflows/estudio.yml/runs") return json({ total_count: corridas.length, workflow_runs: corridas });
    if (p === "/actions/workflows/estudio.yml/dispatches" && metodo === "POST") {
      corridas.unshift({ id: 9900 + corridas.length, event: "workflow_dispatch", status: "queued", conclusion: null, display_title: "Estudio MotoCine", created_at: new Date().toISOString() });
      return json(null, 204);
    }
    if ((m = /^\/actions\/runs\/(\d+)\/jobs$/.exec(p))) return json({ jobs: [{ steps: pasos[m[1]] ?? [] }] });
    return json({ message: "Not Found" }, 404);
  }

  return { fetch: fetchFalso, registro, issues, comentarios, corridas };
}

/** Caché de mentiras (caches.default de Cloudflare). */
export function cacheFalsa() {
  const guardado = new Map();
  return {
    default: {
      async match(req) {
        const r = guardado.get(typeof req === "string" ? req : req.url);
        return r ? r.clone() : undefined;
      },
      async put(req, res) {
        guardado.set(typeof req === "string" ? req : req.url, res.clone());
      },
    },
  };
}

/** R2 de mentiras (binding ARCHIVOS): put / head / get (con rangos) / list. */
export function r2Falso() {
  const objetos = new Map();
  const metadatos = (key, o) => ({
    key,
    size: o.datos.byteLength,
    uploaded: o.subido,
    httpEtag: `"${key.length}-${o.datos.byteLength}"`,
    httpMetadata: o.httpMetadata,
    customMetadata: o.customMetadata,
    writeHttpMetadata(h) {
      if (o.httpMetadata?.contentType) h.set("Content-Type", o.httpMetadata.contentType);
    },
  });
  return {
    objetos,
    async put(key, cuerpo, opciones = {}) {
      const datos = new Uint8Array(await new Response(cuerpo).arrayBuffer());
      objetos.set(key, { datos, subido: new Date(), httpMetadata: opciones.httpMetadata ?? {}, customMetadata: opciones.customMetadata ?? {} });
      return metadatos(key, objetos.get(key));
    },
    async head(key) {
      const o = objetos.get(key);
      return o ? metadatos(key, o) : null;
    },
    async get(key, opciones = {}) {
      const o = objetos.get(key);
      if (!o) return null;
      let datos = o.datos;
      let range;
      const pedido = opciones.range instanceof Headers ? opciones.range.get("Range") : null;
      const m = pedido && /bytes=(\d*)-(\d*)/.exec(pedido);
      if (m) {
        if (!m[1]) {
          range = { suffix: Number(m[2]) };
          datos = o.datos.subarray(Math.max(0, o.datos.byteLength - range.suffix));
        } else {
          const inicio = Number(m[1]);
          const fin = m[2] ? Math.min(Number(m[2]), o.datos.byteLength - 1) : o.datos.byteLength - 1;
          range = { offset: inicio, length: fin - inicio + 1 };
          datos = o.datos.subarray(inicio, fin + 1);
        }
      }
      return { ...metadatos(key, o), range, body: new Response(datos).body };
    },
    async list({ prefix = "" } = {}) {
      return { objects: [...objetos.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, o]) => metadatos(k, o)), truncated: false };
    },
  };
}
