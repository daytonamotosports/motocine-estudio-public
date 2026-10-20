// Motos "casi reales" en estilo animado: proporciones de moto de verdad (medidas en milímetros) y
// piezas reconocibles. Se modela en mm y el grupo se escala a la unidad del kit (rueda de ~77).
//   x hacia adelante (rueda delantera en +x), y hacia arriba, z hacia el lado IZQUIERDO de la moto
//   (cadena y palanca de cambios en +z; escape y freno trasero en -z).
// Estilos: naked y sport (carenada). Devuelven lo mismo que kit3d: { bike, F, R, engine, chain, tank }.
const MC = window.MC;
const { T } = MC.three;
const K = MC.kit;
const { rbox, mat, paint, put, rod, profile, lathe, decal, canvasTex } = K;

const S = .258;                                   // mm → unidades del kit
const AX = { f: [680, 300], r: [-680, 300] };     // ejes (distancia entre ejes 1360 mm, rueda de 600 mm)
const HEAD = [430, 840];                          // pipa de dirección (lanzamiento ~25°)

// ---------------------------------------------------------------- materiales
// texturas de relieve (mapas de normales) hechas en el momento: labrado de llanta y escamas de pintura metalizada
const RELIEF = {};
function normalFromHeight(hc, strength = 2) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data, out = document.createElement('canvas');
  out.width = w; out.height = h; const og = out.getContext('2d'), img = og.createImageData(w, h), H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    img.data[i] = (-dx / l * .5 + .5) * 255; img.data[i + 1] = (dy / l * .5 + .5) * 255; img.data[i + 2] = (1 / l * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  og.putImageData(img, 0, 0); const t = new T.CanvasTexture(out); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.NoColorSpace; return t;
}
function treadMap() {                                  // labrado: canales en V en la banda de rodadura y estrías en el costado
  if (RELIEF.tread) return RELIEF.tread;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 256);
  g.strokeStyle = '#000'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(8, 92); g.lineTo(40, 124); g.moveTo(24, 132); g.lineTo(56, 164); g.stroke();       // canales inclinados
  g.lineWidth = 2; g.strokeStyle = '#777'; for (let y = 20; y < 70; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  for (let y = 190; y < 240; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
  return (RELIEF.tread = normalFromHeight(c, 3));
}
function flakeMap() {                                  // escamas de la pintura metalizada (ruido fino)
  if (RELIEF.flake) return RELIEF.flake;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), d = g.createImageData(128, 128);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < d.data.length; i += 4) { const v = 110 + rnd() * 70; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return (RELIEF.flake = normalFromHeight(c, .8));
}

function mats(C) {
  return {
    paint: paint(C.brand), black: paint(0x141519), white: paint(0xf2f2f0), gloss: new T.MeshPhysicalMaterial({ color: 0x0e0f12, roughness: .2, metalness: .3, clearcoat: 1 }),
    alu: mat(0xb9bec5, .32, 1), aluDark: mat(0x5d6168, .4, .9), chrome: mat(0xe6e9ee, .1, 1), gold: mat(0xd9a43a, .28, .95),
    steel: mat(0x8f959c, .3, 1), plastic: mat(0x1b1c20, .55), rubber: mat(0x121212, .9), seat: mat(0x1a1a1c, .85),
    hose: mat(0x0d0d0f, .55), tire: (() => { const m = mat(0x141414, .86); m.normalMap = treadMap().clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(54, 1); m.normalScale.set(1.2, 1.2); return m; })(), led: mat(0xffffff, .1, 0, { emissive: 0xeaf4ff, emissiveIntensity: 2.2 }),
    tail: mat(0xff2020, .2, 0, { emissive: 0xff1010, emissiveIntensity: 1.8 }), amber: mat(0xffa21a, .2, 0, { emissive: 0xff8a00, emissiveIntensity: 1.2 }),
    screen: mat(0x08131f, .15, 0, { emissive: 0x2a9dff, emissiveIntensity: 1 }), caliper: mat(0xf2b01e, .3, .3), fin: mat(0x2a2c31, .4, .8),
  };
}
const V = (x, y, z = 0) => new T.Vector3(x, y, z);
function tube(parent, pts, r, m, seg = 48, closed = false) {
  return put(parent, new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => V(...p)), closed), seg, r, 10, closed), m);
}
function along(parent, a, b, geo, m) {            // coloca una geometría (eje y) entre dos puntos
  const A = V(...a), B = V(...b), d = B.clone().sub(A), o = new T.Mesh(geo, m);
  o.position.copy(A).add(B).multiplyScalar(.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); parent.add(o); return o;
}
const cyl = (r, h, s = 24, r2) => new T.CylinderGeometry(r, r2 ?? r, h, s);
const zAxis = g => { g.rotateX(Math.PI / 2); return g; };

