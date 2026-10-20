// Catálogo de escenas. Cada escena recibe (t, scene, p):
//   t      segundo global del video
//   scene  {type, start, end, chip, transition, params}
//   p      parámetros ya resueltos (todo campo "at"/"*_at" llega en segundos globales)
// Documentación de parámetros: references/scene-catalog.md
'use strict';

// ---------------------------------------------------------------- title
// Gancho / tarjeta de título: ícono grande + líneas de texto que entran al ritmo de la voz.
MC.scenes.title = function (t, s, p) {
  const out = p.exit === 'none' ? 0 : eio(prog(t, s.end - .22, s.end + .05));
  x.save(); x.globalAlpha = 1 - out;
  x.translate(W / 2, H / 2); x.scale(1 + .5 * out, 1 + .5 * out); x.translate(-W / 2, -H / 2);
  if (p.slashes !== false) {
    for (let i = 0; i < 3; i++) {
      const k = eout(prog(t, s.start + .05 + i * .08, s.start + .45 + i * .08));
      x.save(); x.transform(1, 0, -0.35, 1, 0, 0); x.fillStyle = i === 1 ? TH.text : TH.primary;
      x.fillRect(-100 + 900 * k + i * 60, 340, 34, 150); x.restore();
    }
  }
  const iy = p.icon_y || 760;
  const alert = has(p.alert_at) && t > p.alert_at ? (Math.sin(t * 14) > 0 ? 1 : .25) : 0;
  if (alert) {
    const g = x.createRadialGradient(W / 2, iy, 40, W / 2, iy, 420);
    g.addColorStop(0, rgba(TH.accent, .45 * alert)); g.addColorStop(1, rgba(TH.accent, 0));
    x.fillStyle = g; x.fillRect(0, iy - 460, W, 920);
  }
  const pc = back(prog(t, s.start + .2, s.start + .7));
  x.save(); x.translate(W / 2, iy); x.scale(pc, pc);
  heroIcon(p.icon || 'none', 0, 0, p.icon_scale || 1, alert);
  if (p.drip && p.icon === 'oil_can' && !(has(p.alert_at) && t > p.alert_at)) {
    const d = (t * 1.3) % 1; oilDrop(275, 60 + 160 * d, 1.4, 1 - d);
  }
  x.restore();
  stackLines(t, p.lines, p.lines_y || 1060);
  x.restore();
};

// ---------------------------------------------------------------- engine_cutaway
// Motor en corte con pistón/biela/cigüeñal moviéndose de verdad.
MC.scenes.engine_cutaway = function (t, s, p) {
  const t0 = s.start, rpmAt = p.rpm ? p.rpm.at : null;
  const idle = p.idle_speed || .7, top = p.top_speed || 4.3;
  const speed = u => {
    if (u < t0 + .7) return 0;
    if (u < t0 + 1.1) return idle * prog(u, t0 + .7, t0 + 1.1);
    if (!has(rpmAt) || u < rpmAt) return idle;
    return idle + (top - idle) * eio(prog(u, rpmAt, rpmAt + 1.8));
  };
  const ang = angleTable('eng' + t0, t0, s.end + 1, speed);
  const S = 1.1, OX = 540, OY = 935, DY = 60;
  const zp = p.exit_zoom ? eio(prog(t, s.end - .6, s.end)) : 0;
  x.save();
  const gx = ENG.BORE_R, gy = 800, Z = 1 + 9 * zp;
  x.translate(OX, OY + DY); x.scale(S, S); x.translate(-OX, -OY);
  x.translate(gx, gy); x.scale(Z, Z); x.translate(-gx, -gy);
  const lt = t - t0, scan = 380 + 1150 * eio(prog(lt, 0, 1.1)), solid = prog(lt, .6, 1.2);
  x.save(); x.beginPath(); x.rect(0, 0, W, scan); x.clip();
  const e = engineDrawing(t, ang(t), speed(t), solid, { oilLevel: has(p.oil_level) ? p.oil_level : 1, spark: p.spark ? Math.max(0, Math.cos(ang(t)) - .95) * 20 : 0 });
  if (p.splash !== false) oilSplashes(t, t0, ang, solid);
  x.restore(); x.restore();
  if (lt < 1.25) {
    const sy = OY + DY + (scan - OY) * S;
    x.save(); x.globalAlpha = 1 - prog(lt, 1.0, 1.25);
    const g = x.createLinearGradient(0, sy - 60, 0, sy); g.addColorStop(0, rgba(TH.accent, 0)); g.addColorStop(1, rgba(TH.accent, .55));
    x.fillStyle = g; x.fillRect(0, sy - 60, W, 60); x.fillStyle = TH.accent; x.fillRect(0, sy - 3, W, 5); x.restore();
  }
  if (zp < .05) {
    const P = (px, py) => [OX + (px - OX) * S, OY + DY + (py - OY) * S];
    const spots = {
      piston: () => [...P(ENG.BORE_L + 40, e.py + 10), 230, null, -1],
      crank: () => [...P(ENG.CX + 60, ENG.CY + 60), 790, 1330, 1],
      rod: () => [...P((ENG.CX + e.pinX) / 2 + 20, (e.py + e.pinY) / 2), 800, 1060, 1],
      plug: () => [...P(ENG.CX + 18, ENG.CYL_TOP - 130), 800, 400, 1],
      oil: () => [...P(ENG.CX - 120, ENG.CY + 200), 230, 1480, -1],
      cylinder: () => [...P(ENG.BORE_R + 20, 760), 800, 560, 1],
    };
    for (const lb of p.labels || []) {
      const f = spots[lb.part]; if (!f) continue;
      const [px, py, lx, ly, side] = f();
      label(t, lb.at, px, py, lx, has(ly) ? ly : py - 170, lb.text, side);
    }
  }
  if (p.rpm) {
    const r = p.rpm, a = prog(t, r.at - .1, r.at + .3) * (1 - prog(t, s.end - .8, s.end - .5));
    if (a > 0) {
      const max = r.max || 8000, v = Math.round(speed(t) / top * max / 100) * 100;
      x.save(); x.globalAlpha = a; const y0 = 365;
      x.font = FONT(900, 100); x.textAlign = 'right'; x.textBaseline = 'alphabetic';
      x.fillStyle = TH.text; x.fillText(v.toLocaleString('es-CO'), 700, y0);
      x.font = FONT(800, 46); x.fillStyle = TH.accent; x.textAlign = 'left'; x.fillText(r.unit || 'RPM', 720, y0);
      x.save(); x.transform(1, 0, -0.25, 1, 0, 0);
      const segs = 24, on = Math.round(segs * v / max);
      for (let i = 0; i < segs; i++) { x.fillStyle = i < on ? (i > 18 ? TH.accent : TH.text) : 'rgba(255,255,255,.12)'; x.fillRect(350 + i * 25, y0 + 22, 18, 38); }
      x.restore(); x.restore();
    }
  }
};

