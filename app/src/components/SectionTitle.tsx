// COPIA de orion-pos webapp/src/components/SectionTitle.tsx (20-oct-2026); no editar a mano en orion-pos por esta app.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// v1421 -- el título chico en mayúsculas sobre cada grupo (como "AJUSTES"
// en el iPhone). Antes eran ~30 copias del mismo estilo escritas a mano en
// las apps; ahora una sola pieza compartida (scripts/shared-kit.mjs).
// `right`: algo a la derecha del título (un total, un enlace).
export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <h2 className={cn("flex items-baseline justify-between gap-2 px-4 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--color-muted)]", className)}>
      {right ? (
        <>
          <span className="min-w-0">{children}</span>
          {right}
        </>
      ) : (
        children
      )}
    </h2>
  );
}
