"""Estudio MotoCine: de un PEDIDO (formulario) a un proyecto de video listo, sin escribir guiones a mano.

El pedido llega del formulario de GitHub (repositorio público motocine-estudio-public) o de la línea de comandos:

  python -m motocine estudio --formato adivina --falla balancines --escenario taller --letra B

Cada formato tiene una PLANTILLA de guion con las reglas de `references/viral.md` ya metidas (gancho en el cuadro
0, opciones, cuenta 3-2-1, "pero lo peor…", cierre con pregunta y bucle). El contenido sale del CATÁLOGO
(`catalogo/fallas/*.json`): cada falla trae sus datos verificados, su sonido, su escena "por dentro" y las opciones
para confundir. Agregar una falla = agregar un archivo al catálogo; no hay que tocar código.
"""
from __future__ import annotations

import json
import random
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOGO = ROOT / 'catalogo' / 'fallas'
FORMATOS = ('adivina',)
LETRAS = 'ABC'


def fallas() -> dict[str, dict]:
    return {p.stem: json.loads(p.read_text(encoding='utf-8')) for p in sorted(CATALOGO.glob('*.json'))}


def _slug(s: str) -> str:
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:40]


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:]


def _palabra(texto: str) -> str:
    """Palabra ancla de una opción: la primera con más de 3 letras ("cadena floja" → "cadena")."""
    return next((w for w in re.findall(r'[\wáéíóúñ]+', texto) if len(w) > 3), texto.split()[0])


def adivina(f: dict, letra: str = 'aleatoria', escenario: str = 'taller', seed: int | None = None) -> dict:
    """Formato "¿Qué falla es?" (adivina por el sonido). Devuelve el video.json completo."""
    rng = random.Random(seed if seed is not None else f['id'])
    letra = letra.upper() if letra and letra.upper() in LETRAS else rng.choice(LETRAS)
    dis = [d for d in f['distractores'] if _palabra(d).lower() != f['palabra'].lower()][:2]
    ops = dis[:]
    ops.insert(LETRAS.index(letra), f['opcion'])
    lineas = ' '.join(f'{L}: {o}.' for L, o in zip(LETRAS, ops))
    narration = (f"{f['pregunta']} Escucha y elige entre tres. {lineas} Piénsalo bien. Tres… dos… uno… "
                 f"¡Respuesta {letra}: {f['palabra']}! Mira por dentro. {f['explicacion']} {f['solucion']} "
                 f"Pero lo peor: {f['peor']} ¿Le atinaste? Comenta tu letra y escucha otra vez.")
    receta = {
        'tipo': 'adivina', 'escenario': escenario, 'pregunta': f['sello'], 'sonido': f['sonido'], 'fuente': f['fuente'],
        'opciones': [{'letra': L, 'texto': (f['tarjeta'] if o == f['opcion'] else _cap(o)), 'palabra': _palabra(o)}
                     for L, o in zip(LETRAS, ops)],
        'cuenta': ['Tres', 'dos', 'uno'],
        'respuesta': {'letra': letra, 'palabra': 'Respuesta', 'parte': f['parte'], 'nota': f['nota'], 'titulo': f'¡Es la {letra}!'},
        'peor': {'palabra': 'peor', 'parte': f['parte'], 'nota': f['peor_nota'], 'titulo': 'Lo peor…'},
        'cierre': {'palabra': 'atinaste', 'titulo': '¿Le atinaste?', 'repetir': 'otra'},
    }
    if f.get('detalle'):
        receta['detalle'] = {'palabra': 'Mira', 'hasta': 'atinaste', **f['detalle']}
    return {'title': f"{f['pregunta']} — {f['nombre']}", 'brand': 'daytona', 'duration': 'auto', 'tail': 2.4,
            'voice': {'start': 0.15}, 'music': {'bpm': 112, 'volume': 0.38}, 'narration': narration, 'receta': receta}


