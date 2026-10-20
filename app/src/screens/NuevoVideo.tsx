// Pantalla "Nuevo video": se elige formato, falla (del catálogo), escenario
// y respuesta correcta; "Crear video" crea el pedido en GitHub y lleva al
// Detalle, donde se ve cómo avanza.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AudioLines, Check, RotateCw, Sun, Wrench } from "lucide-react";
import { ButtonRow, FormGroup, IconBadge, Segmented, TextRow } from "@/components/formKit";
import { LargeTitle } from "@/components/LargeTitle";
import { Spinner } from "@/components/Spinner";
import { TONES } from "@/components/toneKit";
import { Button } from "@/components/ui/button";
import { BackLink, BarraAbajo, Pagina } from "@/components/piezas";
import { SubirArchivos, type ArchivoSubido } from "@/components/SubirArchivos";
import { api } from "@/lib/api";
import { avisar } from "@/lib/avisos";
import { recortar } from "@/lib/formato";
import { FORMATOS, LETRAS, NOMBRE_MAX, type Escenario, type Letra } from "@/lib/logic/pedido";
import type { Falla } from "@/lib/logic/tipos";
import { cn } from "@/lib/utils";

export function NuevoVideo() {
  const navigate = useNavigate();
  const [fallas, setFallas] = useState<Falla[] | null>(null);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [falla, setFalla] = useState("");
  const [escenario, setEscenario] = useState<Escenario>("Taller");
  const [letra, setLetra] = useState<Letra>("Aleatoria");
  const [nombre, setNombre] = useState("");
  const [faltaFalla, setFaltaFalla] = useState(false);
  const [creando, setCreando] = useState(false);
  const [archivos, setArchivos] = useState<ArchivoSubido[]>([]);
  const subiendo = archivos.some((a) => !a.clave && !a.error);
  const grupoFalla = useRef<HTMLDivElement>(null);
  const formato = FORMATOS[0];

  async function cargarCatalogo() {
    setErrorCatalogo(null);
    try {
      setFallas(await api<Falla[]>("/api/catalogo"));
    } catch (e) {
      setErrorCatalogo((e as Error).message);
    }
  }
  useEffect(() => {
    void cargarCatalogo();
  }, []);

  async function crear() {
    if (!falla) {
      setFaltaFalla(true);
      grupoFalla.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (subiendo) return avisar("Espera a que terminen de subir los archivos.", "info");
    setCreando(true);
    try {
      const claves = archivos.flatMap((a) => (a.clave ? [a.clave] : []));
      const r = await api<{ numero: number }>("/api/pedidos", { method: "POST", body: { formato: formato.valor, falla, escenario, letra, nombre, archivos: claves } });
      avisar("¡Pedido enviado! Ya empieza a armarse.", "ok");
      navigate(`/video/${r.numero}`, { replace: true });
    } catch (e) {
      avisar((e as Error).message, "error");
      setCreando(false);
    }
  }

  return (
    <Pagina conBarra>
      <div className="o-page-forward flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <BackLink to="/" label="Videos" />
          <LargeTitle title="Nuevo video" subtitle="Elige la falla y listo. El robot hace el guion, la voz y el video." />
        </div>

        <FormGroup title="Formato">
          <div className="flex items-center gap-3 px-4 py-3">
            <IconBadge tone={TONES.rose}>
              <AudioLines className="size-[18px]" />
            </IconBadge>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold leading-tight">{formato.titulo}</div>
              <div className="mt-0.5 text-[13px] font-medium leading-snug text-[var(--color-muted)]">{formato.descripcion}</div>
            </div>
            <Check className="size-5 flex-none text-[var(--color-accent-strong)]" strokeWidth={2.8} aria-label="Elegido" />
          </div>
        </FormGroup>

        <div ref={grupoFalla}>
          <FormGroup
            title="Falla"
            footer={faltaFalla ? <span className="font-bold text-[var(--color-danger)]">Elige una falla para seguir.</span> : "Cada falla trae su sonido real y su escena “por dentro”."}
          >
            {fallas === null && !errorCatalogo ? (
              <div className="flex min-h-[52px] items-center gap-3 px-4 text-[15px] font-medium text-[var(--color-muted)]">
                <Spinner className="size-4" /> Cargando fallas…
              </div>
            ) : errorCatalogo ? (
              <>
                <div className="px-4 py-3 text-[14px] font-medium text-[var(--color-muted)]">{errorCatalogo}</div>
                <ButtonRow onClick={() => void cargarCatalogo()}>
                  <RotateCw className="size-4" /> Intentar otra vez
                </ButtonRow>
              </>
            ) : (
              fallas?.map((f) => {
                const elegida = f.id === falla;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    onClick={() => {
                      setFalla(f.id);
                      setFaltaFalla(false);
                    }}
                    className="o-press flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-surface-soft)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-[15px] leading-tight", elegida ? "font-extrabold" : "font-bold")}>{f.nombre}</div>
                      {f.explicacion ? <div className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug text-[var(--color-muted)]">{recortar(f.explicacion, 90)}</div> : null}
                    </div>
                    <span className="grid size-6 flex-none place-items-center">
                      {elegida ? <Check key="si" className="o-check-pop size-5 text-[var(--color-accent-strong)]" strokeWidth={2.8} /> : null}
                    </span>
                  </button>
                );
              })
            )}
          </FormGroup>
        </div>

        <FormGroup title="Escenario" footer="Dónde aparece el mecánico en el video.">
          <div className="px-3 py-3">
            <Segmented
              label="Escenario"
              size="lg"
              value={escenario}
              onChange={setEscenario}
              options={[
                { value: "Taller", label: "Taller", icon: <Wrench /> },
                { value: "Patio", label: "Patio", icon: <Sun /> },
              ]}
            />
          </div>
        </FormGroup>

        <FormGroup title="Respuesta correcta" footer="En qué opción queda la respuesta. Con “Aleatoria” la elige el robot.">
          <div className="px-3 py-3">
            <Segmented label="Respuesta correcta" size="lg" value={letra} onChange={setLetra} options={LETRAS.map((l) => ({ value: l, label: l }))} />
          </div>
        </FormGroup>

        <FormGroup title="Tus fotos o videos (opcional)" footer="Hasta 10, de máximo 100 MB cada uno. Por ahora el robot los recibe con el pedido; usarlos dentro del video llega en un próximo formato.">
          <SubirArchivos archivos={archivos} onChange={setArchivos} />
        </FormGroup>

        <FormGroup title="Nombre (opcional)" footer="Para encontrarlo fácil en la lista. Si lo dejas vacío, se usa el nombre de la falla.">
          <TextRow label="Nombre del video" value={nombre} onChange={setNombre} placeholder="ej. balancines-octubre" maxLength={NOMBRE_MAX} enterKeyHint="done" />
        </FormGroup>
      </div>

      <BarraAbajo>
        <Button size="lg" className="w-full" loading={creando} disabled={subiendo} onClick={() => void crear()}>
          {creando ? "Enviando…" : subiendo ? "Subiendo archivos…" : "Crear video"}
        </Button>
      </BarraAbajo>
    </Pagina>
  );
}
