// Piezas mecánicas reutilizables: motor monocilíndrico en corte (cinemática
// real biela-manivela), superficies metálicas en macro y termómetro.
'use strict';

const ENG = { CX: 540, CY: 1170, R: 105, L: 320, BORE_L: 392, BORE_R: 688, CYL_TOP: 600, CYL_BOT: 1010, WALL: 34 };
function pistonY(th) { const { CY, R, L } = ENG; return CY - (R * Math.cos(th) + Math.sqrt(L * L - R * R * Math.sin(th) ** 2)); }

// Tabla de ángulo integrada a partir de una función de velocidad (vueltas/seg).
function angleTable(key, t0, t1, speedFn) {
  if (MC.cache[key]) return MC.cache[key];
  const RATE = 240, n = Math.ceil((t1 - t0) * RATE) + 4, A = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) A[i] = A[i - 1] + speedFn(t0 + i / RATE) / RATE * 2 * Math.PI;
  const f = t => { const u = clamp((t - t0) * RATE, 0, n - 1), i = Math.floor(u); return A[i] + (A[i + 1] - A[i]) * (u - i); };
  return (MC.cache[key] = f);
}

function oilSplashes(t, t0, angleFn, alpha) {
  if (alpha <= 0) return;
  const { CX, CY, R } = ENG;
  x.save();
  for (let k = 0; k < 160; k++) {
    const e = t0 + 1.0 + k * 0.045; if (e > t) break;
    const age = t - e; if (age > 0.9) continue;
    const th = angleFn(e), sp = 380 + 260 * ((k * 37) % 11) / 11;
    const vx = Math.cos(th) * sp * (k % 2 ? 1 : -1) * .6, vy = -Math.abs(Math.sin(th)) * sp - 120;
    const px = CX + R * Math.sin(th) + vx * age, py = CY - R * Math.cos(th) + vy * age + 900 * age * age;
    if (py > CY + 235 || Math.hypot(px - CX, py - CY) > 245) continue;
    x.fillStyle = TH.oil; x.globalAlpha = alpha * (1 - age / .9);
    x.beginPath(); x.ellipse(px, py, 7, 10, Math.atan2(vy, vx), 0, 7); x.fill();
  }
  x.restore();
}