// ---------------------------------------------------------------- ruedas
function tireGeo(R = 300, W = 70) {               // perfil de llanta real (costado redondeado), girado alrededor del eje
  const p = [[R - 82, -W * .8], [R - 60, -W * .98], [R - 28, -W * .92], [R - 8, -W * .62], [R, 0], [R - 8, W * .62], [R - 28, W * .92], [R - 60, W * .98], [R - 82, W * .8]];
  return zAxis(lathe(p, 72));
}
function rimSpokes(parent, Rr, m, n = 3) {        // radios dobles curvos tipo deportiva
  for (let i = 0; i < n * 2; i++) {
    const a0 = i / (n * 2) * Math.PI * 2 + (i % 2 ? .1 : -.1), s = new T.Shape();
    s.moveTo(-9, 40); s.quadraticCurveTo(6, Rr * .55, -4, Rr - 6); s.lineTo(10, Rr - 6); s.quadraticCurveTo(20, Rr * .55, 9, 40); s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth: 16, bevelEnabled: true, bevelThickness: 4, bevelSize: 3, bevelSegments: 3, curveSegments: 16 });
    g.translate(0, 0, -8); g.rotateZ(a0); put(parent, g, m);
  }
}
function waveDisc(R, m) {
  const s = new T.Shape(), n = Math.round(R / 11);
  for (let i = 0; i <= n * 8; i++) { const a = i / (n * 8) * Math.PI * 2, r = R + R * .045 * Math.cos(a * n); i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); }
  const hub = new T.Path(); hub.absarc(0, 0, R * .62, 0, Math.PI * 2, true); s.holes.push(hub);
  for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2, r = R * (.76 + (i % 3) * .07), h = new T.Path(); h.absarc(Math.cos(a) * r, Math.sin(a) * r, R * .028, 0, Math.PI * 2, true); s.holes.push(h); }
  const g = new T.ExtrudeGeometry(s, { depth: 5, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -2.5); return new T.Mesh(g, m);
}
function carrier(parent, R, z, m, bolt) {          // estrella del disco (flotante) con remaches
  const s = new T.Shape(); s.absarc(0, 0, R, 0, Math.PI * 2);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, h = new T.Path(); h.absellipse(Math.cos(a) * R * .6, Math.sin(a) * R * .6, R * .2, R * .12, 0, Math.PI * 2, true, a); s.holes.push(h); }
  const c = new T.Path(); c.absarc(0, 0, R * .3, 0, Math.PI * 2, true); s.holes.push(c);
  const g = new T.ExtrudeGeometry(s, { depth: 6, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2 }); g.translate(0, 0, z - 3);
  put(parent, g, m);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; put(parent, zAxis(cyl(5, 9, 10)), bolt, Math.cos(a) * (R + 6), Math.sin(a) * (R + 6), z); }
}
function radialCaliper(M, side = 1, label = 'DAYTONA') {   // pinza radial de 4 pistones; side = lado hacia afuera (+1 izq., -1 der.)
  const g = new T.Group();
  const body = profile([[-70, -30], [-58, 28], [-20, 40], [20, 40], [58, 28], [70, -30], [40, -36], [-40, -36]], 64, 12);
  put(g, body, M.caliper);
  for (const x of [-30, 30]) { put(g, zAxis(cyl(17, 6, 28)), M.alu, x, 4, side * 33); put(g, zAxis(cyl(9, 7, 6)), M.steel, x, 4, side * 36); }
  const lab = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#f2b01e'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.font = 'italic 900 42px Montserrat';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, w / 2, h / 2 + 2); });
  put(g, new T.PlaneGeometry(90, 20), new T.MeshStandardMaterial({ map: lab, roughness: .4, polygonOffset: true, polygonOffsetFactor: -2 }), 0, -18, side * 32.6, 0, side > 0 ? 0 : Math.PI, 0);
  for (const x of [-56, 56]) put(g, cyl(8, 80, 6), M.steel, x, -6, 0, Math.PI / 2);
  put(g, zAxis(cyl(9, 20, 12)), M.chrome, 0, 42, side * 18);                // banjo
  return g;
}
function wheel(M, C, front) {
  const w = new T.Group(), parts = {};
  put(w, tireGeo(300, front ? 60 : 85), M.rubber);
  const tread = mat(0x050505, .95);
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2;
    for (const s of [1, -1]) { const m = put(w, new T.BoxGeometry(5, 3, 28), tread, Math.cos(a) * 298.6, Math.sin(a) * 298.6, s * 18, 0, 0, a + Math.PI / 2); m.rotation.y = s * .55; } }
  put(w, zAxis(lathe([[212, -50], [222, -56], [226, -46], [214, -38], [214, 38], [226, 46], [222, 56], [212, 50]], 72)), M.paint);    // aro del rin
  rimSpokes(w, 214, M.paint);
  put(w, zAxis(cyl(44, 120, 32)), M.aluDark);
  put(w, zAxis(cyl(16, 150, 16)), M.steel);
  if (front) {
    for (const z of [78, -78]) { const d = waveDisc(160, z > 0 ? M.alu.clone() : M.alu); d.position.z = z; w.add(d); if (z > 0) parts.disc = d; carrier(w, 95, z, M.aluDark, M.gold); }
  } else {
    const d = waveDisc(115, M.alu); d.position.z = -72; w.add(d); carrier(w, 70, -72, M.aluDark, M.gold); parts.rdisc = d;
    const sp = new T.Shape(), n = 45;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + .5) / n * Math.PI * 2; i ? sp.lineTo(Math.cos(a) * 112, Math.sin(a) * 112) : sp.moveTo(112, 0);
      sp.lineTo(Math.cos(a + .03) * 124, Math.sin(a + .03) * 124); sp.lineTo(Math.cos(b - .02) * 124, Math.sin(b - .02) * 124); sp.lineTo(Math.cos(b) * 112, Math.sin(b) * 112); }
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, h = new T.Path(); h.absarc(Math.cos(a) * 70, Math.sin(a) * 70, 22, 0, Math.PI * 2, true); sp.holes.push(h); }
    const cc = new T.Path(); cc.absarc(0, 0, 32, 0, Math.PI * 2, true); sp.holes.push(cc);
    const sg = new T.ExtrudeGeometry(sp, { depth: 6, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 1 }); sg.translate(0, 0, 117);
    parts.sprocket = put(w, sg, M.aluDark.clone());
    put(w, zAxis(cyl(40, 60, 24)), M.aluDark, 0, 0, 90);
  }
  return { w, parts };
}

