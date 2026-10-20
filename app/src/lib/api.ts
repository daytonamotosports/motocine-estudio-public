// Llamadas de la app a su propio Worker (/api/*). Los errores ya vienen en
// español desde el Worker; aquí solo se cubre "sin internet". Si la sesión
// se venció (401), se avisa a la app para que vuelva a pedir el PIN.
export class ErrorApi extends Error {
  status: number;
  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.status = status;
  }
}

export const SESION_TERMINADA = "mc:sesion-terminada";

export async function api<T>(ruta: string, opciones: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ruta, {
      method: opciones.method ?? "GET",
      headers: opciones.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ErrorApi("Sin conexión. Revisa el internet e intenta otra vez.", 0);
  }
  const datos = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    if (res.status === 401 && ruta !== "/api/login") window.dispatchEvent(new Event(SESION_TERMINADA));
    throw new ErrorApi(datos?.error ?? "Algo falló. Intenta otra vez.", res.status);
  }
  return datos as T;
}