// ---------------------------------------------------------------- oil_film
// Macro de la película de aceite entre pistón y cilindro (flujo cortante real).
MC.scenes.oil_film = function (t, s, p) {
  const lt = t - s.start, disp = 220 * Math.sin(lt * 3.2), GL = 330, GR = 750;
  x.fillStyle = '#060607'; x.fillRect(0, 0, W, H);
  x.fillStyle = oilGradient(GL, GR); x.fillRect(GL - 30, 0, GR - GL + 60, H);
  x.save(); x.beginPath(); x.rect(GL, 0, GR - GL, H); x.clip();
  for (let k = 0; k < 60; k++) {
    const xx = GL + 20 + ((k * 0.618) % 1) * (GR - GL - 40), share = 1 - (xx - GL) / (GR - GL);
    const yy = (((k * 197) % H + disp * share * 2.2 + lt * 60) % H + H) % H;
    x.strokeStyle = `rgba(255,240,190,${0.25 + 0.35 * share})`; x.lineWidth = 4;
    x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx, yy + 50 + 90 * share); x.stroke();
  }
  for (let k = 0; k < 25; k++) {
    const xx = GL + 30 + ((k * 0.381) % 1) * (GR - GL - 60), share = 1 - (xx - GL) / (GR - GL);
    const yy = (((k * 331) % H) + disp * share * 2.2 + H * 4) % H;
    x.fillStyle = 'rgba(255,255,230,.55)'; x.beginPath(); x.arc(xx, yy, 6 + (k % 4) * 2, 0, 7); x.fill();
  }
  const hv = has(p.heat_at) ? prog(t, p.heat_at, p.heat_at + .5) : 0;
  if (hv > 0) {
    for (let k = 0; k < 46; k++) {
      const q = (t * 0.8 + hash(k)) % 1, xx = GL + 10 + q * (GR - GL - 40);
      const yy = ((hash(k + 50) * H + q * 520 + disp * (1 - q) * 0.8) % H + H) % H;
      x.fillStyle = `rgba(255,${Math.round(60 + 150 * q)},20,${hv * (1 - q) * .9})`;
      x.beginPath(); x.arc(xx, yy, 9 - 4 * q, 0, 7); x.fill();
    }
  }
  x.restore();
  pistonSurface(GL, disp);
  if (hv > 0) {
    x.save(); x.globalCompositeOperation = 'lighter';
    const gg = x.createLinearGradient(GL - 160, 0, GL + 10, 0);
    gg.addColorStop(0, 'rgba(255,50,0,0)'); gg.addColorStop(1, `rgba(255,60,0,${.5 * hv * (.75 + .25 * Math.sin(t * 8))})`);
    x.fillStyle = gg; x.fillRect(GL - 160, 0, 170, H); x.restore();
  }
  cylinderSurface(GR);
  moveArrow(165, Math.cos(lt * 3.2), lt);
  sideLabels(prog(lt, .45, .8), p.left_label || 'PISTÓN', p.right_label || 'CILINDRO');
  if (has(p.film_at)) bracketLabel(back(prog(t, p.film_at, p.film_at + .5)), 540, 640, p.film_label || 'CAPA DE ACEITE');
  badgesAt(t, p.badges, 1220);
};

