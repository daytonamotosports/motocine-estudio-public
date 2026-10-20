// COPIA de orion-pos webapp/src/components/ui/button.tsx (20-oct-2026); no editar a mano en orion-pos por esta app.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/Spinner";

// v1 -- pedido explicito del usuario: "sigue trabajando en las
// animaciones y la estética... los pequeños detalles son los que hacen
// la diferencia". De los ~130 usos de este <Button> compartido en toda
// la app, solo 2 agregaban `o-press` (el hundimiento tactil al tocar,
// `transform: scale(0.965)`, que SI usan casi todos los botones sueltos
// -- CollapsibleSection, los iconos del riel/drawer, etc.) a mano en su
// className -- el resto se sentia "muerto" al tocar, sin ninguna
// retroalimentacion mas alla del cambio de color de `transition-colors`.
// Se mueve a la base para que CUALQUIER <Button> de la app lo tenga sin
// que cada pantalla tenga que acordarse de agregarlo.
// v1390b/v1391 -- un solo botón para toda la app, estilo iPhone (Fase 5 del
// plan de estética, PENDIENTES.md #9): siempre redondo (píldora), con la
// misma altura por tamaño y tres papeles claros:
// - primary: la acción principal (verde, con sombra suave).
// - secondary: acción secundaria (gris translúcido, se ve bien sobre
//   cualquier fondo y en modo oscuro). `outline` queda como alias.
// - tinted: secundaria con color (verde suave), para "Agregar…" dentro de
//   una tarjeta.
// - danger: borrar/anular (rojo).
// - ghost: solo texto.
// Tamaños: sm (36px), default (44px, el mínimo cómodo para el dedo), lg
// (50px, el botón grande de abajo de una ventana -- SheetButton), icon.
// Los botones grandes hechos a mano usan `buttonVariants({ size: "lg" })`.
export const buttonVariants = cva(
  "o-press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-[background-color,filter,opacity] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // La sombra sigue al color principal (en el Portal es el de la marca de cada negocio).
        primary: "bg-[var(--color-accent-fill)] text-white shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--color-accent)_70%,transparent)] hover:brightness-95",
        secondary: "bg-[var(--color-fill)] text-[var(--color-text)] hover:bg-[var(--color-fill-strong)]",
        outline: "bg-[var(--color-fill)] text-[var(--color-text)] hover:bg-[var(--color-fill-strong)]",
        tinted: "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)] hover:brightness-[0.97]",
        ghost: "text-[var(--color-accent-strong)] hover:bg-[var(--color-surface-soft)]",
        danger: "bg-[var(--color-danger-fill,var(--color-danger))] text-white shadow-[0_10px_24px_-12px_rgba(220,76,76,0.7)] hover:brightness-95",
      },
      size: {
        sm: "h-9 px-3.5 text-[14px] [&_svg]:size-4",
        default: "h-11 px-5 text-[15px] [&_svg]:size-[18px]",
        lg: "h-[50px] px-6 text-[16px] font-extrabold [&_svg]:size-[18px]",
        icon: "size-9 [&_svg]:size-[18px]",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** v1413 -- mientras guarda/envía: el ícono del botón se cambia por el
   * "cargando" compartido (Spinner) y el botón queda desactivado. */
  loading?: boolean;
}

export function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }: ButtonProps) {
  if (asChild) return <Slot className={cn(buttonVariants({ variant, size, className }))} {...props}>{children}</Slot>;
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }), loading && "disabled:opacity-80 [&>svg]:hidden")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-[1.15em]" /> : null}
      {children}
    </button>
  );
}
