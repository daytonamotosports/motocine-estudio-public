// COPIA de orion-pos webapp/src/components/ui/switch.tsx (20-oct-2026); no editar a mano en orion-pos por esta app.
import { cn } from "@/lib/utils";

// v1 -- pedido explicito del usuario: "al más puro estilo de iOS". Los
// toggles de encendido/apagado de la app (publicar en tienda, cuenta
// predeterminada, "es prestado"...) eran un <input type="checkbox">
// nativo -- un cuadrito, nunca el interruptor deslizante que cualquier
// app estilo iOS usa para una decision de SI/NO. Checkbox nativo
// (position:absolute, opacity:0, pero SIGUE siendo el elemento real
// enfocable/accesible con teclado) + un "track"/"thumb" dibujados a
// mano que reaccionan al :checked del input via CSS hermano -- ningun
// estado de React aparte que mantener sincronizado, el input de
// siempre sigue siendo la unica fuente de verdad.
//
// A proposito NO reemplaza los checkboxes de SELECCION MULTIPLE (listas
// de permisos, filas marcables de una tabla, "acepto los terminos") --
// ahi un check real sigue siendo lo correcto semánticamente; esto es
// solo para decisiones de encendido/apagado de una sola opcion.
// v1439 -- todo interruptor necesita nombre para el lector de pantalla:
// `label` (texto) o `labelledBy` (id del título visible al lado).
export function Switch({ checked, onChange, disabled, className, label, labelledBy }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; className?: string } & ({ label: string; labelledBy?: undefined } | { label?: undefined; labelledBy: string })) {
  return (
    <label className={cn("o-press relative inline-flex h-7 w-[46px] flex-none cursor-pointer items-center", disabled && "pointer-events-none opacity-50", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        aria-label={label}
        aria-labelledby={labelledBy}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-[var(--color-border-strong)] transition-colors duration-200 ease-out peer-checked:bg-[var(--color-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2" />
      <span className="pointer-events-none absolute left-[3px] size-[22px] translate-x-0 rounded-full bg-white shadow-[var(--shadow-on-photo)] transition-transform duration-200 ease-[var(--motion-spring,cubic-bezier(0.2,0.9,0.25,1.08))] peer-checked:translate-x-[19px]" />
    </label>
  );
}
