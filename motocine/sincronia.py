"""Vigilante de sincronía: ¿la cámara y el mecánico acompañan a la voz?

Recorre el video 10 veces por segundo SIN dibujar el 3D (rápido: segundos) y lee dónde está el mecánico en pantalla,
qué gesto hace, si habla, dónde está la pieza señalada y cómo se mueve la cámara. Revisa:
  mecánico visible  mientras habla y cuando señala una pieza (si señala fuera de cuadro, no sirve)
  no tapar          el mecánico no debe quedar delante de la pieza que señala
  cámara viva       ningún tramo de más de 2 s con la cámara quieta
  a tiempo          cada movimiento de cámara arranca cerca del inicio de una frase (±0,45 s)
Se corre solo con `stills` y `render` en escenas con mecánico; también: python -m motocine sincronia projects/x
"""
from __future__ import annotations

import asyncio

import numpy as np

STEP = .1


async def _probe(proj) -> list[dict]:
    from playwright.async_api import async_playwright

    from .render import GL_ARGS, _open_page, chromium_path, serve
    spec = proj.engine_spec
    srv, base = serve(proj.dir)
    out = []
    try:
        async with async_playwright() as pw:
            kw = {'args': GL_ARGS}
            if chromium_path():
                kw['executable_path'] = chromium_path()
            b = await pw.chromium.launch(**kw)
            page, _, _ = await _open_page(b, base, spec)
            await page.evaluate('() => { window.__SKIP3D = true; }')
            ts = [round(i * STEP, 2) for i in range(int(spec['duration'] / STEP))]
            out = await page.evaluate('ts => ts.map(t => { MC.isoState = null; MC.draw(t); return MC.isoState; })', ts)
            await b.close()
    finally:
        srv.shutdown()
    return [s for s in out if s]


def _sentence_starts(spec) -> list[float]:
    ws = spec.get('speech_words') or []
    return [w[0] for i, w in enumerate(ws) if i == 0 or str(ws[i - 1][2]).endswith(('.', '?', '!', '…'))]


def analyze(proj, states: list[dict] | None = None) -> dict | None:
    spec = proj.engine_spec
    sc = next((s for s in spec['scenes'] if s['type'] == 'iso' and (s.get('params') or {}).get('poses')), None)
    if sc is None:
        return None
    st = states if states is not None else asyncio.run(_probe(proj))
    if not st:
        return None
    t = np.array([s['t'] for s in st]); vis = np.array([s['visible'] for s in st]); talk = np.array([s['talk'] > 0 for s in st])
    cam = np.array([s['cam'] for s in st], float)
    warn = []
    vis_talk = float(vis[talk].mean()) if talk.any() else 1.0
    if vis_talk < .8:
        warn.append(f'El mecánico solo se ve el {vis_talk:.0%} del tiempo que habla (lo bueno: 80 % o más)')
    for q in sc['params']['poses']:
        if q['name'] != 'point':
            continue
        m = (t >= q['at'] + .2) & (t <= q['at'] + 1.0)
        if m.any() and vis[m].mean() < .7:
            warn.append(f'Señala fuera de cuadro en {q["at"]:.1f} s (encuadra la pieza Y al mecánico)')
    # ¿el mecánico tapa la pieza señalada? (la pieza cae dentro de su silueta en pantalla)
    hid = []
    for s_ in st:
        if not s_.get('part') or not s_.get('feet'):
            continue
        (hx, hy), (fx, fy), (px, py) = s_['head'], s_['feet'], s_['part']
        h = max(1, fy - hy)
        if hy - .35 * h < py < fy and abs(px - (hx + fx) / 2) < .42 * h:
            hid.append(s_['t'])
    if len(hid) * STEP >= .5:
        warn.append(f'El mecánico tapa la pieza que señala ({len(hid) * STEP:.1f} s, desde {hid[0]:.1f} s): párate al lado')
    # movimiento de cámara por paso: desplazamiento + cambio de acercamiento y de ángulo
    d = np.abs(np.diff(cam[:, 0])) + np.abs(np.diff(cam[:, 1])) + 400 * np.abs(np.diff(cam[:, 2])) + 300 * np.abs(np.diff(cam[:, 3]))
    still = d < .6
    for dd in sc['params'].get('details') or []:       # "por dentro": la maqueta no se ve (el mecanismo tiene su movimiento)
        still &= ~((t[1:] >= dd['at']) & (t[1:] <= dd['until'] + .35))
    run, longest, spans = 0, 0.0, []
    for i, s_ in enumerate(still):
        run = run + 1 if s_ else 0
        if run * STEP >= 2.0 and (i + 1 == len(still) or not still[i + 1]):
            spans.append((round(t[i] - run * STEP, 1), round(t[i], 1)))
        longest = max(longest, run * STEP)
    for a, b in spans:
        warn.append(f'Cámara quieta {a}–{b} s: agrega un movimiento o un golpe de acercamiento')
    starts = _sentence_starts(spec)
    late = []
    for f in sc['params'].get('focus') or []:
        if f['at'] < 1.5 or not starts:
            continue
        gap = min(abs(f['at'] - s) for s in starts)
        onsets = [w[0] for w in spec.get('speech_words') or []]
        on_word = min((abs(f['at'] - o) for o in onsets), default=9) <= .2      # o justo en una palabra (golpe al ritmo)
        if gap > .45 and not on_word:
            late.append(round(f['at'], 1))
    shots = [f for f in (sc['params'].get('focus') or []) if f['at'] >= 0]
    per10 = len(shots) / max(1.0, spec.get('duration') or (st[-1]['t'] if st else 1)) * 10
    if per10 < 2.95:
        warn.append(f'Solo {per10:.1f} cambios de toma cada 10 s (lo dinámico: 3 o más)')
    if late:
        warn.append(f'Movimientos de cámara lejos del inicio de una frase en {late} s')
    score = 100 - 30 * max(0, .8 - vis_talk) / .8 - 8 * len(warn)
    return {'score': int(max(0, min(100, round(score)))), 'mecanico_visible_hablando': round(vis_talk, 2),
            'camara_quieta_max_s': round(longest, 1), 'tomas_cada_10s': round(per10, 1), 'warnings': warn}


def report(proj, log=print) -> dict | None:
    r = analyze(proj)
    if r is None:
        return None
    log(f'Vigilante de sincronía: {r["score"]}/100 · mecánico visible al hablar {r["mecanico_visible_hablando"]:.0%} · '
        f'cámara quieta máx. {r["camara_quieta_max_s"]} s · {r["tomas_cada_10s"]} tomas cada 10 s')
    for w in r['warnings']:
        log(f'   ⚠ {w}')
    return r