// Dibuja el motor completo. th = ángulo del cigüeñal; spd = vueltas/seg (para estela).
function engineDrawing(t, th, spd, solid, opts = {}) {
  const { CX, CY, R, BORE_L, BORE_R, CYL_TOP, CYL_BOT, WALL } = ENG;
  const py = pistonY(th), pinX = CX + R * Math.sin(th), pinY = CY - R * Math.cos(th);
  const sol = Math.max(solid, .001);
  x.save(); x.lineWidth = 6;
  // cárter
  x.beginPath(); x.arc(CX, CY, 250, -Math.PI * .5 + 1.0, Math.PI * 1.5 - 1.0); x.lineTo(BORE_L - WALL, CYL_BOT); x.lineTo(BORE_R + WALL, CYL_BOT); x.closePath();
  if (solid > 0) { x.globalAlpha = solid; x.fillStyle = '#121316'; x.fill(); x.globalAlpha = 1; }
  x.strokeStyle = 'rgba(255,255,255,.85)'; x.stroke();
  // aceite del cárter (opts.oilLevel 0..1, por defecto lleno)
  const oilLevel = has(opts.oilLevel) ? opts.oilLevel : 1;
  if (solid > 0 && oilLevel > 0) {
    x.save(); x.beginPath(); x.arc(CX, CY, 244, 0, 7); x.clip();
    const lvl = CY + 235 - 60 * oilLevel; x.beginPath(); x.moveTo(CX - 260, H);
    for (let i = 0; i <= 52; i++) { const xx = CX - 260 + i * 10; x.lineTo(xx, lvl + 8 * Math.sin(i * .5 + t * 6) * Math.min(1, spd)); }
    x.lineTo(CX + 260, H); x.closePath();
    const og = x.createLinearGradient(0, lvl, 0, lvl + 80); og.addColorStop(0, '#F9C847'); og.addColorStop(1, TH.oilDark);
    x.globalAlpha = solid; x.fillStyle = og; x.fill(); x.restore();
  }
  // cigüeñal con estela
  const ghosts = spd > 1.5 ? 4 : 1;
  for (let gI = ghosts - 1; gI >= 0; gI--) {
    const a = th - gI * spd * 0.012;
    x.save(); x.translate(CX, CY); x.rotate(a); x.globalAlpha = (gI ? 0.18 : 1) * sol;
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 178, Math.PI / 2 - 1.05, Math.PI / 2 + 1.05); x.closePath();
    x.fillStyle = metal(-178, 178, .25); x.fill();
    rrect(-62, -R - 58, 124, R + 100, 58); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 3; x.stroke();
    x.restore();
  }
  x.fillStyle = '#2A2C31'; x.beginPath(); x.arc(CX, CY, 46, 0, 7); x.fill();
  x.strokeStyle = TH.primary; x.lineWidth = 6; x.stroke();
  // biela
  const ang = Math.atan2(pinY - py, pinX - CX), len = Math.hypot(pinX - CX, pinY - py);
  x.save(); x.translate(CX, py); x.rotate(ang);
  x.beginPath(); x.moveTo(0, -26); x.lineTo(len, -40); x.lineTo(len, 40); x.lineTo(0, 26); x.closePath();
  const rg = x.createLinearGradient(0, -40, 0, 40); rg.addColorStop(0, '#5A6068'); rg.addColorStop(.4, '#D9DEE3'); rg.addColorStop(1, '#3B4047');
  x.fillStyle = rg; x.globalAlpha = sol; x.fill(); x.globalAlpha = 1;
  x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 3; x.stroke();
  x.restore();
  x.fillStyle = '#C9CED4'; x.beginPath(); x.arc(pinX, pinY, 50, 0, 7); x.fill();
  x.fillStyle = '#2A2C31'; x.beginPath(); x.arc(pinX, pinY, 22, 0, 7); x.fill();
  // camisa
  x.fillStyle = '#0E0F12'; x.globalAlpha = solid * .9; x.fillRect(BORE_L, CYL_TOP, BORE_R - BORE_L, CYL_BOT - CYL_TOP); x.globalAlpha = 1;
  // pistón
  const top = py - 78;
  rrect(BORE_L + 5, top, BORE_R - BORE_L - 10, 175, 14);
  x.fillStyle = metal(BORE_L, BORE_R); x.globalAlpha = sol; x.fill(); x.globalAlpha = 1;
  x.strokeStyle = '#fff'; x.lineWidth = 4; x.stroke();
  x.fillStyle = 'rgba(0,0,0,.55)';
  for (let i = 0; i < 3; i++) x.fillRect(BORE_L + 5, top + 18 + i * 17, BORE_R - BORE_L - 10, 6);
  if (opts.heat > 0) {
    x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = opts.heat * (.7 + .3 * Math.sin(t * 9));
    x.fillStyle = 'rgba(255,60,0,.7)'; rrect(BORE_L + 5, top, BORE_R - BORE_L - 10, 175, 14); x.fill(); x.restore();
  }
  x.fillStyle = '#2A2C31'; x.beginPath(); x.arc(CX, py, 26, 0, 7); x.fill();
  // película de aceite en las paredes
  if (solid > 0 && oilLevel > 0) {
    x.save(); x.globalAlpha = solid * oilLevel;
    for (const wx of [BORE_L - 2, BORE_R + 2]) {
      const g = x.createLinearGradient(0, CYL_TOP, 0, CYL_BOT), s = (t * 1.3) % 1;
      g.addColorStop(0, '#9C6206'); g.addColorStop(clamp(s - .1), '#C88A10'); g.addColorStop(s, TH.oilLight); g.addColorStop(clamp(s + .1), '#C88A10'); g.addColorStop(1, '#9C6206');
      x.fillStyle = g; x.fillRect(wx - 5, CYL_TOP, 10, CYL_BOT - CYL_TOP);
    }
    x.restore();
  }
  // paredes y aletas
  for (const [a0, a1, dir] of [[BORE_L - WALL - 5, BORE_L - 5, -1], [BORE_R + 5, BORE_R + WALL + 5, 1]]) {
    x.fillStyle = metal(a0, a1, .35); x.globalAlpha = sol; x.fillRect(a0, CYL_TOP, a1 - a0, CYL_BOT - CYL_TOP); x.globalAlpha = 1;
    x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(a0, CYL_TOP, a1 - a0, CYL_BOT - CYL_TOP);
    for (let fy = CYL_TOP + 20; fy < CYL_BOT - 20; fy += 38) {
      const fx = dir < 0 ? a0 - 70 : a1;
      x.fillStyle = '#2B2E33'; x.globalAlpha = sol; x.fillRect(fx, fy, 70, 16); x.globalAlpha = 1;
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.strokeRect(fx, fy, 70, 16);
    }
  }
  // culata y bujía
  rrect(BORE_L - WALL - 25, CYL_TOP - 90, (BORE_R - BORE_L) + 2 * WALL + 50, 92, 18);
  x.fillStyle = metal(BORE_L - WALL - 25, BORE_R + WALL + 25, .35); x.globalAlpha = sol; x.fill(); x.globalAlpha = 1;
  x.strokeStyle = '#fff'; x.lineWidth = 4; x.stroke();
  x.fillStyle = '#E8E8E8'; x.fillRect(CX - 18, CYL_TOP - 150, 36, 62); x.fillStyle = TH.primary; x.fillRect(CX - 24, CYL_TOP - 115, 48, 14);
  if (opts.spark > 0) {
    x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(CX, CYL_TOP - 4, 2, CX, CYL_TOP - 4, 90);
    g.addColorStop(0, `rgba(255,255,220,${opts.spark})`); g.addColorStop(1, 'rgba(255,160,40,0)'); x.fillStyle = g; x.fillRect(CX - 90, CYL_TOP - 94, 180, 180); x.restore();
  }
  x.restore();
  return { py, pinX, pinY };
}

