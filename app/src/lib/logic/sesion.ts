// Sesión de la app: después de escribir el PIN, el Worker deja una galleta
// (cookie) con HMAC-SHA256(llave = APP_PIN, mensaje = "sesion"). Así no se
// guarda nada en ningún lado: si el dueño cambia el PIN en Cloudflare, todas
// las sesiones viejas dejan de servir solas. Usa WebCrypto (está igual en
// Cloudflare Workers, en el navegador y en Node para las pruebas).

export const COOKIE = "mc_sesion";
export const DURACION_SESION_S = 30 * 24 * 60 * 60; // 30 días

export async function firmaSesion(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const llave = await crypto.subtle.importKey("raw", enc.encode(pin), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", llave, enc.encode("sesion")));
  return Array.from(firma, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara sin cortar en la primera diferencia (no da pistas por el tiempo). */
export function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/** Lee una galleta del encabezado Cookie. */
export function leerCookie(encabezado: string | null | undefined, nombre = COOKIE): string | null {
  for (const parte of String(encabezado ?? "").split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return v.join("=") || null;
  }
  return null;
}

export async function sesionValida(encabezado: string | null | undefined, pin: string): Promise<boolean> {
  const valor = leerCookie(encabezado);
  if (!valor || !pin) return false;
  return iguales(valor, await firmaSesion(pin));
}

export function cookieSesion(valor: string): string {
  return `${COOKIE}=${valor}; Path=/; Max-Age=${DURACION_SESION_S}; HttpOnly; Secure; SameSite=Lax`;
}

export function cookieBorrar(): string {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
