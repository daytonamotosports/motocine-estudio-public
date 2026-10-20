// MotoCine — núcleo del motor de animación (canvas 2D).
// Todas las escenas comparten estos helpers. El tiempo `t` siempre es el
// segundo global del video; cada escena calcula su tiempo local con scene.start.
'use strict';

const MC = window.MC = { scenes: {}, icons: {}, spec: null, logo: null, cache: {} };
let x = null;              // contexto 2D compartido por todas las escenas
let W = 1080, H = 1920;
let TH = {                 // tema (se reemplaza con la marca del proyecto)
  primary: '#C10608', accent: '#E3141B', text: '#FFFFFF', ink: '#0B0B0C',
  bg1: '#1A1B1F', bg2: '#030304', oil: '#F5B427', oilDark: '#8A5304', oilLight: '#FFE08A',
  good: '#C10608'
};

// ---------- utilidades ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const prog = (t, a, b) => (b === a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));
const lerp = (a, b, k) => a + (b - a) * k;
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eout = t => 1 - Math.pow(1 - clamp(t), 3);
const back = t => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const FONT = (w, s, italic = true) => `${italic ? 'italic ' : ''}${w} ${s}px Montserrat`;
const has = v => v !== undefined && v !== null;
const rgba = (hex, a) => {
  const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};

function rrect(x0, y0, w, h, r) {
  x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
  x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath();
}
function metal(x0, x1, dark = 0) {
  const g = x.createLinearGradient(x0, 0, x1, 0), k = 1 - dark;
  const col = v => `rgb(${Math.round(v * k)},${Math.round(v * k * 1.02)},${Math.round(v * k * 1.06)})`;
  g.addColorStop(0, col(70)); g.addColorStop(.25, col(190)); g.addColorStop(.45, col(225));
  g.addColorStop(.7, col(120)); g.addColorStop(1, col(55));
  return g;
}
function oilGradient(x0, x1) {
  const g = x.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#B97A0A'); g.addColorStop(.5, '#F7BE36'); g.addColorStop(1, '#B97A0A');
  return g;
}

