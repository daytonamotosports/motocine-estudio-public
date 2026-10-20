"""Música y efectos de sonido procedurales (sin archivos ni licencias externas).

Estilo comercial: tensión en el gancho, "drop" cuando empieza el video, bombo, palmas,
hi-hats, bajo y acordes; redoble antes de cada cambio de escena y golpe final.
Los efectos se colocan solos según las escenas: whoosh/glitch en transiciones y cortes de
cámara, clic en etiquetas e insignias, golpes en énfasis y momentos fuertes.
Un objeto con "at" puede llevar "sfx": "tick" | "boom" | "ding" | "hit" | "none".
"""
from __future__ import annotations

import json
import wave
from pathlib import Path

import numpy as np

SR = 48000
ROOT = Path(__file__).resolve().parent.parent


class Synth:
    def __init__(self, seed: int = 7):
        self.rng = np.random.default_rng(seed)

    def band(self, n, lo, hi):
        s = self.rng.normal(0, 1, n)
        F = np.fft.rfft(s)
        f = np.fft.rfftfreq(n, 1 / SR)
        F[(f < lo) | (f > hi)] = 0
        out = np.fft.irfft(F, n)
        return out / (np.abs(out).max() + 1e-9)

    def whoosh(self, d=.5):
        n = int(d * SR); tt = np.linspace(0, 1, n)
        return (self.band(n, 150, 900) * (1 - tt) + self.band(n, 1500, 7000) * tt) * np.sin(np.pi * tt) ** 2

    def rewind(self, d=.45):                       # whoosh al revés con caída de tono
        n = int(d * SR); t = np.arange(n) / SR
        tone = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t / .12) + 120) / SR) * .4
        return (self.whoosh(d)[::-1] + tone) * np.linspace(.3, 1, n)

    def glitch(self, d=.3):
        n = int(d * SR)
        s = self.band(n, 300, 9000)
        steps = np.repeat(self.rng.choice([0, 1], size=n // 600 + 1, p=[.35, .65]), 600)[:n]
        crushed = np.round(s * 6) / 6
        return crushed * steps * np.linspace(1, .2, n)

    def boom(self, d=1.0):
        n = int(d * SR); t = np.arange(n) / SR
        f = 40 + 70 * np.exp(-t / .07)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .35) + self.band(n, 40, 300) * np.exp(-t / .1) * .5

    def hit(self):                                 # golpe corto de énfasis: grave + chasquido
        n = int(.35 * SR); t = np.arange(n) / SR
        f = 70 + 160 * np.exp(-t / .02)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .09) + self.band(n, 2500, 9000) * np.exp(-t / .015) * .6

    def motor(self, d, tic=True, up=False):
        """Motor monocilíndrico 4T en mínima (~1.500 rpm: una explosión cada 2 vueltas): golpe de escape grave por
        cada explosión + cuerpo; con tic=True, el "tic-tic" metálico de balancines desajustados (un chasquido
        brillante por ciclo). up=True: acelera al final (el tic sube con las rpm)."""
        n = int(max(.1, d) * SR); t = np.arange(n) / SR
        rpm = 1500 + np.zeros(n) + (2600 * np.clip((t - d * .55) / (d * .45), 0, 1) ** 1.6 if up else 0)
        f = rpm / 120
        ph = np.cumsum(f) / SR
        frac = ph % 1
        thump = np.exp(-frac * 10)
        out = thump * (np.sin(2 * np.pi * np.cumsum(f * 3) / SR) * .5 + .8) * .6
        out += self.band(n, 50, 380) * thump * .45 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * .18
        if tic:
            out += self.band(n, 2600, 7200) * np.exp(-((frac - .55) % 1) * 140) * .7
        out *= np.minimum(1, np.minimum(t / .06, (d - t) / .12))
        return out / (np.abs(out).max() + 1e-9) * .85

    def cadena(self, d, seca=True):
        """Cadena girando: traqueteo suave de eslabones (~60 por segundo) y, si está SECA, un chirrido metálico agudo
        que se repite con cada vuelta de la rueda (~3 por segundo). Lubricada: solo el rodar suave."""
        n = int(max(.1, d) * SR); t = np.arange(n) / SR
        roll = self.band(n, 700, 3200) * (.55 + .45 * np.sin(2 * np.pi * 60 * t) ** 2) * .35
        out = roll + self.band(n, 80, 300) * .25
        if seca:
            ph = (t * 3.1) % 1
            env = np.exp(-((ph - .3) % 1) * 9) * (((ph - .3) % 1) < .22)
            f = 2700 + 350 * np.sin(2 * np.pi * 7 * t)
            sq = np.sin(2 * np.pi * np.cumsum(f) / SR) + .4 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
            out += sq * env * .55
        out *= np.minimum(1, np.minimum(t / .08, (d - t) / .15))
        return out / (np.abs(out).max() + 1e-9) * .8

    def tick(self):
        n = int(.12 * SR); t = np.arange(n) / SR
        return np.sin(2 * np.pi * 1800 * t) * np.exp(-t / .03) * .5 + self.band(n, 3000, 9000) * np.exp(-t / .02) * .2

    def ding(self):
        n = int(.8 * SR); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * 1320 * t) + .5 * np.sin(2 * np.pi * 1980 * t)) * np.exp(-t / .25) * .5

    def riser(self, d):
        n = int(max(.1, d) * SR); tt = np.linspace(0, 1, n)
        s = self.band(n, 600, 6000) * tt ** 2 * .6
        tone = np.sin(2 * np.pi * np.cumsum(200 + 700 * tt ** 2) / SR) * tt ** 3 * .25
        return s + tone

    def grind(self, d):
        n = int(max(.1, d) * SR); t = np.arange(n) / SR
        return self.band(n, 2000, 7000) * (0.3 + 0.7 * np.clip(t / 2.0, 0, 1)) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 1.6 * t)))

    # --- batería y música ---
    def kick(self):
        n = int(.35 * SR); t = np.arange(n) / SR
        f = 45 + 110 * np.exp(-t / .035)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .12)

    def clap(self):
        n = int(.25 * SR); t = np.arange(n) / SR
        env = np.exp(-t / .06) * (1 + .6 * (np.sin(2 * np.pi * 90 * t) > 0) * (t < .03))
        return self.band(n, 900, 5000) * env * .8 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / .03) * .3

    def hat(self, open_=False):
        n = int((.16 if open_ else .05) * SR)
        s = np.diff(self.rng.normal(0, 1, n), prepend=0)
        return s * np.exp(-np.arange(n) / SR / (.05 if open_ else .012)) * .3

    def bass(self, f, d):
        n = int(d * SR); t = np.arange(n) / SR
        s = sum(np.sin(2 * np.pi * f * k * t) / k * .8 ** k for k in range(1, 7))
        return s * np.minimum(1, t / .005) * np.exp(-t / (d * .7))

    def pad(self, freqs, d):
        n = int(d * SR); t = np.arange(n) / SR
        s = sum(np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.003 * t) for f in freqs)
        env = np.minimum(1, t / .4) * np.minimum(1, (d - t) / .4)
        return s * env / len(freqs)


