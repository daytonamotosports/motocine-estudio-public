"""Vigilante de viralidad: revisa el guion y el plan del video contra la guía `references/viral.md`.

No necesita dibujar nada (segundos). Corre con `stills` y `render`, o solo: python -m motocine viral projects/x
Cada punto es medible; el puntaje es el % de puntos cumplidos (los marcados "clave" pesan doble).
"""
from __future__ import annotations

import re

from .design import _plain

MOTOS = ('ns', 'pulsar', 'akt', 'yamaha', 'suzuki', 'honda', 'bajaj', 'boxer', 'fz', 'nkd', 'moto', 'motos', '125', '200')
PROBLEMA = ('ruido', 'falla', 'error', 'errores', 'dana', 'danar', 'gasta', 'aceite', 'cadena', 'llanta', 'freno', 'motor',
            'bujia', 'humo', 'prendas', 'varado', 'cuesta', 'pierdes', 'mata', 'sonido')
SUSPENSO = ('pero', 'lo peor', 'ojo', 'cuidado', 'sin embargo', 'lo ultimo', 'y lo ultimo', 'el tercero', 'casi nadie', 'nadie')
CTA = ('comenta', 'guardalo', 'guarda', 'mandaselo', 'manda', 'escribenos', 'siguenos', 'comparte')
CTA_CONCRETO = ('letra', 'numero', 'km', 'kilometros', '1 o 2', 'cual', 'cuanto', 'cuantos', 'parcero', 'amigo', '?')
NUM = re.compile(r'\d|\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|cien|mil|primero|segundo|tercero)\b')
STOP = {'que', 'tu', 'tus', 'la', 'el', 'los', 'las', 'de', 'del', 'y', 'en', 'un', 'una', 'es', 'lo', 'te', 'se', 'por', 'con'}


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r'(?<=[.?!…])\s+', text.strip()) if s.strip()]


def _events(spec: dict) -> list[float]:
    """Momentos en que cambia algo en pantalla (para medir el ritmo visual)."""
    ev = []
    for sc in spec.get('scenes', []):
        ev.append(sc['start'])
        p = sc.get('params') or {}
        for key in ('focus', 'marks', 'titles', 'bubbles', 'stats', 'lines', 'badges', 'cards', 'points'):
            for o in p.get(key) or []:
                if isinstance(o, dict) and isinstance(o.get('at'), (int, float)):
                    ev.append(o['at'])
        ev += [t for t in p.get('punches') or [] if isinstance(t, (int, float))]
        ev += [it['at'] for it in (p.get('options') or {}).get('items') or []]       # tarjetas de opciones
        ev += [c['at'] for c in p.get('countdown') or []]
        for d in p.get('details') or []:              # escena "por dentro": entra, cambia de fase, nombra piezas, golpea
            ev += [d['at'], d['until']] + [q['at'] for q in d.get('phases') or []] + list(d.get('label_at') or [])
            tt = d['at']
            while tt < d['until']:
                ev.append(round(tt, 2)); tt += 1.2   # cada vuelta de la leva hay movimiento/golpe visible
        if (p.get('options') or {}).get('reveal_at') is not None:
            ev.append(p['options']['reveal_at'])
        for o in p.get('objects') or []:              # el mecánico empieza a caminar = algo nuevo en pantalla
            ev += [m['at'] for m in o.get('moves') or [] if isinstance(m.get('at'), (int, float))]
        ev += [t for t in p.get('cuts') or [] if isinstance(t, (int, float))]
    return sorted(set(round(e, 2) for e in ev))


