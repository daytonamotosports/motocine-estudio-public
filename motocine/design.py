"""Vigilante de diseño: revisa si el video se VE bien y si el guion engancha.

Imagen (2 cuadros por segundo, en pequeño):
  luz       brillo medio: muy oscuro (< 0.17) o lavado (> 0.82)
  color     colorido (Hasan-Süsstrunk): un video apagado no frena el dedo en el celular
  contraste desviación del brillo: sin contraste todo se ve plano
  detalle   densidad de bordes (lo normal 0.2–0.3): < 0.11 = plano demasiado cerrado o vacío (la pieza no se reconoce)
  marca     presencia del color de la marca (sin exagerar)
Guion:
  intriga   ¿abre con pregunta o con una promesa ("mira hasta el final", "3 mitos", "error")? ¿la promesa se
            cumple tarde (lazo abierto)? frases cortas, le habla a "tú", cierra con llamado a la acción.
"""
from __future__ import annotations

import re
import subprocess
import unicodedata
from pathlib import Path

import numpy as np

FPS = 2
W, H = 108, 192


def _frames(path: Path) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vf', f'fps={FPS},scale={W}:{H},format=rgb24',
                          '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32) / 255


def visual(path: Path, brand_rgb: tuple[float, float, float] = (.8, .06, .1)) -> dict:
    f = _frames(path)
    lum = f @ np.array([.299, .587, .114], np.float32)
    bright = lum.mean((1, 2))
    contrast = lum.std((1, 2))
    rg = f[..., 0] - f[..., 1]
    yb = .5 * (f[..., 0] + f[..., 1]) - f[..., 2]
    color = np.sqrt(rg.std((1, 2)) ** 2 + yb.std((1, 2)) ** 2) + .3 * np.sqrt(rg.mean((1, 2)) ** 2 + yb.mean((1, 2)) ** 2)
    gx, gy = np.abs(np.diff(lum, axis=2)), np.abs(np.diff(lum, axis=1))
    detail = ((gx[:, :-1, :] + gy[:, :, :-1]) > .08).mean((1, 2))
    b = np.array(brand_rgb, np.float32)
    brand = (np.abs(f - b).sum(-1) < .35).mean((1, 2))
    return {'bright': bright, 'contrast': contrast, 'color': color, 'detail': detail, 'brand': brand}


def _spans(mask: np.ndarray, min_s: float) -> list[tuple[float, float]]:
    out, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j < len(mask) and mask[j]:
                j += 1
            if (j - i) / FPS >= min_s:
                out.append((i / FPS, j / FPS))
            i = j
        else:
            i += 1
    return out


def _plain(s: str) -> str:
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


PROMISE = ('no prendas', 'deja de', 'para', 'hasta el final', 'al final', 'mira', 'te muestro', 'secreto', 'nadie', 'error', 'mitos', 'trucos', 'cuidado',
           'que pasa', 'por que', 'sabias', 'nunca', 'jamas', 'peor', 'mejor', 'cuanto', 'cuantos', 'cuantas')
CTA = ('comenta', 'siguenos', 'sigueme', 'escribenos', 'pidelo', 'agenda', 'guarda', 'comparte', 'escribe')


