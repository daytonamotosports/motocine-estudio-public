"""Carga un proyecto (video.json), genera la voz y resuelve escenas y tiempos.

El resultado es la "especificación de motor" que recibe engine/index.html.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .captions import build_phrases
from .text import AnchorError, Word, is_time_key, norm, resolve_anchor, resolve_tree, ANCHOR
from .voice import synthesize

ROOT = Path(__file__).resolve().parent.parent
SCENE_TYPES = {'iso', 'studio', 'quiz', 'product', 'title', 'engine_cutaway', 'oil_film', 'dry_friction', 'sight_glass', 'outro', 'checklist', 'gauge', 'photo', 'chain_drive', 'sprocket_wear', 'diorama', 'kit'}
TRANSITIONS = {'flash', 'red', 'none', 'whip', 'zoom', 'glitch', 'bars'}
AUTO_TRANSITIONS = ['whip', 'zoom', 'bars', 'whip', 'glitch', 'zoom']   # variedad por defecto (estilo comercial)


@dataclass
class Project:
    path: Path                 # archivo video.json
    data: dict
    brand: dict
    voice: dict = field(default_factory=dict)   # resultado de synthesize()
    engine_spec: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)

    @property
    def dir(self) -> Path:
        return self.path.parent

    @property
    def build(self) -> Path:
        return self.dir / 'build'

    @property
    def slug(self) -> str:
        return self.dir.name


def find_project(arg: str | Path) -> Path:
    p = Path(arg)
    if p.is_dir():
        p = p / 'video.json'
    if not p.exists():
        raise FileNotFoundError(f'No encuentro {p}')
    return p.resolve()


def prepare_image(src: Path, build: Path, max_side: int = 4096, enhance: bool = True) -> Path:
    """Endereza la foto según el celular (EXIF), la deja en buena resolución (para acercamientos
    nítidos) y le da tratamiento: niveles, rescata altas luces quemadas, contraste local, nitidez y
    color. Sin Pillow instalado se usa la original."""
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return src
    st = src.stat()
    out = build / 'images' / f'{src.stem}_{int(st.st_mtime)}_{st.st_size}_{max_side}{"_e2" if enhance else ""}.jpg'
    if out.exists():
        return out
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    if enhance:
        im = enhance_photo(im)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, quality=92)
    return out


def speech_cuts(words, off: float, start: float, end: float, every: float = 1.6) -> list[float]:
    """Cambios de toma al ritmo de la voz: al empezar cada frase (después de una pausa), nunca dos tomas a menos de
    0.9 s, y si una frase es larga se corta igual cada ~every s para no aburrir."""
    starts = [off + w.start for i, w in enumerate(words) if i == 0 or w.start - words[i - 1].end > .18]
    cuts, last = [], start
    for t in [x for x in starts if start + .5 < x < end - .5] + [end]:
        while t - last > every * 1.35:
            last += every; cuts.append(round(last, 3))
        if t < end and t - last >= .9:
            cuts.append(round(t - .05, 3)); last = t
    return cuts


def prepare_product(src: Path, build: Path, size: int = 1100) -> Path:
    """Foto de producto para anuncios: si el fondo es claro y parejo (foto de catálogo) lo quita y deja el
    producto recortado (PNG con transparencia), recorta al borde, lo agranda con buen filtro y lo mejora."""
    from PIL import Image, ImageOps, ImageFilter, ImageDraw
    import numpy as np
    st = src.stat()
    out = build / 'products' / f'{src.stem}_{int(st.st_mtime)}_{st.st_size}_{size}_p2.png'
    if out.exists():
        return out
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    spread = np.percentile(np.abs(border - bg).sum(1), 80)
    rgba, bbox = None, None
    if spread < 45 and bg.mean() > 170:                                  # fondo claro y parejo: se puede quitar
        cand = Image.fromarray(((np.abs(a - bg).sum(2) < 48) * 255).astype(np.uint8), 'L')
        frame = Image.new('L', (w + 2, h + 2), 255); frame.paste(cand, (1, 1))
        ImageDraw.floodfill(frame, (0, 0), 128, thresh=0)               # solo el fondo conectado al borde
        bgm = np.asarray(frame)[1:-1, 1:-1] == 128
        # huecos encerrados grandes (el centro de un o-ring, una arandela): también son fondo; los pequeños (letras
        # blancas, brillos) se quedan
        enclosed = (np.asarray(cand) > 0) & ~bgm                         # parecido al fondo pero sin tocar el borde
        small = (max(1, w * 160 // max(w, h)), max(1, h * 160 // max(w, h)))
        smb = Image.fromarray(enclosed.astype(np.uint8) * 255).resize(small, Image.NEAREST)
        holes = np.zeros(smb.size[::-1], bool); v = 2
        for (yy, xx) in zip(*np.nonzero(np.asarray(smb) == 255)):
            if np.asarray(smb)[yy, xx] != 255 or v > 250:
                continue
            ImageDraw.floodfill(smb, (int(xx), int(yy)), v, thresh=0)
            reg = np.asarray(smb) == v
            if reg.sum() > .015 * reg.size:
                holes |= reg
            v += 1
        holes_full = np.asarray(Image.fromarray(holes.astype(np.uint8) * 255).resize((w, h), Image.NEAREST)) > 0
        bgm = bgm | (holes_full & (np.asarray(cand) > 0))
        alpha = Image.fromarray(np.where(bgm, 0, 255).astype(np.uint8), 'L')
        alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
        rgba = enhance_photo(im).convert('RGBA'); rgba.putalpha(alpha)
        bbox = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    if rgba is None:
        rgba = enhance_photo(im).convert('RGBA')
    if bbox:
        pad = int(max(bbox[2] - bbox[0], bbox[3] - bbox[1]) * .03)
        rgba = rgba.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad)))
    k = size / max(rgba.size)
    if k > 1:
        rgba = rgba.resize((round(rgba.width * k), round(rgba.height * k)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.4, 70, 2))
    elif k < 1:
        rgba.thumbnail((size, size), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(out)
    return out


def enhance_photo(im):
    """Tratamiento tipo revelado para fotos de celular: sin IA, gratis y repetible."""
    import numpy as np
    from PIL import Image, ImageEnhance, ImageFilter
    im = im.filter(ImageFilter.MedianFilter(3))                       # quita el grano del celular
    a = np.asarray(im).astype(np.float32) / 255
    lum = a @ np.array([.299, .587, .114], np.float32)
    lo, hi = np.percentile(lum, .5), np.percentile(lum, 99.5)
    a = np.clip((a - lo) / max(hi - lo, 1e-3), 0, 1)                  # niveles
    k = 2.2                                                           # altas luces suaves (ventanas quemadas)
    a = np.where(a > .7, .7 + .3 * (1 - np.exp(-k * (a - .7) / .3)) / (1 - np.exp(-k)), a)
    a = a ** 1.06                                                     # un poco más de cuerpo en sombras medias
    im = Image.fromarray((a * 255 + .5).astype(np.uint8))
    im = im.filter(ImageFilter.UnsharpMask(radius=max(8, im.width // 60), percent=45, threshold=0))   # contraste local
    im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=90, threshold=2))                      # nitidez fina
    return ImageEnhance.Color(im).enhance(1.12)


def load_brand(name: str | None) -> dict:
    name = name or 'default'
    path = ROOT / 'brands' / name / 'brand.json'
    if not path.exists():
        raise FileNotFoundError(f'No existe la marca "{name}" ({path})')
    brand = json.loads(path.read_text(encoding='utf-8'))
    brand['_dir'] = str(path.parent)
    bgi = (brand.get('background') or {}).get('image')
    if bgi and (path.parent / bgi).exists():                      # fondo con imagen (escenario) para escenas 2D
        brand['background'] = {**brand['background'], 'image_url': f'/brands/{name}/{bgi}'}
    if brand.get('logo') and (path.parent / brand['logo']).exists():
        brand['logo_url'] = f'/brands/{name}/{brand["logo"]}'
    return brand


def load(project: str | Path, voice_override: str | None = None, log=print) -> Project:
    path = find_project(project)
    data = json.loads(path.read_text(encoding='utf-8'))
    brand = load_brand(data.get('brand'))
    proj = Project(path, data, brand)
    vcfg = {**brand.get('voice', {}), **data.get('voice', {})}
    if voice_override:
        vcfg['engine'] = voice_override
    proj.voice = synthesize(data['narration'], vcfg, proj.build, base=proj.dir, log=log)
    proj.voice['start'] = float(vcfg.get('start', 0.5))
    proj.engine_spec = resolve(proj)
    return proj


def resolve(proj: Project) -> dict:
    from .recetas import expand
    proj.data = expand(proj.data, proj.voice['words'], proj.voice['start'])   # "receta" → escenas (pocas líneas)
    d, words, off = proj.data, proj.voice['words'], proj.voice['start']
    voice_end = off + (words[-1].end if words else 0)
    dur = d.get('duration', 30)
    if dur == 'auto':
        dur = round(voice_end + float(d.get('tail', 4.0)), 2)
    dur = float(dur)
    if voice_end > dur:
        proj.warnings.append(f'La voz termina en {voice_end:.1f} s pero el video dura {dur:.1f} s: acorta el texto, '
                             f'sube voice.rate (p. ej. "+8%") o usa "duration": "auto".')
    raw = d.get('scenes') or []
    if not raw:
        raise ValueError('El proyecto no tiene escenas')
    starts = []
    for i, sc in enumerate(raw):
        if sc.get('type') not in SCENE_TYPES:
            raise ValueError(f'Escena {i + 1}: tipo "{sc.get("type")}" desconocido. Tipos: {", ".join(sorted(SCENE_TYPES))}')
        st = sc.get('start', 0 if i == 0 else None)
        if st is None:
            raise ValueError(f'Escena {i + 1} ({sc["type"]}): falta "start"')
        try:
            starts.append(resolve_anchor(st, words, off))
        except AnchorError as e:
            raise AnchorError(f'Escena {i + 1} ({sc["type"]}), start: {e}') from None
    scenes, num = [], 0
    for i, sc in enumerate(raw):
        start, end = starts[i], (starts[i + 1] if i + 1 < len(raw) else dur)
        if end - start < 0.8:
            proj.warnings.append(f'Escena {i + 1} ({sc["type"]}) dura solo {end - start:.2f} s')
        try:
            params = resolve_tree(sc.get('params', {}), words, off, start)
        except AnchorError as e:
            raise AnchorError(f'Escena {i + 1} ({sc["type"]}): {e}') from None
        for key, a, b in _bad_spans(params):
            proj.warnings.append(f'Escena {i + 1} ({sc["type"]}): "{key}" termina ({b:.2f} s) antes de empezar ({a:.2f} s); '
                                 'revisa el ancla de "until" (¿palabra repetida? usa #2)')
        for key, t in _anchor_times(params):
            if not (start - 0.05 <= t <= end + 0.05):
                proj.warnings.append(f'Escena {i + 1} ({sc["type"]}): "{key}" cae en {t:.2f} s, fuera de la escena ({start:.2f}–{end:.2f} s); no se verá.')
        if params.get('model'):                                   # modelo 3D descargado (GLB, glTF, FBX, OBJ o STL)
            mp = (proj.dir / params['model']).resolve()
            if not mp.exists():
                raise FileNotFoundError(f'Escena {i + 1}: no existe el modelo 3D {mp}')
            if mp.suffix.lower() not in ('.glb', '.gltf', '.fbx', '.obj', '.stl'):
                raise ValueError(f'Escena {i + 1}: formato de modelo {mp.suffix} no soportado (usa GLB, glTF, FBX, OBJ o STL)')
            params['model_url'] = '/project/' + mp.relative_to(proj.dir.resolve()).as_posix()
        if sc['type'] == 'studio' and not params.get('shots') and params.get('cut_on', 'speech') == 'speech':
            params['cuts'] = speech_cuts(words, off, start, end, params.get('cut_every', 1.6))
        if sc['type'] == 'product':                               # fotos de producto (anuncio)
            for it in params.get('items') or []:
                src = (proj.dir / it['image']).resolve()
                if not src.exists():
                    raise FileNotFoundError(f'Escena {i + 1}: no existe la foto del producto {src}')
                it['image_url'] = '/project/' + prepare_product(src, proj.build).relative_to(proj.dir.resolve()).as_posix()
        if sc['type'] == 'photo' and params.get('image'):
            img = (proj.dir / params['image']).resolve()
            if not img.exists():
                raise FileNotFoundError(f'Escena {i + 1}: no existe la imagen {img}')
            img = prepare_image(img, proj.build, enhance=params.get('enhance', True) is not False)
            for q in params.get('points') or []:
                if isinstance(q.get('until'), (int, float)) and q['until'] - q['at'] < 1.0:
                    proj.warnings.append(f'Escena {i + 1}: la etiqueta "{q.get("text")}" se ve solo {q["until"] - q["at"]:.1f} s; '
                                         'deja al menos 1 s (más pausa en la voz o menos etiquetas).')
            params['image_url'] = '/project/' + img.relative_to(proj.dir).as_posix()
        chip = None
        if sc.get('chip'):
            num += 1
            chip = {'num': f'{num:02d}', 'text': sc['chip']}
        tr = sc.get('transition', 'none' if i == 0 else AUTO_TRANSITIONS[(i - 1) % len(AUTO_TRANSITIONS)])
        if tr not in TRANSITIONS:
            raise ValueError(f'Escena {i + 1}: transición "{tr}" desconocida. Opciones: {", ".join(sorted(TRANSITIONS))}')
        scenes.append({'type': sc['type'], 'start': round(start, 3), 'end': round(end, 3), 'chip': chip,
                       'transition': tr, 'params': params})
    for a, b in zip(scenes, scenes[1:]):
        if b['start'] <= a['start']:
            raise ValueError(f'Las escenas deben ir en orden: "{b["type"]}" empieza en {b["start"]} s, antes que "{a["type"]}"')
    cap_cfg = d.get('captions', {})
    phrases = []
    if cap_cfg is not False:
        cap_cfg = cap_cfg or {}
        t_from = resolve_anchor(cap_cfg.get('from', 0), words, off)
        t_until = resolve_anchor(cap_cfg.get('until', dur), words, off)
        phrases = build_phrases(words, off, t_from, t_until, max_chars=cap_cfg.get('max_chars', 26))
    # gancho de apertura: muestra un momento posterior antes del inicio ("flash-forward")
    teaser = None
    if d.get('teaser'):
        tz = d['teaser']
        src = resolve_anchor(tz['at'], words, off)
        teaser = {'src': round(src, 3), 'dur': float(tz.get('dur', 1.2)), 'text': tz.get('text'), 'size': tz.get('size', 96)}
        if src + teaser['dur'] > dur:
            raise ValueError('teaser: el momento elegido se sale del video')
    # palabras de énfasis: golpe de zoom + sonido + recuadro rojo en el subtítulo
    emphasis, keywords = [], set(norm(k) for k in (cap_cfg or {}).get('keywords', []) if cap_cfg is not False)
    for e in d.get('emphasis', []):
        try:
            emphasis.append(resolve_anchor(e, words, off))
        except AnchorError as ex:
            raise AnchorError(f'emphasis: {ex}') from None
        m = ANCHOR.match(str(e))
        if m:
            keywords.add(norm(m.group('word')))
    b = proj.brand
    return {
        'teaser': teaser, 'emphasis': sorted(emphasis),
        'output_duration': round(dur + (teaser['dur'] if teaser else 0), 3),
        'background': d.get('background', b.get('background', {})),
        'progress': d.get('progress_bar', False), 'grain': d.get('grain', True),
        'vignette': d.get('vignette', True), 'fade': d.get('fade', '0,0,0'), 'fade_in': d.get('fade_in', True),
        'title': d.get('title', ''), 'width': d.get('width', 1080), 'height': d.get('height', 1920),
        'fps': d.get('fps', 30), 'duration': dur, 'voice_start': off,
        'brand': {'name': b.get('name'), 'wordmark': b.get('wordmark', {}), 'colors': b.get('colors', {}),
                  'logo_url': b.get('logo_url') if d.get('logo', True) else None},
        'watermark': d.get('watermark', True),
        'key_times': d.get('key_times'),
        'render3d': d.get('render3d', {}),
        'odometer': resolve_tree(d['odometer'], words, off, 0) if d.get('odometer') else None,
        'captions': {'phrases': phrases, 'keywords': sorted(keywords),
                     'size': (cap_cfg or {}).get('size', 64) if cap_cfg is not False else 64},
        'scenes': scenes,
        # intervalos en que suena cada palabra: el mecánico mueve la boca al hablar
        'speech': [[round(w.start + off, 3), round(w.end + off, 3)] for w in words],
        # lo mismo con el texto: subtítulo en caja negra del estilo maqueta (iso)
        'speech_words': [[round(w.start + off, 3), round(w.end + off, 3), w.text] for w in words],
    }


def _bad_spans(obj, prefix=''):
    """Elementos con "at" y "until" donde la salida queda antes de la entrada."""
    if isinstance(obj, dict):
        a, b = obj.get('at'), obj.get('until')
        if isinstance(a, (int, float)) and isinstance(b, (int, float)) and b <= a:
            yield (prefix.rstrip('.') or 'elemento', a, b)
        for k, v in obj.items():
            yield from _bad_spans(v, f'{prefix}{k}.')
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _bad_spans(v, f'{prefix}{i}.')


def _anchor_times(obj, prefix=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if is_time_key(k) and isinstance(v, (int, float)):
                yield (prefix + k, v)
            else:
                yield from _anchor_times(v, prefix + k + '.')
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _anchor_times(v, f'{prefix}{i}.')


def timeline_table(proj: Project) -> str:
    """Resumen legible de escenas y tiempos (para revisar antes de renderizar)."""
    s = proj.engine_spec
    rows = [f'Video: {s["output_duration"]:.1f} s · voz {proj.voice["engine"]} ({proj.voice["timing"]}) empieza en {s["voice_start"]} s']
    if s.get('teaser'):
        tz = s['teaser']
        rows.append(f'Gancho: {tz["dur"]} s mostrando desde {tz["src"]:.2f} s ("{tz.get("text") or ""}"); todo lo demás se corre {tz["dur"]} s')
    if s.get('emphasis'):
        rows.append('Énfasis: ' + ', '.join(f'{e:.2f}' for e in s['emphasis']))
    for i, sc in enumerate(s['scenes'], 1):
        chip = f' [{sc["chip"]["num"]} {sc["chip"]["text"]}]' if sc['chip'] else ''
        rows.append(f'{i:>2}. {sc["start"]:6.2f}–{sc["end"]:6.2f} s  {sc["type"]}{chip}  · entra con {sc["transition"]}')
        for k, t in _anchor_times(sc['params']):
            rows.append(f'          {t:6.2f} s  {k}')
    rows.append(f'Subtítulos: {len(s["captions"]["phrases"])} frases')
    return '\n'.join(rows)


def words_table(words: list[Word], offset: float) -> str:
    return '\n'.join(f'{w.start + offset:6.2f} {w.text}' for w in words)