// ---------------------------------------------------------------- chasis común
function chassis(C, M, style) {
  const bike = new T.Group();
  const F = wheel(M, C, true), R = wheel(M, C, false);
  F.w.position.set(...AX.f, 0); R.w.position.set(...AX.r, 0); bike.add(F.w, R.w);
  // horquilla invertida: barras superiores negras gruesas, barras inferiores doradas, punteras de aluminio
  const fa = V(...AX.f), hd = V(...HEAD), dir = hd.clone().sub(fa).normalize();
  const at = k => fa.clone().add(dir.clone().multiplyScalar(k));
  for (const z of [105, -105]) {
    const p0 = at(40), p1 = at(330), p2 = at(640);
    along(bike, [p0.x, p0.y, z], [p1.x, p1.y, z], cyl(24, 1, 24), M.gold).scale.y = p0.distanceTo(p1);
    along(bike, [at(300).x, at(300).y, z], [p2.x, p2.y, z], cyl(31, 1, 28), M.black).scale.y = at(300).distanceTo(p2);
    put(bike, zAxis(cyl(30, 46, 20)), M.alu, fa.x, fa.y, z);                                           // puntera
    along(bike, [at(30).x, at(30).y, z], [at(110).x, at(110).y, z], cyl(30, 80, 20), M.alu);
    put(bike, cyl(20, 18, 20), M.gold, p2.x, p2.y + 16, z);                                           // tapón con ajuste
  }
  for (const [k, h] of [[470, 24], [640, 30]]) { const p = at(k); put(bike, rbox(110, h, 260, 10), M.aluDark, p.x, p.y, 0, 0, 0, Math.atan2(dir.x, dir.y)); }   // tijas
  // pinzas radiales sobre los discos + mangueras con banjo
  const calF = [];
  for (const z of [78, -78]) {
    const cal = radialCaliper(M, z > 0 ? 1 : -1); const ang = 2.6;
    cal.position.set(AX.f[0] + Math.cos(ang) * 150, AX.f[1] + Math.sin(ang) * 150, z); cal.rotation.z = ang - Math.PI / 2;
    bike.add(cal); calF.push(cal);
  }
  F.parts.caliper = calF[0].children[0];
  const top = at(650);
  for (const z of [1, -1]) tube(bike, [[top.x - 30, top.y + 140, z * 300], [top.x + 20, top.y + 60, z * 200], [at(380).x + 40, at(380).y, z * 130], [AX.f[0] - 100, AX.f[1] + 140, z * 95]], 6, M.hose);
  // trasero: pinza bajo el disco derecho
  const rc = radialCaliper(M, -1); rc.scale.setScalar(.78); rc.position.set(AX.r[0] + 40, AX.r[1] - 108, -72); rc.rotation.z = Math.PI + .3; bike.add(rc);
  // chasis multitubular (color de marca) y subchasis
  const N = { h1: [HEAD[0] - 20, HEAD[1] + 10], h2: [HEAD[0] - 50, HEAD[1] - 120], a: [240, 760], b: [60, 720], piv: [-40, 500], e1: [250, 560], e2: [120, 600] };
  for (const z of [110, -110]) {
    for (const [p, q] of [['h1', 'a'], ['h2', 'e1'], ['a', 'b'], ['b', 'piv'], ['h2', 'a'], ['a', 'e1'], ['e1', 'e2'], ['e2', 'b'], ['e2', 'piv']])
      along(bike, [...N[p], z * (p.startsWith('h') ? .55 : 1)], [...N[q], z], cyl(14, 1, 14), M.paint).scale.y = V(...N[p]).distanceTo(V(...N[q]));
    for (const p of Object.values(N)) put(bike, new T.SphereGeometry(18, 14, 10), M.paint, p[0], p[1], z * (p === N.h1 || p === N.h2 ? .55 : 1));
    along(bike, [60, 720, z * .9], [-560, 880, z * .55], cyl(12, 1, 12), M.black).scale.y = 640;   // subchasis
    along(bike, [-40, 520, z * .9], [-480, 840, z * .55], cyl(10, 1, 12), M.black).scale.y = 540;
  }
  along(bike, HEAD.concat([0]), [HEAD[0] - 60, HEAD[1] - 140, 0], cyl(36, 1, 24), M.paint).scale.y = 152;    // pipa
  // basculante de aluminio fundido con tensores de cadena
  for (const z of [140, -140]) {
    const arm = profile([[0, -50], [-40, -40], [-560, -26], [-640, -20], [-650, 22], [-560, 28], [-40, 46], [0, 54]], 36, 10);
    put(bike, arm, M.alu, -40, 480, z * 1.07, 0, 0, Math.atan2(480 - AX.r[1], -40 - AX.r[0]));
    put(bike, rbox(40, 34, 12, 4), M.aluDark, AX.r[0] + 40, AX.r[1] + 4, z * 1.12);
  }
  put(bike, zAxis(cyl(26, 320, 20)), M.aluDark, -40, 480, 0);                                     // eje del basculante
  put(bike, rbox(160, 40, 300, 12), M.alu, -200, 440, 0, 0, 0, .25);                               // puente
  // monoamortiguador lateral con resorte (hélice) y botella
  const sA = V(-300, 410, 70), sB = V(-70, 730, 70), sd = sB.clone().sub(sA), sl = sd.length(), sn = sd.clone().normalize();
  along(bike, [sA.x, sA.y, 70], [sB.x, sB.y, 70], cyl(16, 1, 16), M.chrome).scale.y = sl;
  along(bike, [sA.clone().add(sn.clone().multiplyScalar(sl * .45)).x, sA.clone().add(sn.clone().multiplyScalar(sl * .45)).y, 70], [sB.x, sB.y, 70], cyl(26, 1, 20), M.gold).scale.y = sl * .55;
  const hel = [], turns = 7;
  for (let i = 0; i <= turns * 24; i++) { const u = i / (turns * 24), a = u * turns * Math.PI * 2, c = sA.clone().add(sn.clone().multiplyScalar(30 + u * (sl - 90)));
    const px = V(-sn.y, sn.x, 0).multiplyScalar(Math.cos(a) * 38), pz = Math.sin(a) * 38; hel.push([c.x + px.x, c.y + px.y, 70 + pz]); }
  tube(bike, hel, 6, M.paint, 400);
  put(bike, zAxis(cyl(30, 110, 20)), M.gold, sB.x + 40, sB.y - 30, 150);                           // botella
  // estribos piloto y pasajero con soportes, talonera, pedal de freno (der.) y palanca de cambios (izq.)
  for (const z of [1, -1]) {
    put(bike, profile([[0, 0], [70, 40], [60, 130], [10, 150], [-30, 100], [-20, 20]], 14, 4), M.alu, -150, 300, z * 160);
    const peg = new T.Group(); peg.position.set(-110, 370, z * 205); bike.add(peg);
    put(peg, zAxis(cyl(16, 90, 16)), M.aluDark);
    for (let i = 0; i < 6; i++) put(peg, zAxis(cyl(18, 6, 16)), M.steel, 0, 0, -36 + i * 14);
    put(bike, profile([[0, 0], [60, 20], [50, 90], [0, 80]], 10, 3), M.aluDark, -380, 420, z * 170);
    put(bike, zAxis(cyl(12, 70, 12)), M.rubber, -350, 470, z * 205);
    tube(bike, z > 0 ? [[-90, 380, 190], [-10, 360, 200], [60, 380, 196]] : [[-90, 380, -190], [-10, 352, -200], [70, 352, -200]], 8, M.aluDark, 20);
    put(bike, zAxis(cyl(9, 40, 10)), M.rubber, z > 0 ? 60 : 70, z > 0 ? 380 : 352, z * 210);
  }
  // pata lateral
  tube(bike, [[-60, 360, 130], [-40, 200, 190], [-20, 40, 230]], 10, M.aluDark, 16);
  return { bike, F, R, calF };
}

