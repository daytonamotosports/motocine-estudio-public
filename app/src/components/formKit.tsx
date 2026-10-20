// COPIA de orion-pos webapp/src/components/formKit.tsx (20-oct-2026); no editar a mano en orion-pos por esta app.
// Recortada: sin MoneyRow (esta app no maneja dinero).
import type { InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tone } from "@/components/toneKit";
import { Spinner } from "@/components/Spinner";
import { SectionTitle } from "@/components/SectionTitle";

// v1350 -- pedido explícito del usuario: "cada ventana de la
// configuración debe trabajarse... para que queden más adaptadas al
// modelo nuevo y parezcan más de celular, más una interfaz de teléfono".
// Las subpantallas de Configuración eran tarjetas con campos de PC (2
// columnas, cajitas con borde, botón "Guardar" pequeño a la izquierda).
// Este kit es el lenguaje de Ajustes del iPhone: grupos blancos sobre el
// fondo gris, filas a todo el ancho separadas por una línea fina, el
// rótulo del grupo arriba y la explicación abajo, interruptores para
// sí/no y un botón grande de guardar que aparece abajo solo cuando hay
// algo que guardar.

/** Contenedor de una subpantalla: angosto, con aire abajo para la barra
 * de guardar. */
export function FormPage({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex max-w-[640px] flex-col gap-6 px-4 pb-32 pt-4 sm:px-5">{children}</div>;
}

/** Grupo de filas (como una sección de Ajustes del iPhone). */
export function FormGroup({ title, footer, children, className }: { title?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("o-item-in flex flex-col gap-1.5", className)}>
      {title ? <SectionTitle>{title}</SectionTitle> : null}
      <div className="overflow-hidden rounded-[18px] bg-[var(--color-surface)] shadow-[var(--shadow-group)] [&>*+*]:border-t [&>*+*]:border-[var(--color-border)]">{children}</div>
      {footer ? <div className="px-4 text-[13px] font-medium leading-snug text-[var(--color-muted)]">{footer}</div> : null}
    </section>
  );
}

/** Cuadrito de color con ícono (el de cada fila de Ajustes del iPhone). */
export function IconBadge({ tone, children, size = "md" }: { tone: Tone; children: ReactNode; size?: "md" | "lg" }) {
  return (
    <span className={cn("grid flex-none place-items-center text-white", size === "lg" ? "size-10 rounded-[12px]" : "size-[30px] rounded-[8px]")} style={{ background: tone.base }}>
      {children}
    </span>
  );
}

const inputClass = "w-full min-w-0 bg-transparent text-[16px] font-medium text-[var(--color-text)] outline-none placeholder:font-medium placeholder:text-[var(--color-faint)]";

/** Campo de texto: rótulo pequeño arriba, lo escrito grande abajo.
 * `prefix`/`suffix` van pegados a lo escrito (ej. "$", "%", "días").
 * `error` (v1387): el problema se dice debajo del mismo campo, en rojo, en
 * vez de una ventana con "Aceptar" que tapa el formulario. */
export function TextRow({ label, value, onChange, hint, error, right, prefix, suffix, ...props }: { label: string; value: string; onChange: (value: string) => void; hint?: ReactNode; error?: ReactNode; right?: ReactNode; prefix?: ReactNode; suffix?: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "prefix">) {
  return (
    <label className={cn("flex min-w-0 items-center gap-2 px-4 py-2.5", error && "bg-[var(--color-danger-soft)]")} aria-invalid={error ? true : undefined}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-[12px] font-bold", error ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]")}>{label}</span>
        {prefix || suffix ? (
          <span className="flex min-w-0 items-baseline gap-1">
            {prefix ? <span className="flex-none text-[16px] font-medium text-[var(--color-muted)]">{prefix}</span> : null}
            {/* Con sufijo ("%", "días") el campo mide lo escrito, para que
                el sufijo quede pegado al número y no al borde. */}
            <input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className={cn(inputClass, suffix && "w-auto flex-none")}
              style={suffix ? { width: `${Math.max(String(value || props.placeholder || "").length, 1) + 1}ch` } : undefined}
              {...props}
            />
            {suffix ? <span className="flex-none text-[14px] font-medium text-[var(--color-muted)]">{suffix}</span> : null}
          </span>
        ) : (
          <input value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} {...props} />
        )}
        <FieldNote error={error} hint={hint} />
      </span>
      {right}
    </label>
  );
}

