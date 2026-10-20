// Kit 3D "pro": versiones con mucho más detalle de motos, herramientas y repuestos.
// Formas curvas de verdad: perfiles laterales suavizados y extruidos con bisel (carenados, tanques,
// cuerpos de scooter, bidones) y piezas torneadas (bujía, destornillador, aerosol, filtro, casco).
// Reemplaza a las versiones simples de kit3d.js en MC.kit (mismos nombres, mismo uso).
const MC = window.MC;
const { T } = MC.three;
const K = MC.kit;
const { rbox, mat, paint, put, rod, toyBike } = K;

// ---------------------------------------------------------------- ayudas de modelado
function smoothShape(pts) {                 // contorno cerrado y suave que pasa por los puntos
  const s = new T.Shape();
  s.moveTo(...pts[0]); s.splineThru(pts.slice(1).concat([pts[0]]).map(p => new T.Vector2(...p)));
  return s;
}
function profile(pts, depth, bevel = 8, holes = []) {      // perfil lateral (x,y) extruido a lo ancho (z), centrado
  const s = smoothShape(pts);
  for (const h of holes) { const p = new T.Path(); p.moveTo(...h[0]); p.splineThru(h.slice(1).concat([h[0]]).map(q => new T.Vector2(...q))); s.holes.push(p); }
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(1, depth - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return g;
}
const lathe = (pts, segs = 48) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), segs);
const chrome = () => mat(0xe3e7ec, .12, 1);
let LOGO = null;
function logoTex() {
  if (LOGO || !MC.logo) return LOGO;
  LOGO = new T.Texture(MC.logo); LOGO.colorSpace = T.SRGBColorSpace; LOGO.anisotropy = 8; LOGO.needsUpdate = true; return LOGO;
}
function decal(parent, size, x, y, z, ry = 0) {   // logo de la marca impreso (brilla un poco para leerse)
  const t = logoTex(); if (!t) return null;
  return put(parent, new T.PlaneGeometry(size, size), new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: .55,
    transparent: true, roughness: .5, polygonOffset: true, polygonOffsetFactor: -2 }), x, y, z, 0, ry, 0);
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------------------------------------------------------------- detalles comunes de moto
function rearBrake(B) {
  const w = B.R.w;
  put(w, new T.CylinderGeometry(30, 30, 3, 32), mat(0xdfe3e8, .25, .85), 0, 0, -20, Math.PI / 2);
  put(B.bike, rbox(22, 30, 14, 5), mat(0xf5b427, .35), -175 + 26, 80 - 22, -24, 0, 0, .4);
}
function proBrakes(B, C) {          // disco ondulado y pinza de 2 pistones (los de brakeSet) en la rueda delantera
  const w = B.F.w, old = B.F.parts.disc, set = brakeSet(C);
  w.remove(old);
  const disc = set.g; disc.scale.setScalar(.33); disc.position.set(0, 0, 17); w.add(disc);
  const cal = disc.children.find(o => o.isGroup); disc.remove(cal);
  B.bike.remove(B.F.parts.caliper);
  cal.scale.setScalar(.33); cal.position.set(B.F.w.position.x - 22, 80 + 32, 30); cal.rotation.z = .55; B.bike.add(cal);
  B.F.parts.disc = set.disc; B.F.parts.caliper = cal.children[0];
}
function nakedDetails(B, C) {
  const bike = B.bike, red = paint(C.brand), dark = mat(0x26282d, .45, .6), hose = mat(0x111111, .6);
  rearBrake(B); proBrakes(B, C);
  // radiador con rejilla
  put(bike, rbox(16, 80, 70, 4), dark, 112, 178, 0, 0, 0, -.25);
  for (let i = 0; i < 7; i++) put(bike, new T.BoxGeometry(18, 2, 68), mat(0x55595f, .4, .8), 116, 148 + i * 10, 0, 0, 0, -.25);
  // líneas de freno y cables
  const tube = (pts, r = 2.4) => put(bike, new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 30, r, 6), hose);
  tube([[118, 300, 60], [140, 250, 40], [160, 180, 34], [150, 112, 30]]);
  tube([[118, 300, -60], [96, 270, -36], [70, 240, -40]]);
  tube([[-60, 150, -40], [-120, 110, -36], [-150, 70, -26]], 2);
  // tablero digital
  put(bike, rbox(40, 26, 50, 6), mat(0x111111, .4), 126, 322, 0, 0, 0, -.5);
  put(bike, new T.PlaneGeometry(30, 18), mat(0x0a1a2a, .2, 0, { emissive: 0x3bb0ff, emissiveIntensity: .9 }), 136, 330, 0, 0, Math.PI / 2, -.5).rotation.set(-.5, Math.PI / 2, 0);
  // manetas y tapas de horquilla
  for (const z of [64, -64]) { const l = put(bike, rbox(46, 5, 6, 2), mat(0x2c2e33, .3, .8), 140, 300, z, 0, z > 0 ? -.2 : .2, -.1); }
  for (const z of [30, -30]) put(bike, new T.CylinderGeometry(9, 9, 8, 16), mat(0xd9a53a, .3, .9), 128, 282, z);
  // pata lateral y protector de cadena
  rod(bike, [-40, 80, 40], [-10, 20, 62], 4, dark);
  put(bike, rbox(120, 10, 16, 3), dark, -100, 112, 36, 0, 0, .13);
  // logo en el tanque
  decal(bike, 46, 70, 234, 50.5); decal(bike, 46, 70, 234, -50.5, Math.PI);
}

