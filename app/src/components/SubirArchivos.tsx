// "Tus fotos o videos (opcional)" en Nuevo video: cada archivo se sube
// apenas se elige (a Cloudflare R2, por /api/archivos), con su avance y su
// miniatura. Al crear el video, el pedido lleva las claves de los que
// quedaron listos. Mismo estilo de filas que el resto (formKit).
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Film, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONES } from "@/components/toneKit";
import { MAX_ARCHIVOS, MAX_BYTES } from "@/lib/logic/archivos";
import { SESION_TERMINADA } from "@/lib/api";

export interface ArchivoSubido {
  id: number;
  nombre: string;
  tipo: string;
  tamano: number;
  previa: string;
  progreso: number; // 0..1
  clave?: string;
  error?: string;
}

let siguienteId = 1;

function megas(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
}

/** Sube un archivo tal cual (sin armar un formulario), con avance. */
function subir(archivo: File, alAvanzar: (p: number) => void): Promise<string> {
  return new Promise((ok, falla) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/archivos?nombre=${encodeURIComponent(archivo.name)}`);
    xhr.setRequestHeader("Content-Type", archivo.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && alAvanzar(e.loaded / e.total);
    xhr.onload = () => {
      let datos: { clave?: string; error?: string } = {};
      try {
        datos = JSON.parse(xhr.responseText);
      } catch {
        /* respuesta vacía */
      }
      if (xhr.status === 401) window.dispatchEvent(new Event(SESION_TERMINADA));
      if (xhr.status >= 200 && xhr.status < 300 && datos.clave) ok(datos.clave);
      else falla(new Error(datos.error ?? "No se pudo subir. Intenta otra vez."));
    };
    xhr.onerror = () => falla(new Error("Sin conexión. Revisa el internet e intenta otra vez."));
    xhr.send(archivo);
  });
}

export function SubirArchivos({ archivos, onChange }: { archivos: ArchivoSubido[]; onChange: (cambiar: (prev: ArchivoSubido[]) => ArchivoSubido[]) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Las miniaturas viven en memoria: se sueltan al salir de la pantalla.
  const previas = useRef(new Set<string>());
  useEffect(() => () => previas.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function elegir(lista: FileList | null) {
    setAviso(null);
    const nuevos = Array.from(lista ?? []);
    const cupo = MAX_ARCHIVOS - archivos.length;
    if (nuevos.length > cupo) setAviso(`Máximo ${MAX_ARCHIVOS} archivos por video.`);
    for (const archivo of nuevos.slice(0, Math.max(0, cupo))) {
      const id = siguienteId++;
      const previa = URL.createObjectURL(archivo);
      previas.current.add(previa);
      const malo = !/^(image|video)\//.test(archivo.type) ? "Solo fotos o videos." : archivo.size > MAX_BYTES ? "Pesa más de 100 MB." : undefined;
      onChange((prev) => [...prev, { id, nombre: archivo.name, tipo: archivo.type, tamano: archivo.size, previa, progreso: 0, error: malo }]);
      if (malo) continue;
      const poner = (cambios: Partial<ArchivoSubido>) => onChange((prev) => prev.map((a) => (a.id === id ? { ...a, ...cambios } : a)));
      subir(archivo, (p) => poner({ progreso: p }))
        .then((clave) => poner({ clave, progreso: 1 }))
        .catch((e: Error) => poner({ error: e.message }));
    }
  }

  return (
    <>
      {archivos.map((a) => (
        <div key={a.id} className="o-item-in flex min-h-[64px] items-center gap-3 px-4 py-2">
          {a.tipo.startsWith("video/") ? (
            <span className="relative size-12 flex-none overflow-hidden rounded-[12px] bg-black">
              <video src={a.previa} muted playsInline preload="metadata" className="size-full object-cover" />
              <Film className="absolute bottom-1 right-1 size-3.5 text-white drop-shadow" />
            </span>
          ) : (
            <img src={a.previa} alt="" className="size-12 flex-none rounded-[12px] bg-[var(--color-surface-sunken)] object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold leading-tight">{a.nombre}</div>
            {a.error ? (
              <div className="mt-0.5 flex items-center gap-1 text-[13px] font-bold text-[var(--color-danger)]">
                <AlertTriangle className="size-3.5 flex-none" /> {a.error}
              </div>
            ) : a.clave ? (
              <div className="mt-0.5 text-[13px] font-medium text-[var(--color-muted)]">Listo · {megas(a.tamano)}</div>
            ) : (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-fill)]" role="progressbar" aria-valuenow={Math.round(a.progreso * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Subiendo ${a.nombre}`}>
                  <span className="block h-full rounded-full transition-[width] duration-200" style={{ width: `${Math.max(4, a.progreso * 100)}%`, background: TONES.blue.base }} />
                </span>
                <span className="w-10 flex-none text-right text-[12px] font-bold tabular-nums text-[var(--color-muted)]">{Math.round(a.progreso * 100)}%</span>
              </div>
            )}
          </div>
          <button type="button" onClick={() => onChange((prev) => prev.filter((x) => x.id !== a.id))} aria-label={`Quitar ${a.nombre}`} className="o-press o-hit grid size-7 flex-none place-items-center rounded-full bg-[var(--color-fill)] text-[var(--color-muted)]">
            <X className="size-4" strokeWidth={2.6} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={archivos.length >= MAX_ARCHIVOS}
        className={cn("o-press flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-surface-soft)] disabled:opacity-50")}
      >
        <span className="grid size-[30px] flex-none place-items-center rounded-[8px] text-white" style={{ background: TONES.blue.base }}>
          <ImagePlus className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-[var(--color-accent-strong)]">{archivos.length ? "Agregar más" : "Agregar fotos o videos"}</span>
          {aviso ? <span className="block text-[13px] font-bold text-[var(--color-danger)]">{aviso}</span> : null}
        </span>
      </button>
      <input
        ref={entrada}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        aria-label="Elegir fotos o videos"
        onChange={(e) => {
          elegir(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