// ---------------------------------------------------------------- dry_friction
// Sin lubricación: el aceite se va, el metal se toca, chispas, calor, rayones y bloqueo.
MC.scenes.dry_friction = function (t, s, p) {
  const u = t - s.start, seize = has(p.seize_at) ? p.seize_at : s.end + 99;
  const heatAt = has(p.heat_at) ? p.heat_at : s.start + 1.3, peakAt = has(p.peak_at) ? p.peak_at : heatAt + 1.7;
  const slow0 = seize - .9, w = 3.2;
  const tt = Math.min(t, seize);
  let ph = w * (Math.min(tt, slow0) - s.start);
  if (tt > slow0) { const d = tt - slow0; ph += w * d - w * d * d / (2 * .9); }
  const disp = 220 * Math.sin(ph);
  const vel = Math.cos(ph) * (t < slow0 ? 1 : t < seize ? 1 - (t - slow0) / .9 : 0);
  const close = eio(prog(u, .5, 1.4)), GL = 330 + 190 * close, GR = 750 - 190 * close;
  const drain = eio(prog(u, 0, 1.3)), heat = prog(t, heatAt, heatAt + 1.7);
  const stopped = t >= seize;
  const shk = (t > heatAt + .2 && !stopped ? 3 + 9 * heat : 0) + (stopped ? 34 * (1 - prog(t, seize, seize + .35)) : 0);
  x.save(); x.translate(shk * Math.sin(t * 63), shk * Math.cos(t * 49));
  x.fillStyle = '#060607'; x.fillRect(-50, -50, W + 100, H + 100);
  if (drain < 1) {
    const topY = H * drain;
    x.save(); x.beginPath(); x.moveTo(GL - 30, H);
    for (let xx = GL - 30; xx <= GR + 30; xx += 15) x.lineTo(xx, topY + 18 * Math.sin(xx * .03 + t * 8));
    x.lineTo(GR + 30, H); x.closePath(); x.fillStyle = oilGradient(GL, GR); x.fill(); x.restore();
  }
  pistonSurface(GL, disp);
  if (has(p.scratch_at)) {
    const sc = prog(t, p.scratch_at - .2, p.scratch_at + .4);
    if (sc > 0) {
      x.save(); x.strokeStyle = `rgba(255,255,255,${.75 * sc})`; x.lineWidth = 3;
      for (let k = 0; k < 14; k++) {
        const xx = GL - 25 - hash(k) * 150, yy = ((hash(k + 20) * H + disp) % H + H) % H, len = 160 + hash(k + 40) * 260;
        x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + (hash(k + 60) - .5) * 10, yy + len * sc); x.stroke();
      }
      x.restore();
    }
  }
  cylinderSurface(GR);
  if (heat > 0) {
    x.save(); x.globalCompositeOperation = 'lighter';
    const wg = 140 + 260 * heat, pul = .8 + .2 * Math.sin(t * 9);
    const gg = x.createLinearGradient(540 - wg, 0, 540 + wg, 0);
    gg.addColorStop(0, 'rgba(255,40,0,0)'); gg.addColorStop(.5, `rgba(255,70,0,${.85 * heat * pul})`); gg.addColorStop(1, 'rgba(255,40,0,0)');
    x.fillStyle = gg; x.fillRect(540 - wg, 0, 2 * wg, H);
    x.fillStyle = `rgba(255,30,0,${.18 * heat})`; x.fillRect(0, 0, W, H);
    x.lineCap = 'round';
    for (let k = 0; k < 300; k++) {
      const e = heatAt + k * 0.016; if (e > t || e > seize) break;
      const age = t - e; if (age > .45) continue;
      const dir = hash(k) > .5 ? 1 : -1, vx = dir * (350 + 600 * hash(k + 7)), vy = -300 + 600 * hash(k + 13);
      const px = 540 + vx * age, py = 200 + hash(k + 3) * 1400 + vy * age + 1400 * age * age, al = 1 - age / .45;
      x.strokeStyle = `rgba(255,${Math.round(200 + 55 * al)},${Math.round(120 * al)},${al})`; x.lineWidth = 5;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px - vx * .03, py - (vy + 2800 * age) * .03); x.stroke();
    }
    x.restore();
  }
  moveArrow(130, vel, u);
  x.restore();
  if (p.thermometer !== false) thermometer(950, 520, 1060, .15 + .85 * eio(prog(t, heatAt - .1, peakAt + .3)), t, prog(u, .9, 1.3));
  if (stopped) {
    const m = prog(t, seize, seize + .3);
    x.save(); x.globalCompositeOperation = 'saturation'; x.fillStyle = `rgba(128,128,128,${.85 * m})`; x.fillRect(0, 0, W, H); x.restore();
    x.fillStyle = `rgba(0,0,0,${.35 * m})`; x.fillRect(0, 0, W, H);
    const fl = 1 - prog(t, seize, seize + .18);
    if (fl > 0) { x.fillStyle = rgba(TH.accent, .55 * fl); x.fillRect(0, 0, W, H); }
    stamp(t, seize, p.stamp || '¡MOTOR TRABADO!');
  }
};

// ---------------------------------------------------------------- sight_glass
// Mirilla de nivel de aceite con marcas MÍN/MÁX que se llena y recibe visto bueno.
MC.scenes.sight_glass = function (t, s, p) {
  const cx = 540, cy = 860, R1 = 265, R0 = 210, w = t - s.start;
  const fillAt = has(p.fill_at) ? p.fill_at : s.start + .35, okAt = has(p.ok_at) ? p.ok_at : fillAt + 1;
  const from = has(p.level_from) ? p.level_from : .12, to = has(p.level_to) ? p.level_to : .55;
  const pk0 = back(prog(w, 0, .45));
  x.save(); x.translate(cx, cy); x.scale(pk0, pk0);
  const rg = x.createRadialGradient(-80, -80, 40, 0, 0, R1);
  rg.addColorStop(0, '#D9DEE3'); rg.addColorStop(.6, '#7B848D'); rg.addColorStop(1, '#2E3238');
  x.fillStyle = rg; x.beginPath(); x.arc(0, 0, R1, 0, 7); x.fill();
  x.strokeStyle = '#fff'; x.lineWidth = 5; x.stroke();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .5; x.fillStyle = '#2A2C31'; x.beginPath(); x.arc(Math.cos(a) * 238, Math.sin(a) * 238, 14, 0, 7); x.fill(); }
  x.save(); x.beginPath(); x.arc(0, 0, R0, 0, 7); x.clip();
  x.fillStyle = '#0C0D10'; x.fillRect(-R0, -R0, 2 * R0, 2 * R0);
  const lvl = from + (to - from) * eio(prog(t, fillAt, fillAt + .95));
  const slosh = 16 * (1 - prog(t, fillAt + .85, fillAt + 2));
  const sy = R0 - 2 * R0 * lvl;
  x.beginPath(); x.moveTo(-R0, R0);
  for (let xx = -R0; xx <= R0; xx += 10) x.lineTo(xx, sy + slosh * Math.sin(xx * .025 + w * 9));
  x.lineTo(R0, R0); x.closePath();
  const og = x.createLinearGradient(0, sy, 0, R0); og.addColorStop(0, '#FFD45A'); og.addColorStop(1, '#9A5E05');
  x.fillStyle = og; x.fill();
  for (const lv of [.72, .32]) { const yy = R0 - 2 * R0 * lv; x.fillStyle = '#fff'; x.fillRect(-R0, yy - 3, 2 * R0, 6); }
  x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.ellipse(-70, -90, 70, 120, -.5, 0, 7); x.fill();
  x.restore();
  x.strokeStyle = '#111'; x.lineWidth = 8; x.beginPath(); x.arc(0, 0, R0, 0, 7); x.stroke();
  x.restore();
  const la = prog(w, .3, .6);
  if (la > 0) {
    x.save(); x.globalAlpha = la; x.font = FONT(900, 44); x.textBaseline = 'middle'; x.textAlign = 'left';
    for (const [lv, tx] of [[.72, p.max_label || 'MÁX'], [.32, p.min_label || 'MÍN']]) {
      const yy = cy + R0 - 2 * R0 * lv; x.strokeStyle = '#fff'; x.lineWidth = 4;
      x.beginPath(); x.moveTo(cx + R1 + 6, yy); x.lineTo(cx + R1 + 40, yy); x.stroke();
      x.fillStyle = '#fff'; x.fillText(tx, cx + R1 + 50, yy);
    }
    x.restore();
  }
  const pk = back(prog(t, okAt, okAt + .4));
  if (pk > 0) { x.save(); x.translate(cx + 190, cy + 190); x.scale(pk, pk); x.fillStyle = TH.primary; x.beginPath(); x.arc(0, 0, 62, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 6; x.stroke(); drawIcon('check', 1.6); x.restore(); }
  badgesAt(t, p.badges, 1240);
};