// ---------------------------------------------------------------- motor bicilíndrico en paralelo
function engine(bike, M, C) {
  const g = new T.Group(); bike.add(g);
  const cc = put(g, profile([[-120, 330], [180, 320], [290, 380], [300, 470], [220, 540], [40, 560], [-120, 520], [-150, 420]], 300, 34), M.aluDark.clone());
  // cilindros inclinados con aletas, culata y tapa de válvulas
  const cyl0 = new T.Group(); cyl0.position.set(200, 540, 0); cyl0.rotation.z = -.42; g.add(cyl0);
  put(cyl0, rbox(170, 120, 250, 26), M.aluDark, 0, 40, 0);
  for (let i = 0; i < 6; i++) put(cyl0, rbox(196, 8, 270, 4), M.fin, 0, 12 + i * 18, 0);
  put(cyl0, rbox(186, 70, 262, 26), M.alu, 0, 140, 0);
  put(cyl0, rbox(176, 46, 240, 22), M.paint, 0, 190, 0);
  for (const z of [-80, 0, 80]) put(cyl0, cyl(9, 8, 6), M.chrome, -60, 214, z);
  for (const z of [-50, 50]) { put(cyl0, cyl(16, 30, 16), M.rubber, 70, 222, z); }                  // pipetas de bujía
  // tapas laterales: embrague (der.), alternador (izq.), piñón (izq.) con tornillos y visor de aceite
  const cover = (x, y, z, r, m) => { put(g, zAxis(lathe([[0, 0], [r, 0], [r, 14], [r - 10, 26], [0, 30]], 48)), m, x, y, z * (155 - 2)).scale.z = z;
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; put(g, zAxis(cyl(6, 8, 6)), M.chrome, x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10), z * 186); } };
  cover(110, 430, -1, 105, M.alu); cover(-40, 440, 1, 90, M.alu);
  put(g, profile([[0, 0], [70, 10], [80, 70], [10, 80]], 20, 6), M.black, 10, 380, 160);
  put(g, zAxis(cyl(20, 6, 24)), mat(0xf5b427, .2, 0, { transparent: true, opacity: .85 }), 160, 360, -158);
  put(g, cyl(16, 26, 16), M.paint, 250, 556, -100);                                                // tapón de aceite
  // radiador con rejilla y mangueras
  const rad = new T.Group(); rad.position.set(360, 640, 0); rad.rotation.z = -.32; bike.add(rad);
  put(rad, rbox(40, 280, 380, 10), M.black);
  const grille = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#121316'; c.fillRect(0, 0, w, h); c.fillStyle = '#3b3e45'; for (let y = 0; y < h; y += 8) c.fillRect(0, y, w, 3); });
  put(rad, new T.PlaneGeometry(330, 240), new T.MeshStandardMaterial({ map: grille, roughness: .6, metalness: .5 }), 21, 0, 0, 0, Math.PI / 2, 0);
  tube(bike, [[330, 520, 120], [300, 470, 150], [240, 450, 150]], 12, M.hose, 20); tube(bike, [[380, 760, -120], [330, 720, -150], [260, 700, -120]], 12, M.hose, 20);
  // escape: colectores, catalizador bajo el motor y silenciador lateral
  for (const z of [-60, 60]) tube(bike, [[320, 600, z], [400, 480, z * .9], [360, 300, z * .6], [180, 230, z * .3], [20, 240, -60]], 20, M.chrome, 60);
  put(bike, rbox(260, 110, 220, 40), M.aluDark, 40, 250, -20);
  tube(bike, [[-60, 260, -110], [-200, 320, -180], [-320, 400, -200]], 22, M.steel, 30);
  const muf = new T.Group(); muf.position.set(-430, 450, -200); muf.rotation.z = .42; bike.add(muf);
  put(muf, lathe([[0, -150], [44, -150], [58, -120], [62, 80], [56, 140], [30, 152], [0, 152]], 48), M.black, 0, 0, 0, 0, 0, Math.PI / 2);
  put(muf, zAxis(cyl(64, 26, 40)).rotateY(Math.PI / 2), M.alu, -20, 0, 0);
  put(muf, cyl(22, 30, 24), M.chrome, -165, 0, 0, 0, 0, Math.PI / 2);
  decal(muf, 70, 0, 0, 0, 0)?.position.set(10, 0, -63);
  return cc;
}

