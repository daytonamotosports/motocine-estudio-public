// Pantalla "Entrar": el PIN del dueño. El Worker revisa el PIN y deja una
// galleta segura por 30 días (no hay usuarios ni contraseñas que recordar).
import { useState } from "react";
import { Clapperboard } from "lucide-react";
import { FormGroup, FormPage, TextRow } from "@/components/formKit";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export function Entrar({ onEntrar }: { onEntrar: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [entrando, setEntrando] = useState(false);

  async function entrar() {
    if (!pin.trim()) return setError("Escribe el PIN.");
    setEntrando(true);
    try {
      await api("/api/login", { method: "POST", body: { pin } });
      onEntrar();
    } catch (e) {
      setError((e as Error).message);
      setPin("");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <FormPage>
      <form
        className="o-page-fade mx-auto flex w-full max-w-[420px] flex-col gap-6 pt-[8vh]"
        onSubmit={(e) => {
          e.preventDefault();
          void entrar();
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-[84px] place-items-center rounded-[24px] bg-[var(--color-accent)] text-white shadow-[var(--shadow-accent)]">
            <Clapperboard className="size-10" strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em]">MotoCine</h1>
            <p className="mt-1 text-[14px] font-semibold text-[var(--color-muted)]">Daytona Moto Sport · videos para redes</p>
          </div>
        </div>
        <FormGroup footer="Es el PIN que pusiste en Cloudflare. Queda guardado en este equipo por 30 días.">
          <TextRow
            label="PIN"
            value={pin}
            onChange={(v) => {
              setPin(v.replace(/\D/g, "").slice(0, 12));
              setError(undefined);
            }}
            error={error}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            placeholder="••••"
            aria-label="PIN"
          />
        </FormGroup>
        <Button type="submit" size="lg" className="w-full" loading={entrando}>
          {entrando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </FormPage>
  );
}