// ---------- piezas gráficas comunes ----------
// Fondo de estudio animado: degradado, piso en perspectiva que avanza, haces de luz,
// polvo y destellos desenfocados (bokeh) con paralaje. style "grid" = fondo simple anterior.
const PARTS = Array.from({ length: 80 }, (_, i) => ({ x: hash(i * 3.1 + 1), y: hash(i * 7.7 + 2), z: .15 + .85 * hash(i * 1.3 + 3), r: hash(i * 5.9 + 4), red: hash(i * 9.2 + 5) < .2 }));
function background(t) {
  const bgc = (MC.spec && MC.spec.background) || {};
  if (bgc.style === 'image' && MC.bgImage) {        // escenario: foto (o render) del taller desenfocada, con acercamiento lento
    const im = MC.bgImage, z = 1.06 + .03 * Math.sin(t * .15), sc = Math.max(W / im.width, H / im.height) * z;
    const w = im.width * sc, h = im.height * sc;
    x.drawImage(im, (W - w) / 2 + 20 * Math.sin(t * .11), (H - h) / 2, w, h);
    const sh = x.createLinearGradient(0, 0, 0, H);   // un velo suave arriba y abajo para que se lean los textos
    sh.addColorStop(0, `rgba(0,0,0,${bgc.dim_top ?? .35})`); sh.addColorStop(.35, 'rgba(0,0,0,.08)'); sh.addColorStop(.7, 'rgba(0,0,0,.12)'); sh.addColorStop(1, `rgba(0,0,0,${bgc.dim_bottom ?? .4})`);
    x.fillStyle = sh; x.fillRect(0, 0, W, H);
    x.save(); x.globalAlpha = .9; x.fillStyle = TH.primary;
    x.beginPath(); x.moveTo(0, H - 40); x.lineTo(260, H - 40); x.lineTo(220, H); x.lineTo(0, H); x.fill(); x.restore();
    return;
  }
  const g = x.createRadialGradient(W / 2, H * .42, 40, W / 2, H * .5, H * .72);
  g.addColorStop(0, TH.bg1); g.addColorStop(1, TH.bg2);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (bgc.style === 'grid') {
    x.strokeStyle = 'rgba(255,255,255,0.045)'; x.lineWidth = 1;
    const off = (t * 18) % 60; x.beginPath();
    for (let i = -60; i < W + 60; i += 60) { x.moveTo(i + off, 0); x.lineTo(i + off, H); }
    for (let j = -60; j < H + 60; j += 60) { x.moveTo(0, j + off); x.lineTo(W, j + off); }
    x.stroke();
  } else {
    // piso: líneas que fugan al horizonte y travesaños que avanzan hacia la cámara
    const hz = H * .64;
    x.save();
    const hg = x.createRadialGradient(W / 2, hz, 10, W / 2, hz, W * .9);
    hg.addColorStop(0, rgba(TH.accent, .16)); hg.addColorStop(1, rgba(TH.accent, 0));
    x.translate(W / 2, hz); x.scale(1, .22); x.translate(-W / 2, -hz); x.fillStyle = hg; x.fillRect(-W, hz - W, W * 3, W * 2);
    x.restore();
    x.save(); x.lineWidth = 1.5;
    for (let i = -14; i <= 14; i++) {
      x.strokeStyle = `rgba(255,255,255,${.055 - Math.abs(i) * .0025})`;
      x.beginPath(); x.moveTo(W / 2 + i * 26, hz); x.lineTo(W / 2 + i * 300, H); x.stroke();
    }
    const N = 9, ph = (t * .35) % 1;
    for (let k = 0; k < N; k++) {
      const q = (k + ph) / N, y = hz + (H - hz) * q * q;
      x.strokeStyle = `rgba(255,255,255,${.06 * q})`; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke();
    }
    x.restore();
    // haces de luz desde arriba que se mecen
    x.save(); x.globalCompositeOperation = 'lighter';
    for (const [bx, ba, ph2] of [[W * .28, -.22, 0], [W * .74, .2, 2.1], [W * .5, 0, 4.2]]) {
      const ang = ba + .05 * Math.sin(t * .35 + ph2);
      x.save(); x.translate(bx, -60); x.rotate(ang);
      const lg = x.createLinearGradient(0, 0, 0, H * .8);
      lg.addColorStop(0, 'rgba(255,255,255,.05)'); lg.addColorStop(.6, 'rgba(255,255,255,.015)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = lg; x.beginPath(); x.moveTo(-50, 0); x.lineTo(50, 0); x.lineTo(320, H * .8); x.lineTo(-320, H * .8); x.closePath(); x.fill();
      x.restore();
    }
    // polvo y bokeh con paralaje
    for (const pt of PARTS) {
      const sp = 10 + 34 * pt.z, py = ((pt.y * H - t * sp) % H + H) % H, px = pt.x * W + 24 * Math.sin(t * .3 + pt.r * 6);
      const flick = .7 + .3 * Math.sin(t * 2 + pt.r * 20);
      if (pt.red || pt.r > .86) {
        const R = 16 + 38 * pt.r, col = pt.red ? TH.accent : '#ffffff';
        const bg = x.createRadialGradient(px, py, 0, px, py, R);
        bg.addColorStop(0, rgba(col, .16 * flick)); bg.addColorStop(.7, rgba(col, .07 * flick)); bg.addColorStop(1, rgba(col, 0));
        x.fillStyle = bg; x.fillRect(px - R, py - R, 2 * R, 2 * R);
      } else {
        x.fillStyle = `rgba(255,255,255,${.28 * pt.z * flick})`;
        x.beginPath(); x.arc(px, py, 1 + 2.6 * pt.z, 0, 7); x.fill();
      }
    }
    x.restore();
  }
  x.save(); x.globalAlpha = .9; x.fillStyle = TH.primary;
  x.beginPath(); x.moveTo(0, H - 40); x.lineTo(260, H - 40); x.lineTo(220, H); x.lineTo(0, H); x.fill();
  x.restore();
}

// cinta de sección "01 TÍTULO" arriba a la izquierda
function chip(t, t0, t1, num, label) {
  const pin = back(prog(t, t0, t0 + .55));
  const a = prog(t, t0, t0 + .25) * (1 - prog(t, t1, t1 + .25));
  if (a <= 0) return;
  x.save(); x.globalAlpha = a; x.translate(-420 * (1 - pin), 0);
  x.font = FONT(800, 46); const w = x.measureText(label).width;
  x.save(); x.transform(1, 0, -0.22, 1, 0, 0);
  x.fillStyle = TH.primary; x.fillRect(120, 160, 96, 96);
  x.fillStyle = TH.text; x.fillRect(222, 160, w + 70, 96);
  x.restore();
  x.fillStyle = TH.text; x.font = FONT(900, 52); x.textBaseline = 'middle'; x.textAlign = 'center';
  x.fillText(num, 128, 210);
  x.fillStyle = TH.ink; x.font = FONT(800, 46); x.textAlign = 'left';
  x.fillText(label, 210, 210);
  x.restore();
}

// etiqueta con punto, línea guía y caja (side -1 = caja a la izquierda)
function label(t, t0, px, py, lx, ly, text, side, size = 42) {
  if (MC.teasing) return;
  const p = prog(t, t0, t0 + .35); if (p <= 0) return;
  const pb = back(prog(t, t0 + .15, t0 + .55));
  x.save();
  x.fillStyle = TH.accent; x.beginPath(); x.arc(px, py, 11 * eout(p), 0, 7); x.fill();
  x.strokeStyle = rgba(TH.accent, .5); x.lineWidth = 3; x.globalAlpha = 1 - p;
  x.beginPath(); x.arc(px, py, 11 + 22 * p, 0, 7); x.stroke(); x.globalAlpha = 1;
  const ex = px + (lx - px) * eout(p), ey = py + (ly - py) * eout(p);
  x.strokeStyle = TH.text; x.lineWidth = 4; x.beginPath(); x.moveTo(px, py); x.lineTo(ex, ey); x.stroke();
  if (pb > 0) {
    x.font = FONT(800, size); const w = x.measureText(text).width + size;
    const hh = size * .86;
    const bx = clamp(side < 0 ? lx - w : lx, 24, W - 24 - w);
    x.save(); x.translate(bx + w / 2, ly); x.scale(pb, pb);
    x.fillStyle = TH.text; x.save(); x.transform(1, 0, -0.18, 1, 0, 0); x.fillRect(-w / 2, -hh, w, 2 * hh); x.restore();
    x.fillStyle = TH.primary; x.fillRect(-w / 2 - 4, hh - 6, w * .45, 7);
    x.fillStyle = TH.ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 0, 2);
    x.restore();
  }
  x.restore();
}