// ---------------------------------------------------------------- outro
// Cierre: motor sano girando + insignia, y tarjeta final con frase y logo.
MC.scenes.outro = function (t, s, p) {
  const cardAt = has(p.card_at) ? p.card_at : s.start + 2;
  const outP = eio(prog(t, cardAt - .1, cardAt + .3));
  if (outP < 1 && p.engine !== false) {
    x.save(); x.globalAlpha = 1 - outP;
    const g = x.createRadialGradient(540, 900, 60, 540, 900, 560);
    g.addColorStop(0, rgba(TH.accent, .22 + .06 * Math.sin(t * 5))); g.addColorStop(1, rgba(TH.accent, 0));
    x.fillStyle = g; x.fillRect(0, 300, W, 1300);
    const sc = .82 * (1 - .25 * outP) * (0.9 + 0.1 * back(prog(t, s.start, s.start + .5)));
    x.translate(540, 920); x.scale(sc, sc); x.translate(-540, -935);
    engineDrawing(t, (t - s.start) * 1.4 * 2 * Math.PI, 1.4, 1, {});
    x.restore();
    if (p.badge) badge(back(prog(t, p.badge.at, p.badge.at + .5)) * (1 - outP), 540, 1360, p.badge.text, p.badge.icon);
  }
  if (t > cardAt) {
    const lines = (p.lines || []).map((ln, i) => Object.assign({ size: 170, at: cardAt + .1 + i * .3 }, ln));
    let y = 610;
    for (const ln of lines) { y += ln.size / 2; bigWord(t, ln.at, ln.text, y, ln.size, colorOf(ln.color)); y += ln.size / 2 + 10; }
    const lp = eout(prog(t, cardAt + .7, cardAt + 1.1));
    x.save(); x.transform(1, 0, -0.3, 1, 0, 0); x.fillStyle = TH.text; x.fillRect(540 + 300 - 320 * lp, y + 20, 640 * lp, 10); x.restore();
    const la = prog(t, cardAt + 1.0, cardAt + 1.2), ls = .8 + .2 * back(prog(t, cardAt + 1.0, cardAt + 1.5));
    if (la > 0) { x.save(); x.translate(540, y + 330); x.scale(ls, ls); drawLogo(0, 0, p.logo_size || 560, la); x.restore(); }
    if (p.tagline) { x.save(); x.globalAlpha = prog(t, cardAt + 1.4, cardAt + 1.7); x.font = FONT(800, 44); x.textAlign = 'center'; x.fillStyle = TH.text; x.fillText(p.tagline, 540, y + 660); x.restore(); }
    if (p.cta) {                                    // botón de llamado a la acción que late
      const ca = cardAt + (p.cta_delay || 1.5), k = back(prog(t, ca, ca + .45));
      if (k > 0) {
        const pulse = 1 + .045 * Math.sin((t - ca) * 7) * prog(t, ca + .5, ca + .8), cy = Math.min(H - 330, y + 700);
        x.save(); x.translate(540, cy); x.scale(k * pulse, k * pulse);
        x.font = FONT(900, 46); const w = x.measureText(p.cta).width + 90;
        const gl = x.createRadialGradient(0, 0, 10, 0, 0, w * .7); gl.addColorStop(0, rgba(TH.accent, .35)); gl.addColorStop(1, rgba(TH.accent, 0));
        x.fillStyle = gl; x.fillRect(-w, -140, 2 * w, 280);
        x.fillStyle = TH.accent; rrect(-w / 2, -48, w, 96, 48); x.fill();
        x.strokeStyle = '#fff'; x.lineWidth = 4; x.stroke();
        x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.cta, 0, 3);
        x.restore();
      }
    }
  }
};

// ---------------------------------------------------------------- checklist
// Lista de pasos/consejos que aparecen uno a uno al ritmo de la voz.
MC.scenes.checklist = function (t, s, p) {
  if (p.title) bigWord(t, s.start + .1, p.title, 470, p.title_size || 96, colorOf(p.title_color || 'text'));
  const items = p.items || [], gap = p.gap || 175, y0 = p.y || (960 - (items.length - 1) * gap / 2 + 60);
  items.forEach((it, i) => {
    const k = back(prog(t, it.at, it.at + .45)), a = prog(t, it.at, it.at + .15);
    if (a <= 0) return;
    const y = y0 + i * gap;
    x.save(); x.globalAlpha = a; x.translate(-260 * (1 - k), 0);
    x.save(); x.transform(1, 0, -0.18, 1, 0, 0); x.fillStyle = TH.text; x.fillRect(150 + y * .18, y - 62, 840, 124); x.restore();
    x.fillStyle = TH.primary; x.beginPath(); x.arc(180, y, 52, 0, 7); x.fill();
    x.save(); x.translate(180, y); drawIcon(it.icon || 'check', 1.35); x.restore();
    x.font = FONT(900, it.size || 50); x.fillStyle = TH.ink; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText(it.text, 260, y + 3, 780);
    if (it.note) { x.font = FONT(700, 32, false); x.fillStyle = '#444'; x.fillText(it.note, 262, y + 42, 760); }
    x.restore();
  });
};

