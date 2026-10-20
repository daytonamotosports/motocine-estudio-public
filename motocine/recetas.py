"""Recetas: describir un video en pocas líneas y que la herramienta arme las escenas.

En video.json, en vez de "scenes", se pone "receta". Hoy existe:

  "receta": {
    "tipo": "lista",                         # "N razones / errores / pasos" en estilo maqueta (iso)
    "titulo": "¿Tu moto gasta\\nmás gasolina?",
    "gancho": {"palabra": "culpables", "texto": "3 culpables"},      # opcional
    "puntos": [
      {"palabra": "Uno", "titulo": "Llantas bajas", "pieza": "tire", "nota": "EL MOTOR TRABAJA DE MÁS"},
      ...
    ],
    "cierre": {"palabra": "Revisa", "titulo": "Revisa las 3\\ny ahorra"}
  }

Cada "palabra" se busca DESPUÉS de la anterior (no hace falta "#2" aunque la palabra se repita). Las piezas son
los objetos de la maqueta (tire, filter, plug, gauge, drum, box, moto, pump...; ver scene-catalog.md "iso") y
aceptan sus opciones: {"pieza": "filter", "sucio": true}. Todo lo demás (taller, calle, moto andando, cámara,
números, colores, sin viñeta, fundido crema) sale solo. Cualquier clave de la escena se puede pisar con
"params": {...} dentro de la receta.
"""
from __future__ import annotations

import math

from .text import Word, norm

TOKEN_COLORS = [0xf3c24a, 0xf07fae, 0x46c79a, 0x8b55dc, 0xf0894a]
PIECE = {  # tamaño y opciones por defecto de cada pieza en primer plano
    'tire': {'s': 1.6, 'flat': True, 'spin': .6}, 'filter': {'scale': 1.9, 'dirty': True},
    'plug': {'scale': 2.4, 'worn': True, 'spin': .8}, 'gauge': {'scale': 2.2}, 'drum': {'scale': 1.8},
    'box': {'scale': 1.8}, 'moto': {'scale': 2.2}, 'pump': {'scale': 1.6}, 'person': {'scale': 2.2},
}
ALIAS = {'sucio': 'dirty', 'gastada': 'worn', 'gastado': 'worn', 'baja': 'flat', 'gira': 'spin', 'color': 'color'}


class RecetaError(ValueError):
    pass


def _find(words: list[Word], off: float, word: str, after: float) -> float:
    target = norm(word)
    for w in words:
        if w.norm == target and off + w.start >= after - 1e-6:
            return round(off + w.start, 3)
    raise RecetaError(f'Receta: la palabra "{word}" no aparece en la narración después de {after:.1f} s')


