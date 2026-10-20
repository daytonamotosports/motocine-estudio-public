"""Línea de comandos de MotoCine.

  python -m motocine new mi-video --title "Cada cuánto cambiar la cadena"
  python -m motocine words projects/mi-video          # voz + tiempos de cada palabra
  python -m motocine check projects/mi-video          # revisa escenas y anclas
  python -m motocine stills projects/mi-video 2 8 15  # cuadros de prueba (PNG)
  python -m motocine render projects/mi-video         # video final + QA
  python -m motocine render projects/mi-video --part 0/4   # solo un pedazo (varias máquinas a la vez)
  python -m motocine assemble projects/mi-video partes/    # une los pedazos + audio + QA
  python -m motocine qa projects/mi-video/output/mi-video.mp4
  python -m motocine vigilar video.mp4 --project projects/mi-video --compare ref.mp4   # atención
  python -m motocine voices                           # voces en español disponibles
  python -m motocine voz-nube projects/mi-video       # voz humana (Edge) generada gratis en GitHub
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from . import spec as S


def _load(args):
    proj = S.load(args.project, voice_override=getattr(args, 'voice_engine', None))
    for w in proj.warnings:
        print('⚠', w)
    return proj


def cmd_new(args):
    dest = S.ROOT / 'projects' / args.slug
    if dest.exists():
        sys.exit(f'Ya existe {dest}')
    tpl = S.ROOT / 'templates' / f'{args.template}.json'
    data = json.loads(tpl.read_text(encoding='utf-8'))
    if args.title:
        data['title'] = args.title
    if args.brand:
        data['brand'] = args.brand
    dest.mkdir(parents=True)
    (dest / 'video.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Proyecto creado: {dest / "video.json"}')
    print('1) Escribe la narración  2) python -m motocine words ...  3) ajusta escenas  4) check  5) render')


def cmd_words(args):
    proj = _load(args)
    print(S.words_table(proj.voice['words'], proj.voice['start']))
    print(f'\nVoz: {proj.voice["engine"]} · tiempos {proj.voice["timing"]} · {proj.voice["duration"]:.1f} s')


def cmd_check(args):
    proj = _load(args)
    print(S.timeline_table(proj))
    print('\nOK: todas las anclas se resolvieron.' if not proj.warnings else f'\n{len(proj.warnings)} advertencia(s) arriba.')


def cmd_stills(args):
    from .render import stills
    proj = _load(args)
    times = ([float(t) for t in args.times] or proj.engine_spec.get('key_times')
             or [sc['start'] + .6 * (sc['end'] - sc['start']) for sc in proj.engine_spec['scenes']])
    paths = stills(proj, times)
    from .sincronia import report
    report(proj)
    from .viral import report as viral_report
    viral_report(proj)
    if len(paths) > 1 and shutil.which('ffmpeg'):
        import subprocess
        sheet = proj.build / 'stills' / 'hoja.jpg'
        inputs = sum([['-i', str(p)] for p in paths], [])
        n = len(paths)
        cols = min(n, 6)
        rows = -(-n // cols)
        filt = ''.join(f'[{i}:v]scale=270:-2[s{i}];' for i in range(n))
        pads = ''.join(f'[s{i}]' for i in range(n))
        blanks = cols * rows - n
        if blanks:
            filt += f'color=black:s=270x480:d=1[bk];[bk]split={blanks}' + ''.join(f'[b{i}]' for i in range(blanks)) + ';'
            pads += ''.join(f'[b{i}]' for i in range(blanks))
        filt += f'{pads}xstack=inputs={cols * rows}:layout=' + '|'.join(f'{(i % cols) * 270}_{(i // cols) * 480}' for i in range(cols * rows)) + '[o]'
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', filt, '-map', '[o]', '-frames:v', '1', str(sheet)])
        if r.returncode == 0:
            print(f'Hoja de cuadros: {sheet}')


def cmd_render(args):
    from .render import render
    from . import qa
    proj = _load(args)
    fps = args.fps
    if args.draft:  # borrador rápido: 15 fps y 3D a menor resolución sin suavizado
        fps = fps or 15
        proj.engine_spec['render3d'] = {'scale': .6, 'antialias': False, 'glow': False, 'shadows': False}
    if args.part:
        from .render import render_part
        i, n = (int(v) for v in args.part.split('/'))
        render_part(proj, i, n, workers=args.workers, fps=fps)
        return
    out = render(proj, out=Path(args.out) if args.out else None, workers=args.workers, fps=fps)
    if not args.no_qa:
        qa.run(out, proj.data['narration'] if args.transcript else None, expected=proj.engine_spec['output_duration'])
        _watch(out, proj)


def _watch(out, proj):
    from . import watch
    try:
        watch.run(out, proj.engine_spec, proj.voice.get('words'))
        from .sincronia import report
        report(proj)
        from .viral import report as viral_report
        viral_report(proj)
    except Exception as e:  # el vigilante nunca debe tumbar un render terminado
        print(f'⚠ Vigilante no pudo analizar el video: {e}')


def cmd_assemble(args):
    from .render import assemble
    from . import qa
    proj = _load(args)
    out = assemble(proj, Path(args.parts), out=Path(args.out) if args.out else None)
    if not args.no_qa:
        qa.run(out, None, expected=proj.engine_spec['output_duration'])
        _watch(out, proj)


def cmd_vigilar(args):
    from . import watch
    spec = words = None
    if args.project:
        proj = _load(args)
        spec, words = proj.engine_spec, proj.voice.get('words')
    watch.run(Path(args.video), spec, words, compare=Path(args.compare) if args.compare else None)


def cmd_qa(args):
    from . import qa
    narration = None
    if args.project:
        narration = json.loads(S.find_project(args.project).read_text(encoding='utf-8'))['narration']
    qa.run(Path(args.video), narration)


def cmd_voices(args):
    from .voice import list_edge_voices
    for v in list_edge_voices(args.prefix):
        print(f'{v["ShortName"]:28} {v["Gender"]:7} {v.get("Locale", "")}')


def cmd_voz_nube(args):
    from .nube import run
    run(S.find_project(args.project), args.voz, args.todas)


def cmd_sincronia(args):
    from .sincronia import report
    if report(_load(args)) is None:
        print('Este video no tiene escena con mecánico: nada que revisar')


def cmd_viral(args):
    from .viral import report
    report(_load(args))


def cmd_estudio(args):
    from .estudio import crear, fallas
    if args.publicar:
        from .estudio import publicar
        publicar()
        return
    if args.lista:
        for k, f in fallas().items():
            print(f'{k:14} {f["nombre"]}')
        return
    out = crear({'formato': args.formato, 'falla': args.falla, 'escenario': args.escenario, 'letra': args.letra,
                 'nombre': args.nombre})
    print(f'Proyecto listo: {out}')


def cmd_piezas(args):
    """Lista las piezas (nombres) de un modelo 3D descargado, con su tamaño en mm, para armar "model_setup.parts"."""
    import asyncio
    from .render import serve, chromium_path, GL_ARGS
    from playwright.async_api import async_playwright
    f = Path(args.model).resolve()
    if not f.exists():
        sys.exit(f'No existe {f}')
    cfg = {'forward': args.forward, 'up': args.up, 'length': args.length}

    async def run():
        srv, base = serve(f.parent)
        try:
            async with async_playwright() as pw:
                b = await pw.chromium.launch(executable_path=chromium_path(), args=GL_ARGS)
                page = await b.new_page()
                await page.goto(base + '/engine/index.html')
                await page.wait_for_function('window.MC_READY === true')
                rows = await page.evaluate('([u, c]) => MC.modelParts(u, c)', ['/project/' + f.name, cfg])
                await b.close()
                return rows
        finally:
            srv.shutdown()
    rows = asyncio.run(run())
    print(f'{f.name}: {len(rows)} objetos (tamaños en mm con el largo total = {args.length} mm; x adelante, y arriba)')
    for r in rows:
        if r['d'] <= args.depth and (args.all or not r['mesh'] or r['tris'] > 50):
            print(f"{'  ' * (r['d'] - 1)}{r['name']:<40.40} {'malla' if r['mesh'] else 'grupo':5} "
                  f"tam {r['size'][0]:>5}x{r['size'][1]:>4}x{r['size'][2]:>4}  centro {r['at']}  {r['tris']} triángulos")


def main(argv=None):
    ap = argparse.ArgumentParser(prog='motocine', description='Videos educativos animados de motos, de principio a fin.')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('new', help='crear un proyecto desde una plantilla')
    p.add_argument('slug'); p.add_argument('--title'); p.add_argument('--brand'); p.add_argument('--template', default='basico')
    p.set_defaults(fn=cmd_new)
    for name, fn, hlp in (('words', cmd_words, 'generar la voz y ver el tiempo de cada palabra'),
                          ('check', cmd_check, 'revisar escenas, anclas y tiempos'),
                          ('stills', cmd_stills, 'guardar cuadros de prueba'),
                          ('render', cmd_render, 'renderizar el video final'),
                          ('assemble', cmd_assemble, 'unir partes renderizadas por separado y mezclar el audio')):
        p = sub.add_parser(name, help=hlp)
        p.add_argument('project')
        p.add_argument('--voice-engine', choices=['edge', 'kokoro', 'file', 'piper', 'silent'], help='cambiar el motor de voz solo esta vez')
        if name == 'stills':
            p.add_argument('times', nargs='*', help='segundos (por defecto, uno por escena)')
        if name == 'render':
            p.add_argument('--out'); p.add_argument('--workers', type=int); p.add_argument('--fps', type=int)
            p.add_argument('--draft', action='store_true', help='borrador rápido (15 fps, 3D en baja resolución)')
            p.add_argument('--no-qa', action='store_true'); p.add_argument('--transcript', action='store_true', help='comparar el audio con el guion (requiere faster-whisper)')
            p.add_argument('--part', help='renderizar solo el pedazo i de n, ej. 0/4 (sin audio; luego "assemble")')
        if name == 'assemble':
            p.add_argument('parts', help='carpeta con los part*.mp4'); p.add_argument('--out'); p.add_argument('--no-qa', action='store_true')
        p.set_defaults(fn=fn)
    p = sub.add_parser('piezas', help='ver las piezas (nombres y tamaños) de un modelo 3D descargado')
    p.add_argument('model'); p.add_argument('--forward', default='+x', choices=['+x', '-x', '+z', '-z'])
    p.add_argument('--up', default='+y', choices=['+y', '+z']); p.add_argument('--length', type=float, default=2000)
    p.add_argument('--all', action='store_true', help='mostrar también las mallas muy pequeñas')
    p.add_argument('--depth', type=int, default=5, help='niveles del árbol a mostrar')
    p.set_defaults(fn=cmd_piezas)
    p = sub.add_parser('qa', help='control de calidad de un MP4')
    p.add_argument('video'); p.add_argument('--project')
    p.set_defaults(fn=cmd_qa)
    p = sub.add_parser('vigilar', help='analizar la atención de un video (gancho, zonas muertas, lectura)')
    p.add_argument('video'); p.add_argument('--project', help='carpeta del proyecto para revisar textos y voz')
    p.add_argument('--compare', help='video de referencia para comparar')
    p.add_argument('--voice-engine', choices=['edge', 'kokoro', 'file', 'piper', 'silent'])
    p.set_defaults(fn=cmd_vigilar)
    p = sub.add_parser('voz-nube', help='generar la voz gratis en GitHub (repositorio público motocine-voz) y traerla')
    p.add_argument('project'); p.add_argument('--voz', default='edge-jorge-mx'); p.add_argument('--todas', action='store_true')
    p.set_defaults(fn=cmd_voz_nube)
    p = sub.add_parser('sincronia', help='¿cámara y mecánico acompañan a la voz? (rápido, sin dibujar 3D)')
    p.add_argument('project'); p.add_argument('--voice-engine', choices=['edge', 'kokoro', 'file', 'piper', 'silent'])
    p.set_defaults(fn=cmd_sincronia)
    p = sub.add_parser('viral', help='¿el guion y el plan cumplen la guía de viralidad? (references/viral.md)')
    p.add_argument('project'); p.add_argument('--voice-engine', choices=['edge', 'kokoro', 'file', 'piper', 'silent'])
    p.set_defaults(fn=cmd_viral)
    p = sub.add_parser('estudio', help='crear un video desde el catálogo (formato + falla), sin escribir guion')
    p.add_argument('--formato', default='adivina'); p.add_argument('--falla', default='')
    p.add_argument('--escenario', default='taller'); p.add_argument('--letra', default='aleatoria')
    p.add_argument('--nombre'); p.add_argument('--lista', action='store_true', help='ver las fallas del catálogo')
    p.add_argument('--publicar', action='store_true', help='copiar motor + catálogo + formulario al repositorio público del estudio')
    p.set_defaults(fn=cmd_estudio)
    p = sub.add_parser('voices', help='listar voces de Edge TTS')
    p.add_argument('--prefix', default='es-')
    p.set_defaults(fn=cmd_voices)
    args = ap.parse_args(argv)
    try:
        args.fn(args)
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        sys.exit(f'Error: {e}')


if __name__ == '__main__':
    main()
