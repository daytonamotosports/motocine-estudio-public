// Lee los comentarios que deja el robot (estudio.yml) en el pedido:
//   "⏳ Empecé a armar tu video…"                → se está armando
//   "✅ **¡Tu video está listo!**" + enlaces      → listo
//   "⚠️ **No se pudo armar el video.**" + motivos → con problema
// y el que deja esta app al pedir "Volver a intentar":
//   "🔁 **Volviendo a armar el video.**"          → se está armando
// El ÚLTIMO de esos comentarios manda (un video rehecho vuelve a "armando").
import type { Estado, Nota, Resumen } from "./tipos.ts";

export interface Comentario {
  body: string;
  created_at: string;
}

export const MARCA_REHACER = "🔁 **Volviendo a armar el video.**";

/** Qué dice un comentario (o null si no es del robot). */
export function clasificar(cuerpo: string): Estado | null {
  const t = String(cuerpo ?? "").trim();
  if (/^✅/.test(t) || /tu video está listo/i.test(t)) return "listo";
  if (/^⚠️?/.test(t) || /no se pudo armar el video/i.test(t)) return "problema";
  if (/^⏳/.test(t) || /^🔁/.test(t) || /empecé a armar/i.test(t)) return "armando";
  return null;
}

/** El último comentario que cuenta (del robot o de "Volver a intentar"). */
export function ultimoMarcador<C extends Comentario>(comentarios: C[]): { comentario: C; estado: Estado } | null {
  for (let i = comentarios.length - 1; i >= 0; i--) {
    const estado = clasificar(comentarios[i].body);
    if (estado) return { comentario: comentarios[i], estado };
  }
  return null;
}

/** Enlace del video dentro del comentario ✅. Con `repo`, solo se acepta un
 * enlace de las publicaciones de ESE repositorio (el Worker lo descarga:
 * nunca debe seguir un enlace a cualquier otro sitio). */
export function urlVideo(cuerpo: string, repo?: string): string | null {
  const m = /\[Descargar el video\]\((https:\/\/[^)\s]+)\)/i.exec(cuerpo) ?? /\((https:\/\/github\.com\/[^)\s]+\/releases\/download\/[^)\s]+\.mp4)\)/i.exec(cuerpo);
  return m && esDeReleases(m[1], repo) ? m[1] : null;
}

/** Enlace de la hoja de cuadros (![cuadros](…/hoja.jpg)). */
export function urlHoja(cuerpo: string, repo?: string): string | null {
  const m = /!\[cuadros\]\((https:\/\/[^)\s]+)\)/i.exec(cuerpo);
  return m && esDeReleases(m[1], repo) ? m[1] : null;
}

export function esDeReleases(url: string, repo?: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.hostname !== "github.com") return false;
    if (!repo) return /\/releases\/download\//.test(u.pathname);
    return u.pathname.startsWith(`/${repo}/releases/download/`) && !u.pathname.includes("..");
  } catch {
    return false;
  }
}

/** Saca el resumen (viralidad, revisores, motivos) del comentario final. */
export function leerResumen(cuerpo: string): Resumen {
  const resumen: Resumen = { viralidad: null, guion: null, notas: [], motivos: [], voz: [] };
  let seccion: "" | "revisores" | "voz" = "";
  let enCodigo = false;
  for (const cruda of String(cuerpo ?? "").split(/\r?\n/)) {
    const linea = cruda.trim();
    if (linea.startsWith("```")) {
      enCodigo = !enCodigo;
      continue;
    }
    if (enCodigo || !linea) continue;
    const vir = /^\*\*Viralidad:\*\*\s*(\d{1,3})\s*\/\s*100/i.exec(linea);
    if (vir) {
      resumen.viralidad = Number(vir[1]);
      resumen.notas.push({ etiqueta: "Viralidad", valor: `${vir[1]}/100` });
      seccion = "";
      continue;
    }
    const guion = /^\*\*Guion:\*\*\s*(.+)$/i.exec(linea);
    if (guion) {
      resumen.guion = guion[1].trim();
      continue;
    }
    if (/^\*\*Revisores:\*\*/i.test(linea)) {
      seccion = "revisores";
      continue;
    }
    if (/^\*\*Voz/i.test(linea)) {
      seccion = "voz";
      continue;
    }
    if (/^❌/.test(linea)) {
      resumen.motivos.push(sinMarcas(linea.replace(/^❌\s*/, "")));
      continue;
    }
    const item = /^[-*]\s+(.+)$/.exec(linea);
    if (!item) continue;
    const texto = item[1].trim();
    if (/^⚠/.test(texto)) {
      resumen.motivos.push(sinMarcas(texto.replace(/^⚠️?\s*/, "")));
    } else if (seccion === "voz") {
      resumen.voz.push(sinMarcas(texto));
    } else if (seccion === "revisores" || /^(Vigilante|QA)\b/.test(texto)) {
      // "Vigilante de viralidad" repite la viralidad de arriba: se juntan en una fila.
      const nota = notaRevisor(texto);
      const igual = resumen.notas.find((n) => n.etiqueta === nota.etiqueta);
      if (igual) Object.assign(igual, { valor: nota.valor || igual.valor, detalle: nota.detalle ?? igual.detalle });
      else resumen.notas.push(nota);
    }
  }
  return resumen;
}

/** "Vigilante de sincronía: 88/100 · mecánico visible…" → Sincronía · 88/100. */
export function notaRevisor(texto: string): Nota {
  const limpio = sinMarcas(texto);
  const dosPuntos = limpio.indexOf(":");
  const quien = (dosPuntos > 0 ? limpio.slice(0, dosPuntos) : limpio).trim();
  const resto = dosPuntos > 0 ? limpio.slice(dosPuntos + 1).trim() : "";
  const puntaje = /(\d{1,3})\s*\/\s*100/.exec(resto);
  const partes = resto.split("·").map((s) => s.trim()).filter(Boolean);
  const valor = puntaje ? `${puntaje[1]}/100` : partes[0] ?? "";
  const detalle = (puntaje ? partes.filter((p) => !p.includes(puntaje[0])) : partes.slice(1)).join(" · ");
  return { etiqueta: nombreRevisor(quien), valor, detalle: detalle || undefined };
}

function nombreRevisor(quien: string): string {
  const q = quien.toLowerCase();
  if (q.startsWith("qa")) return "Calidad técnica";
  const de = /^vigilante de (.+)$/i.exec(quien);
  if (de) return de[1].charAt(0).toUpperCase() + de[1].slice(1);
  if (q.startsWith("vigilante")) return "Atención";
  return quien;
}

function sinMarcas(texto: string): string {
  return texto.replace(/\*\*/g, "").replace(/`/g, "").trim();
}
