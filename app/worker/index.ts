// Orion MotoCine -- Worker de Cloudflare.
// - Todo lo que NO es /api/* son los archivos de la app (dist/, binding ASSETS).
// - /api/* habla con GitHub por el dueño: crea el pedido (issue) en el
//   repositorio público motocine-estudio-public, lee los comentarios del
//   robot (workflow estudio.yml) y le pasa el video a la app desde el mismo
//   sitio (así se puede ver, descargar y compartir sin salir de la app).
// Claves (se ponen en el panel de Cloudflare como "Secret", nunca aquí):
//   GITHUB_TOKEN  token "fine-grained" solo de ese repositorio
//                 (Issues: lectura y escritura, Actions: lectura y
//                 escritura, Contents: lectura).
//   APP_PIN       el PIN para entrar a la app.
// Fotos y videos del dueño: Cloudflare R2, binding ARCHIVOS (bucket
// "motocine-archivos"). Si no está activado, solo esas rutas responden
// "Falta activar el almacenamiento..."; lo demás sigue funcionando.
// Los errores llegan a la app como frases cortas en español; el detalle
// técnico solo queda en el registro del Worker (console.error).
import { cuerpoPedido, esPedido, leerCuerpo, nombreDesdeTitulo, tituloPedido, validarPedido } from "../src/lib/logic/pedido.ts";
import { MARCA_REHACER, leerResumen, ultimoMarcador, urlHoja, urlVideo, type Comentario } from "../src/lib/logic/comentarios.ts";
import { elegirCorrida, resolverEstado, type Corrida, type PasoRun } from "../src/lib/logic/pasos.ts";
import { cookieBorrar, cookieSesion, firmaSesion, iguales, sesionValida } from "../src/lib/logic/sesion.ts";
import type { Falla, PedidoCorto, PedidoDetalle } from "../src/lib/logic/tipos.ts";
import { MAX_BYTES, claveArchivo, claveValida, esFotoOVideo, firmaArchivoValida, urlArchivo } from "../src/lib/logic/archivos.ts";

interface Env {
  ASSETS: Fetcher;
  REPO: string;
  GITHUB_TOKEN?: string;
  APP_PIN?: string;
  ARCHIVOS?: R2Bucket;
}

interface Issue {
  number: number;
  title: string;
  body: string | null;
  created_at: string;
  comments: number;
  html_url: string;
  pull_request?: unknown;
}

interface ComentarioGh extends Comentario {
  issue_url: string;
}

const WORKFLOW = "estudio.yml";
const CACHE_BASE = "https://orion-motocine.cache";

