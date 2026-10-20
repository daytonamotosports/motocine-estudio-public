// Fotos y videos que sube el dueño (se guardan en Cloudflare R2, binding
// ARCHIVOS). Cada archivo queda en "subidas/<fecha>-<nombre>" y el pedido
// (issue) lleva un enlace por archivo para que el robot los pueda bajar SIN
// la galleta de sesión: ?t=<firma>, con firma = HMAC-SHA256(APP_PIN,
// "archivo:" + clave). La firma sirve solo para ESE archivo; con ella no se
// puede ver ningún otro ni entrar a la app. Si cambian el PIN, los enlaces
// viejos dejan de servir.
import { iguales } from "./sesion.ts";

export const MAX_BYTES = 100 * 1024 * 1024; // 100 MB (también es el tope de Cloudflare por pedido)
export const MAX_ARCHIVOS = 10;
const CLAVE = /^subidas\/\d{8}-\d{6}-[a-z0-9]{4}-[a-z0-9][a-z0-9._-]{0,79}$/;

/** "Foto Moto (1).JPG" → "foto-moto-1.jpg" (sin tildes, sin espacios). */
export function nombreSeguro(nombre: string): string {
  const limpio = String(nombre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/[-_]+\./g, ".")
    .replace(/^[-._]+|[-_]+$/g, "")
    .slice(-80)
    .replace(/^[-._]+/, "");
  return limpio || "archivo";
}

/** Clave en R2: subidas/20261020-162455-k3x9-foto-moto.jpg (hora de Bogotá). */
export function claveArchivo(nombre: string, fecha = new Date(), azar = Math.random().toString(36).slice(2, 6).padEnd(4, "0")): string {
  const bogota = new Date(fecha.getTime() - 5 * 3600_000).toISOString(); // Colombia: UTC-5 todo el año
  const sello = `${bogota.slice(0, 10).replace(/-/g, "")}-${bogota.slice(11, 19).replace(/:/g, "")}`;
  return `subidas/${sello}-${azar.toLowerCase().replace(/[^a-z0-9]/g, "0").slice(0, 4)}-${nombreSeguro(nombre)}`;
}

export function claveValida(clave: unknown): clave is string {
  return typeof clave === "string" && CLAVE.test(clave) && !clave.includes("..");
}

export function esFotoOVideo(tipo: string | null | undefined): boolean {
  return /^(image|video)\//.test(String(tipo ?? ""));
}

export async function firmaArchivo(pin: string, clave: string): Promise<string> {
  const enc = new TextEncoder();
  const llave = await crypto.subtle.importKey("raw", enc.encode(pin), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", llave, enc.encode(`archivo:${clave}`)));
  return Array.from(firma, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function firmaArchivoValida(pin: string, clave: string, t: string | null | undefined): Promise<boolean> {
  if (!pin || !t || !claveValida(clave)) return false;
  return iguales(t, await firmaArchivo(pin, clave));
}

/** Enlace público (con firma) que va en el pedido para el robot. */
export async function urlArchivo(origen: string, clave: string, pin: string): Promise<string> {
  return `${origen.replace(/\/+$/, "")}/api/archivos/${clave}?t=${await firmaArchivo(pin, clave)}`;
}

/** Sección extra del cuerpo del pedido (solo si hay archivos). */
export function seccionArchivos(urls: string[]): string {
  return urls.length ? `### Archivos\n\n${urls.join("\n")}` : "";
}
