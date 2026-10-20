"""Renderiza un proyecto: cuadros del motor HTML (Chromium) -> FFmpeg -> MP4 con voz, música y efectos."""
from __future__ import annotations

import asyncio
import base64
import functools
import http.server
import json
import os
import shutil
import subprocess
import threading
import urllib.parse
import time
from pathlib import Path

from .audio import make_tracks
from .spec import ROOT, Project


# WebGL por software (SwiftShader): funciona igual en cualquier PC o servidor sin tarjeta gráfica.
GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb']


class _Handler(http.server.SimpleHTTPRequestHandler):
    project_dir: Path = ROOT

    def translate_path(self, path):
        path = urllib.parse.unquote(path.split('?', 1)[0].split('#', 1)[0])   # nombres con espacios o tildes
        if path.startswith('/project/'):
            return str(self.project_dir / path[len('/project/'):])
        return str(ROOT / path.lstrip('/'))

    def log_message(self, *a):
        pass


def serve(project_dir: Path):
    handler = type('H', (_Handler,), {'project_dir': project_dir})
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_address[1]}'


def chromium_path() -> str | None:
    """Ruta de Chromium: variable MOTOCINE_CHROMIUM, la de Playwright o una del sistema."""
    if os.getenv('MOTOCINE_CHROMIUM'):
        return os.getenv('MOTOCINE_CHROMIUM')
    for c in ('/opt/pw-browsers/chromium', 'chromium', 'chromium-browser', 'google-chrome'):
        p = shutil.which(c) if not c.startswith('/') else (c if Path(c).exists() else None)
        if p:
            return p
    return None  # Playwright usará su navegador descargado


async def _open_page(browser, base_url: str, spec: dict):
    page = await browser.new_page(viewport={'width': spec['width'], 'height': spec['height']})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    await page.goto(base_url + '/engine/index.html')
    await page.wait_for_function('window.MC_READY === true')
    info = await page.evaluate('spec => MC.init(spec)', spec)
    if errors:
        raise RuntimeError('Error en el motor: ' + errors[0])
    return page, info, errors


async def _render_range(browser, base_url, spec, frames, out_path, fps, quality, progress):
    # el grano de película lo pone FFmpeg (en C, varios núcleos) y no el navegador: ahorra ~60 ms por cuadro
    grain = spec.get('grain', True) is not False
    page, _, errors = await _open_page(browser, base_url, {**spec, 'grain': False})
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-',
                           *(['-vf', 'noise=alls=5:allf=t'] if grain else []),
                           '-c:v', 'libx264', '-preset', 'faster', '-crf', '20', '-maxrate', '6M', '-bufsize', '12M',
                           '-pix_fmt', 'yuv420p', '-r', str(fps), str(out_path)], stdin=subprocess.PIPE)
    try:
        for i in frames:
            url = await page.evaluate('([t, q]) => MC.frame(t, "jpeg", q)', [i / fps, quality])
            if errors:
                raise RuntimeError(f'Error en el motor en el cuadro {i} ({i / fps:.2f} s): {errors[0]}')
            ff.stdin.write(base64.b64decode(url.split(',', 1)[1]))
            progress()
    finally:
        ff.stdin.close()
        ff.wait()
        await page.close()
    if ff.returncode != 0:
        raise RuntimeError(f'FFmpeg falló al codificar {out_path.name}')


SCENES3D = {'chain_drive', 'sprocket_wear', 'diorama', 'kit', 'studio', 'iso'}   # igual que en engine/core.js


def default_workers(spec: dict) -> int:
    """Con escenas 3D, un solo navegador ya ocupa todos los núcleos (SwiftShader dibuja con varios hilos):
    abrir más solo los hace competir (medido: 1 proceso 0.99 cuadros/s, 4 procesos 0.87). Sin 3D sí conviene repartir."""
    if any(s['type'] in SCENES3D for s in spec.get('scenes', [])):
        return 1
    return max(1, min(4, os.cpu_count() or 1))


def frame_range(total: int, part: int, parts: int) -> range:
    """Cuadros de la parte `part` (0..parts-1) cuando el video se reparte entre varias máquinas."""
    if not 0 <= part < parts:
        raise ValueError(f'Parte {part} fuera de rango (0..{parts - 1})')
    a, b = total * part // parts, total * (part + 1) // parts
    return range(a, b)


