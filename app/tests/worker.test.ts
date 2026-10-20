// Prueba de punta a punta del Worker con un GitHub de mentiras
// (scripts/github-falso.mjs): PIN, galleta, lista, detalle, crear pedido
// (con el cuerpo exacto del formulario), video con rangos y rehacer.
import { test, before } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error -- módulo .mjs sin tipos (solo para pruebas)
import { cacheFalsa, crearGithubFalso, r2Falso, REPO } from "../scripts/github-falso.mjs";
import worker from "../worker/index.ts";

const r2 = r2Falso();
const env = { REPO, GITHUB_TOKEN: "token-de-prueba", APP_PIN: "2468", ASSETS: { fetch: async () => new Response("app") }, ARCHIVOS: r2 };
const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
let gh: ReturnType<typeof crearGithubFalso>;
let galleta = "";

const pedir = (ruta: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://motocine.test${ruta}`, { ...init, headers: { ...(galleta ? { Cookie: galleta } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers as object) } }) as any, env as any, ctx as any);

before(async () => {
  gh = crearGithubFalso();
  globalThis.fetch = gh.fetch;
  (globalThis as unknown as { caches: unknown }).caches = cacheFalsa();
});

test("sin sesión: 401 en la API, la app sí carga", async () => {
  assert.equal((await pedir("/api/pedidos")).status, 401);
  assert.equal(await (await pedir("/")).text(), "app");
});

test("PIN equivocado y PIN correcto", async () => {
  const mal = await pedir("/api/login", { method: "POST", body: JSON.stringify({ pin: "1111" }) });
  assert.equal(mal.status, 401);
  assert.match((await mal.json()).error, /PIN/);
  const bien = await pedir("/api/login", { method: "POST", body: JSON.stringify({ pin: "2468" }) });
  assert.equal(bien.status, 200);
  const cookie = bien.headers.get("Set-Cookie") ?? "";
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  galleta = cookie.split(";")[0];
  assert.equal((await pedir("/api/sesion")).status, 200);
});

test("lista de pedidos: solo videos, más nuevos primero, con su estado", async () => {
  const lista = await (await pedir("/api/pedidos")).json();
  assert.deepEqual(lista.map((p: { numero: number; estado: string }) => [p.numero, p.estado]), [
    [15, "armando"],
    [14, "listo"],
    [12, "problema"],
  ]);
  assert.equal(lista[1].hoja, "/api/pedidos/14/hoja");
  assert.equal(lista[1].nombre, "balancines-octubre");
});

test("detalle listo: video, notas y pasos", async () => {
  const d = await (await pedir("/api/pedidos/14")).json();
  assert.equal(d.estado, "listo");
  assert.equal(d.video, "/api/pedidos/14/video");
  assert.match(d.videoPublico, /releases\/download\/video-14-7\/video\.mp4$/);
  assert.equal(d.resumen.viralidad, 94);
  assert.ok(d.pasos.every((p: { estado: string }) => p.estado === "hecho"));
  assert.equal(d.escenario, "Taller");
  assert.equal(d.letra, "A");
});

test("detalle armando: paso en curso según la corrida", async () => {
  const d = await (await pedir("/api/pedidos/15")).json();
  assert.equal(d.estado, "armando");
  assert.equal(d.pasos.find((p: { estado: string }) => p.estado === "activo").id, "armando");
  assert.equal(d.video, null);
});

test("detalle con problema: motivos", async () => {
  const d = await (await pedir("/api/pedidos/12")).json();
  assert.equal(d.estado, "problema");
  assert.ok(d.resumen.motivos.some((m: string) => /85\/100/.test(m)));
  assert.equal(d.pasos.find((p: { estado: string }) => p.estado === "error").id, "revision");
});

test("un issue que no es video no se muestra", async () => {
  assert.equal((await pedir("/api/pedidos/13")).status, 404);
});

test("video: completo, por rangos y para descargar", async () => {
  const entero = await pedir("/api/pedidos/14/video");
  if (entero.status === 502) return; // sin video de muestra en este equipo
  assert.equal(entero.status, 200);
  assert.equal(entero.headers.get("Content-Type"), "video/mp4");
  await entero.body?.cancel();
  const parte = await pedir("/api/pedidos/14/video", { headers: { Range: "bytes=0-99" } });
  assert.equal(parte.status, 206);
  assert.equal((await parte.arrayBuffer()).byteLength, 100);
  assert.match(parte.headers.get("Content-Range") ?? "", /^bytes 0-99\/\d+$/);
  const bajar = await pedir("/api/pedidos/14/video?descargar=1", { method: "HEAD" });
  assert.match(bajar.headers.get("Content-Disposition") ?? "", /attachment/);
  // El video se baja SIN el token (nunca se manda a otro sitio).
  assert.ok(gh.registro.filter((r: { url: string }) => r.url.includes("/releases/download/")).every((r: { auth: string | null }) => !r.auth));
  assert.equal((await pedir("/api/pedidos/15/video")).status, 404);
});

test("crear pedido: cuerpo exacto del formulario", async () => {
  const mal = await pedir("/api/pedidos", { method: "POST", body: JSON.stringify({ falla: "no-existe" }) });
  assert.equal(mal.status, 400);
  const res = await pedir("/api/pedidos", { method: "POST", body: JSON.stringify({ falla: "cadena", escenario: "Taller", letra: "C", nombre: "" }) });
  assert.equal(res.status, 201);
  const { numero } = await res.json();
  const creado = gh.issues.find((i: { number: number }) => i.number === numero);
  assert.equal(creado.title, "Video: cadena");
  assert.equal(creado.body, "### Formato\n\nAdivina la falla por el sonido\n\n### Falla\n\ncadena\n\n### Escenario\n\nTaller\n\n### Letra correcta\n\nC\n\n### Nombre del video (opcional)\n\n_No response_");
  const d = await (await pedir(`/api/pedidos/${numero}`)).json();
  assert.equal(d.estado, "armando");
  assert.equal(d.pasos[1].estado, "activo");
});

test("POST sin JSON se rechaza (protección contra formularios de otros sitios)", async () => {
  const r = await worker.fetch(new Request("https://motocine.test/api/pedidos/14/rehacer", { method: "POST", headers: { Cookie: galleta, "Content-Type": "application/x-www-form-urlencoded" }, body: "a=1" }) as never, env as never, ctx as never);
  assert.equal(r.status, 415);
});

test("rehacer: lanza el workflow con el número y vuelve a 'armando'", async () => {
  const r = await pedir("/api/pedidos/14/rehacer", { method: "POST", body: "{}" });
  assert.equal(r.status, 200);
  const disparo = gh.registro.find((x: { url: string }) => x.url.endsWith("/dispatches"));
  assert.deepEqual(JSON.parse(disparo.cuerpo), { ref: "main", inputs: { issue: "14" } });
  const d = await (await pedir("/api/pedidos/14")).json();
  assert.equal(d.estado, "armando");
});

test("token malo: mensaje claro, sin detalles técnicos", async () => {
  const r = await worker.fetch(new Request("https://motocine.test/api/pedidos", { headers: { Cookie: galleta } }) as never, { ...env, GITHUB_TOKEN: "otro" } as never, ctx as never);
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /token/);
});

