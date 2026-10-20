// Pantalla "Inicio": el botón "Nuevo video" y la lista "Mis videos". Si hay
// alguno armándose, la lista se actualiza sola cada 20 segundos.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clapperboard, Plus, WifiOff } from "lucide-react";
import { FormGroup, FormPage } from "@/components/formKit";
import { LargeTitle } from "@/components/LargeTitle";
import { EmptyState } from "@/components/statusKit";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Marca, PedidoRow } from "@/components/piezas";
import { api } from "@/lib/api";
import type { PedidoCorto } from "@/lib/logic/tipos";

const CADA_MS = 20_000;

export function Inicio() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<PedidoCorto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(Date.now());

  const cargar = useCallback(async () => {
    try {
      const lista = await api<PedidoCorto[]>("/api/pedidos");
      setPedidos([...lista].sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAhora(Date.now());
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hayArmando = !!pedidos?.some((p) => p.estado === "armando");
  useEffect(() => {
    if (!hayArmando) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, CADA_MS);
    return () => window.clearInterval(id);
  }, [hayArmando, cargar]);

  return (
    <FormPage>
      <div className="o-page-fade flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Marca />
          <LargeTitle title="Videos" subtitle="Pide un video y el robot lo arma solo: guion, voz, revisión y video." />
        </div>
        <Button size="lg" className="w-full" onClick={() => navigate("/nuevo")}>
          <Plus strokeWidth={2.8} />
          Nuevo video
        </Button>

        {pedidos === null && !error ? (
          <div className="o-page-fallback flex justify-center py-10 text-[var(--color-muted)]">
            <Spinner className="size-6" label="Cargando videos" />
          </div>
        ) : error && !pedidos ? (
          <EmptyState icon={<WifiOff />} title="No pude traer tus videos" text={error} action={{ label: "Intentar otra vez", onClick: () => void cargar() }} />
        ) : pedidos && pedidos.length === 0 ? (
          <EmptyState icon={<Clapperboard />} title="Todavía no hay videos" text="Toca “Nuevo video”, elige la falla y en unos 20 minutos lo tienes aquí." />
        ) : pedidos ? (
          <FormGroup title="Mis videos" footer={hayArmando ? "Se actualiza solo mientras se arma un video." : `${pedidos.length} ${pedidos.length === 1 ? "video" : "videos"}`}>
            {pedidos.map((p) => (
              <PedidoRow key={p.numero} pedido={p} ahora={ahora} />
            ))}
          </FormGroup>
        ) : null}
      </div>
    </FormPage>
  );
}
