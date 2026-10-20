// Pruebas del lector de comentarios del robot (estudio.yml).
import { test } from "node:test";
import assert from "node:assert/strict";
import { MARCA_REHACER, clasificar, leerResumen, notaRevisor, ultimoMarcador, urlHoja, urlVideo } from "../src/lib/logic/comentarios.ts";

const REPO = "daytonamotosports/motocine-estudio-public";
const URL = `https://github.com/${REPO}/releases/download/video-12-7`;
const LISTO = `✅ **¡Tu video está listo!**

🎬 [Descargar el video](${URL}/video.mp4)

![cuadros](${URL}/hoja.jpg)

**Pedido:** Adivina la falla por el sonido · balancines · Taller · letra A

**Guion:** ¿Qué falla tiene esta moto? Escucha bien...

**Viralidad:** 94/100
- ⚠ Gancho en 1 s (dato 1.4 s)

**Revisores:**
- Vigilante de viralidad: 94/100 · 15/16 reglas (references/viral.md)
- Vigilante balancines.mp4: puntaje 91/100 · gancho 88/100 · bajón 2
- Vigilante de diseño: 89/100 · imagen 90 (luz 0.52, color 0.61)
- Vigilante de sincronía: 96/100 · mecánico visible al hablar 82%
- QA balancines.mp4: 31.2 s · 1080x1920 · audio aac · -14.1 LUFS · 9.8 MB`;

const PROBLEMA = `⚠️ **No se pudo armar el video.**

**Pedido:** Adivina la falla por el sonido · frenos · Taller · letra aleatoria

**Viralidad:** 78/100
- ⚠ Pregunta en los primeros 2 s

❌ No armé el video: el guion no llega a 85/100. Ajusta el pedido o pide una falla distinta.
\`\`\`
- Vigilante esto está dentro del código y no cuenta
\`\`\``;

test("clasifica los comentarios del robot", () => {
  assert.equal(clasificar("⏳ Empecé a armar tu video (15–25 min). Te aviso aquí cuando esté."), "armando");
  assert.equal(clasificar(LISTO), "listo");
  assert.equal(clasificar(PROBLEMA), "problema");
  assert.equal(clasificar(`${MARCA_REHACER} Lo pediste desde la app.`), "armando");
  assert.equal(clasificar("Gracias, quedó muy bien"), null);
});

test("el último comentario que cuenta manda", () => {
  const c = [
    { body: "⏳ Empecé", created_at: "2026-10-20T10:00:00Z" },
    { body: LISTO, created_at: "2026-10-20T10:20:00Z" },
    { body: "qué bien", created_at: "2026-10-20T10:30:00Z" },
  ];
  assert.equal(ultimoMarcador(c)?.estado, "listo");
  c.push({ body: `${MARCA_REHACER}`, created_at: "2026-10-20T11:00:00Z" });
  assert.equal(ultimoMarcador(c)?.estado, "armando");
  assert.equal(ultimoMarcador([]), null);
});

test("saca el enlace del video y de la hoja", () => {
  assert.equal(urlVideo(LISTO, REPO), `${URL}/video.mp4`);
  assert.equal(urlHoja(LISTO, REPO), `${URL}/hoja.jpg`);
  assert.equal(urlVideo(PROBLEMA, REPO), null);
});

test("no acepta enlaces de otro repositorio ni de otro sitio", () => {
  assert.equal(urlVideo("[Descargar el video](https://evil.com/daytonamotosports/motocine-estudio-public/releases/download/x/video.mp4)", REPO), null);
  assert.equal(urlVideo("[Descargar el video](https://github.com/otro/repo/releases/download/x/video.mp4)", REPO), null);
  assert.equal(urlVideo(`[Descargar el video](https://github.com/${REPO}/releases/download/../../x/video.mp4)`, REPO), null);
});

test("lee el resumen: viralidad, revisores y avisos", () => {
  const r = leerResumen(LISTO);
  assert.equal(r.viralidad, 94);
  assert.match(r.guion ?? "", /^¿Qué falla/);
  assert.deepEqual(r.notas.map((n) => [n.etiqueta, n.valor]), [
    ["Viralidad", "94/100"],
    ["Atención", "91/100"],
    ["Diseño", "89/100"],
    ["Sincronía", "96/100"],
    ["Calidad técnica", "31.2 s"],
  ]);
  assert.deepEqual(r.motivos, ["Gancho en 1 s (dato 1.4 s)"]);
  assert.equal(r.notas[0].detalle, "15/16 reglas (references/viral.md)");
});

test("lee los motivos de un video con problema (sin lo que está en código)", () => {
  const r = leerResumen(PROBLEMA);
  assert.equal(r.viralidad, 78);
  assert.deepEqual(r.motivos, ["Pregunta en los primeros 2 s", "No armé el video: el guion no llega a 85/100. Ajusta el pedido o pide una falla distinta."]);
  assert.equal(r.notas.length, 1);
});

test("nota de un revisor", () => {
  assert.deepEqual(notaRevisor("Vigilante de sincronía: 88/100 · mecánico visible al hablar 80%"), { etiqueta: "Sincronía", valor: "88/100", detalle: "mecánico visible al hablar 80%" });
});