// cadena de eslabones entre piñón de salida y corona (lado izquierdo)
function chain(bike, M) {
  const cA = [40, 430], rA = 42, cB = AX.r, rB = 118, z = 120, pts = [];
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + Math.PI * i / 12; pts.push(V(cA[0] + rA * Math.cos(a), cA[1] + rA * Math.sin(a), z)); }
  for (let i = 0; i <= 20; i++) { const a = Math.PI / 2 + Math.PI * i / 20; pts.push(V(cB[0] + rB * Math.cos(a), cB[1] + rB * Math.sin(a), z)); }
  const curve = new T.CatmullRomCurve3(pts, true), L = curve.getLength(), n = Math.round(L / 15.875);
  const g = new T.Group(); bike.add(g);
  const plate = rbox(22, 14, 6, 3), roller = zAxis(cyl(6, 18, 10)), mP = M.steel.clone(), mR = mat(0xb08d57, .35, .9);
  for (let i = 0; i < n; i++) {
    const u = i / n, p = curve.getPointAt(u), t = curve.getTangentAt(u), a = Math.atan2(t.y, t.x);
    for (const dz of [-9, 9]) put(g, plate, i % 2 ? mP : M.aluDark, p.x, p.y, p.z + dz, 0, 0, a);
    put(g, roller, mR, p.x, p.y, p.z);
  }
  put(bike, zAxis(cyl(42, 12, 24)), M.aluDark, cA[0], cA[1], z);
  put(bike, profile([[-30, 0], [-600, -150], [-610, -130], [-30, 24]], 10, 4), M.black, 0, 500, z + 20);   // guardacadena
  return g.children[0];
}