// ---- superficies en macro (pistón a la izquierda, cilindro a la derecha) ----
const NOISE = []; for (let i = 0; i < 400; i++) NOISE.push(Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1));
function rough(y, seed) { const s = (y / 18) + seed, i = Math.floor(s), f = s - i; const a = NOISE[((i % 400) + 400) % 400], b = NOISE[(((i + 1) % 400) + 400) % 400]; return a + (b - a) * f; }
function pistonSurface(GL, disp) {
  x.save(); x.beginPath(); x.moveTo(0, 0);
  for (let y = 0; y <= H; y += 6) x.lineTo(GL - 22 * rough(y - disp, 3), y);
  x.lineTo(0, H); x.closePath();
  x.fillStyle = metal(GL - 330, GL); x.fill(); x.clip();
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const xx = GL - 330 + 12 * i + 6; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, H); x.stroke(); }
  x.fillStyle = 'rgba(0,0,0,.6)';
  for (let i = 0; i < 3; i++) { const ry = ((700 + i * 60 + disp) % H + H) % H; x.fillRect(0, ry, GL, 18); }
  x.restore();
}
function cylinderSurface(GR) {
  x.save(); x.beginPath(); x.moveTo(W, 0);
  for (let y = 0; y <= H; y += 6) x.lineTo(GR + 22 * rough(y, 11), y);
  x.lineTo(W, H); x.closePath();
  x.fillStyle = metal(GR, GR + 330, .25); x.fill(); x.restore();
}
function sideLabels(a, left, right) {
  if (a <= 0) return;
  x.save(); x.globalAlpha = a; x.font = FONT(900, 44); x.textBaseline = 'middle'; x.textAlign = 'center';
  x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 8;
  if (left) { x.strokeText(left, 165, 440); x.fillText(left, 165, 440); }
  if (right) { x.strokeText(right, 915, 440); x.fillText(right, 915, 440); }
  x.restore();
}
function moveArrow(cxp, vel, t) {
  x.save(); x.globalAlpha = .9; x.fillStyle = '#fff';
  const ay = 960 + (vel > 0 ? 1 : -1) * 20 * Math.sin(t * 12);
  x.translate(cxp, ay); x.scale(1, vel > 0 ? 1 : -1);
  x.beginPath(); x.moveTo(-40, -40); x.lineTo(40, -40); x.lineTo(0, 30); x.closePath(); x.fill();
  x.restore();
}
function bracketLabel(p, cx, cy, text, halfW = 200) {
  if (p <= 0) return;
  x.save(); x.translate(cx, cy); x.scale(p, p);
  x.strokeStyle = '#fff'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(-halfW, 60); x.lineTo(-halfW, 30); x.lineTo(halfW, 30); x.lineTo(halfW, 60); x.stroke();
  x.font = FONT(900, 50); x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = x.measureText(text).width + 50;
  x.save(); x.transform(1, 0, -0.2, 1, 0, 0); x.fillStyle = TH.primary; x.fillRect(-w / 2, -70, w, 80); x.restore();
  x.fillStyle = '#fff'; x.fillText(text, 0, -28);
  x.restore();
}

