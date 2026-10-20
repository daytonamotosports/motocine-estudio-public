# Orion MotoCine — la app para pedir videos

Una app para el celular (y el PC), con el mismo estilo de Orion POS: escribes tu PIN, tocas **Nuevo video**,
eliges la falla, y en 15–25 minutos el video aparece listo para ver, descargar o compartir. No hay que entrar a
GitHub: la app crea el pedido por ti en el repositorio `motocine-estudio-public`, y el robot de siempre
(`estudio.yml`) arma el video.

Puedes subir también tus fotos o videos (opcional). Por ahora el robot los **recibe** con el pedido (le llega un
enlace por archivo), pero **todavía no los usa** dentro del video: eso llega en un próximo formato.

## Lo que tienes que hacer una sola vez en Cloudflare

### 1. El token de GitHub (para que la app pueda crear pedidos)

1. En GitHub: tu foto → **Settings** → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**.
2. Nombre: `orion-motocine`. Vencimiento: el que prefieras (cuando venza, se hace otro igual).
3. **Repository access** → **Only select repositories** → elige **solo** `daytonamotosports/motocine-estudio-public`.
4. **Permissions → Repository permissions**:
   - **Issues**: Read and write
   - **Actions**: Read and write
   - **Contents**: Read-only
   - (Metadata: Read-only se pone solo)
5. **Generate token** y copia el código (empieza por `github_pat_…`). No lo pegues en ningún archivo ni chat.

### 2. El almacenamiento de fotos y videos (R2) — ANTES de publicar

1. Cloudflare → **R2 Object Storage** → si te lo pide, actívalo (la capa gratis alcanza de sobra).
2. **Create bucket** → nombre exacto: `motocine-archivos` → **Create**.

Hazlo antes del paso 3: la app ya viene conectada a ese bucket y Cloudflare puede rechazar la publicación si no
existe. (Si algún día lo quitas, la app sigue funcionando; solo la subida dirá "Falta activar el almacenamiento
de archivos en Cloudflare".)

### 3. El Worker (ya lo creaste: `motocine-estudio-public`)

En Cloudflare → **Workers & Pages** → `motocine-estudio-public` → **Settings** → **Build**:

| Si la "Root directory" es… | Build command          | Deploy command       |
|----------------------------|------------------------|----------------------|
| `/` (la raíz)              | `npm ci && npm run build` | `npx wrangler deploy` |
| `app`                      | `npm ci && npm run build` | `npx wrangler deploy` |

Las dos sirven: en la raíz del repositorio van un `wrangler.toml` y un `package.json` que llevan a `app/`
(sus originales están en `app/raiz/`).

### 4. Las claves (secretas)

Mismo Worker → **Settings** → **Variables and Secrets** → **Add** → tipo **Secret**:

- `GITHUB_TOKEN` = el token del paso 1
- `APP_PIN` = el PIN que vas a usar para entrar (solo números, por ejemplo 6 cifras)

Guarda y vuelve a publicar (**Deployments** → **Retry deployment**, o con el próximo cambio).
Si cambias el PIN, todos los equipos tendrán que escribirlo otra vez (y los enlaces de archivos de pedidos
viejos dejan de servir).

### 5. (Opcional) Una dirección bonita

Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → por ejemplo
`motocine.orionpos.com.co`.

## Cómo funciona por dentro (para la próxima sesión de IA)

- `src/` la app (React 19 + Vite + Tailwind v4). El kit de Orion está COPIADO a mano (encabezado
  "COPIA de orion-pos…"): `components/formKit.tsx`, `ui/button|switch|select.tsx`, `Spinner`, `SectionTitle`,
  `Segmented`, `LargeTitle`, `statusKit` (EmptyState), `toneKit` (recortado), `index.css`/`kit.css` (recortados).
  El rojo Daytona solo cambia los tokens `--color-accent*` al final de `index.css`.
- `src/lib/logic/` lógica pura que usan la app y el Worker: cuerpo del pedido (`pedido.ts`, formato exacto del
  formulario), lector de comentarios del robot (`comentarios.ts`), los 5 pasos (`pasos.ts`), sesión con HMAC
  (`sesion.ts`) y archivos con enlaces firmados (`archivos.ts`).
- `worker/index.ts` la API: `/api/login`, `/api/catalogo`, `/api/pedidos`, `/api/pedidos/:n`,
  `/api/pedidos/:n/video` (con rangos), `/api/pedidos/:n/hoja`, `/api/pedidos/:n/rehacer`, `/api/archivos`.
- Archivos: `subidas/<fecha>-<nombre>` en R2; el pedido lleva `### Archivos` con un enlace por línea
  `https://<sitio>/api/archivos/<clave>?t=<HMAC(APP_PIN, "archivo:"+clave)>` que el robot puede bajar sin PIN.
  El repositorio es público: cualquiera que vea el pedido puede abrir ESE archivo (no los demás).
- "Volver a intentar" deja un comentario 🔁 en el pedido y lanza `estudio.yml` (workflow_dispatch). Sugerencia
  para el workflow: `run-name: "Video #${{ github.event.issue.number || inputs.issue }}"` (la app ya lo reconoce
  y así encuentra la corrida exacta).

## Probar en este equipo (sin tocar GitHub)

```bash
npm ci
npm run build            # pruebas + revisión de tipos + app
npm run typecheck:worker
npm run preview          # http://localhost:8788  PIN 2468 (GitHub y R2 de mentiras)
python scripts/capturas.py /ruta/capturas   # celular claro/oscuro y PC + hoja.png
```