// ---------------------------------------------------------------- motos
function naked(C) { const B = toyBike(C); nakedDetails(B, C); return B; }

function sport(C) {
  const B = toyBike(C), bike = B.bike, red = paint(C.brand), black = paint(0x141519), white = paint(0xf2f2f0);
  rearBrake(B); proBrakes(B, C);
  // carenado completo (silueta convexa de deportiva) con toma de aire y franja negra baja
  const side = [[224, 284], [228, 254], [212, 222], [182, 186], [146, 150], [104, 122], [54, 104], [0, 98], [-28, 106], [-22, 140], [24, 160], [76, 186], [116, 222], [142, 262], [164, 300], [198, 308]];
  put(bike, profile(side, 120, 10, [[[156, 238], [184, 244], [176, 220], [152, 216]]]), red);
  put(bike, profile([[140, 150], [100, 124], [52, 108], [0, 102], [-24, 110], [-20, 126], [24, 128], [80, 140], [128, 168]], 124, 5), black);
  // quilla
  put(bike, profile([[120, 130], [60, 70], [-30, 66], [-40, 92], [40, 102], [110, 140]], 96, 8), black);
  // colín afilado con luz
  put(bike, profile([[-70, 228], [-150, 242], [-226, 262], [-232, 250], [-150, 224], [-80, 214]], 70, 8), red);
  put(bike, rbox(16, 10, 44, 4), mat(0xff2a2a, .3, 0, { emissive: 0xff1010, emissiveIntensity: 1.6 }), -228, 254, 0, 0, 0, .3);
  // parabrisas ahumado
  put(bike, profile([[150, 312], [186, 322], [214, 302], [206, 336], [172, 356]], 80, 3),
      new T.MeshPhysicalMaterial({ color: 0x5d6b78, roughness: .05, metalness: .1, transparent: true, opacity: .55, clearcoat: 1 }));
  // faros dobles y semimanillares
  for (const z of [24, -24]) put(bike, rbox(26, 14, 22, 5), mat(0xffffff, .15, 0, { emissive: 0xeaf4ff, emissiveIntensity: 2 }), 218, 270, z, 0, 0, -.5);
  for (const z of [60, -60]) put(bike, new T.CylinderGeometry(6, 6, 46, 12), mat(0x222428, .4, .7), 128, 296, z, Math.PI / 2, 0, 0);
  decal(bike, 60, 100, 196, 61); decal(bike, 60, 100, 196, -61, Math.PI);
  return B;
}