/** Dos campos cortos lado a lado en la misma fila (Nombre | Apellido). */
export function RowPair({ children, columns = "1fr 1fr" }: { children: ReactNode; columns?: string }) {
  return (
    <div className="grid [&>*+*]:border-l [&>*+*]:border-[var(--color-border)]" style={{ gridTemplateColumns: columns }}>
      {children}
    </div>
  );
}

/** Debajo del campo: el error (rojo) o, si no hay, la ayuda gris. También
 * se usa suelto debajo de un campo armado a mano (placa, nombre grande). */
export function FieldNote({ error, hint }: { error?: ReactNode; hint?: ReactNode }) {
  if (error) {
    return (
      <span role="alert" className="o-item-in text-[12px] font-bold leading-snug text-[var(--color-danger)]">
        {error}
      </span>
    );
  }
  return hint ? <span className="text-[12px] font-medium text-[var(--color-faint)]">{hint}</span> : null;
}

/** v1393 -- el error de un formulario se dice debajo del campo que falta
 * (no en un texto suelto al final ni en una ventana). Uso:
 *   const fieldError = useFieldError<"name" | "price">();
 *   if (!name) return fieldError.fail("name", "Escribe el nombre.");
 *   <TextRow id={fieldError.idFor("name")} error={fieldError.errorFor("name")} onChange={(v) => (setName(v), fieldError.clear("name"))} />
 * `fail` también lleva el cursor a ese campo. */
