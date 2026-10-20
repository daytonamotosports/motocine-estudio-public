// Piezas propias de Orion MotoCine, armadas con el mismo lenguaje del kit
// de Orion (formKit.tsx): filas a todo el ancho dentro de grupos blancos,
// jerarquía por peso de letra, el botón grande abajo.
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONES, TonePill } from "@/components/toneKit";
import { Spinner } from "@/components/Spinner";
import { fechaCorta } from "@/lib/formato";
import { minutosRestantes } from "@/lib/logic/pasos";
import type { Estado, Paso, PedidoCorto } from "@/lib/logic/tipos";

/** "‹ Videos" al estilo iPhone: vuelve atrás si se llegó desde la app, o
 * va a `to` si se abrió el enlace directo. */
export function BackLink({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate(to, { replace: true }))}
      className="o-press -ml-1.5 flex items-center self-start text-[16px] font-bold text-[var(--color-accent-strong)]"
    >
      <ChevronLeft className="size-6" />
      {label}
    </button>
  );
}

/** Marca chiquita arriba del título (como el rótulo de una app de iPhone). */
export function Marca() {
  return (
    <div className="flex items-center gap-2 px-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--color-muted)]">
      <span className="grid size-5 place-items-center rounded-[6px] bg-[var(--color-accent)] text-white">
        <Film className="size-3" strokeWidth={2.6} />
      </span>
      Daytona Moto Sport · MotoCine
    </div>
  );
}

export const TONO_ESTADO: Record<Estado, (typeof TONES)[keyof typeof TONES]> = {
  armando: TONES.blue,
  listo: TONES.green,
  problema: TONES.amber,
};

export function textoEstado(p: Pick<PedidoCorto, "estado" | "desde">, ahora = Date.now()): string {
  if (p.estado === "listo") return "Listo";
  if (p.estado === "problema") return "Con problema";
  return `Armando… (≈ ${minutosRestantes(p.desde, ahora)} min)`;
}

export function EstadoPill({ pedido, ahora }: { pedido: Pick<PedidoCorto, "estado" | "desde">; ahora?: number }) {
  return <TonePill tone={TONO_ESTADO[pedido.estado]}>{textoEstado(pedido, ahora)}</TonePill>;
}

/** Miniatura del video: la hoja de cuadros si ya está, si no un ícono. */
function Miniatura({ pedido }: { pedido: PedidoCorto }) {
  if (pedido.hoja) {
    return <img src={pedido.hoja} alt="" loading="lazy" className="size-12 flex-none rounded-[12px] bg-[var(--color-surface-sunken)] object-cover" />;
  }
  const tono = TONO_ESTADO[pedido.estado];
  return (
    <span className="grid size-12 flex-none place-items-center rounded-[12px]" style={{ background: tono.soft, color: tono.ink }}>
      {pedido.estado === "armando" ? <Spinner className="size-5" /> : pedido.estado === "problema" ? <AlertTriangle className="size-5" /> : <Film className="size-5" />}
    </span>
  );
}

/** Fila de "Mis videos" (misma forma que NavRow, con miniatura grande). */
export function PedidoRow({ pedido, ahora }: { pedido: PedidoCorto; ahora: number }) {
  return (
    <Link to={`/video/${pedido.numero}`} className="o-press flex min-h-[68px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-surface-soft)]">
      <Miniatura pedido={pedido} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold leading-tight">{pedido.nombre}</div>
        <div className="mt-0.5 truncate text-[13px] font-medium text-[var(--color-muted)]">{fechaCorta(pedido.creado)}</div>
        <div className="mt-1.5 flex">
          <EstadoPill pedido={pedido} ahora={ahora} />
        </div>
      </div>
      <ChevronRight className="size-[18px] flex-none text-[var(--color-faint)]" />
    </Link>
  );
}

/** Barra pegada abajo con el botón grande (mismo fondo degradado que SaveBar). */
export function BarraAbajo({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 z-20 -mx-4 mt-auto px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-6 [background:linear-gradient(to_top,var(--color-bg)_55%,transparent)] sm:-mx-5 sm:px-5">{children}</div>;
}

/** Un paso del estado: círculo (hecho, en curso, pendiente o con problema) y su nombre. */
export function PasoRow({ paso, detalle }: { paso: Paso; detalle?: ReactNode }) {
  const circulo =
    paso.estado === "hecho" ? (
      <span className="grid size-7 flex-none place-items-center rounded-full text-white" style={{ background: TONES.green.base }}>
        <Check className="size-4" strokeWidth={3} />
      </span>
    ) : paso.estado === "activo" ? (
      <span className="grid size-7 flex-none place-items-center rounded-full" style={{ background: TONES.blue.soft, color: TONES.blue.ink }}>
        <Spinner className="size-4" />
      </span>
    ) : paso.estado === "error" ? (
      <span className="grid size-7 flex-none place-items-center rounded-full text-white" style={{ background: TONES.amber.base }}>
        <AlertTriangle className="size-4" strokeWidth={2.6} />
      </span>
    ) : (
      <span className="size-7 flex-none rounded-full border-2 border-[var(--color-border-strong)]" />
    );
  return (
    <div className="flex min-h-[52px] items-center gap-3 px-4 py-2.5" aria-current={paso.estado === "activo" ? "step" : undefined}>
      {circulo}
      <div className="min-w-0 flex-1">
        <div className={cn("text-[15px] leading-tight", paso.estado === "pendiente" ? "font-semibold text-[var(--color-muted)]" : "font-bold")}>{paso.titulo}</div>
        {detalle ? <div className="mt-0.5 text-[13px] font-medium text-[var(--color-muted)]">{detalle}</div> : null}
      </div>
    </div>
  );
}

/** Fila de texto de solo lectura (motivos, avisos), con ícono opcional. */
export function TextoRow({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {icon ? <span className="mt-0.5 flex-none">{icon}</span> : null}
      <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug">{children}</p>
    </div>
  );
}

/** Contenedor de pantalla: el mismo de FormPage (angosto, centrado, 16 px a
 * los lados). `conBarra`: la pantalla lleva BarraAbajo y no necesita el aire
 * de abajo (si no, la barra quedaría flotando por encima del final).
 * `ancha`: en PC usa más ancho (Detalle con el video al lado). */
export function Pagina({ children, conBarra, ancha }: { children: ReactNode; conBarra?: boolean; ancha?: boolean }) {
  return <div className={cn("mx-auto flex flex-col gap-6 px-4 pt-4 sm:px-5", ancha ? "max-w-[640px] lg:max-w-[1040px]" : "max-w-[640px]", conBarra ? "min-h-[var(--app-h)] pb-0" : "pb-32")}>{children}</div>;
}