function enduro(C) {
  const B = toyBike(C), bike = B.bike, red = paint(C.brand), white = paint(0xf2f2f0), black = paint(0x141519);
  for (const W of [B.F.w, B.R.w]) {
    W.scale.setScalar(1.18); W.position.y = 94;
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; put(W, rbox(11, 9, 28, 2), mat(0x141414, .9), Math.cos(a) * 80, Math.sin(a) * 80, 0, 0, 0, a); }
  }
  rearBrake(B);
  bike.scale.y = 1.08;
  // guardabarros alto delantero y trasero largo
  put(bike, profile([[150, 236], [196, 246], [246, 232], [250, 222], [196, 230], [150, 224]], 44, 4), white);
  put(bike, profile([[-120, 236], [-200, 250], [-262, 262], [-262, 252], [-200, 238], [-120, 226]], 40, 4), white);
  // placa de número frontal y laterales
  const plate = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f2f2f0'; g.fillRect(0, 0, w, h); g.fillStyle = TH.primary; g.font = 'italic 900 150px Montserrat';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('07', w / 2, h / 2 + 6); });
  put(bike, rbox(12, 70, 76, 10), white, 170, 300, 0, 0, 0, -.3);
  put(bike, new T.PlaneGeometry(62, 56), new T.MeshStandardMaterial({ map: plate, roughness: .5 }), 177, 300, 0, 0, Math.PI / 2, 0).rotation.set(0, Math.PI / 2, .3);
  for (const z of [44, -44]) put(bike, profile([[-80, 170], [-150, 200], [-160, 160], [-90, 140]], 6, 2), white).position.z = z;
  // escape alto y asiento largo y delgado
  rod(bike, [20, 120, -46], [-110, 200, -50], 8, mat(0xc4c9cf, .22, 1));
  put(bike, new T.CylinderGeometry(15, 13, 80, 20), mat(0x2b2d31, .35, .8), -140, 214, -50, 0, 0, Math.PI / 2 - .35);
  put(bike, profile([[60, 238], [-40, 232], [-150, 240], [-150, 228], [-40, 220], [60, 226]], 46, 6), black);
  decal(bike, 44, 70, 234, 50.5); decal(bike, 44, 70, 234, -50.5, Math.PI);
  return B;
}

function scooter(C) {
  const bike = new T.Group(), red = paint(C.brand), black = paint(0x141519), satin = mat(0x2a2c31, .5, .3), rubber = mat(0x141414, .85);
  const wheel = x => {
    const w = new T.Group(); w.position.set(x, 50, 0); bike.add(w);
    put(w, new T.TorusGeometry(38, 14, 14, 40), rubber);
    put(w, new T.TorusGeometry(28, 3.5, 8, 40), mat(0xc4c9cf, .22, 1));
    for (let i = 0; i < 5; i++) put(w, rbox(6, 26, 8, 2), mat(0xc4c9cf, .22, 1), 0, 0, 0, 0, 0, i * Math.PI * .4).geometry.translate(0, 14, 0);
    put(w, new T.CylinderGeometry(9, 9, 22, 16), mat(0x8c9198, .3, .9), 0, 0, 0, Math.PI / 2);
    return { w, parts: {} };
  };
  const F = wheel(158), R = wheel(-138);
  // cuerpo trasero curvo, piso, escudo frontal y asiento
  put(bike, profile([[-30, 70], [-60, 150], [-130, 190], [-205, 186], [-224, 150], [-190, 100], [-120, 76]], 94, 14), red);
  put(bike, profile([[-40, 70], [100, 66], [118, 78], [-30, 84]], 86, 6), black);
  put(bike, profile([[100, 66], [132, 150], [128, 250], [152, 262], [158, 150], [128, 60]], 96, 12), red);
  put(bike, profile([[-40, 192], [-120, 204], [-196, 198], [-200, 184], [-120, 186], [-44, 178]], 72, 10), mat(0x1b1b1d, .85));
  // dirección, manubrio con cubierta y faro
  rod(bike, [158, 50, 0], [134, 250, 0], 8, mat(0xc4c9cf, .22, 1));
  put(bike, profile([[110, 272], [150, 286], [176, 272], [168, 254], [120, 252]], 110, 10), red);
  put(bike, new T.CylinderGeometry(15, 15, 12, 24), mat(0xffffff, .15, 0, { emissive: 0xfff1cc, emissiveIntensity: 2 }), 176, 266, 0, 0, 0, Math.PI / 2);
  for (const z of [70, -70]) { put(bike, new T.CylinderGeometry(7, 7, 26, 12), rubber, 140, 270, z, Math.PI / 2); rod(bike, [140, 276, z * .8], [128, 320, z * .9], 2.5, satin);
    put(bike, rbox(28, 18, 6, 4), black, 126, 326, z * .92, 0, z > 0 ? .3 : -.3, 0); }
  put(bike, rbox(14, 12, 40, 4), mat(0xff2a2a, .3, 0, { emissive: 0xff1010, emissiveIntensity: 1.4 }), -222, 164, 0);
  const engine = put(bike, rbox(110, 46, 40, 12), mat(0x8c9198, .4, .7), -110, 62, -32);
  rod(bike, [-60, 50, -40], [-180, 64, -46], 9, mat(0x2b2d31, .35, .8));
  decal(bike, 52, -120, 140, 47.5); decal(bike, 52, -120, 140, -47.5, Math.PI);
  return { bike, F, R, engine, chain: engine, tank: engine };
}