// ---------------------------------------------------------------- carrocería naked
function nakedBody(bike, M, C) {
  // tanque escultural con tapas laterales y franja
  const tank = put(bike, profile([[380, 830], [330, 920], [200, 960], [40, 930], [-20, 860], [40, 800], [300, 790]], 320, 70), M.paint);
  put(bike, profile([[360, 800], [300, 880], [150, 900], [40, 870], [10, 830], [150, 820]], 340, 20), M.black);
  for (const z of [1, -1]) {
    put(bike, profile([[420, 780], [380, 700], [260, 620], [200, 660], [250, 760], [340, 820]], 26, 8), M.paint, 0, 0, z * 175);   // aletas del radiador
    put(bike, profile([[400, 760], [350, 700], [280, 660], [270, 690], [330, 745]], 30, 6), M.black, 0, 0, z * 188);
  }
  put(bike, cyl(34, 14, 24), M.alu, 140, 958, 0);
  decal(bike, 120, 180, 880, 162); decal(bike, 120, 180, 880, -162, Math.PI);
  // asiento piloto y pasajero, colín con LED, porta placa y direccionales
  put(bike, profile([[20, 860], [-60, 830], [-380, 840], [-410, 870], [-370, 880], [-60, 880]], 250, 40), M.seat);
  put(bike, profile([[-380, 870], [-440, 890], [-600, 920], [-600, 945], [-430, 925], [-380, 905]], 200, 30), M.seat);
  put(bike, profile([[-380, 830], [-600, 880], [-800, 930], [-810, 905], [-620, 850], [-400, 800]], 220, 40), M.paint);
  put(bike, rbox(50, 30, 150, 12), M.tail, -800, 920, 0, 0, 0, .3);
  tube(bike, [[-700, 860, 0], [-760, 760, 0], [-820, 680, 0]], 14, M.black, 12);
  put(bike, rbox(20, 160, 200, 8), M.black, -830, 640, 0, 0, 0, -.15);
  put(bike, new T.PlaneGeometry(180, 140), mat(0xf4f4f0, .5), -841, 640, 0, 0, -Math.PI / 2, -.15);
  for (const z of [1, -1]) { tube(bike, [[-790, 700, z * 70], [-800, 700, z * 150]], 6, M.black, 4); put(bike, rbox(50, 20, 24, 8), M.amber, -805, 700, z * 160); }
  // guardabarros delantero y trasero (tipo hugger)
  put(bike, zAxis(new T.LatheGeometry([[318, -62], [326, -66], [330, 0], [326, 66], [318, 62]].map(([r, y]) => new T.Vector2(r, y)), 40, 2.1, 1.5)), M.black, ...AX.f, 0);
  const rh = put(bike, zAxis(new T.LatheGeometry([[318, -72], [328, -78], [332, 0], [328, 78], [318, 72]].map(([r, y]) => new T.Vector2(r, y)), 40, 2.27, 1.2)), M.black, ...AX.r, 0);
  // faro LED con máscara, tablero TFT y manubrio completo
  const hl = new T.Group(); hl.position.set(560, 900, 0); bike.add(hl);
  put(hl, profile([[0, -90], [60, -70], [90, 0], [60, 90], [0, 110], [-30, 0]], 180, 26), M.black);
  put(hl, profile([[40, -60], [76, -40], [84, 0], [70, 50], [40, 70], [30, 0]], 120, 10), M.led, 22, 0, 0);
  for (const z of [-44, 44]) put(hl, rbox(20, 90, 14, 6), M.led, 92, 0, z, 0, 0, .1);
  put(hl, profile([[-10, 80], [60, 100], [80, 150], [20, 150]], 150, 10), M.paint);
  put(bike, rbox(30, 90, 140, 12), M.plastic, 470, 1010, 0, 0, 0, -.35);
  put(bike, new T.PlaneGeometry(110, 70), M.screen, 486, 1014, 0, 0, Math.PI / 2, 0).rotation.set(0, Math.PI / 2, -.35);
  handlebar(bike, M, 410, 1030, 400, false);
  return tank;
}
function handlebar(bike, M, x, y, half, clipon) {
  if (clipon) for (const z of [1, -1]) tube(bike, [[x, y, z * 100], [x - 20, y - 6, z * 200], [x - 40, y - 14, z * half]], 12, M.black, 12);
  else tube(bike, [[x - 30, y + 30, -half], [x - 10, y + 10, -half * .7], [x, y, -half * .3], [x, y, half * .3], [x - 10, y + 10, half * .7], [x - 30, y + 30, half]], 13, M.black, 40);
  for (const z of [1, -1]) {
    const ey = clipon ? y - 14 : y + 30, ex = clipon ? x - 40 : x - 30, gz = z * (half - 50);
    put(bike, zAxis(cyl(18, 120, 16)), M.rubber, ex, ey, gz);
    for (let i = 0; i < 7; i++) put(bike, zAxis(cyl(19.5, 5, 16)), mat(0x050505, .9), ex, ey, gz - 50 + i * 16);
    put(bike, zAxis(cyl(16, 22, 16)), M.alu, ex, ey, z * (half + 8));                               // contrapeso
    put(bike, rbox(60, 46, 50, 14), M.plastic, ex + 6, ey, z * (half - 140));                       // mandos
    tube(bike, [[ex + 20, ey, z * (half - 170)], [ex + 70, ey - 10, z * (half - 120)], [ex + 80, ey - 14, z * (half - 20)], [ex + 66, ey - 16, z * (half + 10)]], 7, M.alu, 20);   // maneta
    put(bike, rbox(50, 34, 50, 10), M.black, ex + 20, ey + 40, z * (half - 190));                    // depósito de líquido
    put(bike, cyl(20, 6, 20), M.alu, ex + 20, ey + 58, z * (half - 190));
    if (!clipon) {                                                                                  // espejos
      tube(bike, [[ex + 10, ey + 20, z * (half - 200)], [ex, ey + 80, z * (half - 170)], [ex - 20, ey + 130, z * (half - 120)]], 7, M.black, 12);
      const mh = put(bike, profile([[-70, -28], [60, -36], [84, 0], [52, 34], [-62, 28]], 26, 9), M.black, ex - 26, ey + 150, z * (half - 100), 0, Math.PI / 2, 0);
      put(bike, new T.PlaneGeometry(120, 52), M.chrome, ex - 40, ey + 150, z * (half - 100), 0, -Math.PI / 2, 0);
    }
  }
}

