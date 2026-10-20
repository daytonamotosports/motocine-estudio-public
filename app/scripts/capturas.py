"""Capturas de Orion MotoCine (celular claro/oscuro y PC) contra el servidor de prueba.

Uso:  npm run build && npm run preview   (en otra terminal)
      python scripts/capturas.py <carpeta-de-salida>

Saca: Entrar, Inicio, Nuevo video, Detalle (listo), Detalle (armando), Detalle (con problema),
revisa que a 360 px de ancho ninguna pantalla tenga desplazamiento horizontal y arma una hoja
con todas (hoja.png).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

BASE = os.environ.get('MOTOCINE_URL', 'http://localhost:8788')
PIN = os.environ.get('APP_PIN', '2468')
CHROMIUM = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium')
PANTALLAS = [
    ('entrar', 'Entrar', None),
    ('inicio', 'Inicio', '/'),
    ('nuevo', 'Nuevo video', '/nuevo'),
    ('listo', 'Detalle (listo)', '/video/14'),
    ('armando', 'Detalle (armando)', '/video/15'),
    ('problema', 'Detalle (con problema)', '/video/12'),
]
MODOS = [('cel-claro', 390, 844, 'light'), ('cel-oscuro', 390, 844, 'dark'), ('pc-claro', 1280, 800, 'light')]


def esperar(page, clave: str) -> None:
    page.wait_for_load_state('networkidle')
    if clave == 'nuevo':
        page.get_by_text('Balancines desajustados').click()
        muestras = [m for m in (os.environ.get('MUESTRA_HOJA'), os.environ.get('MUESTRA_VIDEO')) if m]
        if muestras:  # dos archivos subidos, para ver las miniaturas
            page.get_by_label('Elegir fotos o videos').set_input_files(muestras)
            page.get_by_text('Listo ·').nth(len(muestras) - 1).wait_for(timeout=20000)
    if clave == 'listo':
        # Muestra un cuadro del video (no la pantalla negra del principio).
        page.wait_for_function("document.querySelector('video') && document.querySelector('video').readyState >= 1", timeout=15000)
        page.evaluate("""() => new Promise((ok) => { const v = document.querySelector('video');
            v.addEventListener('seeked', () => ok(), { once: true }); v.currentTime = 6; setTimeout(ok, 4000); })""")
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(700)  # animaciones de entrada


def entrar(page) -> None:
    page.goto(BASE + '/')
    page.get_by_label('PIN').fill(PIN)
    page.get_by_role('button', name='Entrar').click()
    page.get_by_text('Mis videos').wait_for()


def main(salida: Path) -> int:
    salida.mkdir(parents=True, exist_ok=True)
    hechas: list[tuple[str, str, Path]] = []
    problemas: list[str] = []
    proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    with sync_playwright() as p:
        nav = p.chromium.launch(executable_path=CHROMIUM, proxy={'server': proxy, 'bypass': 'localhost,127.0.0.1'} if proxy else None)
        for modo, ancho, alto, esquema in MODOS:
            ctx = nav.new_context(viewport={'width': ancho, 'height': alto}, device_scale_factor=2 if ancho < 600 else 1,
                                  color_scheme=esquema, locale='es-CO', timezone_id='America/Bogota', ignore_https_errors=True)
            page = ctx.new_page()
            for clave, titulo, ruta in PANTALLAS:
                if ruta is None:
                    page.goto(BASE + '/')
                    page.get_by_label('PIN').wait_for()
                else:
                    if not ctx.cookies():
                        entrar(page)
                    page.goto(BASE + ruta)
                esperar(page, clave)
                archivo = salida / f'{clave}-{modo}.png'
                if ancho < 600:
                    # Pantalla tan alta como la página: así la barra de abajo (sticky) sale abajo, donde se ve en el celular.
                    page.set_viewport_size({'width': ancho, 'height': max(alto, page.evaluate('document.documentElement.scrollHeight'))})
                    page.wait_for_timeout(300)
                page.screenshot(path=str(archivo))
                page.set_viewport_size({'width': ancho, 'height': alto})
                hechas.append((modo, titulo, archivo))
            ctx.close()
        # Celular angosto (360 px): nada se puede salir por los lados.
        ctx = nav.new_context(viewport={'width': 360, 'height': 780}, ignore_https_errors=True)
        page = ctx.new_page()
        for clave, titulo, ruta in PANTALLAS:
            if ruta is None:
                page.goto(BASE + '/')
            else:
                if not ctx.cookies():
                    entrar(page)
                page.goto(BASE + ruta)
            esperar(page, clave)
            ancho_doc = page.evaluate('document.documentElement.scrollWidth')
            if ancho_doc > 360:
                problemas.append(f'{titulo}: {ancho_doc}px de ancho a 360px')
        ctx.close()
        nav.close()
    hoja_contacto(hechas, salida / 'hoja.png')
    print(f'{len(hechas)} capturas en {salida}')
    print('360 px sin desplazamiento horizontal: ' + ('OK' if not problemas else '; '.join(problemas)))
    return 1 if problemas else 0


def hoja_contacto(hechas, destino: Path) -> None:
    """Una fila por pantalla: celular claro, celular oscuro y PC."""
    alto_fila = 760
    filas = []
    for _, titulo, _ in PANTALLAS:
        fotos = [Image.open(a).convert('RGB') for m, t, a in hechas if t == titulo]
        fotos = [f.resize((int(f.width * min(alto_fila / f.height, 1)), int(f.height * min(alto_fila / f.height, 1)))) for f in fotos]
        filas.append((titulo, fotos))
    ancho = max(sum(f.width for f in fs) + 40 * (len(fs) + 1) for _, fs in filas)
    total = sum(max(f.height for f in fs) + 110 for _, fs in filas) + 20
    hoja = Image.new('RGB', (ancho, total), (228, 228, 222))
    dibujo = ImageDraw.Draw(hoja)
    try:
        letra = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 38)
    except OSError:
        letra = ImageFont.load_default()
    y = 20
    for titulo, fotos in filas:
        dibujo.text((40, y + 10), titulo, fill=(22, 24, 28), font=letra)
        x = 40
        for f in fotos:
            hoja.paste(f, (x, y + 70))
            x += f.width + 40
        y += max(f.height for f in fotos) + 110
    hoja.save(destino)


if __name__ == '__main__':
    raise SystemExit(main(Path(sys.argv[1] if len(sys.argv) > 1 else 'capturas')))
