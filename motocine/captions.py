"""Agrupa las palabras en frases cortas para subtítulos tipo karaoke."""
from __future__ import annotations

from .text import Word, PUNCT_END, norm

WEAK = {'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'que', 'de', 'del', 'a', 'al', 'se', 'te', 'lo', 'le', 'tu', 'su',
        'en', 'con', 'por', 'para', 'sin', 'mas', 'muy', 'es', 'no', 'si', 'mi'}


def build_phrases(words: list[Word], offset: float, t_from: float, t_until: float,
                  max_chars: int = 26, min_chars: int = 8, max_gap: float = 0.35) -> list[dict]:
    """Devuelve [{start, end, words:[{text,start,next}]}] en segundos del video.

    Corta una frase al llegar a ~max_chars, tras puntuación (si ya tiene min_chars)
    o cuando la voz hace una pausa mayor que max_gap.
    """
    sel = [Word(w.text, w.start + offset, w.end + offset) for w in words]
    sel = [w for w in sel if t_from - 0.01 <= w.start < t_until]
    # 1) cláusulas: se corta tras puntuación o pausa larga de la voz
    clauses: list[list[Word]] = []
    cur: list[Word] = []
    for i, w in enumerate(sel):
        cur.append(w)
        nxt = sel[i + 1] if i + 1 < len(sel) else None
        if nxt is None or w.text.endswith(PUNCT_END) or nxt.start - w.end > max_gap:
            clauses.append(cur)
            cur = []
    # 2) cláusulas largas -> trozos de largo parecido (sin palabras huérfanas)
    groups: list[list[Word]] = []
    for cl in clauses:
        text_len = len(' '.join(w.text for w in cl))
        if text_len <= max_chars or len(cl) == 1:
            groups.append(cl)
            continue
        n = -(-text_len // max_chars)
        target = text_len / n
        chunk, acc = [], 0
        for w in cl:
            add = len(w.text) + (1 if chunk else 0)
            if chunk and acc + add / 2 > target:
                groups.append(chunk)
                chunk, acc = [], 0
                add = len(w.text)
            chunk.append(w)
            acc += add
        if chunk:
            groups.append(chunk)
    # fusionar restos muy cortos con la frase anterior de la misma cláusula
    merged: list[list[Word]] = []
    for g in groups:
        if merged and len(' '.join(w.text for w in g)) < min_chars // 2 and not merged[-1][-1].text.endswith(PUNCT_END) \
                and len(' '.join(w.text for w in merged[-1] + g)) <= max_chars + 6:
            merged[-1] = merged[-1] + g
        else:
            merged.append(g)
    groups = merged
    # no terminar una línea en palabras de enlace ("el", "y", "que"...): pasarlas a la siguiente
    for i in range(len(groups) - 1):
        a, b = groups[i], groups[i + 1]
        while len(a) > 1 and not a[-1].text.endswith(PUNCT_END) and norm(a[-1].text) in WEAK:
            b.insert(0, a.pop())
    phrases = []
    for gi, g in enumerate(groups):
        start = g[0].start
        if gi + 1 < len(groups):
            nxt_start = groups[gi + 1][0].start
            end = nxt_start if nxt_start - g[-1].end < 0.9 else g[-1].end + 0.5
        else:
            end = min(t_until, g[-1].end + 0.8)
        end = min(end, t_until)
        ws = []
        for i, w in enumerate(g):
            nxt = g[i + 1].start if i + 1 < len(g) else end
            ws.append({'text': w.text, 'key': norm(w.text), 'start': round(w.start, 3), 'next': round(nxt, 3)})
        phrases.append({'start': round(start, 3), 'end': round(end, 3), 'words': ws})
    return phrases