def expand(data: dict, words: list[Word], off: float) -> dict:
    r = data.get('receta')
    if not r:
        return data
    if r.get('tipo', 'lista') == 'mecanico':
        return _mecanico(data, r, words, off)
    if r.get('tipo') == 'adivina':
        return _adivina(data, r, words, off)
    if r.get('tipo', 'lista') != 'lista':
        raise RecetaError(f'Receta "{r.get("tipo")}" desconocida (hay: lista, mecanico, adivina)')
    pts = r.get('puntos') or []
    if not pts:
        raise RecetaError('Receta lista: faltan "puntos"')
    t, times = 0.0, []
    gancho = r.get('gancho')
    if isinstance(gancho, dict) and gancho.get('palabra'):
        t = _find(words, off, gancho['palabra'], t)
        g_at = t
    for p in pts:
        t = _find(words, off, p['palabra'], t + .01)
        times.append(t)
    cierre = r.get('cierre') or {}
    c_at = _find(words, off, cierre['palabra'], t + .01) if cierre.get('palabra') else None

    n = len(pts)
    span = 520 if n <= 3 else 640
    xs = [(-span / 2 + span * i / (n - 1)) if n > 1 else 0 for i in range(n)]
    objects = [
        {'kind': 'taller', 'x': -170, 'z': -190, 'at': .1}, {'kind': 'tower', 'x': 240, 'z': -210, 'h': 230, 'at': .25},
        {'kind': 'pump', 'x': 370, 'z': -60, 'at': .35}, {'kind': 'tree', 'x': -390, 'z': -250, 'at': .3},
        {'kind': 'tree', 'x': 60, 'z': -280, 'scale': .8, 'at': .4}, {'kind': 'tree', 'x': 390, 'z': 260, 'scale': .9, 'at': .45},
        {'kind': 'tree', 'x': -400, 'z': 270, 'scale': .7, 'at': .5}, {'kind': 'drum', 'x': 410, 'z': -150, 'at': .5},
        {'kind': 'moto', 'x': -380, 'z': 60, 'path': [[-380, 60], [380, 60]], 'speed': .12, 'scale': 1.7, 'at': .2},
    ]
    focus = [{'at': 0, 'x': 0, 'z': 0, 'zoom': 1}]
    titles = [{'text': r.get('titulo', data.get('title', '')), 'at': .15, 'y': 420}]
    notes = []
    first = times[0]
    if isinstance(gancho, dict) and gancho.get('texto'):
        titles[0]['until'] = round(g_at - .4, 3)
        titles.append({'text': gancho['texto'], 'at': g_at, 'until': round(first - .3, 3), 'y': 430, 'color': '#e3141b'})
    else:
        titles[0]['until'] = round(first - .3, 3)
    for i, (p, x, at) in enumerate(zip(pts, xs, times)):
        nxt = times[i + 1] if i + 1 < n else (c_at if c_at is not None else None)
        until = round(nxt - .3, 3) if nxt is not None else None
        o = {'kind': p.get('pieza', 'box'), 'x': x + 10, 'z': 210, 'at': at, **PIECE.get(p.get('pieza', 'box'), {})}
        for k, v in p.items():
            if k not in ('palabra', 'titulo', 'pieza', 'nota'):
                o[ALIAS.get(k, k)] = v
        objects.append(o)
        objects.append({'kind': 'number', 'n': i + 1, 'x': x - 70, 'z': 300, 'at': round(at - .1, 3),
                        'color': TOKEN_COLORS[i % len(TOKEN_COLORS)]})
        focus.append({'at': round(at - .2, 3), 'x': x - 30, 'z': 170, 'zoom': 2.6 if n <= 3 else 2.2})
        ti = {'text': p.get('titulo', ''), 'at': at, 'y': 430}
        if until is not None:
            ti['until'] = until
        titles.append(ti)
        if p.get('nota'):
            nt = {'text': p['nota'], 'at': round(at + 1.4, 3), 'y': 1230}
            if until is not None:
                nt['until'] = until
            notes.append(nt)
    if c_at is not None:
        focus.append({'at': round(c_at - .2, 3), 'x': 0, 'z': 60, 'zoom': 1.05, 'dur': 1.1})
        if cierre.get('titulo'):
            titles.append({'text': cierre['titulo'], 'at': c_at, 'y': 410})
    cta = r.get('cta', 'COMENTA Y SÍGUENOS')                 # llamado a la acción escrito (muchos ven sin sonido)
    if cta and words:
        notes.append({'text': cta, 'at': round(off + words[-1].end - 2.2, 3), 'y': 1230, 'color': '#e3141b'})
    params = {'zoom': .95, 'cta': bool(cta), 'board': [900, 720], 'roads': [[0, 40, 840, 60, 0]],
              'pill': {'text': r.get('marca', 'DAYTONA MOTO SPORT'), 'y': 230, 'at': 0},
              'objects': objects, 'focus': focus, 'titles': titles, 'notes': notes, 'caption_y': 1400,
              **r.get('params', {})}
    out = {'captions': False, 'vignette': False, 'fade': '241,239,234', 'watermark': False, **data}
    out['scenes'] = [{'type': 'iso', 'start': 0, 'transition': 'none', 'params': params}]
    # momentos clave para los cuadros de prueba: inicio, cada punto ya acercado y el cierre
    out['key_times'] = [1.0] + [round(a + 1.2, 2) for a in times] + ([round(c_at + 1.5, 2)] if c_at is not None else [])
    return out


# piezas de la moto grande (igual que PARTS en engine/iso3d.js, coordenadas propias de la moto)
PARTS = {'cadena': (-100, 34), 'llanta': (175, 0), 'llanta_trasera': (-175, 0), 'escape': (-158, -46),
         'motor': (-10, 0), 'tanque': (40, 0), 'farola': (150, 0), 'freno': (175, 30),
         'acelerador': (120, 84), 'manubrio_izq': (120, -84), 'visor_aceite': (10, 45), 'culata': (0, 22)}


def _part_world(part: str, moto: dict, rot: float) -> tuple[float, float]:
    lx, lz = PARTS.get(part, (0, 0))
    s = moto.get('scale', 1)
    return (moto['x'] + s * (lx * math.cos(rot) + lz * math.sin(rot)), moto['z'] + s * (-lx * math.sin(rot) + lz * math.cos(rot)))


def _ang_mid(a: float, b: float) -> float:
    d = (b - a + math.pi) % (2 * math.pi) - math.pi
    return a + d / 2


