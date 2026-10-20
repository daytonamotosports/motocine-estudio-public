// Los 5 pasos que ve el dueño en el Detalle, sacados de lo que dice GitHub:
// el último comentario del robot (comentarios.ts) y, mientras se arma, la
// corrida del workflow estudio.yml y sus pasos ("Instalar programas",
// "Armar el video", "Entregar"...). Si GitHub no da la corrida (todavía en
// cola, o falló la consulta), igual se muestra algo sensato con lo que
// digan los comentarios: nunca una pantalla vacía.
import type { Estado, Paso } from "./tipos.ts";

export const TITULOS: Record<Paso["id"], string> = {
  recibido: "Pedido recibido",
  guion: "Guion y voz",
  revision: "Revisión de calidad",
  armando: "Armando el video",
  listo: "Listo",
};
const ORDEN: Paso["id"][] = ["recibido", "guion", "revision", "armando", "listo"];

export interface PasoRun {
  name: string;
  status: string; // queued | in_progress | completed
  conclusion?: string | null;
  started_at?: string | null;
}

export interface Corrida {
  id: number;
  event: string;
  status: string; // queued | in_progress | completed | waiting...
  conclusion?: string | null;
  display_title: string;
  created_at: string;
  html_url?: string;
}

/** Cuánto suele tardar un video (minutos), para el "≈ N min". */
export const DURACION_TIPICA_MIN = 20;

/** Dentro de "Armar el video" pasan 3 cosas seguidas (guion+voz, revisión,
 * render). GitHub solo dice que el paso está corriendo, así que se estima
 * por el tiempo que lleva: es un aviso aproximado, no exacto. */
const GUION_HASTA_MIN = 3;
const REVISION_HASTA_MIN = 5;

/** Paso en curso (0..4) según la corrida y sus pasos. */
export function pasoActivo(corrida: Corrida | null, pasos: PasoRun[] | null, ahora = Date.now()): number {
  if (!corrida || corrida.status !== "in_progress" || !pasos?.length) {
    // En cola o sin datos todavía: el pedido ya llegó, lo siguiente es el guion.
    return corrida?.status === "completed" ? 4 : 1;
  }
  const corriendo = pasos.find((p) => p.status === "in_progress") ?? pasos.find((p) => p.status !== "completed");
  if (!corriendo) return 4;
  const nombre = corriendo.name.toLowerCase();
  if (nombre.includes("entregar")) return 4;
  if (nombre.includes("armar")) {
    const min = corriendo.started_at ? (ahora - Date.parse(corriendo.started_at)) / 60000 : 0;
    if (min < GUION_HASTA_MIN) return 1;
    if (min < REVISION_HASTA_MIN) return 2;
    return 3;
  }
  // "Instalar programas", "Avisar que empezó", "Leer el pedido"... = preparándose.
  return 1;
}

/** En qué paso se quedó un video que no salió (según los motivos). */
export function pasoDelProblema(textoMotivos: string): number {
  const t = textoMotivos.toLowerCase();
  if (/no llega a 85|viralidad|no armé el video/.test(t)) return 2;
  if (/armado falló|render/.test(t)) return 3;
  if (/falla|no existe|desconocid|formato/.test(t)) return 1;
  return 3;
}

/** Arma la lista de 5 pasos para la pantalla. */
export function construirPasos(estado: Estado, opciones: { activo?: number; problemaEn?: number } = {}): Paso[] {
  return ORDEN.map((id, i) => {
    let e: Paso["estado"] = "pendiente";
    if (estado === "listo") e = "hecho";
    else if (estado === "problema") {
      const en = opciones.problemaEn ?? 3;
      e = i < en ? "hecho" : i === en ? "error" : "pendiente";
    } else {
      const activo = opciones.activo ?? 1;
      e = i < activo ? "hecho" : i === activo ? "activo" : "pendiente";
    }
    return { id, titulo: TITULOS[id], estado: e };
  });
}