def check(narration: str, spec: dict, words=None) -> dict:
    sents = _sentences(narration)
    first = sents[0] if sents else ''
    if len(first.split()) <= 2 and len(sents) > 1:   # "¡Para!" solo: el gancho es esa palabra + la frase que sigue
        first = first + ' ' + sents[1]
        sents = [first] + sents[2:]
    p_first, p_two, p_all = _plain(first), _plain(' '.join(sents[:2])), _plain(narration)
    p_end = _plain(' '.join(sents[-2:]))
    dur = spec.get('duration', 30)
    off = spec.get('voice_start', 0)
    sp = spec.get('speech_words') or []
    t0 = sp[0][0] if sp else (off + words[0].start if words else 0)
    voice_end = sp[-1][1] if sp else dur
    iso = [sc for sc in spec.get('scenes', []) if sc['type'] == 'iso']
    p0 = (iso[0].get('params') or {}) if iso else (spec['scenes'][0].get('params') or {})
    # texto del gancho en el cuadro 0 (sello de choque, título o subtítulo que ya está)
    hook_text = None
    if p0.get('impact') and (p0['impact'].get('at') or 0) <= .1:
        hook_text = p0['impact']['text']
    for ti in p0.get('titles') or []:
        if hook_text is None and (ti.get('at') or 0) <= .2:
            hook_text = ti['text']
    for ln in p0.get('lines') or []:
        if hook_text is None and isinstance(ln, dict) and isinstance(ln.get('at'), (int, float)) and ln['at'] <= .2:
            hook_text = ln['text']
    ev = [e for e in _events(spec) if 1 <= e <= voice_end]
    gaps = [b - a for a, b in zip([1.0] + ev, ev + [voice_end])]
    # ritmo AL HABLAR: las pausas largas buscadas (cuenta 3-2-1, suspenso) no cuentan como lentitud
    talk = sum(min(b2[0] - a2[1], .6) for a2, b2 in zip(sp, sp[1:])) + sum(w[1] - w[0] for w in sp) if sp else 0
    wps = len(narration.split()) / max(.1, talk or (voice_end - t0))
    long_s = [s for s in sents if len(s.split()) > 12]
    first_words = {w for w in re.findall(r'[a-zñ]+', p_first) if w not in STOP and len(w) > 3}
    last_words = {w for w in re.findall(r'[a-zñ]+', _plain(sents[-1] if sents else '')) if w not in STOP and len(w) > 3}
    susp_t = None
    for w in sp:
        if any(_plain(str(w[2])).strip('¡!¿?.,:;…') == s.split()[0] for s in SUSPENSO):
            susp_t = w[0]; break
    items = [
        ('clave', 'La primera palabra suena antes de 0,5 s', t0 <= .5, f'{t0:.2f} s'),
        ('clave', 'Texto grande en pantalla desde el cuadro 0 (≤ 7 palabras)',
         bool(hook_text) and len(str(hook_text).split()) <= 7, repr(hook_text)[:40] if hook_text else 'no hay'),
        ('', 'La primera frase nombra el problema o la moto',
         any(re.search(r'\b' + k + r'\b', p_first) for k in MOTOS + PROBLEMA), first[:50]),
        ('', 'Hay un número concreto en las dos primeras frases', bool(NUM.search(p_two)), ''),
        ('clave', 'Gancho corto (≤ 15 palabras) que pregunta, advierte o contradice',
         len(first.split()) <= 15 and (first.endswith(('?', '!')) or first.startswith(('¿', '¡'))), first[:50]),
        ('', 'Ninguna frase pasa de 12 palabras', not long_s, '; '.join(s[:30] for s in long_s[:2])),
        ('', 'Voz a 2,5–3,2 palabras por segundo', 2.4 <= wps <= 3.3, f'{wps:.1f}'),
        ('clave', 'Algo cambia en pantalla al menos cada 2,5 s', (max(gaps) if gaps else 9) <= 2.6,
         f'mayor hueco {max(gaps):.1f} s' if gaps else ''),
        ('', 'Hay suspenso ("pero", "lo peor", "casi nadie"…) antes del segundo 15',
         susp_t is not None and susp_t <= 15, f'{susp_t:.1f} s' if susp_t is not None else 'no hay'),
        ('clave', 'Cierre concreto: comenta / guárdalo / mándaselo + algo fácil de contestar',
         any(c in p_end for c in CTA) and any(c in p_end or c in ' '.join(sents[-2:]) for c in CTA_CONCRETO), sents[-1][:50] if sents else ''),
        ('', 'Dura entre 20 y 35 s', 20 <= dur <= 36, f'{dur:.1f} s'),
        ('', 'Bucle: el final empalma con el inicio', bool(first_words & last_words) or 'otra vez' in p_end,
         ', '.join(sorted(first_words & last_words)) or '—'),
        ('', 'Se entiende sin sonido (subtítulos en toda la narración)',
         bool(spec.get('captions', {}).get('phrases')) or any((sc.get('params') or {}).get('caption') is not False for sc in iso), ''),
    ]
    total = sum(2 if k == 'clave' else 1 for k, *_ in items)
    got = sum((2 if k == 'clave' else 1) for k, _, ok, _ in items if ok)
    return {'score': round(100 * got / total), 'items': [{'clave': k == 'clave', 'regla': r, 'ok': bool(ok), 'dato': d}
                                                        for k, r, ok, d in items]}


def report(proj, log=print) -> dict:
    r = check(proj.data['narration'], proj.engine_spec, proj.voice.get('words'))
    bad = [i for i in r['items'] if not i['ok']]
    log(f'Vigilante de viralidad: {r["score"]}/100 · {len(r["items"]) - len(bad)}/{len(r["items"])} reglas (references/viral.md)')
    for i in bad:
        log(f'   ⚠ {"[clave] " if i["clave"] else ""}{i["regla"]}' + (f' — {i["dato"]}' if i['dato'] else ''))
    return r
