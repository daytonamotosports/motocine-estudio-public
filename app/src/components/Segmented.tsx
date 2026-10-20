// COPIA de orion-pos webapp/src/components/Segmented.tsx (20-oct-2026); no editar a mano en orion-pos por esta app.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* v1401 -- un solo control de pestañas estilo iPhone (punto 3 de la 3.ª
   auditoría de estética): pista gris y la opción elegida "flotando" en
   blanco (gris claro en oscuro). Había 7 hechos a mano, cada uno con su
   tamaño, su redondeo y su color de "elegido" (verde en unos, blanco en
   otros). `tint`: la opción elegida toma ese color con letra blanca (ej.
   Ingreso verde / Salida rosada). Necesita el color --color-segment en
   index.css (blanco en claro, #48484a en oscuro). */
export function Segmented<V extends string | number>({
  value,
  onChange,
  options,
  size = "md",
  label,
  className,
}: {
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: ReactNode; icon?: ReactNode; tint?: string }[];
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex min-w-0 gap-0.5 rounded-[12px] bg-[var(--color-fill)] p-[3px]", size === "sm" && "self-start rounded-full", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "o-press flex min-w-0 flex-1 items-center justify-center gap-1.5 text-center font-bold leading-tight transition-[background-color,color,box-shadow] duration-200 [&_svg]:size-4 [&_svg]:flex-none",
              // El texto largo baja a una segunda línea en vez de cortarse.
              size === "sm" ? "h-7 flex-none whitespace-nowrap rounded-full px-3 text-[12px]" : size === "lg" ? "min-h-11 rounded-[10px] px-2 py-1.5 text-[15px]" : "min-h-9 rounded-[10px] px-2 py-1.5 text-[14px]",
              options.length >= 3 && size !== "sm" && "text-[13px]",
              // v1636 -- 5 o más opciones en celular: cada una del ancho de su palabra
              // y letra un punto menor, para que ninguna se monte sobre la vecina.
              options.length >= 5 && size !== "sm" && "max-sm:flex-auto max-sm:px-1 max-sm:text-[12px]",
              active ? (option.tint ? "text-white shadow-[var(--shadow-control)]" : "bg-[var(--color-segment)] text-[var(--color-text)] shadow-[var(--shadow-control)]") : "text-[var(--color-muted)]",
            )}
            style={active && option.tint ? { background: option.tint } : undefined}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