// insignia blanca con ícono en círculo de marca; p = escala animada (0..1+)
function badge(p, cx, y, txt, icon, size = 44) {
  if (p <= 0) return;
  x.save(); x.translate(cx, y); x.scale(p, p);
  x.font = FONT(900, size);
  const w = Math.min(x.measureText(txt).width + 140, W - 60);
  x.save(); x.transform(1, 0, -0.2, 1, 0, 0); x.fillStyle = TH.text; x.fillRect(-w / 2, -55, w, 110); x.restore();
  x.fillStyle = TH.primary; x.beginPath(); x.arc(-w / 2 + 62, 0, 34, 0, 7); x.fill();
  x.save(); x.translate(-w / 2 + 62, 0); drawIcon(icon || 'check', 1); x.restore();
  x.fillStyle = TH.ink; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(txt, -w / 2 + 112, 3, w - 130);
  x.restore();
}
function badgesAt(t, list, y0, step = 140) {
  if (MC.teasing) return;                    // en el gancho no se muestran textos de la escena
  const up = y0 > 1100 ? 110 : 0;           // las insignias bajas suben para dejar sitio a los subtítulos
  (list || []).forEach((b, i) => badge(back(prog(t, b.at, b.at + .5)), W / 2, (b.y || y0 - up + i * step), b.text, b.icon));
}

// palabra/frase grande con contorno y rebote de entrada
function bigWord(t, t0, txt, y, size, color, shake, xc) {
  const a = prog(t, t0, t0 + .12); if (a <= 0) return;
  const p = back(prog(t, t0, t0 + .4));
  x.save(); x.globalAlpha *= a;
  let sx = 0, sy = 0;
  if (shake) { const k = 1 - prog(t, t0, t0 + .6); sx = 14 * k * Math.sin(t * 70); sy = 10 * k * Math.cos(t * 55); }
  x.translate((has(xc) ? xc : W / 2) + sx, y + sy); x.scale(p, p);
  x.font = FONT(900, size); x.textAlign = 'center'; x.textBaseline = 'middle';
  const maxW = W - 80, w = x.measureText(txt).width;
  if (w > maxW) x.scale(maxW / w, maxW / w);
  x.lineWidth = 14; x.strokeStyle = '#000'; x.lineJoin = 'round'; x.strokeText(txt, 0, 0);
  x.fillStyle = color; x.fillText(txt, 0, 0);
  x.restore();
}
const colorOf = c => (c === 'accent' ? TH.accent : c === 'primary' ? TH.primary : c === 'oil' ? TH.oil : (c && c[0] === '#') ? c : TH.text);