export function useFieldError<F extends string>() {
  const [state, setState] = useState<{ field: F; message: string } | null>(null);
  const scope = useRef(`f${Math.random().toString(36).slice(2, 8)}`).current;
  return {
    idFor: (field: F) => `${scope}-${field}`,
    errorFor: (field: F) => (state?.field === field ? state.message : undefined),
    fail: (field: F, message: string) => {
      setState({ field, message });
      requestAnimationFrame(() => {
        const el = document.getElementById(`${scope}-${field}`);
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    },
    clear: (field?: F) => setState((prev) => (!field || prev?.field === field ? null : prev)),
  };
}

/** Número con − / + grandes (cantidad, stock, descuento). */
export function StepperRow({ label, value, onChange, min = 0, max, suffix, detail }: { label: ReactNode; value: number; onChange: (value: number) => void; min?: number; max?: number; suffix?: string; detail?: ReactNode }) {
  const clamp = (n: number) => Math.max(min, max != null ? Math.min(max, n) : n);
  return (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold leading-tight">{label}</div>
        {detail ? <div className="mt-0.5 text-[13px] font-medium text-[var(--color-muted)]">{detail}</div> : null}
      </div>
      <div className="flex items-center overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
        <button type="button" onClick={() => onChange(clamp(value - 1))} aria-label="Restar uno" className="o-press grid size-10 place-items-center text-[var(--color-text)] disabled:opacity-30" disabled={value <= min}>
          <Minus className="size-4" />
        </button>
        <span className="flex items-baseline justify-center gap-0.5">
          <input
            value={value}
            onChange={(event) => onChange(clamp(Number(event.target.value.replace(/[^\d]/g, "")) || 0))}
            onFocus={(event) => event.currentTarget.select()}
            inputMode="numeric"
            aria-label={typeof label === "string" ? label : undefined}
            className="o-mono w-12 bg-transparent text-center text-[17px] font-extrabold tabular-nums outline-none"
          />
          {suffix ? <span className="-ml-2 pr-1 text-[13px] font-bold text-[var(--color-muted)]">{suffix}</span> : null}
        </span>
        <button type="button" onClick={() => onChange(clamp(value + 1))} aria-label="Sumar uno" className="o-press grid size-10 place-items-center text-[var(--color-text)] disabled:opacity-30" disabled={max != null && value >= max}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Opción de una lista: rótulo a la izquierda, lo elegido a la derecha. */
export function SelectRow<V extends string>({ label, value, onChange, options, placeholder }: { label: string; value: V; onChange: (value: V) => void; options: { value: V; label: string }[]; placeholder?: string }) {
  // Radix Select no admite "" como valor de una opción: se traduce.
  const EMPTY = "__vacio__";
  return (
    <div className="flex min-h-[52px] items-center gap-3 px-4 py-1.5">
      <span className="flex-1 text-[15px] font-bold">{label}</span>
      <Select value={value === "" ? EMPTY : value} onValueChange={(next) => onChange((next === EMPTY ? "" : next) as V)}>
        <SelectTrigger className="w-auto max-w-[60%] gap-1 border-0 bg-transparent px-0 py-1 text-[15px] font-medium text-[var(--color-muted)] focus:border-0">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="end" className="w-auto min-w-[210px]">
          {options.map((option) => (
            <SelectItem key={option.value || EMPTY} value={option.value || EMPTY}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Interruptor de sí/no con explicación corta. */
export function ToggleRow({ icon, tone, title, detail, checked, onChange, disabled }: { icon?: ReactNode; tone?: Tone; title: ReactNode; detail?: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const titleId = useId();
  return (
    <div className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
      {icon && tone ? <IconBadge tone={tone}>{icon}</IconBadge> : null}
      <div className="min-w-0 flex-1">
        <div id={titleId} className="text-[15px] font-bold leading-tight">{title}</div>
        {detail ? <div className="mt-0.5 text-[13px] font-medium leading-snug text-[var(--color-muted)]">{detail}</div> : null}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} labelledBy={titleId} />
    </div>
  );
}

/** Fila que lleva a otra pantalla o abre algo (con flechita). */
export function NavRow({ icon, tone, title, detail, value, to, onClick, href, danger }: { icon?: ReactNode; tone?: Tone; title: ReactNode; detail?: ReactNode; value?: ReactNode; to?: string; onClick?: () => void; href?: string; danger?: boolean }) {
  const body = (
    <>
      {icon && tone ? <IconBadge tone={tone}>{icon}</IconBadge> : null}
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[15px] font-bold leading-tight", danger && "text-[var(--color-danger)]")}>{title}</div>
        {detail ? <div className="mt-0.5 truncate text-[13px] font-medium text-[var(--color-muted)]">{detail}</div> : null}
      </div>
      {value != null ? <span className="max-w-[45%] flex-none truncate text-[15px] font-medium text-[var(--color-muted)]">{value}</span> : null}
      <ChevronRight className="size-[18px] flex-none text-[var(--color-faint)]" />
    </>
  );
  const cls = "o-press flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-surface-soft)]";
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (href) return <a href={href} className={cls} download>{body}</a>;
  return <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

/** Dato de solo lectura: rótulo a la izquierda, valor a la derecha. */
export function InfoRow({ label, value, valueClassName }: { label: ReactNode; value: ReactNode; valueClassName?: string }) {
  return (
    <div className="flex min-h-[48px] items-center gap-3 px-4 py-2.5">
      <span className="flex-1 text-[15px] font-bold">{label}</span>
      <span className={cn("max-w-[60%] text-right text-[15px] font-medium text-[var(--color-muted)]", valueClassName)}>{value}</span>
    </div>
  );
}

/** Botón de texto centrado a todo el ancho (ej. "Archivar", en rojo). */
export function ButtonRow({ children, onClick, danger, disabled }: { children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("o-press flex min-h-[50px] w-full items-center justify-center gap-2 px-4 text-[15px] font-bold hover:bg-[var(--color-surface-soft)] disabled:opacity-50", danger ? "text-[var(--color-danger)]" : "text-[var(--color-accent-strong)]")}
    >
      {children}
    </button>
  );
}

/** Foto/logo grande y centrado, con "Cambiar" debajo. */
export function PhotoPicker({ src, fallback, loading, onPick, onRemove, caption, dim }: { src: string | null; fallback: ReactNode; loading?: boolean; onPick: (file: File) => void; onRemove?: () => void; caption?: ReactNode; dim?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="o-item-in flex flex-col items-center gap-2 py-1">
      <button type="button" onClick={() => ref.current?.click()} className="o-press grid size-24 place-items-center overflow-hidden rounded-[28px] bg-[var(--color-surface)] shadow-[var(--shadow-float)]">
        {loading ? (
          <Spinner className="size-5 text-[var(--color-muted)]" />
        ) : src ? (
          <img src={src} alt="" className={cn("size-full object-contain p-2", dim && "opacity-40")} />
        ) : (
          fallback
        )}
      </button>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => ref.current?.click()} disabled={loading} className="o-press text-[15px] font-bold text-[var(--color-accent-strong)]">
          {loading ? "Cargando…" : src && !dim ? "Cambiar" : "Subir imagen"}
        </button>
        {onRemove ? (
          <button type="button" onClick={onRemove} className="o-press text-[15px] font-bold text-[var(--color-danger)]">
            Quitar
          </button>
        ) : null}
      </div>
      {caption ? <p className="max-w-[300px] text-center text-[13px] font-medium text-[var(--color-muted)]">{caption}</p> : null}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

/** Mensaje que se borra solo a los pocos segundos ("Guardado"). */
export function useFlash(ms = 2600): [string, (message: string) => void] {
  const [message, setMessage] = useState("");
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);
  return [
    message,
    (next: string) => {
      setMessage(next);
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (next) timer.current = window.setTimeout(() => setMessage(""), ms);
    },
  ];
}

/** Barra de guardar pegada abajo: aparece cuando hay cambios sin
 * guardar, y muestra "Guardado" un momento después de guardar. */
export function SaveBar({ dirty, saving, onSave, label = "Guardar cambios", flash, error }: { dirty: boolean; saving?: boolean; onSave: () => void; label?: string; flash?: string; error?: string }) {
  if (!dirty && !saving && !flash && !error) return null;
  return (
    <div className="pointer-events-none sticky bottom-0 z-20 -mx-4 mt-auto px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-6 [background:linear-gradient(to_top,var(--color-bg)_55%,transparent)] sm:-mx-5 sm:px-5">
      {error ? <p className="pointer-events-auto mb-2 text-center text-[13px] font-bold text-[var(--color-danger)]">{error}</p> : null}
      {dirty || saving ? (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className={buttonVariants({ size: "lg", className: "o-pop pointer-events-auto w-full" })}
        >
          {saving ? "Guardando…" : label}
        </button>
      ) : flash ? (
        <div className="o-pop pointer-events-auto mx-auto flex w-fit items-center gap-2 rounded-full bg-[var(--color-text)] px-4 py-2.5 text-[14px] font-bold text-[var(--color-surface)] shadow-[var(--shadow-modal)]">
          <Check className="size-4" />
          {flash}
        </div>
      ) : null}
    </div>
  );
}

/** v1365 -- botón principal grande y redondo de las ventanas (abajo, a todo
 * el ancho), el mismo de Cobro/Factura/Proveedor. */
export function SheetButton({ children, onClick, disabled, danger }: { children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  // v1391 -- mismo botón de toda la app (components/ui/button.tsx), tamaño grande.
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={buttonVariants({ size: "lg", variant: danger ? "danger" : "primary", className: "w-full" })}>
      {children}
    </button>
  );
}

// v1401 -- el control de pestañas vive en components/Segmented.tsx (pieza
// compartida con Portal/Taller/Admin, scripts/shared-kit.mjs).
export { Segmented } from "@/components/Segmented";
