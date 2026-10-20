// Pantalla "Detalle" de un video: los 5 pasos (Pedido recibido → … → Listo)
// mientras se arma, y cuando está listo el video para ver, descargar y
// compartir, la hoja de cuadros y las notas de los revisores. Si no salió,
// dice por qué y ofrece "Volver a intentar".
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Download, ExternalLink, Lightbulb, RotateCw, Share2, WifiOff } from "lucide-react";
import { ButtonRow, FormGroup, InfoRow } from "@/components/formKit";
import { LargeTitle } from "@/components/LargeTitle";
import { EmptyState } from "@/components/statusKit";
import { Spinner } from "@/components/Spinner";
import { TONES } from "@/components/toneKit";
import { Button } from "@/components/ui/button";
import { BackLink, BarraAbajo, EstadoPill, Pagina, PasoRow, TextoRow } from "@/components/piezas";
import { api } from "@/lib/api";
import { avisar } from "@/lib/avisos";
import { duracion, fechaCorta } from "@/lib/formato";
import { minutosDesde } from "@/lib/logic/pasos";
import type { PedidoDetalle } from "@/lib/logic/tipos";

const CADA_MS = 15_000;

export function Detalle() {
  const { numero } = useParams();
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(Date.now());
  const [rehaciendo, setRehaciendo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPedido(await api<PedidoDetalle>(`/api/pedidos/${numero}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAhora(Date.now());
    }
  }, [numero]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const armando = pedido?.estado === "armando";
  useEffect(() => {
    if (!armando) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, CADA_MS);
    return () => window.clearInterval(id);
  }, [armando, cargar]);

  async function rehacer() {
    setRehaciendo(true);
    try {
      await api(`/api/pedidos/${numero}/rehacer`, { method: "POST", body: {} });
      avisar("Listo, lo vuelvo a armar.", "ok");
      setConfirmar(false);
      await cargar();
    } catch (e) {
      avisar((e as Error).message, "error");
    } finally {
      setRehaciendo(false);
    }
  }

  if (!pedido) {
    return (
      <Pagina>
        <BackLink to="/" label="Videos" />
        {error ? (
          <EmptyState icon={<WifiOff />} title="No pude abrir este video" text={error} action={{ label: "Intentar otra vez", onClick: () => void cargar() }} />
        ) : (
          <div className="o-page-fallback flex justify-center py-16 text-[var(--color-muted)]">
            <Spinner className="size-6" label="Cargando" />
          </div>
        )}
      </Pagina>
    );
  }

  const lleva = minutosDesde(pedido.desde, ahora);
  const subtitulo = [pedido.falla, pedido.escenario, pedido.letra === "Aleatoria" ? "respuesta aleatoria" : `respuesta ${pedido.letra}`].filter(Boolean).join(" · ");
  const listo = pedido.estado === "listo" && pedido.video;
  const resumen = pedido.resumen;

  const estado = (
    <FormGroup title="Estado" footer={armando ? `Lleva ${duracion(lleva)} · suele tardar 15–25 min. Puedes salir: el video se sigue armando.` : `Pedido ${fechaCorta(pedido.creado)}`}>
      {pedido.pasos.map((paso) => (
        <PasoRow key={paso.id} paso={paso} detalle={paso.estado === "activo" && paso.id === "listo" ? "Subiendo el video…" : undefined} />
      ))}
    </FormGroup>
  );

  const notas =
    resumen && resumen.notas.length ? (
      <FormGroup title="Notas de calidad" footer="Lo que dijeron los revisores automáticos.">
        {resumen.notas.map((n, i) => (
          <InfoRow key={`${n.etiqueta}-${i}`} label={n.etiqueta} value={n.valor || "—"} valueClassName={puntajeBueno(n.valor) ? "font-bold text-[var(--tone-green-ink)]" : undefined} />
        ))}
      </FormGroup>
    ) : null;

  return (
    <Pagina conBarra={!listo} ancha={!!listo}>
      <div className="o-page-forward flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <BackLink to="/" label="Videos" />
          <LargeTitle title={pedido.nombre} subtitle={subtitulo}>
            <EstadoPill pedido={pedido} ahora={ahora} />
          </LargeTitle>
        </div>

        {listo ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
            <div className="flex flex-col gap-3 lg:sticky lg:top-4">
              <div className="overflow-hidden rounded-[22px] bg-black shadow-[var(--shadow-float)]">
                <video key={pedido.video} src={pedido.video!} controls playsInline preload="metadata" className="mx-auto aspect-[9/16] max-h-[72vh] w-full bg-black object-contain" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Button asChild variant="secondary" size="lg">
                  <a href={`${pedido.video}?descargar=1`} download={`video-${pedido.numero}.mp4`}>
                    <Download /> Descargar
                  </a>
                </Button>
                <BotonCompartir pedido={pedido} />
              </div>
            </div>
            <div className="flex flex-col gap-6">
              {notas}
              {resumen?.motivos.length ? (
                <FormGroup title="Para mejorar" footer="No impidieron el video, pero sirven para el próximo.">
                  {resumen.motivos.map((m, i) => (
                    <TextoRow key={i} icon={<Lightbulb className="size-[18px]" style={{ color: TONES.amber.base }} />}>
                      {m}
                    </TextoRow>
                  ))}
                </FormGroup>
              ) : null}
              {pedido.hoja ? (
                <FormGroup title="Hoja de cuadros">
                  <img src={pedido.hoja} alt="Cuadros del video" loading="lazy" className="block w-full bg-[var(--color-surface-sunken)]" />
                </FormGroup>
              ) : null}
              {estado}
              <FormGroup footer={confirmar ? "Se arma uno nuevo con el mismo pedido (15–25 min). El de ahora sigue en GitHub." : undefined}>
                <ButtonRow onClick={() => (confirmar ? void rehacer() : setConfirmar(true))} disabled={rehaciendo}>
                  {rehaciendo ? <Spinner className="size-4" /> : <RotateCw className="size-4" />}
                  {confirmar ? "Toca otra vez para rehacerlo" : "Rehacer el video"}
                </ButtonRow>
              </FormGroup>
              <EnlaceGithub href={pedido.enlaceGithub} />
            </div>
          </div>
        ) : (
          <>
            {estado}
            {pedido.estado === "problema" ? (
              <FormGroup title="Qué pasó" footer="Puedes volver a intentarlo; si se repite, pide otra falla.">
                {(resumen?.motivos.length ? resumen.motivos : ["El robot no pudo terminar el video."]).map((m, i) => (
                  <TextoRow key={i} icon={<AlertTriangle className="size-[18px]" style={{ color: TONES.amber.base }} />}>
                    {m}
                  </TextoRow>
                ))}
              </FormGroup>
            ) : null}
            {pedido.estado === "problema" ? notas : null}
            <EnlaceGithub href={pedido.enlaceGithub} />
          </>
        )}
      </div>

      {pedido.estado === "problema" ? (
        <BarraAbajo>
          <Button size="lg" className="w-full" loading={rehaciendo} onClick={() => void rehacer()}>
            {!rehaciendo ? <RotateCw /> : null}
            {rehaciendo ? "Pidiendo…" : "Volver a intentar"}
          </Button>
        </BarraAbajo>
      ) : null}
    </Pagina>
  );
}

function puntajeBueno(valor: string): boolean {
  const m = /^(\d+)\/100$/.exec(valor);
  return !!m && Number(m[1]) >= 85;
}

function EnlaceGithub({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="o-press mx-auto flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-muted)]">
      Ver el pedido en GitHub <ExternalLink className="size-3.5" />
    </a>
  );
}

/** Compartir: el ARCHIVO del video si el celular lo permite (WhatsApp,
 * Instagram...); si no, se copia el enlace público de GitHub. Bajar el
 * video tarda un poco y algunos celulares ya no dejan compartir después de
 * esperar: en ese caso queda listo y basta tocar otra vez. */
function BotonCompartir({ pedido }: { pedido: PedidoDetalle }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preparando, setPreparando] = useState(false);

  async function copiarEnlace() {
    const enlace = pedido.videoPublico ?? location.href;
    try {
      await navigator.clipboard.writeText(enlace);
      avisar("Enlace copiado. Pégalo donde quieras.", "ok");
    } catch {
      avisar("No pude copiar el enlace.", "error");
    }
  }

  async function compartir() {
    const puedeArchivos = typeof navigator.share === "function" && typeof navigator.canShare === "function";
    if (!puedeArchivos) return copiarEnlace();
    let f = archivo;
    if (!f) {
      setPreparando(true);
      try {
        const res = await fetch(pedido.video!, { credentials: "same-origin" });
        if (!res.ok) throw new Error();
        f = new File([await res.blob()], `${pedido.nombre.replace(/[^\w-]+/g, "-") || "video"}.mp4`, { type: "video/mp4" });
        setArchivo(f);
      } catch {
        setPreparando(false);
        return copiarEnlace();
      }
      setPreparando(false);
    }
    if (!navigator.canShare({ files: [f] })) return copiarEnlace();
    try {
      await navigator.share({ files: [f], title: pedido.nombre });
    } catch (e) {
      if ((e as DOMException).name === "NotAllowedError") avisar("Video listo. Toca “Compartir” otra vez.", "info");
      // AbortError = la persona cerró el menú: no pasa nada.
    }
  }

  return (
    <Button size="lg" loading={preparando} onClick={() => void compartir()}>
      {!preparando ? <Share2 /> : null}
      {preparando ? "Preparando…" : "Compartir"}
    </Button>
  );
}