// líneas de texto grandes apiladas (usado por title y outro)
function stackLines(t, lines, y0, gap = 24) {
  let y = y0;
  for (const ln of lines || []) {
    const size = ln.size || 104;
    y += size / 2;
    bigWord(t, ln.at, ln.text, y, size, colorOf(ln.color), ln.shake);
    y += size / 2 + gap;
  }
}

function drawLogo(cx, cy, size, alpha = 1) {
  x.save(); x.globalAlpha *= alpha;
  if (MC.logo) {
    x.drawImage(MC.logo, cx - size / 2, cy - size / 2, size, size);
  } else {
    const b = MC.spec.brand || {}, wm = b.wordmark || {};
    const k = size / 600;
    x.translate(cx, cy); x.scale(k, k);
    x.font = FONT(900, 130); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = TH.text; x.fillText(wm.line1 || b.name || '', 0, 0);
    x.font = FONT(800, 58); x.textAlign = 'right'; x.fillText((wm.line2a || '') + ' ', 20, 100);
    x.textAlign = 'left'; x.fillStyle = TH.accent; x.fillText(wm.line2b || '', 20, 100);
  }
  x.restore();
}

function bottomShade() {                     // sombra para leer los subtítulos: sin subtítulos no hace falta (y oscurecía la parte de abajo)
  const cap = MC.spec.captions; if (!cap || !cap.phrases || !cap.phrases.length) return;
  const g = x.createLinearGradient(0, H - 560, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.85)');
  x.fillStyle = g; x.fillRect(0, H - 560, W, 560);
}

// ---------- subtítulos (karaoke por palabra, estilo publicidad) ----------
function captions(t) {
  const cap = MC.spec.captions; if (!cap || !cap.phrases) return;
  const ph = cap.phrases.find(p => t >= p.start && t < p.end); if (!ph) return;
  const keys = new Set(cap.keywords || []);
  const size = cap.size || 64, y0 = cap.y || (H - 520), maxW = W - 160;   // termina antes de los ~480 px de abajo que tapa TikTok
  x.save(); x.font = FONT(800, size); x.textBaseline = 'middle';
  const space = x.measureText(' ').width;
  const rows = [[]]; let rw = 0;
  for (const w of ph.words) {
    const pad = keys.has(w.key) ? 22 : 0;              // aire para el recuadro de la palabra clave
    const ww = x.measureText(w.text).width;
    if (rw > 0 && rw + space + ww + 2 * pad > maxW) { rows.push([]); rw = 0; }
    rows[rows.length - 1].push({ ...w, ww, pad }); rw += (rw ? space : 0) + ww + 2 * pad;
  }
  const pop = .7 + .3 * back(prog(t, ph.start, ph.start + .22));
  const fade = prog(t, ph.start, ph.start + .06) * (1 - prog(t, ph.end - .08, ph.end));
  x.globalAlpha = fade;
  x.translate(W / 2, y0); x.scale(pop, pop);
  const lineH = size * 1.22, top = -(rows.length - 1) * lineH / 2;
  if (cap.box !== false) {                             // fondo oscuro suave: se lee sobre cualquier imagen
    const bw = Math.max(...rows.map(r => r.reduce((a, w) => a + w.ww + 2 * w.pad, 0) + space * (r.length - 1))) + 70;
    const bh = rows.length * lineH + 26;
    x.save(); x.globalAlpha = fade * .5; x.fillStyle = '#000'; rrect(-bw / 2, top - lineH / 2 - 13, bw, bh, 26); x.fill(); x.restore();
  }
  rows.forEach((row, ri) => {
    const total = row.reduce((s, w) => s + w.ww + 2 * w.pad, 0) + space * (row.length - 1);
    let cx = -total / 2; const cy = top + ri * lineH;
    for (const w of row) {
      cx += w.pad;
      const said = t >= w.start, cur = said && t < w.next, key = keys.has(w.key);
      const sp = cur ? 1 + .14 * (1 - prog(t, w.start, w.start + .18)) : 1;   // la palabra actual "salta"
      x.save(); x.translate(cx + w.ww / 2, cy); x.scale(sp, sp);
      if (key && said) {                                   // palabra clave: recuadro de la marca
        const k = back(prog(t, w.start, w.start + .2));
        x.save(); x.scale(k, 1); x.transform(1, 0, -.2, 1, 0, 0);
        x.fillStyle = TH.accent; x.fillRect(-w.ww / 2 - 16, -size * .62, w.ww + 32, size * 1.2); x.restore();
      }
      x.lineJoin = 'round'; x.lineWidth = 12; x.strokeStyle = 'rgba(0,0,0,.9)';
      x.textAlign = 'center';
      if (!(key && said)) x.strokeText(w.text, 0, 0);
      x.fillStyle = key && said ? '#fff' : cur ? TH.accent : TH.text; x.globalAlpha = fade * (said ? 1 : .62);
      x.fillText(w.text, 0, 0);
      x.restore();
      cx += w.ww + w.pad + space;
    }
  });
  x.restore();
}