def crear(pedido: dict, projects: Path | None = None) -> Path:
    """pedido = {formato, falla, escenario, letra, nombre?} → carpeta de proyecto con su video.json."""
    cat = fallas()
    fid = _slug(pedido.get('falla', ''))
    f = cat.get(fid) or next((v for v in cat.values() if _slug(v['nombre']) == fid), None)
    if f is None:
        raise ValueError(f'Falla "{pedido.get("falla")}" no está en el catálogo (hay: {", ".join(cat)})')
    formato = _slug(pedido.get('formato', 'adivina')).split('-')[0] or 'adivina'
    if formato not in FORMATOS:
        raise ValueError(f'Formato "{pedido.get("formato")}" aún no existe (hay: {", ".join(FORMATOS)})')
    esc = 'taller' if 'taller' in _slug(pedido.get('escenario', 'taller')) else 'patio'
    data = adivina(f, pedido.get('letra', 'aleatoria'), esc, pedido.get('seed'))
    slug = _slug(pedido.get('nombre') or f'{formato}-{f["id"]}')
    out = (projects or ROOT / 'projects') / slug
    out.mkdir(parents=True, exist_ok=True)
    (out / 'video.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return out


def leer_formulario(body: str) -> dict:
    """Texto de un issue creado con el formulario de GitHub ("### Pregunta\\n\\nRespuesta") → pedido."""
    campos = {}
    for bloque in re.split(r'^### ', body or '', flags=re.M)[1:]:
        titulo, _, valor = bloque.partition('\n')
        campos[_slug(titulo)] = valor.strip()
    def get(*keys, default=''):
        for k in keys:
            for c, v in campos.items():
                if c.startswith(k) and v and v != '_No response_':
                    return v
        return default
    return {'formato': get('formato', default='adivina'), 'falla': get('falla'), 'escenario': get('escenario', default='taller'),
            'letra': get('letra', 'respuesta', default='aleatoria'), 'nombre': get('nombre')}


def publicar(dest: Path | None = None, log=print) -> Path:
    """Copia el motor, el catálogo y el formulario al repositorio PÚBLICO motocine-estudio-public (minutos gratis de
    GitHub) y regenera la lista de fallas del formulario a partir del catálogo. Luego: commit + push en `dest`."""
    import shutil
    dest = Path(dest or ROOT.parent / 'motocine-estudio-public')
    if not (dest / '.git').exists():
        raise FileNotFoundError(f'No encuentro el repositorio del estudio en {dest}')
    ign = shutil.ignore_patterns('__pycache__', '*.pyc', 'build', 'output')
    for d in ('engine', 'motocine', 'brands', 'catalogo'):
        if (dest / d).exists():
            shutil.rmtree(dest / d)
        shutil.copytree(ROOT / d, dest / d, ignore=ign)
    (dest / 'scripts').mkdir(exist_ok=True)
    shutil.copy(ROOT / 'scripts' / 'estudio_ci.py', dest / 'scripts' / 'estudio_ci.py')
    (dest / 'references').mkdir(exist_ok=True)
    for f in ('viral.md', 'guion.md'):
        shutil.copy(ROOT / 'references' / f, dest / 'references' / f)
    shutil.copy(ROOT / 'requirements.txt', dest / 'requirements.txt')
    shutil.copytree(ROOT / 'estudio', dest, dirs_exist_ok=True, ignore=ign)
    form = dest / '.github' / 'ISSUE_TEMPLATE' / 'nuevo-video.yml'
    txt = form.read_text(encoding='utf-8')
    opts = ''.join(f'        - "{k}"\n' for k in fallas())
    txt = re.sub(r'(id: falla\n(?:.*\n)*?      options:\n)((?:        - .*\n)+)', lambda m: m.group(1) + opts, txt)
    form.write_text(txt, encoding='utf-8')
    (dest / '.gitignore').write_text('__pycache__/\n*.pyc\nprojects/\nsalida/\n')
    log(f'  estudio: copiado a {dest} ({len(fallas())} fallas en el formulario)')
    return dest
