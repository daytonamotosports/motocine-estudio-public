// Fechas y tiempos cortos, en español de Colombia y hora de Bogotá.
const ZONA = "America/Bogota";
const dia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONA });

/** "hoy, 10:24 a. m." · "ayer, 4:05 p. m." · "15 oct." */
export function fechaCorta(iso: string, ahora = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hora = d.toLocaleTimeString("es-CO", { timeZone: ZONA, hour: "numeric", minute: "2-digit" });
  const ayer = new Date(ahora.getTime() - 86400000);
  if (dia(d) === dia(ahora)) return `hoy, ${hora}`;
  if (dia(d) === dia(ayer)) return `ayer, ${hora}`;
  return d.toLocaleDateString("es-CO", { timeZone: ZONA, day: "numeric", month: "short" });
}

/** "7 min" · "1 h 5 min" */
export function duracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Corta un texto largo en la última palabra completa. */
export function recortar(texto: string | undefined, max = 80): string {
  const t = (texto ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}