// ---------- dirección: cámara 2D, énfasis, transiciones, postproducción ----------
const SCENES3D = new Set(['chain_drive', 'sprocket_wear', 'diorama', 'kit', 'studio', 'iso']);
function flash(t, at, color, d = .14) {
  const f = 1 - Math.abs(t - at) / d;
  if (f > 0) { x.fillStyle = rgba(color, .65 * f); x.fillRect(0, 0, W, H); }
}
function snapshot() {
  if (!MC.tmp) { MC.tmp = document.createElement('canvas'); MC.tx = MC.tmp.getContext('2d', { willReadFrequently: !MC.has3d }); }
  if (MC.tmp.width !== W || MC.tmp.height !== H) { MC.tmp.width = W; MC.tmp.height = H; }
  MC.tx.setTransform(1, 0, 0, 1, 0, 0); MC.tx.clearRect(0, 0, W, H); MC.tx.drawImage(MC.canvas, 0, 0);
  return MC.tmp;
}
// golpe de énfasis: sube en 0.06 s y cae en ~0.3 s
function punch(t) {
  let k = 0;
  for (const e of MC.spec.emphasis || []) { const d = t - e; if (d >= 0 && d < .5) k = Math.max(k, Math.min(1, d / .06) * Math.exp(-Math.max(0, d - .06) / .12)); }
  return k;
}
// cámara virtual de cada escena (2D): acercar, alejar, desplazar o girar suave
function sceneCamera(t, sc, idx) {
  const p = sc.params || {}, mode = p.camera2d || (SCENES3D.has(sc.type) || p.moves ? 'none' : (idx % 2 ? 'pull' : 'push'));
  const u = eio(prog(t, sc.start, sc.end));
  let z = 1, px = 0, py = 0, r = 0;
  if (mode === 'push') { z = 1 + .07 * u; py = -18 * u; }
  else if (mode === 'pull') { z = 1.09 - .08 * u; }
  else if (mode === 'drift') { z = 1.04; px = 30 * (u - .5); }
  else if (mode === 'orbit') { z = 1.05; r = .02 * (u - .5); px = 20 * Math.sin(u * Math.PI); }
  if (mode !== 'none') { r += .004 * Math.sin(t * .8 + idx); px += 6 * Math.sin(t * .6); py += 5 * Math.sin(t * .7 + 1); }
  const k = punch(t);
  z *= 1 + .065 * k; r += .012 * k * (Math.floor(t * 3) % 2 ? 1 : -1);
  return { z, px, py, r };
}
function applyCamera(c) {
  x.translate(W / 2 + c.px, H / 2 + c.py); x.rotate(c.r); x.scale(c.z, c.z); x.translate(-W / 2, -H / 2);
}
// transiciones de comercial: k va de -1 (antes del corte) a 1 (después)
const TRANS = {
  whip(k, dir = 1) {
    const a = 1 - Math.abs(k); if (a <= 0) return;
    const img = snapshot(), off = (k < 0 ? -1 : 1) * dir * a * a * 260;
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = TH.bg2; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) { x.globalAlpha = 1 / (i + 1); x.drawImage(img, off + (i - 5.5) * a * 18, 0); }
    x.restore();
  },
  zoom(k) {
    const a = 1 - Math.abs(k); if (a <= 0) return;
    const img = snapshot(), base = k < 0 ? 1 + .45 * a * a : 1 + .3 * a * a;
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = TH.bg2; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const sc = base * (1 + i * .035 * a); x.globalAlpha = 1 / (i + 1);
      x.drawImage(img, W / 2 - W * sc / 2, H / 2 - H * sc / 2, W * sc, H * sc);
    }
    x.restore();
    if (Math.abs(k) < .25) { x.fillStyle = `rgba(255,255,255,${.5 * (1 - Math.abs(k) / .25)})`; x.fillRect(0, 0, W, H); }
  },
  glitch(k, seed = 1) {
    const a = 1 - Math.abs(k); if (a <= 0) return;
    const img = snapshot(), fr = Math.floor((k + 1) * 30);
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 14; i++) {
      const y = hash(i * 13.1 + fr * 3.7 + seed) * H, h = 20 + hash(i * 7.3 + fr) * 140, dx = (hash(i * 3.3 + fr * 1.7) - .5) * 260 * a;
      x.drawImage(img, 0, y, W, h, dx, y, W, h);
    }
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = .35 * a;
    x.drawImage(img, 14 * a, 0); x.fillStyle = rgba(TH.accent, .25 * a); x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = .5 * a; x.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) x.fillRect(0, hash(i * 5.1 + fr) * H, W, 2 + hash(i + fr) * 5);
    x.restore();
  },
  bars(k) {                                   // barras inclinadas de la marca que cruzan la pantalla
    const p = (k + 1) / 2; if (p <= 0 || p >= 1) return;
    const cx = -1700 + 4300 * eio(p);
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.transform(1, 0, -.35, 1, 0, 0);
    const cols = [TH.primary, TH.text, TH.ink, TH.accent];
    const wds = [380, 140, 900, 220];
    let xx = cx;
    for (let i = 0; i < 4; i++) { x.fillStyle = cols[i]; x.fillRect(xx + 700, -50, wds[i], H + 100); xx += wds[i]; }
    x.restore();
  },
};
const TRANS_HALF = { whip: .2, zoom: .22, glitch: .18, bars: .32 };
function transitions(t, S) {
  S.scenes.forEach((s, i) => {
    if (i === 0) return;
    const tr = s.transition, T0 = s.start;
    if (tr === 'flash') flash(t, T0, '#FFFFFF');
    else if (tr === 'red') flash(t, T0, TH.accent);
    else if (TRANS[tr]) { const hd = TRANS_HALF[tr], k = (t - T0) / hd; if (Math.abs(k) < 1) TRANS[tr](k, i % 2 ? 1 : -1); }
  });
  for (const s of S.scenes) for (const c of s._cuts || []) { const k = (t - c) / .16; if (Math.abs(k) < 1) TRANS.whip(k, 1); }
}
let GRAIN = null;
let VIGN = null;
function postFX(t) {
  if (!VIGN || VIGN.width !== W || VIGN.height !== H) {      // viñeta pintada una vez y copiada en cada cuadro
    VIGN = document.createElement('canvas'); VIGN.width = W; VIGN.height = H; const v = VIGN.getContext('2d');
    const vg = v.createRadialGradient(W / 2, H * .48, H * .3, W / 2, H * .5, H * .8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
    v.fillStyle = vg; v.fillRect(0, 0, W, H);
  }
  if (MC.spec.vignette !== false) x.drawImage(VIGN, 0, 0);     // estilo claro (maqueta): sin bordes oscuros
  if (MC.spec.grain === false) return;
  if (!GRAIN) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), id = g.createImageData(256, 256);
    // grano ya "mezclado": puntos claros u oscuros con poca opacidad. Se pinta con mezcla normal, que cuesta
    // una fracción del modo 'overlay' sobre todo el cuadro (en CPU/SwiftShader eran ~180 ms por cuadro)
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 2 - 1; id.data[i] = id.data[i + 1] = id.data[i + 2] = v > 0 ? 255 : 0; id.data[i + 3] = Math.abs(v) * 255 * .09; }
    g.putImageData(id, 0, 0); GRAIN = x.createPattern(c, 'repeat');
  }
  const f = Math.floor(t * 30);
  x.save();
  x.translate(-(hash(f) * 256 | 0), -(hash(f + 7) * 256 | 0)); x.fillStyle = GRAIN; x.fillRect(0, 0, W + 256, H + 256);
  x.restore();
}
function progressBar(t, total) {
  if (MC.spec.progress === false) return;
  x.save(); x.fillStyle = MC.spec.vignette === false ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.14)'; x.fillRect(0, 0, W, 9);
  x.fillStyle = TH.accent; x.fillRect(0, 0, W * clamp(t / total), 9);
  x.fillStyle = '#fff'; x.fillRect(W * clamp(t / total) - 4, 0, 4, 9);
  x.restore();
}
// cuentakilómetros que acompaña todo el video (intriga: el número sube y el color pasa de verde a rojo)
function odometer(t) {
  const o = MC.spec.odometer; if (!o || MC.teasing || !o.keys || !o.keys.length) return;
  const a0 = has(o.show_at) ? o.show_at : o.keys[0].at, a1 = has(o.until) ? o.until : 1e9;
  if (t < a0 || t > a1 + .3) return;
  const k = back(prog(t, a0, a0 + .4)) * (1 - prog(t, a1, a1 + .3));
  let v = o.keys[0].value, prev = 0;
  for (let i = 0; i < o.keys.length; i++) {
    const q = o.keys[i], d = q.dur || .9;
    if (t >= q.at) { const u = eout(prog(t, q.at, q.at + d)); v = prev + (q.value - prev) * u; }
    prev = t >= q.at ? q.value : prev;
    if (t < q.at) break;
  }
  const warn = o.warn ?? 5000, danger = o.danger ?? 10000;
  const col = v >= danger ? TH.accent : v >= warn ? '#F5B427' : '#2fbf5f';
  const shake = v >= danger ? 4 * Math.sin(t * 40) * prog(t, 0, 1) : 0;
  const txt = Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ' + (o.unit || 'km');
  x.save(); x.translate(W / 2 + shake, o.y || 200); x.scale(k, k);
  x.font = FONT(900, 74, false); const w = Math.max(430, x.measureText(txt).width + 90);
  x.fillStyle = 'rgba(8,8,10,.82)'; rrect(-w / 2, -62, w, 124, 26); x.fill();
  x.strokeStyle = col; x.lineWidth = 6; x.stroke();
  x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 0, 6);
  if (o.label) { x.font = FONT(800, 30); x.fillStyle = '#fff'; x.fillText(o.label, 0, -92); }
  x.restore();
}