// ---------------------------------------------------------------- gauge
// Medidor circular con aguja (presión, temperatura, RPM, desgaste...).
MC.scenes.gauge = function (t, s, p) {
  const cx = 540, cy = 900, R = 330, a0 = Math.PI * .75, a1 = Math.PI * 2.25;
  const min = p.min || 0, max = has(p.max) ? p.max : 100;
  const k = eio(prog(t, has(p.from_at) ? p.from_at : s.start + .3, has(p.to_at) ? p.to_at : s.start + 1.6));
  const val = (has(p.from) ? p.from : min) + ((has(p.to) ? p.to : max) - (has(p.from) ? p.from : min)) * k;
  const pk = back(prog(t, s.start, s.start + .45));
  x.save(); x.translate(cx, cy); x.scale(pk, pk);
  x.lineCap = 'butt'; x.lineWidth = 46;
  x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(0, 0, R, a0, a1); x.stroke();
  const ang = v => a0 + (a1 - a0) * clamp((v - min) / (max - min));
  if (has(p.ok_min) && has(p.ok_max)) { x.strokeStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(0, 0, R, ang(p.ok_min), ang(p.ok_max)); x.stroke(); }
  if (has(p.danger_above)) { x.strokeStyle = TH.accent; x.beginPath(); x.arc(0, 0, R, ang(p.danger_above), a1); x.stroke(); }
  if (has(p.danger_below)) { x.strokeStyle = TH.accent; x.beginPath(); x.arc(0, 0, R, a0, ang(p.danger_below)); x.stroke(); }
  x.lineWidth = 4; x.strokeStyle = '#fff';
  for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10; x.beginPath(); x.moveTo(Math.cos(a) * (R - 40), Math.sin(a) * (R - 40)); x.lineTo(Math.cos(a) * (R - 70), Math.sin(a) * (R - 70)); x.stroke(); }
  const na = ang(val) + (k > 0 && k < 1 ? .02 * Math.sin(t * 40) : 0);
  x.save(); x.rotate(na); x.fillStyle = TH.accent; x.beginPath(); x.moveTo(0, -14); x.lineTo(R - 60, 0); x.lineTo(0, 14); x.closePath(); x.fill(); x.restore();
  x.fillStyle = '#2A2C31'; x.beginPath(); x.arc(0, 0, 42, 0, 7); x.fill(); x.strokeStyle = TH.primary; x.lineWidth = 8; x.stroke();
  x.font = FONT(900, 120); x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff';
  x.fillText((p.decimals ? val.toFixed(p.decimals) : Math.round(val).toLocaleString('es-CO')), 0, 230);
  x.font = FONT(800, 50); x.fillStyle = TH.accent; x.fillText(p.unit || '', 0, 290);
  x.restore();
  if (p.label) bigWord(t, s.start + .2, p.label, 420, 80, TH.text);
  badgesAt(t, p.badges, 1300);
};

