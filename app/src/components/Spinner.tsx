// COPIA de orion-pos webapp/src/components/Spinner.tsx (20-oct-2026); no editar a mano en orion-pos por esta app.
import { cn } from "@/lib/utils";

// v1413 -- UN solo "cargando" en las 4 apps (punto 2 de la 5.ª auditoría,
// pedido del usuario: "sí, sigue con el punto 2"). Antes había 3 dibujos:
// el ícono de rayitas que gira (Loader2), un anillo con una parte de color
// y unas flechas que giran, cada uno con su tamaño y grosor. Ahora es el
// del iPhone: 8 rayitas que se van apagando en círculo. Toma el color del
// texto de alrededor (dentro de un botón verde, blanco; suelto, pasarle
// `text-[var(--color-muted)]`) y el tamaño de `className` (size-*).
// Las flechas que giran (RefreshCw) quedan SOLO para "sincronizando" o
// "actualizar", donde dicen qué está pasando, no solo "espera".
// Pieza compartida (scripts/shared-kit.mjs); su animación vive en kit.css.
const BARS = [0, 1, 2, 3, 4, 5, 6, 7];

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
      className={cn("o-spinner relative inline-block size-5 flex-none", className)}
    >
      {BARS.map((i) => (
        <span key={i} style={{ transform: `rotate(${-i * 45}deg)`, opacity: 1 - i * 0.11 }} />
      ))}
    </span>
  );
}