async def _render_video(proj: Project, out: Path, workers: int, fps: int, quality: float, log, frames: range | None = None):
    from playwright.async_api import async_playwright
    spec = proj.engine_spec
    frames = frames if frames is not None else range(int(round(spec['output_duration'] * fps)))
    total = len(frames)
    srv, base = serve(proj.dir)
    seg_dir = proj.build / f'segments_{frames.start}'
    shutil.rmtree(seg_dir, ignore_errors=True)
    seg_dir.mkdir(parents=True)
    done = [0]
    t0 = time.time()
    last = [0.0]

    def progress():
        done[0] += 1
        now = time.time()
        if now - last[0] > 5 or done[0] == total:
            last[0] = now
            el = now - t0
            eta = el / done[0] * (total - done[0])
            log(f'  cuadros {done[0]}/{total}  ({done[0] / el:.1f}/s, faltan ~{eta:.0f} s)')

    try:
        async with async_playwright() as pw:
            kw = {'args': GL_ARGS}
            exe = chromium_path()
            if exe:
                kw['executable_path'] = exe
            browser = await pw.chromium.launch(**kw)
            chunk = -(-total // workers)
            ranges = [frames[i:i + chunk] for i in range(0, total, chunk)]
            segs = [seg_dir / f'seg{i:02d}.mp4' for i in range(len(ranges))]
            await asyncio.gather(*[_render_range(browser, base, spec, r, s, fps, quality, progress) for r, s in zip(ranges, segs)])
            await browser.close()
    finally:
        srv.shutdown()
    concat(segs, out)
    shutil.rmtree(seg_dir, ignore_errors=True)
    log(f'  video sin audio listo en {time.time() - t0:.0f} s')


def concat(segs: list[Path], out: Path):
    """Une pedazos de video sin volver a codificar (todos salen del mismo FFmpeg con los mismos ajustes)."""
    lst = out.parent / (out.stem + '_list.txt')
    lst.write_text(''.join(f"file '{s.resolve()}'\n" for s in segs))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(out)], check=True)
    lst.unlink()


async def _stills(proj: Project, times: list[float], out_dir: Path, log):
    from playwright.async_api import async_playwright
    out_dir.mkdir(parents=True, exist_ok=True)
    srv, base = serve(proj.dir)
    paths = []
    try:
        async with async_playwright() as pw:
            kw = {'args': GL_ARGS}
            if chromium_path():
                kw['executable_path'] = chromium_path()
            browser = await pw.chromium.launch(**kw)
            page, info, errors = await _open_page(browser, base, proj.engine_spec)
            for t in times:
                url = await page.evaluate('([t]) => MC.frame(t, "png")', [t])
                if errors:
                    raise RuntimeError(f'Error en el motor en {t} s: {errors[0]}')
                p = out_dir / f'still_{t:06.2f}.png'
                p.write_bytes(base64.b64decode(url.split(',', 1)[1]))
                paths.append(p)
            await browser.close()
    finally:
        srv.shutdown()
    log(f'  {len(paths)} cuadros guardados en {out_dir}')
    return paths


def stills(proj: Project, times: list[float], log=print) -> list[Path]:
    return asyncio.run(_stills(proj, times, proj.build / 'stills', log))


def render(proj: Project, out: Path | None = None, workers: int | None = None, fps: int | None = None,
           quality: float = 0.93, log=print) -> Path:
    spec = proj.engine_spec
    fps = fps or spec['fps']
    workers = workers or default_workers(proj.engine_spec)
    out = out or (proj.dir / 'output' / f'{proj.slug}.mp4')
    out.parent.mkdir(parents=True, exist_ok=True)
    _prepare(proj, fps)
    log(f'Renderizando {spec["output_duration"]:.1f} s a {fps} fps con {workers} proceso(s)...')
    silent = proj.build / 'video_silent.mp4'
    asyncio.run(_render_video(proj, silent, workers, fps, quality, log))
    return finish(proj, silent, out, log)