def _sentence_start(words: list[Word], off: float, t: float) -> float:
    """Inicio de la frase que contiene la palabra que suena en t (la palabra después del último punto)."""
    idx = max((i for i, w in enumerate(words) if off + w.start <= t + 1e-6), default=0)
    while idx > 0 and not words[idx - 1].text.endswith(('.', '?', '!', '…')):
        idx -= 1
    return round(off + words[idx].start, 3)


TALLER = [                                         # interior del taller (escenario "taller"): paredes y muebles
    {'kind': 'letrero', 'x': 230, 'y': 255, 'z': -350, 'w': 300, 'at': 0},
    {'kind': 'tablero', 'x': -250, 'y': 200, 'z': -352, 'at': 0},
    {'kind': 'banco', 'x': -250, 'z': -300, 'at': 0},
    {'kind': 'estante', 'x': 330, 'z': -318, 'at': 0},
    {'kind': 'llantas', 'x': -405, 'z': -60, 'at': 0},
    {'kind': 'drum', 'x': 410, 'z': -170, 'at': 0},
]


def _escenario(r: dict, objects: list, params: dict) -> None:
    """"escenario": "taller" cambia el patio con calle y árboles por el interior del taller Daytona."""
    if r.get('escenario') != 'taller':
        return
    keep = [o for o in objects if o['kind'] in ('moto_grande', 'mecanico')]
    for o in keep:
        if o['kind'] == 'moto_grande':
            o['y'] = 26                                # sobre el elevador
            keep.append({'kind': 'elevador', 'x': o['x'], 'z': o['z'], 'rot': o.get('rot', 0), 'at': 0})
            break
    objects[:] = keep + [dict(t) for t in TALLER]
    params.pop('roads', None)
    params['room'] = {'h': 300}