/** Error con una frase para la persona (y el código HTTP). */
class Aviso extends Error {
  status: number;
  constructor(mensaje: string, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await api(request, url, env, ctx);
    } catch (error) {
      if (error instanceof Aviso) return json({ error: error.message }, error.status);
      console.error("api", url.pathname, error);
      return json({ error: "Algo falló. Intenta otra vez en un momento." }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function api(request: Request, url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const ruta = url.pathname.replace(/\/+$/, "");
  const metodo = request.method;

  if (ruta === "/api/login" && metodo === "POST") return login(request, env);
  if (ruta === "/api/salir" && metodo === "POST") return json({ ok: true }, 200, { "Set-Cookie": cookieBorrar() });

  if (!env.APP_PIN || !env.GITHUB_TOKEN) throw new Aviso("La app todavía no está configurada (falta el PIN o el token de GitHub en Cloudflare).", 503);
  const archivo = /^\/api\/archivos\/(subidas\/[^?#]+)$/.exec(ruta);
  const clave = archivo ? decodeURIComponent(archivo[1]) : null;
  // Un archivo se puede bajar con la galleta O con su firma ?t= (así lo baja el robot).
  const conFirma = !!clave && (metodo === "GET" || metodo === "HEAD") && (await firmaArchivoValida(env.APP_PIN, clave, url.searchParams.get("t")));
  if (!conFirma && !(await sesionValida(request.headers.get("Cookie"), env.APP_PIN))) throw new Aviso("Tu sesión terminó. Escribe el PIN otra vez.", 401);
  if (clave && (metodo === "GET" || metodo === "HEAD")) return servirArchivo(clave, request, env);
  if (ruta === "/api/archivos" && metodo === "POST") return json(await subirArchivo(request, url, env), 201);
  if (ruta === "/api/archivos" && metodo === "GET") return json(await listarArchivos(env));
  // Lo que cambia algo solo se acepta como JSON (un formulario de otro sitio no puede mandarlo).
  if (metodo === "POST" && !(request.headers.get("Content-Type") ?? "").includes("application/json")) throw new Aviso("Pedido no válido.", 415);

  if (ruta === "/api/sesion" && metodo === "GET") return json({ ok: true });
  if (ruta === "/api/catalogo" && metodo === "GET") return json(await catalogo(env, ctx));
  if (ruta === "/api/pedidos" && metodo === "GET") return json(await listarPedidos(env));
  if (ruta === "/api/pedidos" && metodo === "POST") return json(await crearPedido(request, url, env, ctx), 201);

  const m = /^\/api\/pedidos\/(\d{1,7})(?:\/(video|hoja|rehacer))?$/.exec(ruta);
  if (m) {
    const n = Number(m[1]);
    if (!m[2] && metodo === "GET") return json(await detallePedido(n, env));
    if (m[2] === "video" && (metodo === "GET" || metodo === "HEAD")) return video(n, request, url, env);
    if (m[2] === "hoja" && metodo === "GET") return hoja(n, env, ctx);
    if (m[2] === "rehacer" && metodo === "POST") return json(await rehacer(n, env));
  }
  throw new Aviso("No encontré eso.", 404);
}

/* ------------------------------------------------------------- sesión */

async function login(request: Request, env: Env): Promise<Response> {
  if (!env.APP_PIN) throw new Aviso("La app todavía no tiene PIN. Ponlo en Cloudflare (APP_PIN).", 503);
  const datos = (await request.json().catch(() => ({}))) as { pin?: unknown };
  const pin = String(datos.pin ?? "").trim();
  if (!pin || !iguales(pin, env.APP_PIN)) {
    // Un momento de espera: probar PIN tras PIN se vuelve muy lento.
    await new Promise((r) => setTimeout(r, 900));
    throw new Aviso("Ese PIN no es. Revísalo e intenta otra vez.", 401);
  }
  return json({ ok: true }, 200, { "Set-Cookie": cookieSesion(await firmaSesion(env.APP_PIN)) });
}

/* ------------------------------------------------------------- GitHub */

async function gh<T>(env: Env, ruta: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "orion-motocine",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch (error) {
    console.error("github red", ruta, error);
    throw new Aviso("No hay conexión con GitHub. Intenta en un momento.", 502);
  }
  if (res.ok) return (res.status === 204 ? null : await res.json()) as T;
  const texto = await res.text().catch(() => "");
  console.error("github", res.status, ruta, texto.slice(0, 300));
  if (res.status === 401) throw new Aviso("GitHub no reconoce el token. Hay que poner uno nuevo en Cloudflare.", 502);
  if (res.status === 403 || res.status === 429) {
    if (/rate limit/i.test(texto)) throw new Aviso("GitHub está ocupado. Intenta en un minuto.", 503);
    throw new Aviso("El token de GitHub no tiene permiso para esto. Revisa sus permisos.", 502);
  }
  if (res.status === 404) throw new Aviso("No encontré ese video.", 404);
  if (res.status === 422) throw new Aviso("GitHub no aceptó el pedido. Revisa los datos.", 400);
  throw new Aviso("GitHub no respondió bien. Intenta en un momento.", 502);
}

const repo = (env: Env) => `/repos/${env.REPO}`;

async function comentariosDe(env: Env, n: number): Promise<Comentario[]> {
  return gh<Comentario[]>(env, `${repo(env)}/issues/${n}/comments?per_page=100`);
}

async function corridas(env: Env, cuantas: number): Promise<Corrida[]> {
  try {
    const r = await gh<{ workflow_runs: Corrida[] }>(env, `${repo(env)}/actions/workflows/${WORKFLOW}/runs?per_page=${cuantas}`);
    return r?.workflow_runs ?? [];
  } catch (error) {
    // Sin las corridas igual se puede mostrar el estado por los comentarios.
    console.error("corridas", error);
    return [];
  }
}

/** Fecha del último "Volver a intentar" pedido desde la app. */
function ultimoRehacer(comentarios: Comentario[]): string | null {
  for (let i = comentarios.length - 1; i >= 0; i--) if (comentarios[i].body.startsWith(MARCA_REHACER)) return comentarios[i].created_at;
  return null;
}

/** Lo que tienen en común la lista y el detalle. */
function armarCorto(issue: Issue, comentarios: Comentario[], runs: Corrida[], pasosRun: PasoRun[] | null, env: Env) {
  const datos = leerCuerpo(issue.body);
  const marca = ultimoMarcador(comentarios);
  const corrida = elegirCorrida(runs, { numero: issue.number, titulo: issue.title, creado: issue.created_at }, ultimoRehacer(comentarios));
  const resuelto = resolverEstado({
    marcador: marca ? { estado: marca.estado, creado: marca.comentario.created_at, motivos: marca.comentario.body } : null,
    corrida,
    pasosRun,
  });
  const listo = [...comentarios].reverse().find((c) => urlVideo(c.body, env.REPO));
  // Desde cuándo va el intento actual: el pedido, el último "Volver a intentar" o la corrida, lo más nuevo.
  const inicios = [issue.created_at, ultimoRehacer(comentarios), corrida?.created_at].filter((x): x is string => !!x);
  const desde = resuelto.estado === "armando" ? inicios.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : issue.created_at;
  const corto: PedidoCorto = {
    numero: issue.number,
    nombre: datos.nombre || nombreDesdeTitulo(issue.title),
    falla: datos.falla,
    creado: issue.created_at,
    desde,
    estado: resuelto.estado,
    hoja: listo && urlHoja(listo.body, env.REPO) ? `/api/pedidos/${issue.number}/hoja` : null,
  };
  return { corto, datos, marca, corrida, resuelto, listo };
}

/* ------------------------------------------------------------- catálogo */

async function catalogo(env: Env, ctx: ExecutionContext): Promise<Falla[]> {
  const clave = new Request(`${CACHE_BASE}/catalogo/${env.REPO}`);
  const cache = caches.default;
  const guardado = await cache.match(clave);
  if (guardado) return guardado.json();
  const lista = await leerCatalogo(env);
  ctx.waitUntil(cache.put(clave, new Response(JSON.stringify(lista), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" } })));
  return lista;
}

async function leerCatalogo(env: Env): Promise<Falla[]> {
  const crudo = (ruta: string) => fetch(`https://raw.githubusercontent.com/${env.REPO}/main/${ruta}`, { headers: { "User-Agent": "orion-motocine" } });
  const limpiar = (x: Partial<Falla>): Falla | null => (x && typeof x.id === "string" ? { id: x.id, nombre: String(x.nombre ?? x.id), explicacion: x.explicacion, pregunta: x.pregunta, solucion: x.solucion } : null);
  try {
    const res = await crudo("catalogo/indice.json");
    if (res.ok) return ((await res.json()) as Partial<Falla>[]).map(limpiar).filter((f): f is Falla => !!f);
  } catch (error) {
    console.error("indice", error);
  }
  // Si el índice todavía no existe en el repositorio, se leen las fichas una por una.
  const archivos = await gh<{ name: string }[]>(env, `${repo(env)}/contents/catalogo/fallas?ref=main`).catch(() => [] as { name: string }[]);
  const fichas = await Promise.all(
    archivos
      .filter((a) => a.name.endsWith(".json"))
      .slice(0, 30)
      .map(async (a) => {
        const r = await crudo(`catalogo/fallas/${encodeURIComponent(a.name)}`).catch(() => null);
        return r?.ok ? limpiar((await r.json()) as Partial<Falla>) : null;
      }),
  );
  const lista = fichas.filter((f): f is Falla => !!f);
  if (!lista.length) throw new Aviso("No pude leer la lista de fallas. Intenta en un momento.", 502);
  return lista;
}

/* ------------------------------------------------------------- pedidos */

async function listarPedidos(env: Env): Promise<PedidoCorto[]> {
  const [issues, recientes, runs] = await Promise.all([
    gh<Issue[]>(env, `${repo(env)}/issues?state=all&per_page=30&sort=created&direction=desc`),
    // Los 100 comentarios más nuevos de TODO el repositorio en una sola consulta.
    gh<ComentarioGh[]>(env, `${repo(env)}/issues/comments?sort=created&direction=desc&per_page=100`),
    corridas(env, 20),
  ]);
  const pedidos = issues.filter((i) => !i.pull_request && esPedido(i.title));
  const porIssue = new Map<number, Comentario[]>();
  for (const c of recientes) {
    const n = Number(c.issue_url.split("/").pop());
    porIssue.set(n, [...(porIssue.get(n) ?? []), c]);
  }
  // Pedidos viejos cuyos comentarios no cayeron en los 100 recientes: se piden aparte (pocos).
  const faltan = pedidos.filter((i) => i.comments > 0 && !porIssue.has(i.number)).slice(0, 8);
  await Promise.all(faltan.map(async (i) => porIssue.set(i.number, await comentariosDe(env, i.number).catch(() => []))));
  return pedidos.map((issue) => {
    const comentarios = [...(porIssue.get(issue.number) ?? [])].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    return armarCorto(issue, comentarios, runs, null, env).corto;
  });
}

async function crearPedido(request: Request, url: URL, env: Env, ctx: ExecutionContext): Promise<{ numero: number }> {
  const r = validarPedido(await request.json().catch(() => null));
  if ("error" in r) throw new Aviso(r.error);
  // La falla tiene que existir en el catálogo (si no, el robot fallaría).
  const fallas = await catalogo(env, ctx).catch(() => null);
  if (fallas && !fallas.some((f) => f.id === r.pedido.falla)) throw new Aviso("Esa falla no está en el catálogo. Elige otra.");
  // Archivos: tienen que estar de verdad en el almacenamiento; van al pedido como enlaces firmados.
  const urls: string[] = [];
  if (r.pedido.archivos.length) {
    const bucket = almacen(env);
    for (const clave of r.pedido.archivos) {
      if (!(await bucket.head(clave))) throw new Aviso("Uno de los archivos ya no está. Quítalo y súbelo otra vez.");
      urls.push(await urlArchivo(url.origin, clave, env.APP_PIN!));
    }
  }
  const issue = await gh<Issue>(env, `${repo(env)}/issues`, { method: "POST", body: JSON.stringify({ title: tituloPedido(r.pedido), body: cuerpoPedido(r.pedido, urls) }) });
  return { numero: issue.number };
}

async function issuePedido(env: Env, n: number): Promise<Issue> {
  const issue = await gh<Issue>(env, `${repo(env)}/issues/${n}`);
  if (issue.pull_request || !esPedido(issue.title)) throw new Aviso("No encontré ese video.", 404);
  return issue;
}

async function detallePedido(n: number, env: Env): Promise<PedidoDetalle> {
  const [issue, comentarios, runs] = await Promise.all([issuePedido(env, n), comentariosDe(env, n), corridas(env, 10)]);
  const previo = armarCorto(issue, comentarios, runs, null, env);
  // Los pasos de la corrida solo hacen falta mientras se arma.
  let pasosRun: PasoRun[] | null = null;
  if (previo.corrida && previo.corrida.status !== "completed" && previo.resuelto.estado === "armando") {
    try {
      const r = await gh<{ jobs: { steps?: PasoRun[] }[] }>(env, `${repo(env)}/actions/runs/${previo.corrida.id}/jobs`);
      pasosRun = r?.jobs?.[0]?.steps ?? null;
    } catch (error) {
      console.error("pasos", error);
    }
  }
  const { corto, datos, marca, resuelto, listo } = pasosRun ? armarCorto(issue, comentarios, runs, pasosRun, env) : previo;
  const final = marca && marca.estado !== "armando" && resuelto.estado !== "armando" ? marca.comentario : null;
  const resumen = final ? leerResumen(final.body) : null;
  if (resumen && resuelto.motivoExtra) resumen.motivos.push(resuelto.motivoExtra);
  const videoPublico = listo ? urlVideo(listo.body, env.REPO) : null;
  return {
    ...corto,
    escenario: datos.escenario || "Taller",
    letra: datos.letra || "Aleatoria",
    pasos: resuelto.pasos,
    video: corto.estado === "listo" && videoPublico ? `/api/pedidos/${n}/video` : null,
    videoPublico: corto.estado === "listo" ? videoPublico : null,
    resumen: resumen ?? (resuelto.motivoExtra ? { viralidad: null, guion: null, notas: [], motivos: [resuelto.motivoExtra], voz: [] } : null),
    enlaceGithub: issue.html_url,
  };
}

async function rehacer(n: number, env: Env): Promise<{ ok: true }> {
  await issuePedido(env, n);
  await gh(env, `${repo(env)}/actions/workflows/${WORKFLOW}/dispatches`, { method: "POST", body: JSON.stringify({ ref: "main", inputs: { issue: String(n) } }) });
  // Queda escrito en el pedido: así la app sabe que se está rehaciendo desde ya.
  await gh(env, `${repo(env)}/issues/${n}/comments`, { method: "POST", body: JSON.stringify({ body: `${MARCA_REHACER} Lo pediste desde la app.` }) }).catch((e) => console.error("marca rehacer", e));
  return { ok: true };
}

/* ------------------------------------------------------------- archivos */

/** Último comentario ✅ con su video (solo enlaces de ESTE repositorio). */
async function comentarioListo(n: number, env: Env): Promise<string> {
  const comentarios = await comentariosDe(env, n);
  const listo = [...comentarios].reverse().find((c) => urlVideo(c.body, env.REPO));
  if (!listo) throw new Aviso("Ese video todavía no está listo.", 404);
  return listo.body;
}

async function video(n: number, request: Request, url: URL, env: Env): Promise<Response> {
  const enlace = urlVideo(await comentarioListo(n, env), env.REPO)!;
  const rango = request.headers.get("Range");
  // El repositorio es público: el video se baja sin token (nunca mandarlo a otro sitio).
  const res = await fetch(enlace, { method: request.method, headers: { "User-Agent": "orion-motocine", ...(rango ? { Range: rango } : {}) }, redirect: "follow" }).catch(() => null);
  if (!res || (!res.ok && res.status !== 206)) {
    if (res?.status === 416) return new Response(null, { status: 416, headers: { "Content-Range": res.headers.get("Content-Range") ?? "" } });
    throw new Aviso("No pude traer el video de GitHub. Intenta en un momento.", 502);
  }
  const headers = new Headers({ "Content-Type": "video/mp4", "Cache-Control": "private, max-age=3600", "Accept-Ranges": res.headers.get("Accept-Ranges") ?? "bytes" });
  for (const h of ["Content-Length", "Content-Range", "ETag", "Last-Modified"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (url.searchParams.has("descargar")) headers.set("Content-Disposition", `attachment; filename="video-${n}.mp4"`);
  return new Response(res.body, { status: res.status, headers });
}

async function hoja(n: number, env: Env, ctx: ExecutionContext): Promise<Response> {
  const enlace = urlHoja(await comentarioListo(n, env), env.REPO);
  if (!enlace) throw new Aviso("Ese video no tiene hoja de cuadros.", 404);
  const clave = new Request(`${CACHE_BASE}/hoja/${encodeURIComponent(enlace)}`);
  const guardada = await caches.default.match(clave);
  if (guardada) return new Response(guardada.body, { headers: { "Content-Type": guardada.headers.get("Content-Type") ?? "image/jpeg", "Cache-Control": "private, max-age=86400" } });
  const res = await fetch(enlace, { headers: { "User-Agent": "orion-motocine" }, redirect: "follow" }).catch(() => null);
  if (!res?.ok) throw new Aviso("No pude traer la imagen.", 502);
  const cuerpo = await res.arrayBuffer();
  const tipo = res.headers.get("Content-Type") ?? "image/jpeg";
  // En la caché del Worker se guarda como "public" (si no, Cloudflare no la guarda);
  // al navegador va como "private" (solo para quien entró con el PIN).
  ctx.waitUntil(caches.default.put(clave, new Response(cuerpo, { headers: { "Content-Type": tipo, "Cache-Control": "public, max-age=86400" } })));
  return new Response(cuerpo, { headers: { "Content-Type": tipo, "Cache-Control": "private, max-age=86400" } });
}

/* ------------------------------------------------------------- fotos y videos (R2) */

function almacen(env: Env): R2Bucket {
  if (!env.ARCHIVOS) throw new Aviso("Falta activar el almacenamiento de archivos en Cloudflare.", 503);
  return env.ARCHIVOS;
}

/** Sube UN archivo. Dos formas:
 * - el archivo tal cual en el cuerpo (?nombre=foto.jpg + Content-Type del
 *   archivo): pasa directo a R2 sin guardarse en memoria (la que usa la app,
 *   sirve para videos grandes);
 * - multipart/form-data con el campo "archivo" (para archivos chicos). */
async function subirArchivo(request: Request, url: URL, env: Env) {
  const bucket = almacen(env);
  const tipoPedido = request.headers.get("Content-Type") ?? "";
  const largo = Number(request.headers.get("Content-Length") ?? "0");
  if (largo > MAX_BYTES + 64 * 1024) throw new Aviso("Ese archivo pesa más de 100 MB. Recórtalo o súbelo más liviano.", 413);
  let nombre: string;
  let tipo: string;
  let cuerpo: ReadableStream | Blob;
  let tamano: number;
  if (tipoPedido.includes("multipart/form-data")) {
    const datos = await request.formData().catch(() => null);
    const archivo = datos?.get("archivo");
    if (!archivo || typeof archivo === "string") throw new Aviso("No llegó ningún archivo.");
    nombre = archivo.name;
    tipo = archivo.type;
    cuerpo = archivo;
    tamano = archivo.size;
  } else {
    if (!request.body || !largo) throw new Aviso("No llegó ningún archivo.");
    nombre = url.searchParams.get("nombre") ?? "archivo";
    tipo = tipoPedido.split(";")[0].trim();
    cuerpo = request.body;
    tamano = largo;
  }
  if (!esFotoOVideo(tipo)) throw new Aviso("Solo se pueden subir fotos o videos.", 415);
  if (tamano > MAX_BYTES) throw new Aviso("Ese archivo pesa más de 100 MB. Recórtalo o súbelo más liviano.", 413);
  const clave = claveArchivo(nombre);
  await bucket.put(clave, cuerpo, { httpMetadata: { contentType: tipo }, customMetadata: { nombre: nombre.slice(0, 200) } });
  return { clave, nombre, tipo, tamano, url: `/api/archivos/${clave}` };
}

async function listarArchivos(env: Env) {
  const r = await almacen(env).list({ prefix: "subidas/", limit: 200, include: ["httpMetadata", "customMetadata"] });
  return r.objects
    .map((o) => ({ clave: o.key, nombre: o.customMetadata?.nombre ?? o.key.split("/").pop(), tipo: o.httpMetadata?.contentType ?? "", tamano: o.size, subido: o.uploaded.toISOString(), url: `/api/archivos/${o.key}` }))
    .sort((a, b) => b.subido.localeCompare(a.subido));
}

async function servirArchivo(clave: string, request: Request, env: Env): Promise<Response> {
  if (!claveValida(clave)) throw new Aviso("No encontré ese archivo.", 404);
  const bucket = almacen(env);
  const rango = request.headers.get("Range");
  const obj = request.method === "HEAD" ? await bucket.head(clave) : await bucket.get(clave, rango ? { range: request.headers } : {});
  if (!obj) throw new Aviso("No encontré ese archivo.", 404);
  const headers = new Headers({ "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400", ETag: obj.httpEtag });
  obj.writeHttpMetadata(headers);
  if (!headers.get("Content-Type")) headers.set("Content-Type", "application/octet-stream");
  const r = "body" in obj && rango ? obj.range : undefined;
  // R2 devuelve el rango como {offset, length} o, para "bytes=-N", como {suffix}.
  const parte = r ? ("suffix" in r ? { offset: Math.max(0, obj.size - r.suffix), length: Math.min(r.suffix, obj.size) } : { offset: r.offset ?? 0, length: r.length }) : null;
  if (parte) {
    const inicio = parte.offset;
    const largo = parte.length ?? obj.size - inicio;
    headers.set("Content-Range", `bytes ${inicio}-${inicio + largo - 1}/${obj.size}`);
    headers.set("Content-Length", String(largo));
    return new Response((obj as R2ObjectBody).body, { status: 206, headers });
  }
  headers.set("Content-Length", String(obj.size));
  return new Response("body" in obj ? (obj as R2ObjectBody).body : null, { headers });
}

/* ------------------------------------------------------------- utilidades */

function json(datos: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(datos), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });
}
