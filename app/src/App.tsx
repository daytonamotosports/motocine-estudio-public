// Orion MotoCine: la app para pedir videos de motos sin entrar a GitHub.
// Primero revisa si ya hay sesión (galleta del PIN); si no, pide el PIN.
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Spinner } from "@/components/Spinner";
import { Avisos } from "@/lib/avisos";
import { api, SESION_TERMINADA } from "@/lib/api";
import { Entrar } from "@/screens/Entrar";
import { Inicio } from "@/screens/Inicio";
import { NuevoVideo } from "@/screens/NuevoVideo";
import { Detalle } from "@/screens/Detalle";

type Sesion = "revisando" | "fuera" | "dentro";

export function App() {
  const [sesion, setSesion] = useState<Sesion>("revisando");

  useEffect(() => {
    api("/api/sesion")
      .then(() => setSesion("dentro"))
      .catch(() => setSesion("fuera"));
    const alTerminar = () => setSesion("fuera");
    window.addEventListener(SESION_TERMINADA, alTerminar);
    return () => window.removeEventListener(SESION_TERMINADA, alTerminar);
  }, []);

  return (
    <>
      <Avisos />
      {sesion === "revisando" ? (
        <div className="o-page-fallback grid min-h-[var(--app-h)] place-items-center text-[var(--color-muted)]">
          <Spinner className="size-6" label="Cargando" />
        </div>
      ) : sesion === "fuera" ? (
        <Entrar onEntrar={() => setSesion("dentro")} />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/nuevo" element={<NuevoVideo />} />
            <Route path="/video/:numero" element={<Detalle />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      )}
    </>
  );
}