function bike(C, style = 'naked') {
  return ({ naked, sport, enduro, scooter }[style] || naked)(C);
}

// ---------------------------------------------------------------- herramientas y repuestos
function comboWrench(len = 240) {           // llave combinada: boca abierta + estría de 12 puntas, cromada
  const s = new T.Shape(), w = 16, R = 26;
  s.moveTo(-len / 2 + R, -w / 2); s.lineTo(len / 2 - R, -w / 2);
  s.absarc(len / 2 - R + 12, 0, R, -Math.PI * .8, Math.PI * .8, false);
  s.lineTo(-len / 2 + R, w / 2); s.absarc(-len / 2 + R - 8, 0, R * .9, Math.PI * .25, Math.PI * 1.75, false);
  const ring = new T.Path(), cx = -len / 2 + R - 8;
  for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 12 : 14.5; i ? ring.lineTo(cx + Math.cos(a) * r, Math.sin(a) * r) : ring.moveTo(cx + r, 0); }
  s.holes.push(ring);
  const jaw = new T.Path(), jx = len / 2 - R + 12;
  jaw.moveTo(jx - 4, -11); jaw.lineTo(jx + 40, -15); jaw.lineTo(jx + 40, 15); jaw.lineTo(jx - 4, 11); jaw.closePath(); s.holes.push(jaw);
  const g = new T.ExtrudeGeometry(s, { depth: 6, bevelEnabled: true, bevelThickness: 2.5, bevelSize: 2, bevelSegments: 3, curveSegments: 32 });
  g.translate(0, 0, -3);
  const grp = new T.Group(); put(grp, g, chrome());
  put(grp, new T.BoxGeometry(len * .55, 6, 2), mat(0xaeb3b9, .3, 1), 0, 0, 5.5);                 // acanalado del mango
  const t = canvasTex(256, 32, (c, w, h) => { c.fillStyle = '#c9cdd2'; c.fillRect(0, 0, w, h); c.fillStyle = '#4a4e54'; c.font = 'bold 22px Montserrat';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DAYTONA 12mm', w / 2, h / 2 + 1); });
  put(grp, new T.PlaneGeometry(len * .45, 6), new T.MeshStandardMaterial({ map: t, roughness: .3, metalness: .6 }), 0, 0, 6.6);
  return grp;
}
function ratchet() {
  const g = new T.Group();
  put(g, lathe([[0, -110], [9, -110], [11, -100], [11, 40], [8, 60], [0, 60]], 24), mat(0x15161a, .5), 0, 0, 0, 0, 0, -Math.PI / 2);
  for (let i = 0; i < 8; i++) put(g, new T.TorusGeometry(11.5, 1.6, 6, 20), mat(0x0c0c0c, .7), -100 + i * 12, 0, 0, 0, Math.PI / 2, 0);
  put(g, rbox(90, 14, 12, 4), chrome(), 40, 0, 0);
  put(g, new T.CylinderGeometry(24, 24, 18, 32), chrome(), 92, 0, 0, Math.PI / 2);
  put(g, new T.CylinderGeometry(10, 10, 6, 6), mat(0x9aa0a8, .2, 1), 92, 0, 11, Math.PI / 2);
  put(g, rbox(14, 8, 6, 2), mat(0xC10608, .4), 92, 18, 9);
  return g;
}
function screwdriver(C) {
  const g = new T.Group();
  put(g, lathe([[0, 0], [16, 2], [18, 20], [17, 70], [19, 100], [14, 112], [8, 116], [0, 116]], 36), paint(C.brand));
  for (let i = 0; i < 8; i++) put(g, rbox(5, 60, 5, 2), mat(0x15161a, .6), Math.cos(i * .785) * 17.5, 50, Math.sin(i * .785) * 17.5);
  put(g, new T.CylinderGeometry(4, 4, 130, 12), chrome(), 0, 180, 0);
  put(g, new T.BoxGeometry(8, 14, 2), chrome(), 0, 250, 0);
  g.rotation.z = Math.PI / 2;
  return g;
}
function pliers(C) {
  const g = new T.Group(), steel = mat(0x8f959c, .3, 1), grip = paint(C.brand);
  for (const s of [1, -1]) {
    const arm = new T.Group(); arm.rotation.z = s * .12; g.add(arm);
    put(arm, rbox(150, 12, 10, 4), steel, -60, s * 10, 0, 0, 0, s * .06);
    put(arm, rbox(110, 18, 16, 7), grip, -96, s * 16, 0, 0, 0, s * .1);
    put(arm, rbox(60, 10, 10, 3), steel, 56, -s * 3, 0, 0, 0, -s * .08);
  }
  put(g, new T.CylinderGeometry(9, 9, 20, 16), mat(0xc9ced4, .2, 1), 20, 0, 0, Math.PI / 2);
  return g;
}
function sprayCan(C, text = ['LUBRICANTE', 'CADENA']) {
  const g = new T.Group();
  const label = canvasTex(2048, 512, (c, w, h) => { c.fillStyle = '#15161a'; c.fillRect(0, 0, w, h); c.fillStyle = TH.primary; c.fillRect(0, h * .7, w, h * .08);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'italic 900 64px Montserrat'; c.fillText(text[0], w / 2, 200); c.font = 'italic 800 48px Montserrat'; c.fillText(text[1], w / 2, 270);
    c.fillStyle = TH.primary; c.font = 'italic 900 34px Montserrat'; c.fillText('DAYTONA MOTO SPORT', w / 2, 420); });
  const body = new T.CylinderGeometry(34, 34, 170, 40, 1, true);
  put(g, body, new T.MeshStandardMaterial({ map: label, roughness: .35, metalness: .3 }), 0, 85, 0, 0, -Math.PI / 2, 0);
  put(g, lathe([[0, 170], [34, 170], [30, 186], [16, 198], [12, 202], [0, 202]], 40), chrome());
  put(g, lathe([[0, 0], [34, 0], [34, 2], [0, 6]], 40), chrome());
  put(g, new T.CylinderGeometry(10, 12, 16, 20), mat(0xf2f2f0, .4), 0, 210, 0);
  put(g, new T.CylinderGeometry(2.5, 2.5, 26, 8), mat(0xC10608, .4), 12, 214, 0, 0, 0, Math.PI / 2);
  return g;
}
function oilFilter(C) {
  const g = new T.Group();
  const lab = canvasTex(2048, 256, (c, w, h) => { c.fillStyle = TH.primary; c.fillRect(0, 0, w, h); c.fillStyle = '#15161a'; c.fillRect(0, h * .78, w, h * .22);
    c.fillStyle = '#fff'; c.font = 'italic 900 64px Montserrat'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FILTRO', w / 2, h * .32); c.font = 'italic 800 40px Montserrat'; c.fillText('DE ACEITE', w / 2, h * .6); });
  put(g, new T.CylinderGeometry(46, 46, 110, 48, 1, true), new T.MeshStandardMaterial({ map: lab, roughness: .35, metalness: .2 }), 0, 55, 0, 0, -Math.PI / 2, 0);
  put(g, lathe([[0, 110], [46, 110], [44, 118], [30, 122], [0, 122]], 48), paint(0x15161a));
  put(g, new T.CylinderGeometry(16, 16, 12, 6), paint(0x15161a), 0, 128, 0);
  put(g, lathe([[0, -4], [46, -4], [46, 0], [0, 0]], 48), mat(0x8c9198, .3, .9));
  return g;
}
function gauge(C) {
  const g = new T.Group();
  put(g, lathe([[0, -18], [66, -18], [72, -10], [72, 14], [66, 18], [0, 18]], 56), paint(0x15161a), 0, 0, 0, Math.PI / 2);
  const face = canvasTex(512, 512, (c, w) => {
    c.fillStyle = '#f6f5f0'; c.beginPath(); c.arc(256, 256, 250, 0, 7); c.fill();
    c.lineWidth = 26; c.strokeStyle = '#C10608'; c.beginPath(); c.arc(256, 256, 205, Math.PI * .75, Math.PI * 1.1); c.stroke();
    c.strokeStyle = '#3DBE6A'; c.beginPath(); c.arc(256, 256, 205, Math.PI * 1.35, Math.PI * 1.7); c.stroke();
    c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i <= 50; i++) { const a = Math.PI * (.75 + 1.5 * i / 50), L = i % 5 ? 14 : 30; c.lineWidth = i % 5 ? 3 : 6; c.strokeStyle = '#111';
      c.beginPath(); c.moveTo(256 + Math.cos(a) * 230, 256 + Math.sin(a) * 230); c.lineTo(256 + Math.cos(a) * (230 - L), 256 + Math.sin(a) * (230 - L)); c.stroke();
      if (i % 10 === 0) { c.font = '800 34px Montserrat'; c.fillText(String(i), 256 + Math.cos(a) * 160, 256 + Math.sin(a) * 160); } }
    c.font = '900 40px Montserrat'; c.fillText('PSI', 256, 360); c.font = 'italic 800 26px Montserrat'; c.fillStyle = '#C10608'; c.fillText('DAYTONA', 256, 405);
  });
  put(g, new T.CircleGeometry(64, 56), new T.MeshStandardMaterial({ map: face, roughness: .35 }), 0, 0, 18.6);
  put(g, new T.TorusGeometry(67, 5, 12, 56), chrome(), 0, 0, 19);
  put(g, new T.CircleGeometry(64, 56), new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .1, roughness: 0, clearcoat: 1 }), 0, 0, 23.5);
  const needle = new T.Group(); needle.position.z = 21; g.add(needle);
  put(needle, rbox(5, 56, 2.5, 1), mat(0xC10608, .4), 0, 22, 0);
  put(g, new T.CylinderGeometry(7, 7, 6, 16), mat(0x111111, .4), 0, 0, 22, Math.PI / 2);
  const hose = new T.CatmullRomCurve3([[0, -70, 0], [0, -130, 10], [40, -200, 30], [120, -230, 30]].map(p => new T.Vector3(...p)));
  put(g, new T.TubeGeometry(hose, 40, 8, 10), mat(0x15161a, .6));
  put(g, lathe([[0, 0], [12, 0], [12, 30], [8, 40], [0, 40]], 24), chrome(), 120, -230, 30, 0, 0, -Math.PI / 2);
  put(g, new T.CylinderGeometry(12, 12, 16, 16), chrome(), 0, -76, 0);
  g.userData.needle = needle;
  return g;
}
function battery(C) {
  const g = new T.Group();
  put(g, rbox(170, 120, 96, 8), mat(0x1b1c20, .55));
  put(g, rbox(176, 14, 102, 5), mat(0x2a2b30, .5), 0, 64, 0);
  const lab = canvasTex(512, 256, (c, w, h) => { c.fillStyle = '#F5B427'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.textAlign = 'center';
    c.font = 'italic 900 110px Montserrat'; c.fillText('12V', w / 2, 120); c.font = 'italic 800 40px Montserrat'; c.fillText('9 Ah · 135 CCA', w / 2, 190); });
  put(g, new T.PlaneGeometry(130, 64), new T.MeshStandardMaterial({ map: lab, roughness: .5 }), 0, -6, 48.5);
  for (const [x, c] of [[-56, C.brand], [56, 0x111111]]) { put(g, new T.CylinderGeometry(11, 12, 16, 20), mat(0xb08d57, .3, .9), x, 79, 0); put(g, rbox(26, 12, 26, 4), mat(c, .4), x, 92, 0);
    put(g, new T.CylinderGeometry(5, 5, 8, 6), chrome(), x, 100, 0); }
  for (let i = 0; i < 4; i++) put(g, new T.CylinderGeometry(7, 7, 4, 16), mat(0x3a3b40, .5), -24 + i * 16, 72, -20);
  put(g, new T.TorusGeometry(40, 4, 8, 24, Math.PI), mat(0x111111, .5), 0, 72, 30, 0, 0, 0);
  return g;
}
function sparkPlug() {
  const g = new T.Group();
  const ins = [[0, 60], [11, 60], [13, 66], [13, 74]];
  for (let i = 0; i < 5; i++) ins.push([15, 78 + i * 12], [12.5, 84 + i * 12]);
  ins.push([12, 140], [8, 146], [0, 146]);
  put(g, lathe(ins, 40), mat(0xf4f2ec, .18));
  put(g, new T.CylinderGeometry(21, 21, 20, 6), chrome(), 0, 46, 0);
  put(g, lathe([[0, 34], [18, 34], [18, 38], [0, 38]], 40), mat(0xb08d57, .3, .9));
  const th = []; for (let i = 0; i < 12; i++) th.push([11, 30 - i * 3], [9.6, 28.5 - i * 3]);
  put(g, lathe([[0, 30], ...th, [0, -6]], 40), mat(0xb0b4ba, .3, 1));
  put(g, new T.CylinderGeometry(2.4, 2.4, 10, 8), mat(0xd0d4da, .3, 1), 0, -10, 0);
  put(g, new T.BoxGeometry(4, 4, 12), mat(0x8a8f96, .3, 1), 5, -16, 0); put(g, new T.BoxGeometry(4, 12, 4), mat(0x8a8f96, .3, 1), 9, -10, 0);
  put(g, lathe([[0, 146], [7, 146], [7, 156], [9, 158], [9, 166], [0, 168]], 24), chrome());
  return g;
}
function brakeSet(C, worn = 0) {            // disco ondulado perforado + pinza de 2 pistones con pastillas
  const g = new T.Group();
  const s = new T.Shape(), n = 14;
  for (let i = 0; i <= n * 8; i++) { const a = i / (n * 8) * Math.PI * 2, r = 124 + 7 * Math.cos(a * n); i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); }
  const hub = new T.Path(); hub.absarc(0, 0, 70, 0, Math.PI * 2, true); s.holes.push(hub);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = 98 + (i % 2) * 10, h = new T.Path(); h.absarc(Math.cos(a) * r, Math.sin(a) * r, 4.5, 0, Math.PI * 2, true); s.holes.push(h); }
  const disc = put(g, new T.ExtrudeGeometry(s, { depth: 6, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2, curveSegments: 12 }), mat(0xdfe3e8, .22, .9));
  const car = new T.Shape(); car.absarc(0, 0, 74, 0, Math.PI * 2);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .3, h = new T.Path(); h.absellipse(Math.cos(a) * 46, Math.sin(a) * 46, 14, 9, 0, Math.PI * 2, true, a); car.holes.push(h); }
  const c0 = new T.Path(); c0.absarc(0, 0, 22, 0, Math.PI * 2, true); car.holes.push(c0);
  put(g, new T.ExtrudeGeometry(car, { depth: 8, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2 }), paint(C.brand), 0, 0, 2);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; put(g, new T.CylinderGeometry(6, 6, 10, 6), chrome(), Math.cos(a) * 64, Math.sin(a) * 64, 8, Math.PI / 2); }
  const cal = new T.Group(); cal.position.set(0, 118, 3); g.add(cal);
  put(cal, profile([[-62, -16], [-50, 26], [0, 38], [50, 26], [62, -16], [0, -6]], 64, 8), mat(0xf5b427, .32));
  for (const x of [-26, 26]) put(cal, new T.CylinderGeometry(15, 15, 6, 24), mat(0x9aa0a8, .3, 1), x, 10, 33, Math.PI / 2);
  const lab = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#F5B427'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.font = 'italic 900 40px Montserrat';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DAYTONA', w / 2, h / 2 + 2); });
  put(cal, new T.PlaneGeometry(80, 18), new T.MeshStandardMaterial({ map: lab, roughness: .4 }), 0, 16, 32.5);
  for (const x of [-44, 44]) put(cal, new T.CylinderGeometry(6, 6, 70, 6), chrome(), x, 30, 0, Math.PI / 2);
  const pad = put(cal, rbox(96, 30, 10 * (1 - .75 * worn) + 3, 3), mat(0x3b3226, .9), 0, -14, 12);
  put(cal, rbox(100, 34, 3, 1), mat(0x777b80, .4, .9), 0, -14, 18);
  return { g, disc, pad };
}
function oilBottle(C, text = ['ACEITE', '10W-40 · 4T']) {
  const g = new T.Group();
  const body = profile([[-46, 0], [46, 0], [48, 120], [36, 150], [10, 158], [-30, 156], [-48, 140]], 64, 10, [[[-36, 118], [-12, 124], [-14, 146], [-34, 142]]]);
  put(g, body, mat(0x16171b, .35));
  const lab = canvasTex(256, 256, (c, w, h) => { c.fillStyle = TH.primary; c.fillRect(0, 0, w, h); c.fillStyle = '#15161a'; c.fillRect(0, h * .72, w, h * .28);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'italic 900 58px Montserrat'; c.fillText(text[0], w / 2, 92); c.font = 'italic 800 30px Montserrat'; c.fillText(text[1], w / 2, 146);
    c.font = '800 26px Montserrat'; c.fillText('1 L', w / 2, 222); });
  put(g, new T.PlaneGeometry(78, 92), new T.MeshStandardMaterial({ map: lab, roughness: .45 }), 0, 56, 32.5);
  put(g, lathe([[0, 0], [15, 0], [15, 20], [13, 24], [0, 24]], 32), mat(0xf5b427, .4), 18, 156, 0);
  for (let i = 0; i < 18; i++) put(g, new T.BoxGeometry(2, 18, 2), mat(0xd99a1a, .5), 18 + Math.cos(i * .349) * 15, 168, Math.sin(i * .349) * 15);
  return g;
}
function helmet(C, color) {
  const g = new T.Group(), shell = paint(color ?? C.brand), black = paint(0x15161a);
  const sh = put(g, new T.SphereGeometry(100, 48, 32), shell); sh.scale.set(1, .95, 1.12);
  put(g, new T.SphereGeometry(100.5, 48, 32, 0, Math.PI * 2, 1.9, .5), black).scale.set(1, .95, 1.12);          // borde inferior
  const visor = put(g, new T.SphereGeometry(103, 40, 20, Math.PI / 2 - .9, 1.8, 1.12, .66),
    new T.MeshPhysicalMaterial({ color: 0x14181f, roughness: .03, metalness: .4, clearcoat: 1, side: T.DoubleSide })); visor.scale.set(1, .95, 1.12);
  for (const s of [1, -1]) put(g, new T.CylinderGeometry(12, 12, 6, 20), black, s * 98, 0, 18, 0, 0, Math.PI / 2);
  for (const dx of [-14, 14]) { const st = put(g, new T.TorusGeometry(101, 4, 8, 64, Math.PI * .9), paint(0xffffff), dx, 0, 0, 0, Math.PI / 2, .12); st.scale.set(1, .95, 1.12); }
  put(g, profile([[-30, 0], [30, 0], [22, 14], [-22, 14]], 8, 2), black, 0, 34, 96, -1.2);                     // ventila de mentón
  put(g, profile([[-60, 0], [60, 0], [40, 18], [-40, 18]], 30, 6), black, 0, 70, -82, .6);                       // alerón
  decal(g, 60, -103, 16, -10, -Math.PI / 2);                                                                  // logo en el costado
  return g;
}
function tire(R = 70, r = 22) {
  const g = new T.Group(), rub = mat(0x161616, .9);
  put(g, new T.TorusGeometry(R, r, 20, 64), rub);
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2;                                                   // dibujo en V
    for (const s of [1, -1]) { const m = put(g, new T.BoxGeometry(3, 2, r * .9), mat(0x0a0a0a, .95), Math.cos(a) * (R + r * .98), Math.sin(a) * (R + r * .98), s * r * .35, 0, 0, a + Math.PI / 2); m.rotation.y = s * .5; } }
  const side = canvasTex(1024, 1024, (c, w) => { c.clearRect(0, 0, w, w); c.translate(w / 2, w / 2); c.fillStyle = '#d8d8d4'; c.font = '800 54px Montserrat';
    const txt = '120/70 ZR17 · DAYTONA · TUBELESS · '; let ang = 0; for (const ch of txt + txt) { c.save(); c.rotate(ang); c.fillText(ch, 0, -430); c.restore(); ang += .062; } });
  for (const s of [1, -1]) put(g, new T.RingGeometry(R - r * .2, R + r * .9, 64), new T.MeshStandardMaterial({ map: side, transparent: true, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0, s * (r * .62), 0, s > 0 ? 0 : Math.PI, 0);
  put(g, new T.CylinderGeometry(R - r * .7, R - r * .7, 14, 48), mat(0x3a3e45, .35, .85), 0, 0, 0, Math.PI / 2);
  return g;
}

function upright(o, rz = Math.PI / 2) { const g = new T.Group(); o.rotation.z += rz; g.add(o); return g; }   // herramienta plana, de pie para la vitrina

// ---------------------------------------------------------------- reemplazar en el kit y en la vitrina
Object.assign(K, { bike, naked, sport, enduro, scooter, helmet, tire, oilBottle, wrench: comboWrench, comboWrench, ratchet, screwdriver, pliers,
                   sprayCan, oilFilter, gauge, battery, sparkPlug, brakeSet, profile, lathe, decal, canvasTex });
Object.assign(K.ITEMS, {
  naked: C => naked(C).bike, sport: C => sport(C).bike, enduro: C => enduro(C).bike, scooter: C => scooter(C).bike,
  helmet: C => helmet(C), tire: () => tire(), oil: C => oilBottle(C), wrench: () => upright(comboWrench()), ratchet: () => upright(ratchet()),
  screwdriver: C => upright(screwdriver(C), -Math.PI / 2), pliers: C => upright(pliers(C)), spray: C => sprayCan(C), filter: C => oilFilter(C),
  gauge: C => gauge(C), battery: C => battery(C), spark_plug: () => sparkPlug(), brakes: C => brakeSet(C).g,
});
