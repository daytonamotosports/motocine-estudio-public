// COPIA de orion-pos webapp/src/components/toneKit.tsx (20-oct-2026); no editar a mano en orion-pos por esta app.
// Recortada: solo el tipo Tone, los colores TONES y TonePill (lo que usa formKit y esta app).
import type { ReactNode } from "react";

export interface Tone {
  /** color principal (barras, íconos) */
  base: string;
  /** texto sobre fondo claro (más oscuro, legible) */
  ink: string;
  /** fondo suave */
  soft: string;
  /** degradado de la tarjeta principal */
  hero: string;
}

// v1397 -- `ink` y `soft` apuntan a variables de index.css (--tone-*) para
// que cambien solos con el modo oscuro; los valores claros siguen siendo
// los mismos de siempre. `base` y `hero` no cambian (son el color de marca
// y el degradado de las tarjetas grandes, que se ven bien en los dos).
export const TONES = {
  green: { base: "#0e9f6e", ink: "var(--tone-green-ink)", soft: "var(--tone-green-soft)", hero: "linear-gradient(135deg, #0a6b4b 0%, #0e9f6e 55%, #22c08f 100%)" },
  blue: { base: "#2f7bf0", ink: "var(--tone-blue-ink)", soft: "var(--tone-blue-soft)", hero: "linear-gradient(135deg, #1b4fb8 0%, #2f7bf0 55%, #5b9cff 100%)" },
  amber: { base: "#f59e0b", ink: "var(--tone-amber-ink)", soft: "var(--tone-amber-soft)", hero: "linear-gradient(135deg, #b8620a 0%, #e8890b 55%, #f6b23c 100%)" },
  rose: { base: "#e5487a", ink: "var(--tone-rose-ink)", soft: "var(--tone-rose-soft)", hero: "linear-gradient(135deg, #a8204f 0%, #e5487a 55%, #f37aa0 100%)" },
  violet: { base: "#7c5cff", ink: "var(--tone-violet-ink)", soft: "var(--tone-violet-soft)", hero: "linear-gradient(135deg, #4c32c4 0%, #7c5cff 60%, #a08bff 100%)" },
  teal: { base: "#0ea5a4", ink: "var(--tone-teal-ink)", soft: "var(--tone-teal-soft)", hero: "linear-gradient(135deg, #0b7f7e 0%, #0ea5a4 60%, #3fc9c8 100%)" },
  slate: { base: "#64748b", ink: "var(--tone-slate-ink)", soft: "var(--tone-slate-soft)", hero: "linear-gradient(135deg, #334155 0%, #64748b 100%)" },
} satisfies Record<string, Tone>;

/** Pastilla de monto/estado con el color de un tono. */
export function TonePill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="flex-none rounded-full px-2.5 py-1 text-[12px] font-extrabold tabular-nums" style={{ background: tone.soft, color: tone.ink }}>
      {children}
    </span>
  );
}