/** La corrida del workflow que corresponde a este pedido:
 * - abierta por el issue: su título es el del issue (o trae "#N" si el
 *   workflow tiene run-name con el número);
 * - "Volver a intentar" (workflow_dispatch): no dice de qué issue es, así
 *   que se toma la que arrancó poco después del comentario 🔁 de la app.
 * Siempre la más nueva que cumpla. */
export function elegirCorrida(corridas: Corrida[], issue: { numero: number; titulo: string; creado: string }, rehacerDesde?: string | null): Corrida | null {
  const creado = Date.parse(issue.creado) - 60_000;
  const rehacer = rehacerDesde ? Date.parse(rehacerDesde) : NaN;
  const marcaNumero = new RegExp(`#${issue.numero}(?!\\d)`);
  const sirve = (c: Corrida) => {
    const t = Date.parse(c.created_at);
    if (t < creado) return false;
    if (marcaNumero.test(c.display_title)) return true;
    if (c.event === "issues") return c.display_title.trim() === issue.titulo.trim();
    if (c.event === "workflow_dispatch" && !Number.isNaN(rehacer)) return t >= rehacer - 30_000 && t <= rehacer + 10 * 60_000;
    return false;
  };
  return [...corridas].filter(sirve).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
}

/** Junta todo: estado final + pasos para la pantalla.
 * - Comentario ✅ o ⚠️ más nuevo que la corrida → manda el comentario.
 * - Corrida en marcha más nueva que el último comentario (ej. acaban de
 *   pedir "Volver a intentar") → se está armando.
 * - Corrida terminada con error y sin comentario final → con problema
 *   (el robot se cayó antes de poder avisar). */
export function resolverEstado(entrada: {
  marcador: { estado: Estado; creado: string; motivos?: string } | null;
  corrida: Corrida | null;
  pasosRun: PasoRun[] | null;
  ahora?: number;
}): { estado: Estado; pasos: Paso[]; motivoExtra: string | null } {
  const { marcador, corrida, pasosRun } = entrada;
  const ahora = entrada.ahora ?? Date.now();
  const tMarca = marcador ? Date.parse(marcador.creado) : 0;
  const tCorrida = corrida ? Date.parse(corrida.created_at) : 0;
  const corridaNueva = corrida && tCorrida > tMarca + 5_000;
  const final = marcador && marcador.estado !== "armando" && !corridaNueva;
  if (final && marcador.estado === "listo") return { estado: "listo", pasos: construirPasos("listo"), motivoExtra: null };
  if (final && marcador.estado === "problema") {
    return { estado: "problema", pasos: construirPasos("problema", { problemaEn: pasoDelProblema(marcador.motivos ?? "") }), motivoExtra: null };
  }
  if (corrida?.status === "completed" && corrida.conclusion && !["success", "skipped"].includes(corrida.conclusion)) {
    // "Entregar" corre siempre (if: always()); si ni así llegó el comentario, se cayó antes.
    const minutosSinAviso = (ahora - Date.parse(corrida.created_at)) / 60000;
    if (corrida.conclusion === "cancelled" || minutosSinAviso > 2) {
      return { estado: "problema", pasos: construirPasos("problema", { problemaEn: 1 }), motivoExtra: corrida.conclusion === "cancelled" ? "Se canceló el armado." : "El robot se detuvo antes de terminar." };
    }
  }
  return { estado: "armando", pasos: construirPasos("armando", { activo: pasoActivo(corrida, pasosRun, ahora) }), motivoExtra: null };
}

/** Minutos que faltan (aprox.), nunca menos de 1. */
export function minutosRestantes(desde: string, ahora = Date.now()): number {
  const pasados = (ahora - Date.parse(desde)) / 60000;
  return Math.max(1, Math.round(DURACION_TIPICA_MIN - (Number.isFinite(pasados) ? pasados : 0)));
}

/** "hace 5 min", "hace 2 h", "ayer"... */
export function minutosDesde(desde: string, ahora = Date.now()): number {
  const t = Date.parse(desde);
  return Number.isFinite(t) ? Math.max(0, Math.floor((ahora - t) / 60000)) : 0;
}