def _mecanico(data: dict, r: dict, words: list[Word], off: float) -> dict:
    """Receta "mecanico": el mecánico de la marca junto a una moto grande en la maqueta; habla con globos, señala
    cada pieza cuando se nombra (la moto gira si la pieza está del otro lado) y la cámara se acerca a ella.

      "receta": {"tipo": "mecanico", "titulo": "...",
        "burbujas": [{"palabra": "Sabes", "texto": "¿Qué miro primero?"}, ...],
        "puntos": [{"palabra": "cadena", "parte": "cadena", "titulo": "La cadena", "nota": "¿CUELGA?", "giro": 0}],
        "cierre": {"palabra": "pasaría", "titulo": "...", "burbuja": "¡Te la revisamos!"},
        "cronometro": 10}                                # reloj 0:00→0:10 mientras revisa (opcional)
    Por punto, opcional: "dato": {"grande": "500 km", "texto": "lubrícala cada"} (el número cuenta hacia arriba)
    o "leyenda": [["#4a78d6", "AZUL = ACEITE", true], ["#222", "NEGRO = GASOLINA"]] (true = la que se señala).
    Partes: cadena, llanta, llanta_trasera, escape (lado izquierdo: gira la moto sola), motor, tanque, farola, freno.
    """
    pts = r.get('puntos') or []
    if not pts:
        raise RecetaError('Receta mecanico: faltan "puntos"')
    t, times = 0.0, []
    for p in pts:
        t = _find(words, off, p['palabra'], t + .01)
        times.append(t)
    cierre = r.get('cierre') or {}
    c_at = _find(words, off, cierre['palabra'], t + .01) if cierre.get('palabra') else None
    end_voice = off + (words[-1].end if words else 0)
    LEFT = {'escape', 'manubrio_izq'}                                 # piezas del lado izquierdo: la moto gira para mostrarlas
    objects = [
        {'kind': 'taller', 'x': -150, 'z': -330, 'scale': 1.15, 'at': .1},
        {'kind': 'tree', 'x': -420, 'z': -300, 'at': .3}, {'kind': 'tree', 'x': 380, 'z': -320, 'scale': .9, 'at': .35},
        {'kind': 'tree', 'x': 420, 'z': 300, 'scale': .8, 'at': .4}, {'kind': 'drum', 'x': 300, 'z': -220, 'at': .45},
        {'kind': 'box', 'x': 360, 'z': -170, 'at': .5}, {'kind': 'tire', 'x': -400, 'z': -120, 'scale': .8, 'at': .5},
    ]
    turns, rot0 = [], r.get('giro', 0.0)
    moto = {'kind': 'moto_grande', 'x': 130, 'z': 20, 'scale': 1.0, 'rot': rot0, 'at': .05}
    mech = {'kind': 'mecanico', 'x': -230, 'z': 250, 'scale': .95, 'rot': .78, 'at': 0, 'speed': 320}
    # gancho: arranca muy cerca del mecánico saludando y se abre rápido a la maqueta (movimiento en el primer segundo)
    marks, titles, poses, moves, punches = [], [], [{'at': 0, 'name': 'wave'}, {'at': 1.7, 'name': 'auto'}], [], []
    focus = [{'at': 0, 'x': -330, 'z': 150, 'zoom': 2.2, 'orbit': .2},
             {'at': 1.1, 'x': -60, 'z': 60, 'zoom': 1, 'dur': .8, 'orbit': -.25}]
    imp = r.get('impacto')                         # gancho de choque: sello rojo + destello + sacudón desde el cuadro 0
    imp_until = None
    if imp:
        imp_until = _find(words, off, imp['hasta'], 0) - .1 if imp.get('hasta') else 2.0
        poses[:] = [{'at': 0, 'name': 'stop'}, {'at': round(imp_until, 3), 'name': 'auto'}]
        focus[:] = [{'at': 0, 'x': -400, 'z': 80, 'zoom': 2.1, 'orbit': .12},     # mecánico más abajo: arriba va el sello
                    {'at': round(imp_until, 3), 'x': -60, 'z': 60, 'zoom': 1, 'dur': .6, 'orbit': -.25}]
    titles.append({'text': r.get('titulo', data.get('title', '')), 'at': round(imp_until + .15, 3) if imp else 1.3, 'until': round(times[0] - .3, 3), 'y': 400})
    YAW, PITCH = [-.32, .26, -.22, .3, -.18], [0, -.07, .05, -.05, .03]       # cada toma desde otro ángulo
    prev_kw = 0.0
    for i, (p, at) in enumerate(zip(pts, times)):
        nxt = times[i + 1] if i + 1 < len(pts) else c_at
        until = round(nxt - .3, 3) if nxt is not None else None
        part = p.get('parte', 'motor')
        giro = p.get('giro', 3.1416 if part in LEFT else rot0)
        s_at = max(_sentence_start(words, off, at), prev_kw + 1.2)           # la toma arranca con la frase
        turns.append({'at': round(s_at - .1, 3), 'rot': giro})
        # el mecánico camina hasta la pieza (del lado de la cámara) y la señala justo cuando la voz la nombra
        px, pz = _part_world(part, moto, giro)
        # a la IZQUIERDA de la pieza en pantalla y a su misma distancia de la cámara (no delante: la taparía)
        sx, sz = px - 175, pz + 175
        to_part = math.atan2(px - sx, pz - sz)
        moves.append({'at': round(max(prev_kw + .9, s_at - .7), 3), 'x': round(sx), 'z': round(sz),
                      'rot': round(_ang_mid(to_part, .78), 3)})
        sg = 1 if i % 2 else -1
        zz = p.get('zoom', 1.75)
        focus.append({'at': round(s_at - .05, 3), 'part': part, 'with_mech': True, 'zoom': zz, 'orbit': .2 * sg,
                      'yaw': YAW[i % len(YAW)], 'pitch': PITCH[i % len(PITCH)], 'dx': -60, 'dz': -60})
        # segunda toma de la misma frase: se cierra sobre la pieza desde otro ángulo justo después de nombrarla
        nxt_s = _sentence_start(words, off, nxt) if nxt is not None else at + 3
        re_at = next((off + w.start for w in words if off + w.start >= at + 1.0), at + 1.1)   # cae en una palabra
        if re_at < nxt_s - .7:
            focus.append({'at': round(re_at - .03, 3), 'reframe': True, 'part': part, 'with_mech': True, 'zoom': round(zz * 1.22, 3),
                          'yaw': round(YAW[i % len(YAW)] - .3 * sg, 3), 'pitch': PITCH[i % len(PITCH)] + .04,
                          'orbit': -.16 * sg, 'dx': -60, 'dz': -60})
        punches.append(round(at + .05, 3))
        mk = {'at': round(at + .2, 3), 'part': part, 'text': p.get('nota', ''), 'side': 1}   # etiqueta al lado contrario
        if p.get('efecto'):
            mk['fx'] = p['efecto']
        ti = {'text': f"{i + 1} · {p.get('titulo', '')}", 'at': round(s_at, 3), 'y': 400}
        if until is not None:
            mk['until'] = until; ti['until'] = until
        marks.append(mk); titles.append(ti)
        poses += [{'at': round(at - .15, 3), 'name': 'point'}, {'at': round(at + 1.4, 3), 'name': 'auto'}]
        prev_kw = at
    mech['moves'] = moves
    # gancho con golpes de acercamiento: en la primera palabra y en la última de la primera frase (ritmo desde el seg. 0)
    first_end = next((w for w in words if w.text.endswith(('.', '?', '!'))), None)
    punches[:0] = [round(off + words[0].start + .05, 3)] + ([round(off + first_end.start + .05, 3)] if first_end else [])
    minimal = r.get('minimalista', True)            # máximo 3 cosas a la vez: título, una etiqueta y el subtítulo
    if minimal:
        for p, mk in zip(pts, marks):               # el dato va DENTRO de la etiqueta de la pieza (no en otra tarjeta)
            if p.get('dato'):
                mk['text'] = (p['dato'].get('grande', '') if len(p['dato'].get('grande', '')) <= 12 else p.get('nota', '')).upper()
            elif p.get('leyenda'):
                mk['text'] = next((row[1] for row in p['leyenda'] if len(row) > 2 and row[2]), p.get('nota', ''))
    # números en pantalla: dato o leyenda por punto, lista 1-2-3-4 con ✓ y cronómetro de los "N segundos"
    stats = []
    for p, at, mk in zip(pts, times, marks):
        if p.get('dato'):
            stats.append({'at': round(at + .6, 3), 'until': mk.get('until'), 'big': p['dato'].get('grande', ''),
                          'small': p['dato'].get('texto', ''), 'count': p['dato'].get('contar', True)})
        elif p.get('leyenda'):
            stats.append({'at': round(at + .6, 3), 'until': mk.get('until'), 'rows': p['leyenda']})
    first = min(f['at'] for f in focus if f.get('part'))
    checks = {'at': round(first, 3), 'items': [round(a + .2, 3) for a in times], 'y': 125}   # franja de arriba
    timer = None
    if r.get('cronometro'):
        timer = {'at': round(first - .1, 3), 'from': round(first, 3), 'to': round((c_at or times[-1] + 3) - .3, 3),
                 'seconds': r['cronometro'], 'x': 930, 'y': 125}
    if minimal:
        stats, checks, timer = [], None, None
    if c_at is not None and checks:
        checks['until'] = round(c_at + 1.6, 3)   # (arriba no choca con el título final)
    if c_at is not None and timer:
        timer['until'] = round(c_at + 1.6, 3)
    # cada señal se apaga cuando arranca la frase siguiente (si no, queda encendida mientras el mecánico camina)
    shots = [f['at'] for f in focus if f.get('part') and not f.get('reframe')]
    for mk, nx in zip(marks, shots[1:] + ([round(c_at - .25, 3)] if c_at is not None else [])):
        mk['until'] = round(min(mk.get('until', nx), nx), 3)
    moto['turns'] = turns + ([{'at': round(c_at - .6, 3), 'rot': rot0}] if c_at is not None else [])
    objects.insert(0, moto)
    objects.insert(1, mech)
    bubbles = []
    for b in r.get('burbujas') or []:               # mientras habla en globo, la cámara se acerca al mecánico
        at = _find(words, off, b['palabra'], 0)
        bubbles.append({'at': at, 'text': b['texto'], 'until': round(at + b.get('dura', 2.4), 3), 'dx': 90, 'dy': -70})   # al lado de la cara (arriba va el título)
        focus.append({'at': round(at - .25, 3), 'x': mech['x'] - 40, 'z': mech['z'] - 200, 'zoom': 1.6, 'yaw': .2, 'orbit': -.22})
        # (el título sigue: el globo va al lado de la cabeza y no lo tapa; cortarlo dejaba muy poco tiempo para leerlo)
    focus.sort(key=lambda f: f['at'])
    if c_at is not None:
        focus.append({'at': round(c_at - .2, 3), 'x': -60, 'z': 60, 'zoom': 1.0, 'dur': .9, 'orbit': .3})
        poses.append({'at': round(c_at - .1, 3), 'name': 'thumbs'})
        moves.append({'at': round(c_at - .5, 3), 'x': -200, 'z': 230, 'rot': .78})     # vuelve al frente para despedirse
        if cierre.get('titulo'):
            titles.append({'text': cierre['titulo'], 'at': c_at, 'y': 400})
        if cierre.get('burbuja'):
            bubbles.append({'at': round(c_at + .4, 3), 'text': cierre['burbuja'], 'dx': 40, 'dy': -330})   # debajo: arriba va el título
    notes = []
    cta = r.get('cta', 'ESCRÍBENOS')
    if cta and words and not minimal:              # en minimalista lo dicen la voz y el subtítulo
        notes.append({'text': cta, 'at': round(end_voice - 2.0, 3), 'y': 1250, 'color': '#e3141b'})
    params = {'zoom': .95, 'board': [960, 760], 'roads': [[0, 60, 900, 120, 0]], 'cta': bool(cta),
              'pill': {'text': r.get('marca', 'DAYTONA MOTO SPORT'), 'y': 230, 'at': 0,
                       **({'until': round(times[0] - .6, 3), 'again': round(c_at, 3) if c_at is not None else None} if minimal else {})},
              'objects': objects, 'focus': focus, 'titles': titles, 'notes': notes, 'marks': marks,
              'bubbles': bubbles, 'poses': poses, 'punches': punches, 'caption_y': 1420,
              'stats': stats, 'checks': checks, 'timer': timer,
              'impact': {'at': 0, 'until': round(imp_until, 3), 'text': imp['texto'], 'sfx': 'boom'} if imp else None, **r.get('params', {})}
    _escenario(r, objects, params)
    out = {'captions': False, 'vignette': False, 'fade': '241,239,234', 'watermark': False,
           **({'fade_in': False} if imp else {}), **data}
    out['scenes'] = [{'type': 'iso', 'start': 0, 'transition': 'none', 'params': params}]
    out['key_times'] = [1.2] + [round(a + 1.3, 2) for a in times] + ([round(c_at + 1.6, 2)] if c_at is not None else [])
    return out


