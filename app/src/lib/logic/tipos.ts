// Tipos que comparten la app (pantallas) y el Worker (worker/index.ts).
// Lógica pura: nada de React ni de Cloudflare aquí, para que las pruebas
// (tests/*.test.ts) la puedan correr con Node directamente.

/** En qué va un pedido de video. */
export type Estado = "armando" | "listo" | "problema";

/** Un paso de la tarjeta de estado del Detalle. */
export type EstadoPaso = "hecho" | "activo" | "pendiente" | "error";

export interface Paso {
  id: "recibido" | "guion" | "revision" | "armando" | "listo";
  titulo: string;
  estado: EstadoPaso;
}

/** Una línea de "Notas de calidad" (ej. Viralidad → 94/100). */
export interface Nota {
  etiqueta: string;
  valor: string;
  detalle?: string;
}

/** Lo que el Worker sabe leer del último comentario del robot. */
export interface Resumen {
  viralidad: number | null;
  guion: string | null;
  notas: Nota[];
  /** Por qué no salió el video (líneas con ❌ / ⚠). */
  motivos: string[];
  /** Frases de la voz que el revisor no entendió bien. */
  voz: string[];
}

/** Fila de "Mis videos" (GET /api/pedidos). */
export interface PedidoCorto {
  numero: number;
  nombre: string;
  falla: string;
  creado: string;
  /** Desde cuándo se está armando (para el "≈ N min"). */
  desde: string;
  estado: Estado;
  /** Miniatura (hoja de cuadros) por la API propia, o null. */
  hoja: string | null;
}

/** Detalle de un pedido (GET /api/pedidos/:n). */
export interface PedidoDetalle extends PedidoCorto {
  escenario: string;
  letra: string;
  pasos: Paso[];
  /** Enlace del video en la API propia (mismo origen), o null. */
  video: string | null;
  /** Enlace público de GitHub (para copiar y compartir), o null. */
  videoPublico: string | null;
  resumen: Resumen | null;
  /** El pedido en GitHub (por si hay que mirarlo allá). */
  enlaceGithub: string;
}

/** Falla del catálogo (GET /api/catalogo). */
export interface Falla {
  id: string;
  nombre: string;
  explicacion?: string;
  pregunta?: string;
  solucion?: string;
}