def script(narration: str) -> dict:
    sents = [x.strip() for x in re.split(r'(?<=[.!?…])\s+', narration.strip()) if x.strip()]
    first = sents[0] if sents else ''
    p_first = _plain(' '.join(sents[:2]))
    # gancho: pregunta o ADVERTENCIA ("¡Para! No prendas tu moto así": la de mejor arranque medido, 64/100)
    hook_q = first.startswith(('¿', '¡')) or first.endswith(('?', '!'))
    promise = [w for w in PROMISE if w in p_first] + (['número'] if re.search(r'\b\d+\b|\b(tres|cinco|siete|diez)\b', p_first) else [])
    words = [len(x.split()) for x in sents]
    tu = len(re.findall(r'\b(tu|tus|t[uú]|te)\b', _plain(narration)))
    cta = any(w in _plain(' '.join(sents[-2:])) for w in CTA)
    questions = narration.count('?')
    score = 40 + 20 * hook_q + min(20, 10 * len(promise)) + (10 if cta else 0) + min(10, tu * 2) - max(0, (np.mean(words) if words else 0) - 12) * 3
    warn = []
    if not hook_q and not promise:
        warn.append('El guion no abre con pregunta ni promesa: empieza con "¿Sabías que…?", "Mira hasta el final", "3 errores…"')
    if not cta:
        warn.append('No hay llamado a la acción al final (comenta, síguenos, escríbenos)')
    if words and max(words) > 22:
        warn.append(f'Hay una frase de {max(words)} palabras: pártela (en redes se pierde la atención)')
    if tu == 0:
        warn.append('El guion no le habla al espectador ("tu moto", "te muestro"): suena distante')
    return {'score': int(max(0, min(100, round(score)))), 'hook_question': hook_q, 'promise': promise, 'cta': cta,
            'questions': questions, 'avg_words': round(float(np.mean(words)) if words else 0, 1), 'warnings': warn}


def analyze(path: Path, spec: dict | None = None, narration: str | None = None) -> dict:
    brand = (.8, .06, .1)
    if spec and (spec.get('brand') or {}).get('colors', {}).get('accent'):
        h = spec['brand']['colors']['accent'].lstrip('#')
        brand = tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    v = visual(Path(path), brand)
    dur = len(v['bright']) / FPS
    warn = []
    for a, b in _spans(v['bright'] < .07, 2.0):
        warn.append(f'Muy oscuro {a:.1f}–{b:.1f} s (brillo {v["bright"][int(a * FPS):int(b * FPS)].mean():.2f}): sube la luz o aclara el fondo')
    # fondo claro con piezas de color (estilo maqueta) está bien: solo es "lavada" si además no hay contraste ni color
    for a, b in _spans((v['bright'] > .82) & ((v['contrast'] < .1) | (v['color'] < .04)), 1.5):
        warn.append(f'Imagen lavada {a:.1f}–{b:.1f} s: demasiado blanco y sin contraste')
    for a, b in _spans(v['color'] < .04, 3.0):
        warn.append(f'Colores apagados {a:.1f}–{b:.1f} s: agrega un color fuerte (marca, amarillo, contraluz)')
    for a, b in _spans(v['contrast'] < .1, 2.0):
        warn.append(f'Poco contraste {a:.1f}–{b:.1f} s: todo se ve plano')
    for a, b in _spans(v['detail'] < .05, 2.5):
        warn.append(f'Plano vacío o demasiado cerrado {a:.1f}–{b:.1f} s: la pieza no se reconoce (abre la toma)')
    vis = 100
    # calibrado con un video real de 6,7 M de vistas (fondo oscuro, una sola pieza limpia, mucho espacio vacío):
    # oscuro y minimalista NO es malo; solo se castiga lo casi negro, sin color o vacío de verdad
    vis -= 30 * float(np.clip(.1 - v['bright'].mean(), 0, .1) / .1)
    vis -= 20 * float(np.clip(.06 - v['color'].mean(), 0, .06) / .06)
    vis -= 6 * len(warn)
    out = {'duration': round(dur, 1), 'visual_score': int(max(0, min(100, round(vis)))),
           'bright': round(float(v['bright'].mean()), 3), 'color': round(float(v['color'].mean()), 3),
           'contrast': round(float(v['contrast'].mean()), 3), 'detail': round(float(v['detail'].mean()), 3),
           'brand_share': round(float(v['brand'].mean()), 3), 'warnings': warn}
    if v['brand'].mean() < .01 and spec:
        out['warnings'].append('Casi no aparece el color de la marca: agrega acentos rojos (marcas, píldoras, contraluz)')
    if narration:
        sc = script(narration)
        out['script'] = sc
        out['warnings'] += sc['warnings']
    out['score'] = int(round(.65 * out['visual_score'] + .35 * out.get('script', {}).get('score', out['visual_score'])))
    return out
