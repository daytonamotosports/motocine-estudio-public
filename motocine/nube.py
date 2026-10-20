"""Voz en la nube (gratis): manda la narración al repositorio PÚBLICO motocine-voz, GitHub genera la voz (Edge,
Chatterbox... que aquí no tienen internet) y la trae al proyecto con el tiempo de cada palabra.

  python -m motocine voz-nube projects/mi-video                    # voz por defecto: edge-jorge-mx
  python -m motocine voz-nube projects/mi-video --voz edge-gonzalo-co
  python -m motocine voz-nube projects/mi-video --todas            # laboratorio completo (compara 6 voces, ~25 min)

Deja la voz en projects/mi-video/voz/ y cambia "voice" del video.json a esa grabación (engine "file" + timings).
Repositorio público = minutos de GitHub Actions gratis. Ruta del clon: MOTOCINE_VOZ_REPO (por defecto ../motocine-voz).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from pathlib import Path

DEFAULT = 'edge-jorge-mx'   # ganadora del laboratorio (20-oct): naturalidad 3.5/5, se entiende 98 %


def _git(repo: Path, *a, check=True):
    return subprocess.run(['git', '-C', str(repo), *a], capture_output=True, text=True, check=check)


def run(project: Path, voz: str = DEFAULT, todas: bool = False, wait_min: int = 60, log=print) -> Path:
    project = Path(project)
    if project.is_file():                              # se aceptan la carpeta o su video.json
        project = project.parent
    data = json.loads((project / 'video.json').read_text(encoding='utf-8'))
    repo = Path(os.getenv('MOTOCINE_VOZ_REPO', project.resolve().parents[2] / 'motocine-voz'))
    if not (repo / '.git').exists():
        raise FileNotFoundError(f'No encuentro el repositorio de voz en {repo} (clona daytonamotosports/motocine-voz)')
    slug = project.name
    _git(repo, 'pull', '-q', '--rebase', 'origin', 'main')
    # el código de voz viaja con el guion: GitHub usa siempre el narrador y la pronunciación más nuevos
    here = Path(__file__).resolve().parent
    for f in ('voice.py', 'speech.py', 'narrador.py', 'text.py'):
        shutil.copy(here / f, repo / 'motocine' / f)
    shutil.copy(here.parent / 'scripts' / 'voz_lab.py', repo / 'scripts' / 'voz_lab.py')
    (repo / 'guiones' / f'{slug}.txt').write_text(data['narration'].strip() + '\n', encoding='utf-8')
    from .spec import load_brand
    from .voice import VOICE_VERSION
    vc = {**(load_brand(data.get('brand')).get('voice') or {}), **(data.get('voice') or {})}
    cfg = {k: vc[k] for k in ('rate', 'pitch', 'pausas', 'expresion', 'pronounce') if k in vc}
    cfg['version'] = VOICE_VERSION                     # si cambia cómo se dice (no solo el texto), se rehace
    (repo / 'guiones' / f'{slug}.cfg.json').write_text(json.dumps(cfg, ensure_ascii=False, sort_keys=True))
    voces = repo / 'guiones' / f'{slug}.voces'
    if todas:
        voces.unlink(missing_ok=True)
    else:
        voces.write_text(voz + '\n')
    _git(repo, 'add', 'guiones', 'motocine', 'scripts')
    if _git(repo, 'commit', '-q', '-m', f'Voz para {slug}', check=False).returncode == 0:
        _git(repo, 'push', '-q', 'origin', 'HEAD:main')
        log(f'  voz-nube: guion enviado ({"6 voces" if todas else voz}); esperando a GitHub...')
    else:
        log('  voz-nube: el guion no cambió; busco resultados ya hechos')
    out = repo / 'resultados' / slug
    t0 = time.time()
    while True:
        _git(repo, 'pull', '-q', '--rebase', 'origin', 'main', check=False)
        meta = out / f'{voz}.json'
        m = json.loads(meta.read_text()) if meta.exists() else {}
        if m.get('narration', '').strip() == data['narration'].strip() and m.get('cfg') == cfg:
            break
        if time.time() - t0 > wait_min * 60:
            raise RuntimeError(f'GitHub no entregó la voz en {wait_min} min (revisa Actions de motocine-voz)')
        time.sleep(30)
    dst = project / 'voz'
    dst.mkdir(exist_ok=True)
    shutil.copy(out / f'{voz}.mp3', dst / f'{voz}.mp3')
    shutil.copy(out / f'{voz}.json', dst / f'{voz}.json')
    if (out / 'informe.md').exists():
        shutil.copy(out / 'informe.md', dst / 'informe.md')
    data['voice'] = {**{k: v for k, v in (data.get('voice') or {}).items() if k == 'start'},
                     'engine': 'file', 'file': f'voz/{voz}.mp3', 'timings': f'voz/{voz}.json'}
    (project / 'video.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    log(f'  voz-nube: listo → {dst / (voz + ".mp3")} ({time.time() - t0:.0f} s)')
    revisar(dst / f'{voz}.mp3', dst / f'{voz}.json', log)
    return dst / f'{voz}.mp3'


def revisar(mp3: Path, timings: Path, log=print, download: bool = False) -> list[dict]:
    """Vigilante de la voz que llega de la nube: escucha cada frase (Whisper local) y avisa las palabras que no se
    entienden o que suenan a otra cosa ("delata" se oía "de lata"). Cambia esas palabras en el guion ANTES de armar."""
    try:
        import numpy as np

        from .speech import Checker
        ck = Checker(download=download)
    except Exception as e:  # sin el modelo Whisper no se revisa (no detiene el trabajo)
        log(f'  voz-nube: no pude revisar la voz ({e})')
        return []
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp3), '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'],
                         capture_output=True, check=True).stdout
    x, sr = np.frombuffer(raw, np.float32), 16000
    ws = json.loads(Path(timings).read_text(encoding='utf-8'))['words']
    sents, cur = [], []
    for w in ws:
        cur.append(w)
        if str(w[0]).endswith(('.', '?', '!', '…')):
            sents.append(cur); cur = []
    if cur:
        sents.append(cur)
    bad = []
    for sw in sents:
        text = ' '.join(str(w[0]) for w in sw)
        a, b = max(0, int((sw[0][1] - .15) * sr)), int((sw[-1][2] + .25) * sr)
        heard = ck.hear(x[a:b], sr)
        sc, missing = ck.score(text, heard)
        if sc < .9 and missing:
            bad.append({'texto': text, 'se_oye': heard, 'faltan': missing, 'at': round(sw[0][1], 1)})
    ok = len(sents) - len(bad)
    log(f'  vigilante de voz: {ok}/{len(sents)} frases se entienden bien')
    for r in bad:
        log(f'   ⚠ {r["at"]:5.1f} s "{r["texto"]}" — se oye "{r["se_oye"]}" (no se entiende: {", ".join(r["faltan"])})')
    return bad