// ---------------------------------------------------------------- photo
// Foto propia (del taller, de una moto o generada) con cámara que la recorre: se acerca a cada
// pieza (`moves`), la ilumina (foco) y la señala con etiquetas (`points`). Coordenadas de la foto
// de 0 a 1 (x: izquierda→derecha, y: arriba→abajo). Sin `moves`: acercamiento lento como antes.
function photoCam(t, s, p, im) {
  const cover = Math.max(W / im.width, H / im.height);
  const keys = (p.moves && p.moves.length) ? p.moves : [{ at: s.start, x: .5 + (p.pan_x || 0) * -.02, y: .5, zoom: p.zoom_from || 1 },
    { at: s.start + .01, dur: s.end - s.start, x: .5 + (p.pan_x || 0) * .02, y: .5 + (p.pan_y || 0) * .02, zoom: p.zoom_to || 1.12 }];
  let c = { x: has(keys[0].x) ? keys[0].x : .5, y: has(keys[0].y) ? keys[0].y : .5, zoom: keys[0].zoom || 1, spot: keys[0].spot ? 1 : 0, rot: keys[0].rot || 0 };
  let moving = 0;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i], k0 = has(k.at) ? k.at : s.start, d = k.dur || .75, u = prog(t, k0, k0 + d);
    if (u <= 0) break;
    const e = eio(u);
    if (u < 1) moving = Math.max(moving, Math.sin(u * Math.PI));
    c = { x: lerp(c.x, has(k.x) ? k.x : c.x, e), y: lerp(c.y, has(k.y) ? k.y : c.y, e), zoom: lerp(c.zoom, k.zoom || c.zoom, e),
          spot: lerp(c.spot, k.spot ? 1 : 0, e), rot: lerp(c.rot, k.rot || 0, e) };
  }
  const breathe = 1 + .018 * Math.sin((t - s.start) * .9);      // la toma nunca está quieta
  const sc = cover * c.zoom * breathe;
  const fy = H * (has(p.focus_y) ? p.focus_y : .44);              // la pieza queda arriba de los subtítulos
  let ox = W / 2 - c.x * im.width * sc, oy = fy - c.y * im.height * sc;
  ox = Math.min(0, Math.max(W - im.width * sc, ox)); oy = Math.min(0, Math.max(H - im.height * sc, oy));   // sin bordes negros
  return { sc, ox, oy, spot: c.spot, rot: c.rot, moving, pt: (px, py) => [ox + px * im.width * sc, oy + py * im.height * sc] };
}
MC.scenes.photo = function (t, s, p) {
  const im = MC.images && MC.images[p.image_url];
  if (im) {
    const cam = photoCam(t, s, p, im);
    x.save();
    if (cam.rot) { x.translate(W / 2, H / 2); x.rotate(cam.rot); x.translate(-W / 2, -H / 2); }
    if (p.grade) x.filter = p.grade;                              // el tratamiento de color ya viene hecho en la foto
    x.drawImage(im, cam.ox, cam.oy, im.width * cam.sc, im.height * cam.sc);
    x.filter = 'none';
    x.restore();
    // foco: oscurece alrededor de la pieza de la que se habla
    const pts = p.points || [];
    const cur = pts.filter(q => t >= q.at && (!has(q.until) || t < q.until)).pop();
    if (cam.spot > .01 && cur) {
      const [sx, sy] = cam.pt(cur.x, cur.y);
      const g = x.createRadialGradient(sx, sy, 170, sx, sy, 620);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.5 * cam.spot})`);
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    const g = x.createRadialGradient(W / 2, H * .45, H * .32, W / 2, H / 2, H * .8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const gb = x.createLinearGradient(0, H * .62, 0, H);           // base oscura con toque de marca para los subtítulos
    gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(.6, 'rgba(0,0,0,.45)'); gb.addColorStop(1, rgba(TH.primary, .28));
    x.fillStyle = gb; x.fillRect(0, H * .62, W, H * .38);
    if (has(p.sweep_at)) {                                        // brillo que barre la foto
      const u = prog(t, p.sweep_at, p.sweep_at + .7);
      if (u > 0 && u < 1) {
        x.save(); x.globalCompositeOperation = 'lighter';
        const cx = lerp(-400, W + 400, eio(u)), sg = x.createLinearGradient(cx - 180, 0, cx + 180, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.22)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        x.setTransform(1, 0, -.35, 1, 0, 0); x.fillStyle = sg; x.fillRect(-W, 0, 3 * W, H); x.restore();
      }
    }
    // etiquetas que siguen a la pieza mientras la cámara se mueve
    for (const q of pts) {
      if (t < q.at) continue;
      const a = has(q.until) ? 1 - prog(t, q.until, q.until + .25) : 1;
      if (a <= 0) continue;
      const [px, py] = cam.pt(q.x, q.y), side = q.side || (px > W / 2 ? -1 : 1);
      if (!q.text) {                                              // solo un anillo sobre la pieza
        const u = prog(t, q.at, q.at + .4), r = (q.r || 90) * (.6 + .4 * back(u)), pulse = (t - q.at) % 1.1 / 1.1;
        x.save(); x.globalAlpha = a * u;
        x.strokeStyle = TH.text; x.lineWidth = 7; x.beginPath(); x.arc(px, py, r, 0, 7); x.stroke();
        x.strokeStyle = rgba(TH.accent, 1 - pulse); x.lineWidth = 5; x.beginPath(); x.arc(px, py, r + 10 + 40 * pulse, 0, 7); x.stroke();
        x.restore(); continue;
      }
      const lx = clamp(px + side * (q.dx || 150), 60, W - 60), ly = clamp(py + (q.dy || -230), 400, H - 560);
      x.save(); x.globalAlpha = a; label(t, q.at, px, py, lx, ly, q.text, side, q.size || 58); x.restore();
    }
  }
  // lista que se va armando y se queda en pantalla (se alcanza a leer aunque la voz vaya rápido);
  // la pieza de la que se habla ahora va resaltada
  const cl = (p.checklist || []).filter(it => t >= it.at), last = cl.length - 1;
  if (!MC.teasing) cl.forEach((it, i) => {
    const k = back(prog(t, it.at, it.at + .45)), y = (p.checklist_y || 400) + i * 100, on = i === last;
    x.save(); x.translate(-420 * (1 - k), 0); x.globalAlpha = prog(t, it.at, it.at + .15) * (on ? 1 : .82);
    x.font = FONT(900, on ? 54 : 46); const w = x.measureText(it.text).width + 56, h = on ? 92 : 80, sk = 14, x0 = 40;
    const para = (px, pw, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(px + sk, y - h / 2); x.lineTo(px + pw + sk, y - h / 2); x.lineTo(px + pw - sk, y + h / 2); x.lineTo(px - sk, y + h / 2); x.closePath(); x.fill(); };
    para(x0, h, TH.primary); para(x0 + h + 6, w, on ? TH.text : 'rgba(255,255,255,.88)');
    x.save(); x.translate(x0 + h / 2, y); drawIcon('check', on ? 1 : .85); x.restore();
    x.fillStyle = TH.ink; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(it.text, x0 + h + 6 + 28, y + 3);
    x.restore();
  });
  const la = has(p.lines_until) ? 1 - prog(t, p.lines_until, p.lines_until + .3) : 1;
  if (la > 0) { x.save(); x.globalAlpha = la; stackLines(t, p.lines, p.lines_y || 1050); x.restore(); }
  badgesAt(t, p.badges, 1300);
};


// ---------------------------------------------------------------- product
// Anuncio de producto: la foto recortada (sin fondo) flota bajo un foco con rayos, entra con rebote, se le pasa un
// brillo; un "+" une dos productos; precio grande en sticker; píldoras (motos compatibles) que se suman.
const PIMG = {};
function productPill(cx, cy, text, k, color = 'white', size = 44) {
  if (k <= 0) return 0;
  const [bg, fg] = color === 'yellow' ? ['#F5B427', '#141414'] : color === 'red' ? [TH.accent, '#fff'] : color === 'dark' ? ['#15161a', '#fff'] : ['#fff', '#141414'];
  x.save(); x.font = FONT(800, size, false); const w = x.measureText(text).width + size * 1.1, h = size * 1.5;
  x.translate(cx, cy); x.scale(k, k);
  x.fillStyle = 'rgba(0,0,0,.35)'; rrect(-w / 2 + 4, -h / 2 + 6, w, h, h / 2); x.fill();
  x.fillStyle = bg; rrect(-w / 2, -h / 2, w, h, h / 2); x.fill();
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 0, 2);
  x.restore(); return w;
}
function productImage(url) {                    // ¿la foto trae transparencia? (si no, va en tarjeta blanca)
  if (PIMG[url]) return PIMG[url];
  const im = MC.images[url]; if (!im) return null;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, 0, 0, 64, 64); const d = g.getImageData(0, 0, 64, 64).data; let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 20) clear++;
  return (PIMG[url] = { im, cut: clear > 64 * 64 * .04 });
}
MC.scenes.product = function (t, s, p) {
  const lt = t - s.start, items = p.items || [], n = items.length;
  // fondo: degradado de marca, foco de luz y rayos que giran despacio
  const cy0 = p.spot_y || 820;
  const g = x.createRadialGradient(W / 2, cy0, 40, W / 2, cy0, 900); g.addColorStop(0, rgba(TH.accent, .5)); g.addColorStop(.45, rgba(TH.accent, .12)); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.save(); x.translate(W / 2, cy0); x.rotate(lt * .12); x.fillStyle = 'rgba(255,255,255,.045)';
  for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(0, 0); x.lineTo(1400, -90); x.lineTo(1400, 90); x.closePath(); x.fill(); }
  x.restore();
  stackLines(t, p.lines, p.lines_y || 300);
  // productos
  const slots = n === 1 ? [[W / 2, cy0, 1]] : [[W * .31, cy0 - 40, .78], [W * .71, cy0 + 70, .78]];
  items.forEach((it, i) => {
    const P = productImage(it.image_url); if (!P) return;
    const at = has(it.at) ? it.at : s.start + .2 + i * .4, k = back(prog(t, at, at + .5)); if (k <= 0) return;
    const [sx, sy, sc0] = it.x ? [it.x, it.y, it.scale || .8] : slots[i] || slots[0];
    const bob = 10 * Math.sin((t - at) * 2.2 + i), rot = .04 * Math.sin((t - at) * 1.4 + i * 2) + (it.rot || 0);
    const box = 620 * sc0 * (it.size || 1), ar = P.im.width / P.im.height, w = ar >= 1 ? box : box * ar, h = ar >= 1 ? box / ar : box;
    x.save(); x.translate(sx, sy + bob);
    x.save(); x.scale(k, k * .35); x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(0, (h / 2 + 40) / .35, w * .42, 40, 0, 0, Math.PI * 2); x.fill(); x.restore();   // sombra
    x.rotate(rot); x.scale(k, k);
    if (!P.cut) { x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 30; rrect(-w / 2 - 24, -h / 2 - 24, w + 48, h + 48, 36); x.fill(); x.shadowBlur = 0; }
    x.drawImage(P.im, -w / 2, -h / 2, w, h);
    if (has(p.sweep_at)) {                         // brillo que cruza el producto
      const u = prog(t, p.sweep_at + i * .15, p.sweep_at + i * .15 + .6);
      if (u > 0 && u < 1) { x.globalCompositeOperation = 'lighter'; const gx = -w + 2 * w * u, sg = x.createLinearGradient(gx - 80, 0, gx + 80, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = sg; x.fillRect(-w / 2, -h / 2, w, h); x.globalCompositeOperation = 'source-over'; }
    }
    x.restore();
    if (it.label) productPill(sx, sy + h / 2 + 90 + bob * .3, it.label, back(prog(t, at + .25, at + .6)), it.color || 'white', it.label_size || 44);
    if (it.tag) {                                   // etiqueta pequeña inclinada (ej. ORIGINAL)
      const tk = back(prog(t, at + .4, at + .75)); if (tk > 0) { x.save(); x.translate(sx + w * .32, sy - h * .42 + bob); x.rotate(-.18); productPill(0, 0, it.tag, tk, it.tag_color || 'red', 34); x.restore(); }
    }
  });
  if (n === 2) {                                    // "+" entre los dos productos
    const at = has(items[1].at) ? items[1].at : s.start + .6, k = back(prog(t, at + .1, at + .45));
    if (k > 0) { x.save(); x.translate(W / 2, cy0 + 15); x.scale(k, k); x.fillStyle = TH.accent; x.beginPath(); x.arc(0, 0, 62, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 6; x.stroke(); x.fillStyle = '#fff'; x.font = FONT(900, 90, false); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+', 0, 6); x.restore(); }
  }
  // precio en sticker que late
  if (p.price) {
    const pr = p.price, k = back(prog(t, pr.at, pr.at + .5));
    if (k > 0) {
      const py = pr.y || 1290, pulse = 1 + .035 * Math.sin((t - pr.at) * 6) * prog(t, pr.at + .5, pr.at + .8);
      x.save(); x.translate(W / 2, py); x.rotate(-.05); x.scale(k * pulse, k * pulse);
      x.font = FONT(900, pr.size || 150, false); const tw = x.measureText(pr.text).width;
      x.fillStyle = 'rgba(0,0,0,.4)'; rrect(-tw / 2 - 50 + 8, -110 + 12, tw + 100, 220, 40); x.fill();
      x.fillStyle = '#F5B427'; rrect(-tw / 2 - 50, -110, tw + 100, 220, 40); x.fill();
      x.fillStyle = '#141414'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(pr.text, 0, 8);
      if (pr.kicker) { x.font = FONT(800, 44); x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 12; x.fillText(pr.kicker, 0, -150); }
      x.restore();
    }
  }
  // píldoras (motos compatibles): una fila centrada que se va llenando
  if (p.pills && p.pills.length) {
    const py = p.pills_y || 1500, size = p.pills_size || 42; x.font = FONT(800, size, false);
    const ws = p.pills.map(q => x.measureText(q.text).width + size * 1.1), gap = 18;
    const rows = [[]]; let acc = 0;
    p.pills.forEach((q, i) => { if (acc + ws[i] > W - 120 && rows[rows.length - 1].length) { rows.push([]); acc = 0; } rows[rows.length - 1].push(i); acc += ws[i] + gap; });
    rows.forEach((r, ri) => { let cx = W / 2 - (r.reduce((a, i) => a + ws[i], 0) + gap * (r.length - 1)) / 2;
      r.forEach(i => { const q = p.pills[i]; productPill(cx + ws[i] / 2, py + ri * (size * 1.5 + 16), q.text, back(prog(t, q.at, q.at + .4)), q.color || 'white', size); cx += ws[i] + gap; }); });
    if (p.pills_title) { x.save(); x.globalAlpha = prog(t, p.pills[0].at - .2, p.pills[0].at + .1); x.font = FONT(800, 40); x.textAlign = 'center'; x.fillStyle = '#F5B427';
      x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 12; x.fillText(p.pills_title, W / 2, py - 80); x.restore(); }
  }
};

// ---------------------------------------------------------------- quiz
// "¿Mito o realidad?": la frase grande, dos botones (MITO / REALIDAD), cuenta regresiva 3-2-1 con anillo, y la
// revelación: el botón correcto crece con brillo y visto bueno, el otro se apaga, y un sello cruza la pantalla.
function wrapText(text, maxW) {
  const words = String(text).split(' '), lines = []; let ln = '';
  for (const w of words) { const tr = ln ? ln + ' ' + w : w; if (x.measureText(tr).width > maxW && ln) { lines.push(ln); ln = w; } else ln = tr; }
  if (ln) lines.push(ln); return lines;
}
MC.scenes.quiz = function (t, s, p) {
  const st = p.statement || {}, rv = p.reveal || {}, ans = (rv.answer || 'mito').toLowerCase();
  const revealed = has(rv.at) && t >= rv.at, rk = revealed ? eout(prog(t, rv.at, rv.at + .35)) : 0;
  // fondo: barrido de color según la respuesta al revelar
  if (revealed) { const c = ans === 'mito' ? TH.accent : '#2fbf5f'; const g = x.createRadialGradient(W / 2, 1150, 50, W / 2, 1150, 1100);
    g.addColorStop(0, rgba(c, .45 * rk)); g.addColorStop(1, rgba(c, 0)); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  // encabezado: "MITO O REALIDAD · 1/3"
  const hk = back(prog(t, s.start, s.start + .4));
  if (hk > 0) { x.save(); x.translate(W / 2, 330); x.scale(hk, hk); x.font = FONT(900, 46); const tx = (p.header || '¿MITO O REALIDAD?') + (p.number ? '  ' + p.number : '');
    const w = x.measureText(tx).width + 80; x.fillStyle = '#fff'; x.save(); x.transform(1, 0, -.2, 1, 0, 0); x.fillRect(-w / 2, -42, w, 84); x.restore();
    x.fillStyle = '#141414'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(tx, 0, 3); x.restore(); }
  // la frase (entre comillas), palabra por palabra al ritmo de la voz
  if (st.text) {
    const at = has(st.at) ? st.at : s.start + .2, size = st.size || 76; x.save(); x.font = FONT(900, size, false);
    const lines = wrapText('“' + st.text + '”', W - 150), lh = size * 1.18, y0 = (st.y || 640) - (lines.length - 1) * lh / 2;
    const total = st.text.split(' ').length, dur = Math.max(.6, (has(st.until) ? st.until : at + 2.4) - at);
    let shown = Math.ceil(total * prog(t, at, at + dur * .85) + .001), idx = 0;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 18; x.shadowOffsetY = 5;
    lines.forEach((ln, i) => { const ws = ln.split(' '); let part = []; for (const w of ws) { if (idx < shown) part.push(w); idx++; }
      x.fillStyle = revealed ? 'rgba(255,255,255,.55)' : '#fff'; x.fillText(part.join(' '), W / 2, y0 + i * lh); });
    x.restore();
  }
  // botones
  const bk = back(prog(t, p.buttons_at ?? (s.start + .6), (p.buttons_at ?? (s.start + .6)) + .45));
  const btn = (label, cx, color, isAns) => {
    if (bk <= 0) return;
    const sc = bk * (revealed ? (isAns ? 1 + .22 * rk : 1 - .12 * rk) : 1 + .03 * Math.sin(t * 6 + cx));
    x.save(); x.translate(cx, 1180); x.scale(sc, sc); x.globalAlpha = revealed && !isAns ? 1 - .65 * rk : 1;
    if (revealed && isAns) { const g = x.createRadialGradient(0, 0, 40, 0, 0, 320); g.addColorStop(0, rgba(color, .6)); g.addColorStop(1, rgba(color, 0)); x.fillStyle = g; x.fillRect(-320, -320, 640, 640); }
    x.fillStyle = 'rgba(0,0,0,.4)'; rrect(-200 + 6, -70 + 10, 400, 140, 70); x.fill();
    x.fillStyle = color; rrect(-200, -70, 400, 140, 70); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 6; x.stroke();
    x.fillStyle = '#fff'; x.font = FONT(900, 62); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 0, 4);
    if (revealed) { x.save(); x.translate(170, -62); x.scale(rk * 1.6, rk * 1.6); x.fillStyle = isAns ? '#2fbf5f' : '#555'; x.beginPath(); x.arc(0, 0, 34, 0, 7); x.fill(); drawIcon(isAns ? 'check' : 'cross', 1); x.restore(); }
    x.restore();
  };
  btn('MITO', W * .29, TH.accent, ans === 'mito'); btn('REALIDAD', W * .71, '#2fbf5f', ans !== 'mito');
  // cuenta regresiva: número grande en un anillo que se vacía
  const cs = p.count || [];
  for (let i = 0; i < cs.length && !revealed; i++) {
    const a = cs[i].at, b = i + 1 < cs.length ? cs[i + 1].at : (has(rv.at) ? rv.at : a + .6);
    if (t < a || t >= b) continue;
    const u = prog(t, a, b), k = back(prog(t, a, a + .25)), n = String(cs.length - i);
    x.save(); x.translate(W / 2, 930); x.scale(k, k);
    x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.arc(0, 0, 120, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 14; x.beginPath(); x.arc(0, 0, 112, 0, 7); x.stroke();
    x.strokeStyle = '#F5B427'; x.beginPath(); x.arc(0, 0, 112, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - u)); x.stroke();
    x.fillStyle = '#fff'; x.font = FONT(900, 150, false); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n, 0, 8);
    x.restore();
  }
  // sello que cruza la pantalla
  if (revealed) {
    const k = back(prog(t, rv.at, rv.at + .4)), txt = rv.stamp || (ans === 'mito' ? '¡MITO!' : '¡REALIDAD!');
    x.save(); x.translate(W / 2, 900); x.rotate(-.12); x.scale(k * (1.6 - .6 * k), k * (1.6 - .6 * k)); x.globalAlpha = Math.min(1, k * 1.5);
    x.font = FONT(900, 150); const w = x.measureText(txt).width + 80, c = ans === 'mito' ? TH.accent : '#2fbf5f';
    x.strokeStyle = c; x.lineWidth = 14; rrect(-w / 2, -105, w, 210, 26); x.stroke();
    x.fillStyle = c; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 0, 10);
    x.restore();
  }
};