def _adivina(data: dict, r: dict, words: list[Word], off: float) -> dict:
    """Receta "adivina" (¿qué falla tiene esta moto?): suena la falla, sello con la pregunta, 3 opciones en tarjetas,
    cuenta regresiva 3-2-1, la correcta se pone roja con ✓ y la cámara se cierra en la pieza; cierre en BUCLE
    ("escucha otra vez" y vuelve a sonar), que es lo que más hace repetir el video.

      "receta": {"tipo": "adivina", "pregunta": "¿QUÉ FALLA ES?", "sonido": "motor_tic",
        "opciones": [{"letra": "A", "texto": "Cadena floja", "palabra": "cadena"}, ...],
        "cuenta": ["Tres", "dos", "uno"],
        "respuesta": {"letra": "B", "palabra": "Es", "parte": "culata", "nota": "BALANCINES", "titulo": "¡Es la B!"},
        "peor": {"palabra": "peor", "parte": "culata", "nota": "ÁRBOL DE LEVAS"},
        "cierre": {"palabra": "atinaste", "titulo": "¿Le atinaste?", "repetir": "otra"}}
    """
    ops = r.get('opciones') or []
    if len(ops) < 2:
        raise RecetaError('Receta adivina: faltan "opciones"')
    t = 0.0
    for o in ops:
        t = o['_at'] = _find(words, off, o['palabra'], t + .01)
    cnt = []
    for w in r.get('cuenta') or []:
        t = _find(words, off, w, t + .01); cnt.append(t)
    resp = r.get('respuesta') or {}
    rv = _find(words, off, resp.get('palabra', 'Es'), t + .01)
    peor = r.get('peor') or {}
    p_at = _find(words, off, peor['palabra'], rv + .01) if peor.get('palabra') else None
    cierre = r.get('cierre') or {}
    c_at = _find(words, off, cierre['palabra'], (p_at or rv) + .01) if cierre.get('palabra') else None
    rep = _find(words, off, cierre['repetir'], (c_at or rv) + .01) if cierre.get('repetir') else None
    end_voice = off + (words[-1].end if words else 0)
    first_op = ops[0]['_at']
    moto = {'kind': 'moto_grande', 'x': 130, 'z': 20, 'scale': 1.0, 'rot': 0.0, 'at': 0}
    mech = {'kind': 'mecanico', 'x': -200, 'z': 240, 'scale': .95, 'rot': .78, 'at': 0}
    objects = [moto, mech,
               {'kind': 'taller', 'x': -150, 'z': -330, 'scale': 1.15, 'at': 0},
               {'kind': 'tree', 'x': -420, 'z': -300, 'at': 0}, {'kind': 'tree', 'x': 380, 'z': -320, 'scale': .9, 'at': 0},
               {'kind': 'tree', 'x': 420, 'z': 300, 'scale': .8, 'at': 0}, {'kind': 'drum', 'x': 300, 'z': -220, 'at': 0}]
    part = resp.get('parte', 'culata')
    src = r.get('fuente', 'motor')                    # de dónde sale el sonido (pieza donde arranca la cámara)
    focus = [{'at': 0, 'part': src, 'zoom': 2.3, 'dx': -150, 'dz': -150, 'orbit': .35},              # pegado a la pieza
             {'at': round(first_op - .15, 3), 'x': -40, 'z': 40, 'zoom': 1.2, 'dur': .5, 'orbit': -.2}]   # moto + mecánico
    for i, o in enumerate(ops[1:], 1):              # cada opción mueve un poco la cámara (ritmo mientras se leen)
        focus.append({'at': round(o['_at'] - .1, 3), 'x': -40, 'z': 40, 'zoom': round(1.2 + .07 * i, 3), 'dur': .4,
                      'yaw': [0, .14, -.12, .1][i % 4], 'orbit': .12 * (-1) ** i})
    if cnt:
        focus.append({'at': round(cnt[0] - .05, 3), 'x': -40, 'z': 40, 'zoom': 1.45, 'dur': .4, 'orbit': .25, 'yaw': .15})
    focus.append({'at': round(rv - .05, 3), 'part': part, 'with_mech': True, 'zoom': 1.9, 'dur': .35, 'orbit': -.2, 'yaw': -.25})
    if p_at:
        focus.append({'at': round(p_at - .05, 3), 'part': peor.get('parte', part), 'with_mech': True, 'zoom': 2.2,
                      'dx': -60, 'dz': -60, 'dur': .4, 'orbit': .2, 'yaw': .3})
    if c_at:
        focus.append({'at': round(c_at - .1, 3), 'x': -40, 'z': 40, 'zoom': 1.1, 'dur': .5, 'orbit': .3})
    # más ritmo: golpe en la 2.ª frase, toma antes de la cuenta, prueba en vivo (el motor ACELERA cuando la voz lo dice)
    def _start_after(t0):
        return next((off + w.start for i, w in enumerate(words) if off + w.start > t0 + .05
                     and i and words[i - 1].text.endswith(('.', '?', '!', '…'))), None)
    after_rv = next((off + w.start for w in words if off + w.start >= rv + 1.2), None)   # 2.º golpe tras la respuesta
    extra_punch = [x for x in [_start_after(0), after_rv] if x]
    pre_cnt = _start_after(ops[-1]['_at']) if cnt else None
    if pre_cnt and pre_cnt < cnt[0] - .3:
        focus.append({'at': round(pre_cnt - .05, 3), 'x': -40, 'z': 40, 'zoom': 1.35, 'dur': .4, 'yaw': -.15, 'orbit': .15})
    # prueba en vivo tras la respuesta: "acelera" (el motor sube y el tic con él) o "prueba": {palabra, sonido}
    pr = resp.get('prueba') or ({'palabra': resp['acelera'], 'sonido': 'motor_tic_up'} if resp.get('acelera') else None)
    acc = _find(words, off, pr['palabra'], rv + .01) if pr else None
    if acc:
        focus.append({'at': round(acc - .05, 3), 'part': pr.get('parte', 'motor'), 'with_mech': True, 'zoom': 2.0, 'dx': -60, 'dz': -60,
                      'dur': .35, 'yaw': .2, 'orbit': -.2})
    if c_at and rep:
        mid = _start_after(c_at)
        if mid and mid < rep - .3:
            focus.append({'at': round(mid - .05, 3), 'x': -100, 'z': 120, 'zoom': 1.45, 'dur': .4, 'yaw': -.2, 'orbit': .2})
    focus.sort(key=lambda f: f['at'])
    if rep:
        focus.append({'at': round(rep - .05, 3), 'part': src, 'zoom': 2.3, 'dx': -150, 'dz': -150, 'dur': .5, 'orbit': .35})
    marks = [{'at': 0, 'until': round(first_op - .3, 3), 'part': src, 'text': '', 'fx': 'ondas'},
             {'at': round(rv + .2, 3), 'until': round((p_at or c_at or end_voice) - .2, 3), 'part': part,
              'text': resp.get('nota', ''), 'side': 1}]
    if p_at:
        marks.append({'at': round(p_at + .15, 3), 'until': round((c_at or end_voice) - .2, 3), 'part': peor.get('parte', part),
                      'text': peor.get('nota', ''), 'side': 1})
    if rep:
        marks.append({'at': round(rep, 3), 'part': src, 'text': '', 'fx': 'ondas'})
    poses = [{'at': 0, 'name': 'think'}, {'at': round(first_op, 3), 'name': 'auto'},
             {'at': round((cnt[0] if cnt else rv) - .1, 3), 'name': 'think'},
             {'at': round(rv - .1, 3), 'name': 'point'}, {'at': round(rv + 1.4, 3), 'name': 'auto'}]
    if c_at:
        poses.append({'at': round(c_at - .1, 3), 'name': 'thumbs'})
    titles = []
    if resp.get('titulo'):
        titles.append({'text': resp['titulo'], 'at': round(rv, 3), 'until': round((p_at or c_at or end_voice) - .3, 3), 'y': 400})
    if peor.get('titulo'):
        titles.append({'text': peor['titulo'], 'at': round(p_at, 3), 'until': round((c_at or end_voice) - .3, 3), 'y': 400})
    if cierre.get('titulo') and c_at:
        titles.append({'text': cierre['titulo'], 'at': round(c_at, 3), 'y': 400})
    sounds = [{'at': 0, 'until': round(first_op - .1, 3), 'kind': r.get('sonido', 'motor_tic'), 'gain': 1.1}]
    if acc:                                           # prueba en vivo: acelera y el tic sube
        sounds.append({'at': round(acc - .1, 3), 'until': round(acc + 2.3, 3), 'kind': pr.get('sonido', 'motor_tic_up'), 'gain': .8})
        marks.append({'at': round(acc, 3), 'until': round(acc + 2.2, 3), 'part': pr.get('parte', 'motor'), 'text': pr.get('nota', ''),
                      'fx': pr.get('efecto', 'ondas'), 'side': 1})
    det = r.get('detalle')                           # escena "por dentro" del mecanismo (se entiende qué es y cómo se arregla)
    details = []
    if det:
        d0 = _find(words, off, det['palabra'], rv + .01)
        d1 = _find(words, off, det['hasta'], d0 + .01) - .3 if det.get('hasta') else (c_at or end_voice) - .3
        kind = det.get('tipo', 'balancines')
        phases = [{'at': round(d0, 3), 'mode': {'cadena': 'seca'}.get(kind, 'tic')}]
        fases = det.get('fases') or {m: det[m] for m in ('ajuste', 'gasta') if det.get(m)}   # {modo: palabra}
        for mode, w in fases.items():
            phases.append({'at': round(_find(words, off, w, d0 + .01) - .1, 3), 'mode': mode})
        phases.sort(key=lambda q: q['at'])
        dd = {'at': round(d0 - .1, 3), 'until': round(d1, 3), 'kind': kind, 'phases': phases}
        if det.get('nombres'):
            tt, la = d0, []
            for w in det['nombres']:
                tt = _find(words, off, w, tt + .01); la.append(round(tt, 3))
            dd['label_at'] = la
        details.append(dd)
        if kind == 'cadena':                          # seca chilla; desde que entra el spray, rueda suave
            lub = next((q['at'] for q in phases if q['mode'] == 'lubrica'), d1)
            sounds += [{'at': round(d0 - .1, 3), 'until': round(lub + 1.1, 3), 'kind': 'cadena_seca', 'gain': .55},
                       {'at': round(lub + 1.0, 3), 'until': round(d1, 3), 'kind': 'cadena_ok', 'gain': .45}]
        else:
            sounds.append({'at': round(d0 - .1, 3), 'until': round(d1, 3), 'kind': 'motor', 'gain': .3})
    if details:                                      # las tarjetas A/B/C se van cuando entramos "por dentro"
        params_opts_until = details[0]['at'] - .05
    else:
        params_opts_until = None
    if rep:
        sounds.append({'at': round(rep, 3), 'until': round(end_voice + 2.2, 3), 'kind': r.get('sonido', 'motor_tic'), 'gain': 1.0})
    params = {'zoom': .95, 'board': [960, 760], 'roads': [[0, 60, 900, 120, 0]], 'cta': True,
              'pill': {'text': r.get('marca', 'DAYTONA MOTO SPORT'), 'y': 230, 'at': round(first_op - .3, 3),
                       'until': round(first_op + 1.5, 3), **({'again': round(c_at, 3)} if c_at else {})},
              'objects': objects, 'focus': focus, 'marks': marks, 'poses': poses, 'titles': titles,
              'punches': sorted(round(x + .05, 3) for x in [rv] + ([p_at] if p_at else []) + extra_punch),
              'options': {'items': [{'letra': o['letra'], 'texto': o['texto'], 'at': round(o['_at'] - .15, 3)} for o in ops],
                          'correct': resp.get('letra'), 'reveal_at': round(rv, 3),
                          'until': round(params_opts_until if params_opts_until else (p_at or c_at or end_voice) - .3, 3)},
              'countdown': [{'at': round(a, 3), 'n': len(cnt) - i} for i, a in enumerate(cnt)],
              'sounds': sounds, 'details': details, 'caption_y': 1430,
              'impact': {'at': 0, 'until': round(first_op - .3, 3), 'text': r.get('pregunta', '¿QUÉ FALLA ES?'), 'y': 470},
              **r.get('params', {})}
    _escenario(r, objects, params)
    out = {'captions': False, 'vignette': False, 'fade': '241,239,234', 'watermark': False, 'fade_in': False, **data}
    out['scenes'] = [{'type': 'iso', 'start': 0, 'transition': 'none', 'params': params}]
    out['key_times'] = [0.4, round(ops[-1]['_at'] + .6, 2)] + ([round(cnt[1] + .35, 2)] if len(cnt) > 1 else []) + \
        [round(rv + 1.0, 2)] + ([round(p_at + 1.0, 2)] if p_at else []) + ([round(c_at + 1.0, 2)] if c_at else [])
    return out
