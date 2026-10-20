// El pedido de video = un issue en el repositorio público
// motocine-estudio-public. El robot (workflow estudio.yml) lee el cuerpo
// con motocine/estudio.py `leer_formulario`, que parte el texto por los
// encabezados "### " -- por eso el cuerpo debe salir EXACTAMENTE con el
// formato del formulario de GitHub (nuevo-video.yml). Si el dueño subió
// fotos o videos, va una sección más al final ("### Archivos", un enlace por
// línea); el robot todavía no la usa, y leer_formulario la ignora sin problema.
import { MAX_ARCHIVOS, claveValida, seccionArchivos } from "./archivos.ts";

export const FORMATO_ADIVINA = "Adivina la falla por el sonido";
export const ESCENARIOS = ["Taller", "Patio"] as const;
export const LETRAS = ["Aleatoria", "A", "B", "C"] as const;
export type Escenario = (typeof ESCENARIOS)[number];
export type Letra = (typeof LETRAS)[number];

/** Los formatos que se pueden pedir (por ahora uno solo). */
export const FORMATOS = [
  {
    valor: FORMATO_ADIVINA,
    titulo: "¿Qué falla es? — adivina por el sonido",
    descripcion: "Suena la moto, salen 3 opciones (A, B, C) y al final el mecánico explica la respuesta.",
  },
] as const;

export const SIN_RESPUESTA = "_No response_";
export const NOMBRE_MAX = 60;

export interface Pedido {
  formato: string;
  falla: string;
  escenario: Escenario;
  letra: Letra;
  nombre: string;
  /** Claves en R2 de las fotos/videos subidos (puede ir vacío). */
  archivos: string[];
}

/** Revisa lo que llega del formulario (o de cualquiera que llame a la API)
 * y lo deja limpio. Devuelve el pedido o un mensaje para la persona. */
export function validarPedido(entrada: unknown): { pedido: Pedido } | { error: string } {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const falla = String(e.falla ?? "").trim();
  // El id de la falla es el nombre del archivo del catálogo (balancines, cadena...).
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(falla)) return { error: "Elige una falla de la lista." };
  const escenario = ESCENARIOS.find((x) => x.toLowerCase() === String(e.escenario ?? "Taller").trim().toLowerCase());
  if (!escenario) return { error: "Elige Taller o Patio." };
  const letra = LETRAS.find((x) => x.toLowerCase() === String(e.letra ?? "Aleatoria").trim().toLowerCase());
  if (!letra) return { error: "Elige la respuesta correcta: Aleatoria, A, B o C." };
  const formato = FORMATOS.find((f) => f.valor === String(e.formato ?? FORMATO_ADIVINA))?.valor;
  if (!formato) return { error: "Ese formato todavía no existe." };
  const crudos = e.archivos === undefined || e.archivos === null ? [] : e.archivos;
  if (!Array.isArray(crudos) || !crudos.every(claveValida)) return { error: "Uno de los archivos no es válido. Quítalo y súbelo otra vez." };
  const archivos = [...new Set(crudos)];
  if (archivos.length > MAX_ARCHIVOS) return { error: `Máximo ${MAX_ARCHIVOS} archivos por video.` };
  return { pedido: { formato, falla, escenario, letra, nombre: limpiarNombre(e.nombre), archivos } };
}

/** Nombre en una sola línea, sin "#" (cortaría el formulario) y corto. */
export function limpiarNombre(valor: unknown): string {
  return String(valor ?? "")
    .replace(/[\r\n\t#`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NOMBRE_MAX)
    .trim();
}

/** Título del issue: el workflow solo arranca si empieza por "Video". */
export function tituloPedido(p: Pedido): string {
  return `Video: ${p.nombre || p.falla}`;
}

/** Cuerpo del issue, igual al que arma el formulario de GitHub. `urlsArchivos`:
 * los enlaces firmados de los archivos (los arma el Worker, urlArchivo). */
export function cuerpoPedido(p: Pedido, urlsArchivos: string[] = []): string {
  const extra = seccionArchivos(urlsArchivos);
  return [
    "### Formato",
    p.formato,
    "### Falla",
    p.falla,
    "### Escenario",
    p.escenario,
    "### Letra correcta",
    p.letra,
    "### Nombre del video (opcional)",
    p.nombre || SIN_RESPUESTA,
    ...(extra ? [extra] : []),
  ].join("\n\n");
}

/** Lee un cuerpo de issue (mismo criterio que leer_formulario en Python):
 * sirve para mostrar en la app qué se pidió. */
export function leerCuerpo(cuerpo: string | null | undefined): { formato: string; falla: string; escenario: string; letra: string; nombre: string } {
  const campos: Record<string, string> = {};
  for (const bloque of String(cuerpo ?? "").split(/^### /m).slice(1)) {
    const salto = bloque.indexOf("\n");
    const titulo = (salto < 0 ? bloque : bloque.slice(0, salto)).trim().toLowerCase();
    const valor = salto < 0 ? "" : bloque.slice(salto + 1).trim();
    campos[titulo] = valor === SIN_RESPUESTA ? "" : valor;
  }
  const get = (inicio: string) => Object.entries(campos).find(([k, v]) => k.startsWith(inicio) && v)?.[1] ?? "";
  return { formato: get("formato"), falla: get("falla"), escenario: get("escenario"), letra: get("letra") || get("respuesta"), nombre: get("nombre") };
}

/** "Video: balancines-octubre" → "balancines-octubre". */
export function nombreDesdeTitulo(titulo: string): string {
  return titulo.replace(/^video\s*:?\s*/i, "").trim() || titulo;
}

/** ¿Es un pedido de video? (el workflow usa el mismo criterio). */
export function esPedido(titulo: string | null | undefined): boolean {
  return /^video/i.test(String(titulo ?? "").trim());
}
