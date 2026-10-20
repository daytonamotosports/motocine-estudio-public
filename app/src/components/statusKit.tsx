// COPIA de orion-pos webapp/src/components/statusKit.tsx (20-oct-2026); no editar a mano en orion-pos por esta app.
// Recortada: solo EmptyState.
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon = <Inbox />,
  title,
  text,
  action,
  children,
  compact = false,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** Una acción que no es un simple botón (ej. un enlace). */
  children?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("o-item-in flex flex-col items-center text-center", compact ? "gap-1.5 px-4 py-5" : "gap-2 px-6 py-10", className)}>
      <span
        className={cn(
          "grid flex-none place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-muted)] shadow-[var(--shadow-group)] ring-1 ring-[var(--color-border)]",
          compact ? "mb-0.5 size-10 [&_svg]:size-[18px]" : "mb-1 size-14 [&_svg]:size-6",
        )}
      >
        {icon}
      </span>
      <p className={cn("max-w-[320px] font-extrabold leading-snug text-[var(--color-text)]", compact ? "text-[14px]" : "text-[16px]")}>{title}</p>
      {text ? <p className={cn("max-w-[340px] font-medium leading-snug text-[var(--color-muted)]", compact ? "text-[13px]" : "text-[14px]")}>{text}</p> : null}
      {action ? (
        <button type="button" onClick={action.onClick} className="o-press mt-2 rounded-full bg-[var(--color-accent-soft)] px-4 py-2 text-[14px] font-bold text-[var(--color-accent-strong)]">
          {action.label}
        </button>
      ) : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
