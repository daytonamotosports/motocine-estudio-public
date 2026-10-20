"""Vigilante de atención: mira un video como lo vería un espectador y avisa dónde se puede aburrir.

No reemplaza las métricas reales de la red social (retención por segundo), pero las anticipa con
señales que sí se pueden medir en el archivo:

- Movimiento en pantalla (cuánto cambia la imagen) y cortes de toma, 10 veces por segundo.
- Sonido: cuándo empieza a sonar, silencios, golpes.
- Estímulo por segundo (0–100) y "zonas muertas": tramos de más de 2.5 s sin nada nuevo.
- Gancho (primeros 3 s): qué tan rápido pasa algo, suena algo y cambia algo.
- Con el proyecto (video.json): tiempo de lectura de cada texto, ritmo de la voz y llamado a la acción.

Uso: python -m motocine vigilar video.mp4 [--project projects/x] [--compare referencia.mp4]
Deja un informe <video>_vigilante.png y .json junto al video.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np

FPS = 10                 # muestras por segundo para el análisis
DEAD_S = 2.5             # segundos sin estímulo que ya cuentan como "zona muerta"
READ_WPS = 3.0           # palabras por segundo que alcanza a leer alguien en el celular
READ_BASE = .45          # tiempo para encontrar el texto antes de leerlo


# ---------------------------------------------------------------- señales del archivo
def _frames(path: Path, w: int = 90, h: int = 160) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vf', f'fps={FPS},scale={w}:{h},format=gray',
                          '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32) / 255


def _audio(path: Path, sr: int = 8000) -> np.ndarray | None:
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True)
    if r.returncode != 0 or not r.stdout:
        return None
    a = np.frombuffer(r.stdout, np.int16).astype(np.float32) / 32768
    hop = sr // FPS
    n = len(a) // hop
    rms = np.sqrt((a[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)
    return 20 * np.log10(rms + 1e-9)


def signals(path: Path) -> dict:
    f = _frames(path)
    n = len(f)
    motion = np.zeros(n, np.float32)
    motion[1:] = np.abs(f[1:] - f[:-1]).mean((1, 2))
    hist = np.stack([np.histogram(x, 16, (0, 1))[0] / x.size for x in f])
    hd = np.zeros(n, np.float32)
    hd[1:] = np.abs(hist[1:] - hist[:-1]).sum(1)
    cut = (hd > .45) | (motion > .16)
    cut[0] = False
    for i in range(1, n):                       # un corte no se cuenta dos veces seguidas
        if cut[i] and cut[i - 1]:
            cut[i] = False
    db = _audio(path)
    if db is not None:
        db = np.pad(db, (0, max(0, n - len(db))), constant_values=-90)[:n]
    return {'n': n, 'motion': motion, 'cut': cut, 'bright': f.mean((1, 2)), 'contrast': f.std((1, 2)), 'db': db}


# ---------------------------------------------------------------- estímulo y atención
def stimulus(sig: dict) -> np.ndarray:
    """Estímulo 0–100 por muestra: movimiento (escala logarítmica), cortes y golpes de sonido.
    Cada evento deja una "estela" que se apaga en ~1.5 s, como la atención que despierta."""
    m = np.clip(np.log1p(sig['motion'] * 400) / np.log1p(400 * .06), 0, 1)     # .06 de cambio medio = movimiento pleno
    ev = m * .55 + sig['cut'] * .9
    if sig['db'] is not None:
        on = np.clip(np.diff(sig['db'], prepend=sig['db'][0]) / 12, 0, 1)        # subidas de volumen (golpes, voz que entra)
        ev = ev + on * .35
    out, cur, k = np.zeros_like(ev), 0., np.exp(-1 / (1.5 * FPS))
    for i, e in enumerate(ev):
        cur = max(cur * k, e)
        out[i] = cur
    return np.clip(out * 100, 0, 100)


def dead_zones(stim: np.ndarray, thr: float = 22) -> list[tuple[float, float]]:
    zones, start = [], None
    for i, v in enumerate(list(stim) + [100]):
        if v < thr and start is None:
            start = i
        elif v >= thr and start is not None:
            if (i - start) / FPS >= DEAD_S:
                zones.append((start / FPS, i / FPS))
            start = None
    return zones


def hook(sig: dict, stim: np.ndarray) -> dict:
    n3 = min(sig['n'], 3 * FPS)
    first_motion = next((i / FPS for i in range(1, sig['n']) if sig['motion'][i] > .012), None)
    first_sound = None
    if sig['db'] is not None:
        first_sound = next((i / FPS for i in range(sig['n']) if sig['db'][i] > -35), None)
    events = int(sig['cut'][:n3].sum()) + int((np.diff(stim[:n3]) > 15).sum())
    return {'stim_0_3s': round(float(stim[:n3].mean()), 1), 'first_motion_s': first_motion, 'first_sound_s': first_sound, 'events_0_3s': events}


# ---------------------------------------------------------------- lo que sabemos del proyecto
def _words(s: str) -> int:
    return len([w for w in str(s).split() if w.strip('¿?¡!.,')])


def text_items(spec: dict) -> list[dict]:
    """Textos que aparecen en pantalla con su momento de entrada y salida (cuando se conoce)."""
    items = []
    scenes = spec.get('scenes', [])
    for sc in scenes:
        p, end = sc.get('params') or {}, sc['end']
        for c in p.get('cards') or []:
            until = c.get('until', end)
            for key in ('kicker', 'title'):
                if c.get(key):
                    items.append({'text': c[key], 'at': c['at'], 'until': until})
            for pl in c.get('pills') or []:
                items.append({'text': pl['text'], 'at': pl.get('at', c['at']), 'until': until})
            if c.get('note'):
                items.append({'text': c['note'], 'at': c.get('note_at', c['at']), 'until': until})
        for q in p.get('points') or []:
            if q.get('text'):
                items.append({'text': q['text'], 'at': q['at'], 'until': q.get('until', end)})
        for q in p.get('checklist') or []:
            items.append({'text': q['text'], 'at': q['at'], 'until': end})
        for b in p.get('badges') or []:
            items.append({'text': b.get('text', ''), 'at': b['at'], 'until': end})
        if p.get('pill', {}).get('text'):                          # estilo maqueta (iso): cápsula, títulos, notas
            items.append({'text': p['pill']['text'], 'at': p['pill'].get('at', sc['start']), 'until': end})
        if (p.get('impact') or {}).get('text'):                    # sello del gancho de choque
            items.append({'text': p['impact']['text'], 'at': p['impact'].get('at', sc['start']), 'until': p['impact'].get('until', end)})
        for it in (p.get('options') or {}).get('items') or []:      # tarjetas de opciones (formato adivina)
            items.append({'text': it['texto'], 'at': it['at'], 'until': (p['options'].get('until') or end)})
        for q in (p.get('titles') or []) + (p.get('notes') or []):
            if q.get('text'):
                items.append({'text': q['text'], 'at': q.get('at', sc['start']), 'until': q.get('until', end)})
        for ln in p.get('lines') or []:
            if isinstance(ln, dict) and has_time(ln):
                items.append({'text': ln['text'], 'at': ln['at'], 'until': p.get('lines_until', end)})
    for ph in (spec.get('captions') or {}).get('phrases') or []:
        items.append({'text': ' '.join(w['text'] for w in ph['words']), 'at': ph['start'], 'until': ph['end'], 'caption': True})
    return items


def has_time(d: dict) -> bool:
    return isinstance(d.get('at'), (int, float))


def project_checks(spec: dict, words: list | None) -> tuple[list[str], dict]:
    warn, info = [], {}
    shift = spec['teaser']['dur'] if spec.get('teaser') else 0
    short = []
    for it in text_items(spec):
        need = READ_BASE + _words(it['text']) / READ_WPS
        have = it['until'] - it['at']
        if have + 1e-6 < need and not it.get('caption'):
            short.append(f'"{it["text"]}" se ve {have:.1f} s y necesita ~{need:.1f} s (en {it["at"] + shift:.1f} s)')
    if short:
        warn.append(f'{len(short)} texto(s) no alcanzan a leerse: ' + '; '.join(short[:4]) + (' …' if len(short) > 4 else ''))
    info['texts_short'] = short
    if words:
        dur = words[-1].end - words[0].start
        wps = len(words) / max(dur, .1)
        info['voice_wps'] = round(wps, 2)
        if wps > 3.4:
            warn.append(f'La voz va muy rápido ({wps:.1f} palabras/s); lo cómodo es 2.5–3.2')
        elif wps < 2.0:
            warn.append(f'La voz va lenta ({wps:.1f} palabras/s); en redes funciona mejor 2.5–3.2')
        first = words[0].start + spec.get('voice_start', 0) + shift
        info['first_word_s'] = round(first, 2)
        if first > 1.0:
            warn.append(f'La primera palabra llega en {first:.1f} s: en redes se decide en el primer segundo')
    total = spec.get('output_duration', spec.get('duration', 0))
    texts = text_items(spec)
    if not any(it['at'] + shift < 1.0 for it in texts) and not spec.get('teaser'):
        warn.append('No hay texto en pantalla en el primer segundo (muchos ven sin sonido)')
    cta = any((sc.get('params') or {}).get('cta') for sc in spec.get('scenes', [])) or \
        any('comenta' in str(c.get('kicker', '') + c.get('title', '')).lower() for sc in spec.get('scenes', []) for c in (sc.get('params') or {}).get('cards') or [])
    info['cta'] = cta
    if not cta:
        warn.append('No hay llamado a la acción al final (sígueme / comenta PALABRA / agenda)')
    info['duration'] = total
    return warn, info


# ---------------------------------------------------------------- informe
def analyze(path: Path, spec: dict | None = None, words: list | None = None) -> dict:
    sig = signals(path)
    stim = stimulus(sig)
    dur = sig['n'] / FPS
    dz = dead_zones(stim)
    hk = hook(sig, stim)
    cuts = int(sig['cut'].sum())
    peaks = int((np.diff(stim) > 15).sum())
    rate = (cuts + peaks) / max(dur, 1) * 10
    per_s = [round(float(stim[i * FPS:(i + 1) * FPS].mean()), 1) for i in range(int(np.ceil(dur)))]
    warn = []
    if hk['stim_0_3s'] < 45:
        warn.append(f'Gancho débil: estímulo {hk["stim_0_3s"]:.0f}/100 en los primeros 3 s (lo bueno es 55 o más)')
    if hk['first_motion_s'] is None or hk['first_motion_s'] > .5:
        warn.append('La imagen tarda en moverse al inicio: que algo se mueva desde el primer cuadro')
    if hk['first_sound_s'] is not None and hk['first_sound_s'] > .7:
        warn.append(f'El sonido empieza en {hk["first_sound_s"]:.1f} s: arranca con un golpe o con la voz')
    for a, b in dz:
        warn.append(f'Zona muerta de {b - a:.1f} s ({a:.1f}–{b:.1f} s): nada nuevo en pantalla ni en el sonido')
    if rate < 3:
        warn.append(f'Pocos cambios: {rate:.1f} por cada 10 s (lo usual en videos que retienen: 4–10)')
    info = {}
    if spec:
        w2, info = project_checks(spec, words)
        warn += w2
    dead_total = sum(b - a for a, b in dz)
    score = 100
    score -= max(0, 55 - hk['stim_0_3s']) * .6
    score -= min(30, dead_total / max(dur, 1) * 100)
    score -= max(0, 4 - rate) * 4
    score -= 4 * len(info.get('texts_short', []))
    score -= 0 if info.get('cta', True) else 8
    rep = {'file': str(path), 'duration': round(dur, 1), 'score': int(max(0, min(100, round(score)))), 'hook': hk,
           'cuts': cuts, 'changes_per_10s': round(rate, 1), 'dead_zones': [(round(a, 1), round(b, 1)) for a, b in dz],
           'stimulus_per_second': per_s, 'warnings': warn, **{k: v for k, v in info.items() if k != 'texts_short'}}
    rep['_stim'] = stim
    rep['_sig'] = sig
    return rep


def chart(rep: dict, video: Path, out: Path, ref: dict | None = None) -> Path:
    """Imagen del informe: curva de estímulo, cortes, zonas muertas, sonido y miniaturas."""
    from PIL import Image, ImageDraw, ImageFont
    stim, sig = rep['_stim'], rep['_sig']
    dur = rep['duration']
    Wd, top, ch = 1600, 120, 360
    thumbs_h = 230
    img = Image.new('RGB', (Wd, top + ch + 70 + thumbs_h + 40 + (ch // 2 + 60 if ref else 0)), '#101114')
    d = ImageDraw.Draw(img)
    try:
        fb = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Bold.otf', 34)
        fs = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Medium.otf', 20)
    except OSError:
        fb = fs = ImageFont.load_default()
    col = '#3DBE6A' if rep['score'] >= 75 else '#F5B427' if rep['score'] >= 55 else '#E3141B'
    d.text((30, 24), f'Vigilante de atención · {Path(rep["file"]).name}', fill='white', font=fb)
    d.text((30, 70), f'Puntaje {rep["score"]}/100 · gancho {rep["hook"]["stim_0_3s"]:.0f} · {rep["changes_per_10s"]} cambios/10 s · '
                     f'{len(rep["dead_zones"])} zona(s) muerta(s)', fill=col, font=fs)
    x0, x1, y0 = 60, Wd - 30, top
    X = lambda t: x0 + (x1 - x0) * t / max(dur, .1)
    d.rectangle([X(0), y0, X(min(3, dur)), y0 + ch], fill='#1d2433')          # ventana del gancho
    for a, b in rep['dead_zones']:
        d.rectangle([X(a), y0, X(b), y0 + ch], fill='#3a1416')
    for v in (25, 50, 75):
        yy = y0 + ch - ch * v / 100
        d.line([x0, yy, x1, yy], fill='#2a2c33'); d.text((10, yy - 10), str(v), fill='#777', font=fs)
    if sig['db'] is not None:
        pts = [(X(i / FPS), y0 + ch - ch * np.clip((sig['db'][i] + 60) / 60, 0, 1)) for i in range(sig['n'])]
        d.line(pts, fill='#4a6fa5', width=2)
    pts = [(X(i / FPS), y0 + ch - ch * stim[i] / 100) for i in range(len(stim))]
    d.line(pts, fill='#ffffff', width=3)
    for i in np.nonzero(sig['cut'])[0]:
        d.line([X(i / FPS), y0, X(i / FPS), y0 + ch], fill='#C10608', width=2)
    for s in range(0, int(dur) + 1, 2):
        d.text((X(s) - 8, y0 + ch + 8), f'{s}s', fill='#999', font=fs)
    d.text((x0, y0 + ch + 36), 'blanco = estímulo · azul = sonido · rojo = cortes · franja azul = gancho (0–3 s) · franja roja = zona muerta',
           fill='#888', font=fs)
    # miniaturas cada ~10% del video
    k = 10
    tw = (x1 - x0) // k - 8
    for i in range(k):
        t = dur * (i + .5) / k
        r = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.2f}', '-i', str(video), '-frames:v', '1', '-vf', f'scale={tw}:-2',
                            '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True)
        if r.returncode == 0 and r.stdout:
            import io
            th = Image.open(io.BytesIO(r.stdout)).convert('RGB')
            th = th.crop((0, 0, th.width, min(th.height, thumbs_h)))
            img.paste(th, (int(x0 + i * (tw + 8)), y0 + ch + 70))
    if ref:
        yb = y0 + ch + 70 + thumbs_h + 30
        rs = ref['_stim']
        d.text((30, yb), f'Comparación con {Path(ref["file"]).name}: puntaje {ref["score"]} · gancho {ref["hook"]["stim_0_3s"]:.0f} · '
                         f'{ref["changes_per_10s"]} cambios/10 s', fill='#F5B427', font=fs)
        h2 = ch // 2
        rd = ref['duration']
        pts = [(x0 + (x1 - x0) * (i / FPS) / max(rd, .1), yb + 30 + h2 - h2 * rs[i] / 100) for i in range(len(rs))]
        d.line(pts, fill='#F5B427', width=2)
    img.save(out, quality=90)
    return out


def run(video: Path, spec: dict | None = None, words: list | None = None, compare: Path | None = None, log=print) -> dict:
    video = Path(video)
    rep = analyze(video, spec, words)
    ref = analyze(Path(compare)) if compare else None
    png = chart(rep, video, video.with_name(video.stem + '_vigilante.jpg'), ref)
    clean = {k: v for k, v in rep.items() if not k.startswith('_')}
    clean['chart'] = str(png)
    if ref:
        clean['reference'] = {k: v for k, v in ref.items() if not k.startswith('_') and k != 'stimulus_per_second'}
    video.with_name(video.stem + '_vigilante.json').write_text(json.dumps(clean, ensure_ascii=False, indent=1, default=float), encoding='utf-8')
    log(f'Vigilante {video.name}: puntaje {clean["score"]}/100 · gancho {rep["hook"]["stim_0_3s"]:.0f}/100 · '
        f'{rep["changes_per_10s"]} cambios cada 10 s · {len(rep["dead_zones"])} zona(s) muerta(s)')
    if ref:
        log(f'   referencia {Path(compare).name}: puntaje {ref["score"]} · gancho {ref["hook"]["stim_0_3s"]:.0f} · {ref["changes_per_10s"]} cambios/10 s')
    for w in rep['warnings']:
        log(f'   ⚠ {w}')
    try:                                         # vigilante de diseño: luz, color, contraste, encuadre e intriga del guion
        from . import design
        narr = ' '.join(getattr(w, 'text', '') for w in (words or [])) or None
        dz = design.analyze(video, spec, narr)
        clean['design'] = dz
        video.with_name(video.stem + '_vigilante.json').write_text(json.dumps(clean, ensure_ascii=False, indent=1, default=float), encoding='utf-8')
        sc = dz.get('script', {})
        log(f'Vigilante de diseño: {dz["score"]}/100 · imagen {dz["visual_score"]} (luz {dz["bright"]:.2f}, color {dz["color"]:.2f}, '
            f'detalle {dz["detail"]:.2f})' + (f' · guion {sc["score"]} (intriga: {", ".join(sc["promise"]) or "-"})' if sc else ''))
        for w in dz['warnings']:
            log(f'   ⚠ {w}')
    except Exception as e:                       # nunca tumba el render
        log(f'   (vigilante de diseño no disponible: {e})')
    log(f'   informe: {png}')
    return clean