def _add(buf, t, sig, g=1.0):
    i = int(round(t * SR))
    if i >= len(buf) or i + len(sig) <= 0:
        return
    j = min(len(buf), i + len(sig))
    s0 = max(0, -i)
    buf[max(i, 0):j] += sig[s0:j - i] * g


def _shots() -> dict:
    try:
        return json.loads((ROOT / 'engine' / 'shots.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def camera_cuts(sc: dict) -> list[float]:
    """Momentos de corte de cámara de una escena 3D (para poner un whoosh)."""
    p = sc['params']
    keys = p.get('camera') or _shots().get(p.get('shot') or 'wide') or []
    out = []
    for k in keys:
        if isinstance(k, dict) and k.get('cut'):
            out.append(k['at'] if isinstance(k.get('at'), (int, float)) else sc['start'] + k.get('u', 0) * (sc['end'] - sc['start']))
    return out


def iso_cues(p: dict) -> list:
    """Sonidos de la maqueta: whoosh en cada movimiento de cámara, golpe en cada acercamiento sobre la palabra clave,
    ding cuando aparece una señal, pop de los globos y de las piezas al aparecer, pasos cuando el mecánico camina
    y un golpe fuerte con el sello del gancho de choque."""
    out = []
    for f in (p.get('focus') or [])[1:]:
        out.append(('whoosh', f['at'] - .12, .38, .75))
    for t in p.get('punches') or []:
        out.append(('hit', t, .3, .55))
    for m in p.get('marks') or []:
        out.append(('ding', m['at'] + .05, .6, .7))
    for b in p.get('bubbles') or []:
        out.append(('tick', b['at'], .2, 1.0))
    for o in p.get('objects') or []:
        if isinstance(o.get('at'), (int, float)) and o['at'] < 1.5:
            out.append(('tick', o['at'], .15, .45))
        x, z = o.get('x', 0), o.get('z', 0)
        for mv in o.get('moves') or []:            # pasos: uno cada 0,28 s mientras camina
            d = ((mv['x'] - x) ** 2 + (mv['z'] - z) ** 2) ** .5
            dur = max(.4, d / o.get('speed', 300))
            k = 0
            while k * .28 < dur - .1:
                out.append(('tick', mv['at'] + .1 + k * .28, .1, .3 + .1 * (k % 2)))
                k += 1
            x, z = mv['x'], mv['z']
    for d in p.get('details') or []:               # "por dentro": cada golpe del balancín suena cuando se ve
        out += detail_cues(d)
    for q in p.get('sounds') or []:                # sonidos protagonistas (el motor a adivinar)
        out.append((q.get('kind', 'motor_tic'), q['at'], q['until'] - q['at'], q.get('gain', 1.0)))
    for c in p.get('countdown') or []:             # cuenta regresiva: tic de reloj en cada número
        out.append(('tick', c['at'], .12, 1.0))
    if (p.get('options') or {}).get('reveal_at') is not None:
        out += [('ding', p['options']['reveal_at'], .8, 1.0), ('hit', p['options']['reveal_at'], .3, .8)]
    for it in (p.get('options') or {}).get('items') or []:
        out.append(('tick', it['at'], .12, .6))
    if p.get('impact'):
        out += [('boom', p['impact'].get('at', 0), 1.4, 1.3), ('hit', p['impact'].get('at', 0) + .02, .3, 1.0)]
    return out


def detail_cues(d: dict) -> list:
    """Golpes sincronizados con la animación de engine/iso3d.js (balState): mismo cálculo de holgura y contacto."""
    if d.get('kind') != 'balancines':
        return []
    import math
    adj = next((q for q in d.get('phases') or [] if q['mode'] == 'ajuste'), None)
    out, prev, t = [], 0.0, d['at']
    while t < d['until']:
        u = 0.0 if not adj else min(1, max(0, (t - adj['at'] - .6) / 1.6))
        u = 4 * u ** 3 if u < .5 else 1 - (-2 * u + 2) ** 3 / 2
        gap = 16 + (2 - 16) * u
        ang = (t - d['at']) * d.get('speed', 5.2)
        lift = 26 * max(0.0, math.cos(ang)) ** 3
        contact = 90 * math.sin(math.atan(lift / 90)) - gap
        if contact > 0 >= prev and gap > 6:
            out += [('tick', t, .12, 1.1), ('hit', t, .3, .45)]
        prev = contact
        t += 1 / 600
    return out


def cues(spec: dict) -> tuple[list, list]:
    """Efectos [(tipo, t, duración, ganancia)] y ventanas de silencio de música, en el tiempo del guion."""
    out, mute = [], []
    scenes = spec['scenes']

    def ats(obj):
        if isinstance(obj, dict):
            if isinstance(obj.get('at'), (int, float)):
                yield obj
            for v in obj.values():
                yield from ats(v)
        elif isinstance(obj, list):
            for v in obj:
                yield from ats(v)

    for i, sc in enumerate(scenes):
        p, st, en = sc['params'], sc['start'], sc['end']
        tr = sc.get('transition', 'flash')
        if i == 0:
            out.append(('boom', st, 1.2, .9))
        elif tr == 'glitch':
            out.append(('glitch', st - .15, .3, .8))
        elif tr == 'zoom':
            out.append(('whoosh', st - .3, .45, 1.0)); out.append(('hit', st, .3, .7))
        elif tr == 'bars':
            out.append(('whoosh', st - .35, .7, 1.0))
        elif tr != 'none':
            out.append(('whoosh', st - .25, .5, 1.0))
        for c in camera_cuts(sc):
            out.append(('whoosh', c - .18, .36, .8))
        if sc['type'] == 'iso':                    # maqueta: cada cosa que pasa en pantalla tiene su sonido
            out += iso_cues(p)
            mute += [(q['at'], q['until']) for q in p.get('sounds') or [] if q.get('mute_music', True)]
            continue
        for o in ats(p):
            kind = o.get('sfx') or ('boom' if o.get('shake') else 'tick')
            if kind != 'none':
                out.append((kind, o['at'], .8, .8 if kind == 'boom' else 1.0))
        t = sc['type']
        if t == 'studio':                          # cada cambio de toma del estudio 3D lleva un golpe de aire suave
            for k in p.get('cuts') or []:
                out.append(('whoosh', k - .15, .3, .45))
        if t == 'engine_cutaway' and isinstance(p.get('rpm'), dict):
            out.append(('riser', p['rpm']['at'], 1.8, 1.0))
        if t == 'dry_friction':
            heat = p.get('heat_at', st + 1.3)
            peak = p.get('peak_at', heat + 1.7)
            seize = p.get('seize_at')
            out.append(('riser', peak - 1.6, 1.6, .9))
            out.append(('boom', peak, 1.0, 1.0))
            out.append(('grind', heat, (seize or en) - heat, .35))
            if seize:
                out.append(('boom', seize, 2.0, 1.4))
                mute.append((seize, en))
        if t == 'chain_drive':
            if isinstance(p.get('jump_at'), (int, float)):
                out.append(('boom', p['jump_at'] + .2, 1.0, 1.0))
            if isinstance(p.get('clean_at'), (int, float)):
                out.append(('whoosh', p['clean_at'], 1.1, .7))
            if isinstance(p.get('lube_at'), (int, float)):
                for k in range(7):
                    out.append(('tick', p['lube_at'] + .35 + k * .22, .1, .45))
            if isinstance(p.get('ok_at'), (int, float)):
                out.append(('ding', p['ok_at'], .8, .7))
        if t == 'sprocket_wear' and isinstance(p.get('worn_at'), (int, float)):
            out.append(('boom', p['worn_at'], .8, .7))
        if t == 'oil_film' and isinstance(p.get('film_at'), (int, float)):
            out.append(('tick', p['film_at'], .1, 1.0))
        if t == 'sight_glass':
            out.append(('ding', p.get('ok_at', st + 1.35), .8, .8))
        if t == 'gauge':
            a, b = p.get('from_at', st + .3), p.get('to_at', st + 1.6)
            out.append(('riser', a, b - a, .8))
        if t == 'outro':
            card = p.get('card_at', st + 2)
            for k in range(len(p.get('lines', []))):
                out.append(('boom', card + .1 + k * .3, .8, .7))
            out.append(('boom', card + 1.0, 1.6, 1.0))
            if p.get('cta'):
                out.append(('ding', card + p.get('cta_delay', 1.5), .8, .6))
    for e in spec.get('emphasis', []):
        out.append(('hit', e, .35, .75))
    return out, mute


def _render_fx(sy: Synth, events, n, shift=0.0, gain=1.0, window=None):
    fx = np.zeros(n)
    for kind, t, d, g in events:
        if window and not (window[0] - .3 <= t < window[1]):
            continue
        sig = {'whoosh': lambda: sy.whoosh(d), 'boom': lambda: sy.boom(d), 'tick': sy.tick, 'ding': sy.ding,
               'riser': lambda: sy.riser(d), 'grind': lambda: sy.grind(d), 'hit': sy.hit,
               'glitch': lambda: sy.glitch(d), 'rewind': lambda: sy.rewind(d),
               'motor': lambda: sy.motor(d, tic=False), 'motor_tic': lambda: sy.motor(d),
               'motor_tic_up': lambda: sy.motor(d, up=True),
               'cadena_seca': lambda: sy.cadena(d), 'cadena_ok': lambda: sy.cadena(d, seca=False)}[kind]()
        _add(fx, t + shift, sig, g * gain)
    return fx


def make_tracks(spec: dict, build: Path, music_cfg: dict | bool = True) -> tuple[Path, Path | None]:
    dur = spec['duration']
    tz = spec.get('teaser')
    D = tz['dur'] if tz else 0.0
    total = spec.get('output_duration', dur + D)
    n = int(total * SR) + SR
    sy = Synth()
    events, mute = cues(spec)
    fx = _render_fx(sy, events, n, shift=D)
    if tz:                                     # el gancho repite los sonidos del momento mostrado
        fx += _render_fx(sy, events, n, shift=-tz['src'], gain=.85, window=(tz['src'], tz['src'] + D))
        _add(fx, max(0, D - .42), sy.rewind(.45), .9)
        _add(fx, D, sy.boom(1.4), 1.2)
    build.mkdir(parents=True, exist_ok=True)
    fx_path = build / 'fx.wav'
    _write(fx_path, fx[:int(total * SR)])
    if music_cfg is False:
        return fx_path, None
    mc = music_cfg if isinstance(music_cfg, dict) else {}
    mus = music(spec, sy, n, total, D, mute, float(mc.get('bpm', 100)))
    mus_path = build / 'music.wav'
    _write(mus_path, mus[:int(total * SR)])
    return fx_path, mus_path


# progresión La menor – Fa – Do – Sol (graves y acordes)
BASS = [55.0, 43.65, 65.41, 49.0]
CHORDS = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]]


