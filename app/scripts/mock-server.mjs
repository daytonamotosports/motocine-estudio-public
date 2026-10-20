// Servidor de prueba: la app ya construida (dist/) + el Worker DE VERDAD
// (worker/index.ts) hablando con un GitHub de mentiras
// (scripts/github-falso.mjs). Sirve para mirar la app en el navegador y
// para las capturas, sin tocar el repositorio real.
//   npm run build && npm run preview     → http://localhost:8788  (PIN 2468)
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { buscarMuestras, cacheFalsa, crearGithubFalso, r2Falso, REPO } from "./github-falso.mjs";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const PUERTO = Number(process.env.PORT ?? 8788);
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

// MUESTRA_VIDEO / MUESTRA_HOJA: otro video de muestra (ej. uno .webm para el
// Chromium de las capturas, que no trae el códec de los .mp4).
const muestras = process.env.MUESTRA_VIDEO && process.env.MUESTRA_HOJA ? { mp4: process.env.MUESTRA_VIDEO, hoja: process.env.MUESTRA_HOJA } : buscarMuestras();
const gh = crearGithubFalso({ muestras });
globalThis.fetch = gh.fetch; // el Worker usa este fetch para "GitHub"
globalThis.caches = cacheFalsa();
const { default: worker } = await import("../worker/index.ts");

// Igual que [assets] con not_found_handling = "single-page-application".
const ASSETS = {
  async fetch(request) {
    const ruta = normalize(decodeURIComponent(new URL(request.url).pathname)).replace(/^(\.\.[/\\])+/, "");
    let archivo = join(DIST, ruta);
    if (!archivo.startsWith(DIST) || !existsSync(archivo) || statSync(archivo).isDirectory()) archivo = join(DIST, "index.html");
    return new Response(readFileSync(archivo), { headers: { "Content-Type": TIPOS[extname(archivo)] ?? "application/octet-stream" } });
  },
};
// SIN_R2=1: probar la app como si el almacenamiento no estuviera activado.
const env = { REPO, GITHUB_TOKEN: "token-de-prueba", APP_PIN: process.env.APP_PIN ?? "2468", ASSETS, ARCHIVOS: process.env.SIN_R2 ? undefined : r2Falso() };
const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };

createServer(async (req, res) => {
  try {
    const partes = [];
    for await (const p of req) partes.push(p);
    const request = new Request(`http://localhost:${PUERTO}${req.url}`, {
      method: req.method,
      headers: Object.entries(req.headers).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [])),
      body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(partes),
    });
    const r = await worker.fetch(request, env, ctx);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    if (r.body && req.method !== "HEAD") Readable.fromWeb(r.body).on("error", () => res.end()).pipe(res);
    else res.end();
  } catch (error) {
    console.error(error);
    res.writeHead(500).end("error");
  }
}).listen(PUERTO, () => console.log(`Orion MotoCine de prueba: http://localhost:${PUERTO}  (PIN ${env.APP_PIN})`));