function thermometer(cx, top, bot, level, t, a, label = 'TEMP') {
  if (a <= 0) return;
  x.save(); x.globalAlpha = a;
  const hot = level > .75 ? (Math.sin(t * 20) > 0 ? 1 : 0) : 0;
  x.translate(hot ? 5 * Math.sin(t * 60) : 0, 0);
  rrect(cx - 36, top, 72, bot - top, 36); x.fillStyle = 'rgba(0,0,0,.6)'; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 6; x.stroke();
  x.beginPath(); x.arc(cx, bot + 40, 64, 0, 7); x.fillStyle = 'rgba(0,0,0,.6)'; x.fill(); x.stroke();
  const fy = bot - (bot - top - 30) * level;
  const g = Math.round(255 - 235 * clamp(level * 1.2)), b = Math.round(255 - 240 * clamp(level * 1.2));
  x.fillStyle = `rgb(255,${g},${b})`;
  rrect(cx - 18, fy, 36, bot - fy + 30, 18); x.fill();
  x.beginPath(); x.arc(cx, bot + 40, 46, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 4;
  for (let i = 0; i <= 8; i++) { const ty = bot - (bot - top - 30) * i / 8; x.beginPath(); x.moveTo(cx - 70, ty); x.lineTo(cx - 48, ty); x.stroke(); }
  x.font = FONT(900, 40); x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(label, cx, top - 30);
  if (hot) { x.fillStyle = TH.accent; x.font = FONT(900, 70); x.fillText('!', cx - 110, top + 60); }
  x.restore();
}

function stamp(t, at, text, cx = 540, cy = 980) {
  if (t < at) return;
  const p = back(prog(t, at, at + .35)), s = 2.2 - 1.2 * p;
  x.save(); x.translate(cx, cy); x.rotate(-0.12); x.scale(s, s); x.globalAlpha = prog(t, at, at + .08);
  x.font = FONT(900, 96); x.textAlign = 'center'; x.textBaseline = 'middle';
  let w = x.measureText(text).width; const k = Math.min(1, 880 / w); x.scale(k, k);
  x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(-w / 2 - 40, -95, w + 80, 190);
  x.strokeStyle = TH.accent; x.lineWidth = 14; x.strokeRect(-w / 2 - 40, -95, w + 80, 190);
  x.fillStyle = TH.accent; x.fillText(text, 0, 4);
  x.restore();
}