def music(spec, sy: Synth, n, total, D, mute, bpm=100.0) -> np.ndarray:
    beat = 60 / bpm
    bar = 4 * beat
    out = np.zeros(n)
    mute = [(a + D, b + D) for a, b in mute]
    muted = lambda t: any(a <= t < b for a, b in mute)
    scenes = spec['scenes']
    first_main = (scenes[1]['start'] if len(scenes) > 1 else 3) + D
    card = next((s['params'].get('card_at') for s in scenes if s['type'] == 'outro' and s['params'].get('card_at')), None)
    end_groove = (card + D) if card else total - 1.5
    # tensión durante el gancho: zumbido grave que sube
    if D > 0:
        tt = np.arange(int(D * SR)) / SR
        drone = np.sin(2 * np.pi * 55 * tt) * .25 + sy.band(len(tt), 80, 400) * .08
        _add(out, 0, drone * np.linspace(.4, 1, len(tt)), 1)
        _add(out, 0, sy.riser(D), .5)
    # ritmo principal
    t, k = D, 0
    while t < end_groove:
        if not muted(t):
            full = t >= first_main
            _add(out, t, sy.kick(), .95)
            _add(out, t + beat / 2, sy.hat(open_=full and k % 2 == 1), .55 if full else .4)
            if full:
                if k % 4 in (1, 3):
                    _add(out, t, sy.clap(), .55)
                _add(out, t + beat * .25, sy.hat(), .22)
                _add(out, t + beat * .75, sy.hat(), .22)
                bi = int((t - D) // bar) % 4
                _add(out, t, sy.bass(BASS[bi], beat * .45), .5)
                _add(out, t + beat / 2, sy.bass(BASS[bi], beat * .4), .35)
                if k % 4 == 0:
                    _add(out, t, sy.pad(CHORDS[bi], bar), .09)
        t += beat
        k += 1
    # redoble corto antes de cada cambio de escena
    for sc in scenes[1:]:
        st = sc['start'] + D
        if st < end_groove and not muted(st - .01):
            for j, dt in enumerate((.3, .2, .1)):
                _add(out, st - dt, sy.clap(), .25 + .1 * j)
    # final: golpe y cola
    _add(out, end_groove, sy.boom(2.0), .9)
    if card:
        tail = np.arange(int(max(.1, total - end_groove) * SR)) / SR
        _add(out, end_groove, sy.pad(CHORDS[0], len(tail) / SR) * np.exp(-tail / 1.2), .12)
    fade0 = int((total - 1.0) * SR)
    out[fade0:] *= np.linspace(1, 0, n - fade0)
    return out


def _write(path: Path, x: np.ndarray):
    peak = np.abs(x).max() or 1
    x = x / peak * .9
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