function watermark(t, sc) {
  const S = MC.spec;
  if (S.watermark === false || (sc.params && sc.params.hide_watermark && t >= (sc.params.card_at || sc.start))) return;
  if (MC.logo) drawLogo(W - 112, 300, 150, .95);
  else {
    const b = S.brand || {}, wm = b.wordmark || {};
    x.save(); x.globalAlpha = .9; x.font = FONT(900, 34); x.textAlign = 'right'; x.textBaseline = 'middle';
    x.fillStyle = TH.text; x.fillText(wm.line1 || b.name || '', W - 50, 290);
    x.fillStyle = TH.accent; x.font = FONT(800, 22); x.fillText(((wm.line2a || '') + ' ' + (wm.line2b || '')).trim(), W - 50, 322);
    x.restore();
  }
}

// ---------- ciclo principal ----------
// tOut = segundo del video final. Si hay "teaser" (gancho de apertura), los primeros segundos
// muestran un momento posterior del video y luego todo corre desplazado.
MC.draw = function (tOut) {
  const S = MC.spec, TZ = S.teaser ? S.teaser.dur : 0, total = S.duration + TZ;
  const teasing = S.teaser && tOut < TZ;
  const t = teasing ? S.teaser.src + tOut : tOut - TZ;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
  const idx = Math.max(0, S.scenes.findIndex(s => t >= s.start && t < s.end));
  const sc = S.scenes.find(s => t >= s.start && t < s.end) || S.scenes[S.scenes.length - 1];
  // las escenas que pintan su propio fondo completo (MC.OPAQUE) no necesitan el fondo animado de la marca debajo:
  // dibujarlo y taparlo costaba ~100 ms por cuadro
  if (!(MC.OPAQUE && MC.OPAQUE.has(sc.type)) || S.scenes.length > 1) background(t);
  const impl = MC.scenes[sc.type];
  if (!impl) throw new Error('Escena desconocida: ' + sc.type);
  MC.teasing = teasing;
  x.save(); applyCamera(sceneCamera(t, sc, idx)); impl(t, sc, sc.params || {}); x.restore();
  MC.teasing = false;
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
  if (!teasing) {
    transitions(t, S);
    for (const s of S.scenes) if (s.chip) chip(t, s.start + .15, s.end - .1, s.chip.num, s.chip.text);
    bottomShade();
    captions(t);
  } else {
    bottomShade();
    if (S.teaser.text) bigWord(tOut, .12, S.teaser.text, H - 470, S.teaser.size || 96, TH.text, true);
    x.save(); x.font = FONT(900, 38); x.fillStyle = rgba(TH.accent, .5 + .5 * Math.sin(tOut * 12)); x.textAlign = 'left';
    x.fillText('● REC', 70, 330); x.restore();
  }
  if (S.teaser) {                              // rebobinado: glitch al volver al inicio
    const k = (tOut - TZ) / .28; if (Math.abs(k) < 1) TRANS.glitch(k, 3);
  }
  odometer(t);
  watermark(t, sc);
  postFX(tOut);
  progressBar(tOut, total);
  const fc = S.fade || '0,0,0';                // color del fundido de entrada/salida (crema en el estilo claro)
  if (tOut < .15 && S.fade_in !== false) { x.fillStyle = `rgba(${fc},${1 - tOut / .15})`; x.fillRect(0, 0, W, H); }   // sin fundido si el gancho golpea en el cuadro 0
  if (tOut > total - .4) { x.fillStyle = `rgba(${fc},${prog(tOut, total - .4, total)})`; x.fillRect(0, 0, W, H); }
};