def _prepare(proj: Project, fps: int | None):
    spec = proj.engine_spec
    proj.build.mkdir(parents=True, exist_ok=True)
    (proj.build / 'engine_spec.json').write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding='utf-8')
    return fps or spec['fps']


def render_part(proj: Project, part: int, parts: int, workers: int | None = None, fps: int | None = None,
                quality: float = 0.93, log=print) -> Path:
    """Renderiza solo un pedazo del video (para repartirlo entre varias máquinas). Sin audio."""
    fps = _prepare(proj, fps)
    workers = workers or default_workers(proj.engine_spec)
    frames = frame_range(int(round(proj.engine_spec['output_duration'] * fps)), part, parts)
    out = proj.build / 'parts' / f'part{part:02d}.mp4'
    out.parent.mkdir(parents=True, exist_ok=True)
    log(f'Parte {part + 1}/{parts}: cuadros {frames.start}-{frames.stop - 1} con {workers} proceso(s)...')
    asyncio.run(_render_video(proj, out, workers, fps, quality, log, frames))
    return out


def assemble(proj: Project, parts_dir: Path, out: Path | None = None, log=print) -> Path:
    """Une las partes renderizadas por separado y agrega voz, música y efectos."""
    parts = sorted(Path(parts_dir).rglob('part*.mp4'), key=lambda f: f.name)
    if not parts:
        raise FileNotFoundError(f'No hay partes (part*.mp4) en {parts_dir}')
    out = out or (proj.dir / 'output' / f'{proj.slug}.mp4')
    out.parent.mkdir(parents=True, exist_ok=True)
    _prepare(proj, None)
    silent = proj.build / 'video_silent.mp4'
    log(f'Uniendo {len(parts)} partes...')
    concat(parts, silent)
    return finish(proj, silent, out, log)


def finish(proj: Project, silent: Path, out: Path, log=print) -> Path:
    spec = proj.engine_spec
    log('Mezclando audio...')
    fx, music = make_tracks(spec, proj.build, proj.data.get('music', True))
    shift = spec['teaser']['dur'] if spec.get('teaser') else 0
    mix(silent, proj.voice.get('audio'), spec['voice_start'] + shift, music, fx, out, spec['output_duration'],
        (proj.data.get('music') or {}).get('volume', .38) if isinstance(proj.data.get('music'), dict) else .38)
    log(f'Listo: {out}')
    return out


def mix(video: Path, voice: Path | None, voice_start: float, music: Path | None, fx: Path, out: Path, dur: float, music_vol: float = .25):
    inputs = ['-i', str(video)]
    parts, idx = [], 1
    labels = []
    vo = None
    if voice:
        inputs += ['-i', str(voice)]
        ms = int(voice_start * 1000)
        split = ',asplit=2[vo][sc]' if music else '[vo]'
        # voz de locutor: sin retumbo, cuerpo cálido, presencia, eses suaves, compresión pareja y un poco de sala
        polish = ('highpass=f=70,equalizer=f=180:t=q:w=1:g=1.5,equalizer=f=3400:t=q:w=1.2:g=2.5,deesser=i=0.35,'
                  'acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=2,aecho=0.85:0.6:24|41:0.08|0.05')
        parts.append(f'[{idx}:a]aresample=48000,aformat=channel_layouts=mono,{polish},adelay={ms}|{ms},apad,atrim=0:{dur}{split}')
        vo, idx = '[vo]', idx + 1
        labels.append('[vo]')
    if music:
        inputs += ['-i', str(music)]
        if vo:
            parts.append(f'[{idx}:a]volume={music_vol}[m];[m][sc]sidechaincompress=threshold=0.05:ratio=3:attack=15:release=250[md]')
        else:
            parts.append(f'[{idx}:a]volume={music_vol}[md]')
        labels.append('[md]')
        idx += 1
    inputs += ['-i', str(fx)]
    parts.append(f'[{idx}:a]volume=0.65[fx]')
    labels.append('[fx]')
    parts.append(f'{"".join(labels)}amix=inputs={len(labels)}:normalize=0,afade=t=out:st={dur - .6}:d=0.6,'
                 f'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]')
    cmd = ['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(parts), '-map', '0:v', '-map', '[a]',
           '-t', str(dur), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', str(out)]
    subprocess.run(cmd, check=True)