// ---------------------------------------------------------------- carrocería deportiva (carenada)
function sportBody(bike, M, C) {
  const tank = put(bike, profile([[380, 840], [320, 930], [160, 960], [20, 920], [-40, 850], [60, 810], [300, 800]], 330, 70), M.paint);
  // carenado: frontal con faros, laterales con toma de aire, quilla y franja
  put(bike, profile([[760, 860], [720, 790], [640, 700], [540, 610], [420, 540], [300, 490], [200, 470], [160, 520], [280, 590], [400, 670], [480, 790], [560, 900], [660, 930]], 360, 28,
    [[[430, 640], [520, 700], [505, 630], [440, 600]]]), M.paint);
  put(bike, profile([[770, 862], [730, 800], [690, 840], [700, 900]], 240, 16), M.black);
  put(bike, profile([[600, 600], [470, 520], [330, 470], [200, 450], [60, 330], [60, 290], [240, 270], [460, 330], [580, 450]], 360, 40), M.black);
  for (const z of [1, -1]) { put(bike, rbox(70, 26, 60, 12), M.led, 742, 836, z * 64, 0, 0, -.7); put(bike, rbox(60, 18, 40, 8), M.amber, 640, 870, z * 200, 0, 0, -.4); }
  put(bike, profile([[560, 930], [640, 960], [700, 900], [690, 990], [600, 1060], [540, 1000]], 300, 10),
      new T.MeshPhysicalMaterial({ color: 0x4b5866, roughness: .04, metalness: .1, transparent: true, opacity: .55, clearcoat: 1 }));
  for (const z of [1, -1]) {
    put(bike, profile([[620, 950], [560, 1000], [520, 1000], [540, 950]], 16, 4), M.black, 0, 0, z * 210);      // espejos en carenado
    put(bike, profile([[-20, -26], [70, -30], [90, 0], [60, 28], [-20, 24]], 24, 8), M.black, 520, 1010, z * 250, Math.PI / 2, 0, 0);
  }
  decal(bike, 150, 420, 650, 202); decal(bike, 150, 420, 650, -202, Math.PI);
  // colín alto y afilado con LED, asiento deportivo
  put(bike, profile([[20, 860], [-60, 840], [-340, 880], [-360, 905], [-60, 895]], 240, 36), M.seat);
  put(bike, profile([[-300, 860], [-560, 940], [-820, 1010], [-830, 985], [-600, 900], [-340, 830]], 220, 40), M.paint);
  put(bike, profile([[-420, 900], [-640, 960], [-760, 990], [-760, 970], [-640, 940], [-430, 885]], 230, 8), M.white);
  put(bike, rbox(46, 26, 140, 12), M.tail, -822, 1000, 0, 0, 0, .3);
  tube(bike, [[-700, 900, 0], [-760, 780, 0], [-820, 690, 0]], 14, M.black, 12);
  put(bike, rbox(20, 160, 200, 8), M.black, -830, 650, 0, 0, 0, -.15);
  put(bike, zAxis(new T.LatheGeometry([[318, -62], [326, -66], [330, 0], [326, 66], [318, 62]].map(([r, y]) => new T.Vector2(r, y)), 40, 2.1, 1.5)), M.paint, ...AX.f, 0);
  handlebar(bike, M, 440, 930, 330, true);
  return tank;
}

// ---------------------------------------------------------------- armado
function realBike(C, style = 'naked') {
  const M = mats(C), { bike, F, R } = chassis(C, M, style);
  const eng = engine(bike, M, C), ch = chain(bike, M);
  const tank = style === 'sport' ? sportBody(bike, M, C) : nakedBody(bike, M, C);
  const root = new T.Group(); bike.scale.setScalar(S); root.add(bike);
  // las ruedas giran en su propio eje: se exponen los grupos de rueda (ya dentro del grupo escalado)
  return { bike: root, F, R, engine: eng, chain: ch, tank };
}

const prev = K.bike;
K.bike = (C, style = 'naked') => (style === 'naked' || style === 'sport') ? realBike(C, style) : prev(C, style);
K.naked = C => realBike(C, 'naked'); K.sport = C => realBike(C, 'sport'); K.realBike = realBike;
Object.assign(K.ITEMS, { naked: C => realBike(C, 'naked').bike, sport: C => realBike(C, 'sport').bike });

// piezas compartidas con otros modelos (kit3d_moto2.js)
K.moto = { S, flakeMap, treadMap, mats, tube, along, cyl, zAxis, V, tireGeo, rimSpokes, waveDisc, carrier, radialCaliper, handlebar };
