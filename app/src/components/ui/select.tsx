// COPIA de orion-pos webapp/src/components/ui/select.tsx (20-oct-2026); no editar a mano en orion-pos por esta app.
import type * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// v724 -- pedido explicito del usuario: "las listas... hago clic y
// algunas listas son listas del navegador... tenemos que pulirlo todo
// para que funcione 100% como una aplicación". Reemplaza el <select>
// nativo (su propio popup con el estilo del sistema operativo/
// navegador, fuera de nuestro control) por uno dibujado con nuestros
// propios componentes -- mismo criterio visual que dropdown-menu.tsx.
// API deliberadamente parecida a <select>/<option> (Select/SelectItem
// con value/children) para que migrar cada uso sea un cambio chico.

export const Select = SelectPrimitive.Root;

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left text-[14px] text-[var(--color-text)] outline-none data-[placeholder]:text-[var(--color-faint)] focus:border-[var(--color-accent)]",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-3.5 flex-none text-[var(--color-muted)]" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export const SelectValue = SelectPrimitive.Value;

export function SelectContent({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={6}
        className={cn(
          // v893 -- mismo bug/mismo fix que dropdown-menu.tsx (ver su
          // comentario grande): este `SelectContent` tampoco tenia
          // ninguna animacion, ni de entrada ni de salida.
          "o-popover-content z-[var(--z-dialog)] max-h-[min(360px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-[14px] border border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 py-1 shadow-[0_18px_50px_-12px_rgba(20,20,15,0.35),0_2px_6px_rgba(20,20,15,0.08)]",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex min-h-[44px] cursor-pointer select-none items-center justify-between gap-2 border-b border-[var(--color-border)]/60 px-4 py-2.5 text-[15px] font-bold text-[var(--color-text)] outline-none transition-colors duration-100 last:border-b-0 data-[highlighted]:bg-[var(--color-surface-soft)] data-[state=checked]:text-[var(--color-accent-strong)]",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check className="size-[18px] flex-none" strokeWidth={2.6} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