MC.frame = function (t, type = 'jpeg', quality = 0.93) {
  MC.fi = Math.round(t * ((MC.spec && MC.spec.fps) || 30));      // número de cuadro (las sombras 3D se rehacen cada 2)
  MC.draw(t);
  return MC.canvas.toDataURL('image/' + type, quality);
};

MC.init = async function (spec) {
  MC.spec = spec; MC.cache = {};
  W = spec.width || 1080; H = spec.height || 1920;
  const c = document.getElementById('c'); c.width = W; c.height = H;
  // Sin 3D, el lienzo 2D por CPU es ~4x más rápido; con 3D conviene el de GPU (evita leer WebGL cada cuadro).
  const has3d = MC.has3d = spec.scenes.some(s => SCENES3D.has(s.type));
  MC.canvas = c; x = c.getContext('2d', { willReadFrequently: window.__CPU2D ?? !has3d });
  if (spec.brand && spec.brand.colors) TH = Object.assign({}, TH, spec.brand.colors);
  const r3 = spec.render3d || {};
  window.__AA = r3.antialias !== false; window.__SCALE = r3.scale || .8;   // 0.8: se ve igual (FXAA) y es ~20% más rápido   // calidad de las escenas 3D
  window.__NOGLOW = r3.glow === false; window.__NOSHADOW = r3.shadows === false;
  await Promise.all(['700', '800', '900'].flatMap(w => [document.fonts.load(`italic ${w} 40px Montserrat`), document.fonts.load(`${w} 40px Montserrat`)]));
  await Promise.all([document.fonts.load('400 40px "DM Serif Display"'), document.fonts.load('800 40px "JetBrains Mono"')]).catch(() => null);
  MC.logo = null;
  if (spec.brand && spec.brand.logo_url) MC.logo = await loadImage(spec.brand.logo_url).catch(() => null);
  MC.bgImage = spec.background && spec.background.image_url ? await loadImage(spec.background.image_url).catch(() => null) : null;
  MC.images = {};
  for (const s of spec.scenes) if (s.params && s.params.image_url) MC.images[s.params.image_url] = await loadImage(s.params.image_url).catch(() => null);
  for (const s of spec.scenes) for (const it of (s.params && s.params.items) || []) if (it.image_url) MC.images[it.image_url] = await loadImage(it.image_url).catch(() => null);
  if (MC.preload3d) await MC.preload3d(spec);                      // modelos 3D descargados (GLB, FBX, OBJ, STL)
  return { ok: true, logo: !!MC.logo, scenes: spec.scenes.length };
};
function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
