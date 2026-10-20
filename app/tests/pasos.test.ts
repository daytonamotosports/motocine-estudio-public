// Pruebas de los 5 pasos del Detalle y de cómo se encuentra la corrida.
import { test } from "node:test";
import assert from "node:assert/strict";
import { construirPasos, elegirCorrida, minutosRestantes, pasoActivo, pasoDelProblema, resolverEstado, type Corrida } from "../src/lib/logic/pasos.ts";

const T0 = Date.parse("2026-10-20T10:00:00Z");
const min = (m: number) => new Date(T0 + m * 60000).toISOString();
const estados = (p: ReturnType<typeof construirPasos>) => p.map((x) => x.estado).join(",");
const corrida = (extra: Partial<Corrida> = {}): Corrida => ({ id: 1, event: "issues", status: "in_progress", display_title: "Video: balancines", created_at: min(0), ...extra });

test("pasos por estado", () => {
  assert.equal(estados(construirPasos("listo")), "hecho,hecho,hecho,hecho,hecho");
  assert.equal(estados(construirPasos("armando", { activo: 3 })), "hecho,hecho,hecho,activo,pendiente");
  assert.equal(estados(construirPasos("problema", { problemaEn: 2 })), "hecho,hecho,error,pendiente,pendiente");
});

test("paso en curso según los pasos del workflow", () => {
  assert.equal(pasoActivo(null, null), 1);
  assert.equal(pasoActivo(corrida({ status: "queued" }), null), 1);
  const pasos = (nombre: string, inicio = min(0)) => [
    { name: "Instalar programas", status: nombre === "Instalar programas" ? "in_progress" : "completed", started_at: min(0) },
    { name: "Armar el video", status: nombre === "Armar el video" ? "in_progress" : nombre === "Entregar" ? "completed" : "queued", started_at: inicio },
    { name: "Entregar", status: nombre === "Entregar" ? "in_progress" : "queued" },
  ];
  assert.equal(pasoActivo(corrida(), pasos("Instalar programas")), 1);
  assert.equal(pasoActivo(corrida(), pasos("Armar el video", min(0)), T0 + 60000), 1);
  assert.equal(pasoActivo(corrida(), pasos("Armar el video", min(0)), T0 + 4 * 60000), 2);
  assert.equal(pasoActivo(corrida(), pasos("Armar el video", min(0)), T0 + 12 * 60000), 3);
  assert.equal(pasoActivo(corrida(), pasos("Entregar")), 4);
  assert.equal(pasoActivo(corrida({ status: "completed" }), null), 4);
});

test("en qué paso falló", () => {
  assert.equal(pasoDelProblema("❌ No armé el video: el guion no llega a 85/100."), 2);
  assert.equal(pasoDelProblema("❌ El armado falló. Últimas líneas:"), 3);
  assert.equal(pasoDelProblema("❌ No existe la falla 'frenos'"), 1);
});

test("elige la corrida del pedido", () => {
  const issue = { numero: 12, titulo: "Video: balancines", creado: min(0) };
  const otra = corrida({ id: 2, display_title: "Video: cadena", created_at: min(1) });
  const vieja = corrida({ id: 3, created_at: min(-30) });
  const buena = corrida({ id: 4, created_at: min(0.2) });
  assert.equal(elegirCorrida([otra, vieja, buena], issue)?.id, 4);
  const conNumero = corrida({ id: 5, event: "workflow_dispatch", display_title: "Video #12", created_at: min(40) });
  assert.equal(elegirCorrida([buena, conNumero], issue)?.id, 5);
  const rehecha = corrida({ id: 6, event: "workflow_dispatch", display_title: "Estudio MotoCine", created_at: min(60) });
  assert.equal(elegirCorrida([buena, rehecha], issue)?.id, 4, "sin 🔁 no se sabe de quién es");
  assert.equal(elegirCorrida([buena, rehecha], issue, min(59.9))?.id, 6);
});

test("resolverEstado: comentario final, rehacer y caída del robot", () => {
  const listo = { estado: "listo" as const, creado: min(20) };
  assert.equal(resolverEstado({ marcador: listo, corrida: corrida({ status: "completed", conclusion: "success" }), pasosRun: null }).estado, "listo");
  // Rehacer: hay corrida nueva después del ✅ → se está armando otra vez.
  const r = resolverEstado({ marcador: listo, corrida: corrida({ created_at: min(30) }), pasosRun: null, ahora: T0 + 31 * 60000 });
  assert.equal(r.estado, "armando");
  assert.equal(r.pasos[1].estado, "activo");
  // El robot se cayó y nunca comentó.
  const caida = resolverEstado({ marcador: { estado: "armando", creado: min(1) }, corrida: corrida({ status: "completed", conclusion: "failure" }), pasosRun: null, ahora: T0 + 30 * 60000 });
  assert.equal(caida.estado, "problema");
  assert.ok(caida.motivoExtra);
  // Problema por viralidad: se marca la revisión.
  const prob = resolverEstado({ marcador: { estado: "problema", creado: min(5), motivos: "no llega a 85/100" }, corrida: null, pasosRun: null });
  assert.equal(estados(prob.pasos), "hecho,hecho,error,pendiente,pendiente");
  // Recién creado, sin nada: pedido recibido y guion en curso.
  assert.equal(estados(resolverEstado({ marcador: null, corrida: null, pasosRun: null }).pasos), "hecho,activo,pendiente,pendiente,pendiente");
});

test("minutos que faltan", () => {
  assert.equal(minutosRestantes(min(0), T0 + 5 * 60000), 15);
  assert.equal(minutosRestantes(min(0), T0 + 60 * 60000), 1);
});