test("subir foto, listarla, bajarla con la galleta o con su firma, y pedido con Archivos", async () => {
  const foto = new Uint8Array(3000).map((_, i) => i % 251);
  const subida = await pedir("/api/archivos?nombre=Foto%20Moto.JPG", { method: "POST", body: foto, headers: { "Content-Type": "image/jpeg", "Content-Length": "3000" } });
  assert.equal(subida.status, 201);
  const { clave, url } = await subida.json();
  assert.match(clave, /^subidas\/\d{8}-\d{6}-[a-z0-9]{4}-foto-moto\.jpg$/);
  const lista = await (await pedir("/api/archivos")).json();
  assert.equal(lista[0].clave, clave);
  // Con la galleta, por partes:
  const parte = await pedir(url, { headers: { Range: "bytes=10-19" } });
  assert.equal(parte.status, 206);
  assert.equal(parte.headers.get("Content-Range"), "bytes 10-19/3000");
  assert.deepEqual([...new Uint8Array(await parte.arrayBuffer())], [...foto.subarray(10, 20)]);
  const final = await pedir(url, { headers: { Range: "bytes=-5" } });
  assert.equal(final.headers.get("Content-Range"), "bytes 2995-2999/3000");
  // Crear el pedido: el cuerpo lleva el enlace firmado.
  const res = await pedir("/api/pedidos", { method: "POST", body: JSON.stringify({ falla: "cadena", archivos: [clave] }) });
  assert.equal(res.status, 201);
  const { numero } = await res.json();
  const cuerpo: string = gh.issues.find((i: { number: number }) => i.number === numero).body;
  const enlace = /### Archivos\n\n(\S+)$/.exec(cuerpo)?.[1] ?? "";
  assert.ok(enlace.startsWith(`https://motocine.test/api/archivos/${clave}?t=`));
  // El robot baja el archivo SIN galleta, solo con la firma:
  const sinGalleta = (ruta: string) => worker.fetch(new Request(ruta) as never, env as never, ctx as never);
  const robot = await sinGalleta(enlace);
  assert.equal(robot.status, 200);
  assert.equal(robot.headers.get("Content-Type"), "image/jpeg");
  assert.equal((await robot.arrayBuffer()).byteLength, 3000);
  assert.equal((await sinGalleta(enlace.replace(/t=./, "t=0"))).status, 401, "firma mala");
  assert.equal((await sinGalleta(`https://motocine.test${url}`)).status, 401, "sin firma ni galleta");
  assert.equal((await sinGalleta(`https://motocine.test/api/archivos?t=${enlace.split("t=")[1]}`)).status, 401, "la firma no abre la lista");
});

test("subidas: solo fotos o videos, y archivos que no existen", async () => {
  const txt = await pedir("/api/archivos?nombre=a.txt", { method: "POST", body: "hola", headers: { "Content-Type": "text/plain", "Content-Length": "4" } });
  assert.equal(txt.status, 415);
  const grande = await pedir("/api/archivos?nombre=v.mp4", { method: "POST", body: "x", headers: { "Content-Type": "video/mp4", "Content-Length": String(200 * 1024 * 1024) } });
  assert.equal(grande.status, 413);
  const fantasma = await pedir("/api/pedidos", { method: "POST", body: JSON.stringify({ falla: "cadena", archivos: ["subidas/20261020-112455-k3x9-no-existe.jpg"] }) });
  assert.equal(fantasma.status, 400);
});

test("sin R2 activado: aviso claro, lo demás sigue funcionando", async () => {
  const sinR2 = { ...env, ARCHIVOS: undefined };
  const r = await worker.fetch(new Request("https://motocine.test/api/archivos", { headers: { Cookie: galleta } }) as never, sinR2 as never, ctx as never);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "Falta activar el almacenamiento de archivos en Cloudflare.");
  const lista = await worker.fetch(new Request("https://motocine.test/api/pedidos", { headers: { Cookie: galleta } }) as never, sinR2 as never, ctx as never);
  assert.equal(lista.status, 200);
});
