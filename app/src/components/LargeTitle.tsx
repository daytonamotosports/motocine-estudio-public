// COPIA de orion-pos webapp/src/components/LargeTitle.tsx (20-oct-2026); no editar a mano en orion-pos por esta app.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// v1407 -- el título grande de cada pantalla, como en el iPhone (punto 3 de
// la 4.ª auditoría de estética y estructura). Pedido del usuario: "sí,
// sigue con el punto 3". Antes cada app tenía el suyo con otro tamaño
// (Admin 30, subpantallas del POS 26, Portal 22, Taller 20). Pieza
// compartida (scripts/shared-kit.mjs): igual en las 4 apps.
// - `icon`: un cuadrito de color a la izquierda (subpantallas de Ajustes).
// - `actions`: botones a la derecha; en celular bajan a su propia fila.
// - `children`: algo chico debajo del texto (ej. "1.240 productos").
export function LargeTitle({
  title,
  subtitle,
  icon,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-2 px-1", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="flex-none pt-0.5">{icon}</span> : null}
        <div className="min-w-0">
          <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] [text-wrap:balance]">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-[68ch] text-[14px] font-medium leading-snug text-[var(--color-muted)]">{subtitle}</p> : null}
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </header>
  );
}
