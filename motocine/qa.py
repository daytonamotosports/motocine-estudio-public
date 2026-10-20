"""Control de calidad de un MP4 terminado.

- Duración, resolución, fps y pistas (ffprobe).
- Volumen integrado (LUFS) para redes (~ -14).
- Hoja de contacto: 12 cuadros repartidos en una sola imagen para revisar a ojo.
- Opcional: transcribe el audio con faster-whisper y lo compara con el guion.
"""
from __future__ import annotations

import difflib
import json
import re
import subprocess
from pathlib import Path

from .text import norm


def probe(path: Path) -> dict:
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate',
                          '-of', 'json', str(path)], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def loudness(path: Path) -> float | None:
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)
    return float(m[-1]) if m else None


def contact_sheet(path: Path, out: Path, n: int = 12, cols: int = 6, width: int = 270) -> Path:
    dur = float(probe(path)['format']['duration'])
    times = [dur * (i + .5) / n for i in range(n)]
    tmp = out.parent / '_qa_frames'
    tmp.mkdir(parents=True, exist_ok=True)
    for i, t in enumerate(times):
        base = ['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.2f}', '-i', str(path), '-frames:v', '1']
        label = f",drawtext=text='{t:.1f}s':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6"
        r = subprocess.run(base + ['-vf', f'scale={width}:-2{label}', str(tmp / f'{i:02d}.jpg')], capture_output=True)
        if r.returncode != 0:  # sin fuente del sistema para drawtext: sin marca de tiempo
            subprocess.run(base + ['-vf', f'scale={width}:-2', str(tmp / f'{i:02d}.jpg')], check=True)
    rows = -(-n // cols)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp / '%02d.jpg'), '-vf', f'tile={cols}x{rows}:padding=4:color=black',
                    '-frames:v', '1', str(out)], check=True)
    for f in tmp.glob('*.jpg'):
        f.unlink()
    tmp.rmdir()
    return out


def transcript_score(path: Path, narration: str) -> tuple[float, str] | None:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None
    model = WhisperModel('small', device='cpu', compute_type='int8')
    segs, _ = model.transcribe(str(path), language='es')
    heard = ' '.join(s.text.strip() for s in segs)
    a = [norm(w) for w in narration.split() if norm(w)]
    b = [norm(w) for w in heard.split() if norm(w)]
    return difflib.SequenceMatcher(None, a, b).ratio(), heard


def run(path: Path, narration: str | None = None, expected: float | None = None, log=print) -> dict:
    path = Path(path)
    info = probe(path)
    dur = float(info['format']['duration'])
    v = next((s for s in info['streams'] if s['codec_type'] == 'video'), {})
    a = next((s for s in info['streams'] if s['codec_type'] == 'audio'), None)
    rep = {'file': str(path), 'duration': round(dur, 2), 'video': f'{v.get("width")}x{v.get("height")} {v.get("codec_name")} {v.get("r_frame_rate")}',
           'audio': a['codec_name'] if a else None, 'size_mb': round(path.stat().st_size / 1e6, 1), 'problems': []}
    if expected and abs(dur - expected) > .2:
        rep['problems'].append(f'Duración {dur:.2f} s, se esperaba {expected:.2f} s')
    if not a:
        rep['problems'].append('El video no tiene audio')
    else:
        rep['lufs'] = loudness(path)
        if rep['lufs'] is not None and not (-17 <= rep['lufs'] <= -11):
            rep['problems'].append(f'Volumen {rep["lufs"]} LUFS (lo ideal para redes es cerca de -14)')
    if (v.get('width'), v.get('height')) != (1080, 1920):
        rep['problems'].append('No es vertical 1080x1920')
    sheet = path.with_name(path.stem + '_hoja.jpg')
    rep['contact_sheet'] = str(contact_sheet(path, sheet))
    if narration and a:
        ts = transcript_score(path, narration)
        if ts:
            rep['transcript_match'] = round(ts[0], 3)
            rep['transcript'] = ts[1]
            if ts[0] < .85:
                rep['problems'].append(f'Lo que se oye coincide solo {ts[0]:.0%} con el guion: revisa pronunciación')
        else:
            rep['transcript_match'] = 'no revisado (instala faster-whisper para revisar la pronunciación)'
    log(f'QA {path.name}: {rep["duration"]} s · {rep["video"]} · audio {rep["audio"]} · {rep.get("lufs")} LUFS · {rep["size_mb"]} MB')
    log(f'   hoja de contacto: {rep["contact_sheet"]}')
    if 'transcript_match' in rep:
        log(f'   coincidencia con el guion: {rep["transcript_match"]}')
    for p in rep['problems']:
        log(f'   ⚠ {p}')
    if not rep['problems']:
        log('   sin problemas técnicos detectados (igual revisa la hoja de contacto)')
    path.with_name(path.stem + '_qa.json').write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding='utf-8')
    return rep
