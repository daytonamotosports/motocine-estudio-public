"""Estudio MotoCine en GitHub Actions: formulario → video. Lo llama .github/workflows/estudio.yml.

Entrada: variables ISSUE_BODY e ISSUE_NUMBER (el formulario "Nuevo video").
Salida (carpeta salida/): video.mp4, hoja.jpg y resumen.md (lo que se comenta en el formulario).
Si el guion no pasa la revisión de viralidad (< 85/100) no se arma el video y el resumen dice qué falló.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from motocine import spec as S  # noqa: E402
from motocine.estudio import crear, fallas, leer_formulario  # noqa: E402

OUT = ROOT / 'salida'


def main() -> int:
    OUT.mkdir(exist_ok=True)
    pedido = leer_formulario(os.getenv('ISSUE_BODY', ''))
    pedido['nombre'] = pedido.get('nombre') or f"video-{os.getenv('ISSUE_NUMBER', '0')}"
    lines = [f"**Pedido:** {pedido['formato']} · {pedido['falla']} · {pedido['escenario']} · letra {pedido['letra']}", '']
    try:
        proj_dir = crear(pedido)
    except ValueError as e:
        lines += [f'❌ {e}', '', 'Fallas disponibles: ' + ', '.join(f['nombre'] for f in fallas().values())]
        (OUT / 'resumen.md').write_text('\n'.join(lines), encoding='utf-8')
        return 2
    # 1) voz (Edge Jorge con narrador: aquí hay internet) y revisión de viralidad antes de gastar en el render
    proj = S.load(proj_dir, log=print)
    try:                                              # el vigilante escucha cada frase (Whisper, se baja una vez)
        import json
        from motocine.nube import revisar
        tj = proj.build / 'voz_tiempos.json'
        tj.write_text(json.dumps({'words': [[w.text, w.start, w.end] for w in proj.voice['words']]}, ensure_ascii=False))
        malas = revisar(Path(proj.voice['audio']), tj, download=True)
    except Exception as e:  # nunca detiene el video
        print('no se pudo revisar la voz:', e); malas = []
    from motocine.viral import check
    vr = check(proj.data['narration'], proj.engine_spec, proj.voice.get('words'))
    lines += [f"**Guion:** {proj.data['narration']}", '', f"**Viralidad:** {vr['score']}/100"]
    bad = [i for i in vr['items'] if not i['ok']]
    lines += [f"- ⚠ {i['regla']}" + (f" ({i['dato']})" if i['dato'] else '') for i in bad]
    if malas:
        lines += ['', '**Voz — frases que el revisor no entendió bien** (revísalas al oírlo):']
        lines += [f"- {m['at']} s: «{m['texto']}» se oye «{m['se_oye']}»" for m in malas]
    if vr['score'] < 85:
        lines += ['', '❌ No armé el video: el guion no llega a 85/100. Ajusta el pedido o pide una falla distinta.']
        (OUT / 'resumen.md').write_text('\n'.join(lines), encoding='utf-8')
        return 3
    # 2) video completo (con los revisores de calidad, atención, diseño y sincronía al final)
    r = subprocess.run([sys.executable, '-m', 'motocine', 'render', str(proj_dir)], capture_output=True, text=True)
    log = r.stdout + r.stderr
    print(log[-6000:])
    if r.returncode != 0:
        lines += ['', '❌ El armado falló. Últimas líneas:', '```', log[-1500:], '```']
        (OUT / 'resumen.md').write_text('\n'.join(lines), encoding='utf-8')
        return 4
    out_dir = proj_dir / 'output'
    mp4 = next(out_dir.glob('*.mp4'))
    shutil.copy(mp4, OUT / 'video.mp4')
    hoja = next(out_dir.glob('*_hoja.jpg'), None)
    if hoja:
        shutil.copy(hoja, OUT / 'hoja.jpg')
    lines += ['', '**Revisores:**'] + [f'- {m.strip()}' for m in re.findall(r'^(Vigilante[^\n]*|QA [^\n]*)', log, re.M)]
    (OUT / 'resumen.md').write_text('\n'.join(lines), encoding='utf-8')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
