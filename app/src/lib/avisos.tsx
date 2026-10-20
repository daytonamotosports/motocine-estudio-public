// Avisos rápidos, al estilo de los de Orion POS (lib/toast.tsx): cápsula
// arriba al centro con un ícono en círculo de color, que se va sola.
// Versión corta hecha para esta app (no es copia).
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tipo = "ok" | "error" | "info";
interface Item {
  id: number;
  mensaje: string;
  tipo: Tipo;
}

const EVENTO = "mc:aviso";
let siguiente = 1;

export function avisar(mensaje: string, tipo: Tipo = "info") {
  window.dispatchEvent(new CustomEvent<Item>(EVENTO, { detail: { id: siguiente++, mensaje, tipo } }));
}

const ICONO: Record<Tipo, { fondo: string; icono: ReactNode }> = {
  ok: { fondo: "#0e9f6e", icono: <Check className="size-4" strokeWidth={3} /> },
  error: { fondo: "var(--color-danger-fill)", icono: <AlertTriangle className="size-4" /> },
  info: { fondo: "#2f7bf0", icono: <Info className="size-4" /> },
};

export function Avisos() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const alLlegar = (e: Event) => {
      const item = (e as CustomEvent<Item>).detail;
      setItems((prev) => [...prev.slice(-1), item]);
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== item.id)), 3600);
    };
    window.addEventListener(EVENTO, alLlegar);
    return () => window.removeEventListener(EVENTO, alLlegar);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[var(--z-toast)] flex flex-col items-center gap-2 px-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
          className={cn("o-pop pointer-events-auto flex max-w-[min(440px,calc(100vw-24px))] items-center gap-3 rounded-[24px] py-2 pl-2 pr-4 text-left text-[14px] font-bold shadow-[var(--shadow-float)]", "bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] text-[var(--color-text)] backdrop-blur-xl")}
        >
          <span className="grid size-7 flex-none place-items-center rounded-full text-white" style={{ background: ICONO[item.tipo].fondo }}>
            {ICONO[item.tipo].icono}
          </span>
          {item.mensaje}
        </button>
      ))}
    </div>
  );
}
