// Más motos "casi reales" (mismas reglas que kit3d_moto.js: milímetros, x adelante, y arriba,
// z = lado izquierdo): enduro (rueda de rayos 21"/18", tacos, horquilla larga, escape alto),
// scooter (ruedas 12", carrocería de paso libre, motor-basculante con CVT) y una calle estilo
// NS 200 (chasis perimetral, horquilla convencional, mono-cilindro con radiador, escape bajo el motor,
// tanque con extensiones afiladas, asiento partido y colín afilado). Sin logos de otras marcas.
const MC = window.MC;
const { T } = MC.three;
const K = MC.kit;
const { rbox, mat, paint, put, profile, lathe, decal, canvasTex } = K;
const { S, mats, tube, along, cyl, zAxis, V, waveDisc, carrier, handlebar, flakeMap } = K.moto;

// ---------------------------------------------------------------- ayudas
function sharp(pts, depth, bevel = 6, round = 22) {   // perfil "afilado" pero con esquinas redondeadas (radio round) y bisel suave
  const s = new T.Shape(), P = pts.map(p => new T.Vector2(...p)), n = P.length;
  for (let i = 0; i < n; i++) {
    const p = P[i], a = P[(i + n - 1) % n], b = P[(i + 1) % n], r = Math.min(round, p.distanceTo(a) * .45, p.distanceTo(b) * .45);
    const p1 = p.clone().add(a.clone().sub(p).setLength(r)), p2 = p.clone().add(b.clone().sub(p).setLength(r));
    i ? s.lineTo(p1.x, p1.y) : s.moveTo(p1.x, p1.y); s.quadraticCurveTo(p.x, p.y, p2.x, p2.y);
  }
  s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(1, depth - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 4, curveSegments: 8 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2); return g;
}
// tubo de chasis: tramos rectos con curvas dobladas (radio r) y puntas tapadas, como un tubo real doblado y soldado
function bent(pts, r = 70) {
  const P = pts.map(p => V(...p)), out = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const p = P[i], a = P[i - 1], b = P[i + 1], p1 = p.clone().add(a.clone().sub(p).setLength(Math.min(r, p.distanceTo(a) * .45))),
          p2 = p.clone().add(b.clone().sub(p).setLength(Math.min(r, p.distanceTo(b) * .45)));
    out.push(out[out.length - 1].clone().lerp(p1, .5), p1);
    for (let k = 1; k < 6; k++) { const u = k / 6; out.push(p1.clone().multiplyScalar((1 - u) ** 2).add(p.clone().multiplyScalar(2 * u * (1 - u))).add(p2.clone().multiplyScalar(u * u))); }
    out.push(p2);
  }
  out.push(out[out.length - 1].clone().lerp(P[P.length - 1], .5), P[P.length - 1]);
  return out.map(v => [v.x, v.y, v.z]);
}
function frameTube(parent, pts, r, m, bend = 70, caps = true) {
  const path = bent(pts, bend), o = tube(parent, path, r, m, path.length * 6);
  if (caps) for (const p of [path[0], path[path.length - 1]]) put(parent, new T.SphereGeometry(r * 1.05, 16, 12), m, ...p);
  return o;
}
const between = (bike, a, b, r, m, s = 16) => { const o = along(bike, a, b, cyl(r, 1, s), m); o.scale.y = V(...a).distanceTo(V(...b)); return o; };

function tireProfile(R, W, knobby) {
  const p = knobby ? [[R - 90, -W * .78], [R - 62, -W * .95], [R - 30, -W * .9], [R - 12, -W * .6], [R - 6, 0], [R - 12, W * .6], [R - 30, W * .9], [R - 62, W * .95], [R - 90, W * .78]]
                   : [[R - 82, -W * .8], [R - 60, -W * .98], [R - 28, -W * .92], [R - 8, -W * .62], [R, 0], [R - 8, W * .62], [R - 28, W * .92], [R - 60, W * .98], [R - 82, W * .8]];
  return zAxis(lathe(p, 72));
}
// rueda genérica: llanta (lisa o de tacos), rin fundido o de rayos, disco y corona opcionales
function makeWheel(M, o) {
  const w = new T.Group(), parts = {}, R = o.R, W = o.W, rimR = R - (o.knobby ? 96 : 86);
  put(w, tireProfile(R, W, o.knobby), o.knobby ? M.rubber : (M.tire || M.rubber));
  if (o.knobby) {                                                    // tacos de enduro
    const knob = rbox(26, 18, 22, 5), km = mat(0x0f0f0f, .9), n = Math.round(R / 11);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2;
      for (const [dz, dr] of (i % 2 ? [[-W * .5, -14], [W * .5, -14]] : [[0, -4], [-W * .82, -34], [W * .82, -34]])) put(w, knob, km, Math.cos(a) * (R + dr - 2), Math.sin(a) * (R + dr - 2), dz, 0, 0, a); }
  } else {
    const tread = mat(0x050505, .95);
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2;
      for (const s of [1, -1]) { const m = put(w, new T.BoxGeometry(5, 3, W * .4), tread, Math.cos(a) * (R - 1.4), Math.sin(a) * (R - 1.4), s * W * .25, 0, 0, a + Math.PI / 2); m.rotation.y = s * .55; } }
  }
  put(w, zAxis(lathe([[rimR - 2, -W * .72], [rimR + 8, -W * .8], [rimR + 12, -W * .66], [rimR, -W * .55], [rimR, W * .55], [rimR + 12, W * .66], [rimR + 8, W * .8], [rimR - 2, W * .72]], 72)), o.rimMat || M.black);
  put(w, zAxis(cyl(o.hubR || 44, o.hubW || 120, 32)), M.aluDark);
  put(w, zAxis(cyl(16, (o.hubW || 120) + 30, 16)), M.steel);
  if (o.spokes === 'wire') {                                         // rayos cruzados (36) con niples
    const n = 36;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, side = i % 2 ? 1 : -1, a2 = a + side * .32;
      const h = [Math.cos(a2) * 40, Math.sin(a2) * 40, side * (o.hubW || 120) * .42], r = [Math.cos(a) * (rimR - 4), Math.sin(a) * (rimR - 4), side * W * .2];
      between(w, h, r, 2.6, M.chrome, 6); put(w, cyl(4, 12, 6), M.chrome, r[0] * .97, r[1] * .97, r[2]).lookAt(0, 0, 0); }
  } else if (o.spokes === 'thin12') {                              // 6 pares de rayos delgados que se abren hacia el aro
    for (let i = 0; i < 6; i++) for (const d of [-.11, .11]) { const a0 = i / 6 * Math.PI * 2, s = new T.Shape();
      s.moveTo(-5, 44); s.quadraticCurveTo(d * 120, rimR * .55, d * rimR - 5, rimR - 4); s.lineTo(d * rimR + 5, rimR - 4); s.quadraticCurveTo(d * 120 + 8, rimR * .55, 5, 44); s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: 12, bevelEnabled: true, bevelThickness: 3, bevelSize: 2, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -6); g.rotateZ(a0);
      put(w, g, o.rimMat || M.black); }
  } else if (o.spokes === 'cast6' || o.spokes === 'cast') {
    const n = o.spokes === 'cast6' ? 6 : 5;
    for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, s = new T.Shape();
      s.moveTo(-10, 40); s.quadraticCurveTo(0, rimR * .5, -8, rimR - 4); s.lineTo(8, rimR - 4); s.quadraticCurveTo(14, rimR * .5, 10, 40); s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: 18, bevelEnabled: true, bevelThickness: 4, bevelSize: 3, bevelSegments: 3, curveSegments: 16 }); g.translate(0, 0, -9); g.rotateZ(a0);
      put(w, g, o.rimMat || M.black); }
  }
  if (o.disc) { const d = waveDisc(o.disc.R, M.alu.clone()); d.position.z = o.disc.z; w.add(d); carrier(w, o.disc.R * .6, o.disc.z, M.aluDark, M.gold); parts.disc = d; }
  if (o.disc2) { const d = waveDisc(o.disc2.R, M.alu); d.position.z = o.disc2.z; w.add(d); carrier(w, o.disc2.R * .6, o.disc2.z, M.aluDark, M.gold); }
  if (o.sprocket) {
    const sp = new T.Shape(), n = o.sprocket.teeth || 45, r0 = o.sprocket.R, r1 = r0 + 12;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + .5) / n * Math.PI * 2; i ? sp.lineTo(Math.cos(a) * r0, Math.sin(a) * r0) : sp.moveTo(r0, 0);
      sp.lineTo(Math.cos(a + .03) * r1, Math.sin(a + .03) * r1); sp.lineTo(Math.cos(b - .02) * r1, Math.sin(b - .02) * r1); sp.lineTo(Math.cos(b) * r0, Math.sin(b) * r0); }
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, h = new T.Path(); h.absarc(Math.cos(a) * r0 * .6, Math.sin(a) * r0 * .6, r0 * .18, 0, Math.PI * 2, true); sp.holes.push(h); }
    const cc = new T.Path(); cc.absarc(0, 0, r0 * .28, 0, Math.PI * 2, true); sp.holes.push(cc);
    const sg = new T.ExtrudeGeometry(sp, { depth: 6, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 1 }); sg.translate(0, 0, o.sprocket.z);
    parts.sprocket = put(w, sg, M.aluDark.clone());
  }
  return { w, parts };
}
function axialCaliper(M, side = 1) {               // pinza flotante de 2 pistones (calle) con soporte
  const g = new T.Group();
  put(g, profile([[-60, -26], [-50, 26], [0, 36], [50, 26], [60, -26], [0, -32]], 70, 12), M.caliper);
  put(g, zAxis(cyl(26, 8, 28)), M.alu, 0, 0, side * 38);
  put(g, profile([[-70, -20], [70, -20], [80, 20], [-80, 20]], 14, 4), M.aluDark, 0, -40, -side * 20);
  for (const x of [-40, 40]) put(g, zAxis(cyl(8, 16, 6)), M.chrome, x, 18, side * 36);
  return g;
}
function chainBetween(bike, M, cA, rA, cB, rB, z) {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + Math.PI * i / 12; pts.push(V(cA[0] + rA * Math.cos(a), cA[1] + rA * Math.sin(a), z)); }
  for (let i = 0; i <= 20; i++) { const a = Math.PI / 2 + Math.PI * i / 20; pts.push(V(cB[0] + rB * Math.cos(a), cB[1] + rB * Math.sin(a), z)); }
  const curve = new T.CatmullRomCurve3(pts, true), n = Math.round(curve.getLength() / 15.875), g = new T.Group(); bike.add(g);
  const plate = rbox(22, 14, 6, 3), roller = zAxis(cyl(6, 18, 10)), mP = M.steel.clone(), mR = mat(0xb08d57, .35, .9);
  for (let i = 0; i < n; i++) { const u = i / n, p = curve.getPointAt(u), t = curve.getTangentAt(u), a = Math.atan2(t.y, t.x);
    for (const dz of [-9, 9]) put(g, plate, i % 2 ? mP : M.aluDark, p.x, p.y, p.z + dz, 0, 0, a); put(g, roller, mR, p.x, p.y, p.z); }
  put(bike, zAxis(cyl(rA, 12, 24)), M.aluDark, cA[0], cA[1], z);
  return g.children[0];
}
function springShock(bike, M, a, b, z, coil, body) {
  const A = V(...a), B = V(...b), d = B.clone().sub(A), L = d.length(), n = d.clone().normalize();
  between(bike, [A.x, A.y, z], [B.x, B.y, z], 15, M.chrome);
  const m1 = A.clone().add(n.clone().multiplyScalar(L * .45)); between(bike, [m1.x, m1.y, z], [B.x, B.y, z], 25, body);
  const hel = [], turns = 8;
  for (let i = 0; i <= turns * 24; i++) { const u = i / (turns * 24), ang = u * turns * Math.PI * 2, c = A.clone().add(n.clone().multiplyScalar(28 + u * (L - 80)));
    const p = V(-n.y, n.x, 0).multiplyScalar(Math.cos(ang) * 36); hel.push([c.x + p.x, c.y + p.y, z + Math.sin(ang) * 36]); }
  tube(bike, hel, 6, coil, 420);
  for (const P of [A, B]) put(bike, zAxis(cyl(18, 50, 16)), M.aluDark, P.x, P.y, z);
}
function teleFork(bike, M, axle, head, z, lowerMat, upperMat, gaiter) {   // horquilla convencional (barras arriba, botellas abajo)
  const fa = V(...axle), hd = V(...head), dir = hd.clone().sub(fa).normalize(), at = k => fa.clone().add(dir.clone().multiplyScalar(k)), L = fa.distanceTo(hd);
  for (const zz of [z, -z]) {
    const p0 = at(-10), p1 = at(L * .45), p2 = at(L + 80);
    between(bike, [p0.x, p0.y, zz], [p1.x, p1.y, zz], 30, lowerMat, 24);
    put(bike, zAxis(cyl(32, 50, 20)), lowerMat, fa.x, fa.y, zz);
    between(bike, [p1.x, p1.y, zz], [p2.x, p2.y, zz], 20, upperMat, 24);
    put(bike, cyl(22, 14, 20), M.aluDark, p2.x, p2.y + 6, zz);
    if (gaiter) for (let i = 0; i < 6; i++) { const q = at(L * .45 + 10 + i * 18); put(bike, cyl(26 - (i % 2) * 3, 14, 18), M.rubber, q.x, q.y, zz).quaternion.setFromUnitVectors(V(0, 1, 0), dir); }
  }
  for (const k of [L - 40, L + 60]) { const p = at(k); put(bike, rbox(100, 26, z * 2 + 70, 10), M.aluDark, p.x, p.y, 0, 0, 0, Math.atan2(dir.x, dir.y)); }
  return { dir, at, L };
}
function usdFork(bike, M, axle, head, z, upper, lower) {
  const fa = V(...axle), hd = V(...head), dir = hd.clone().sub(fa).normalize(), at = k => fa.clone().add(dir.clone().multiplyScalar(k)), L = fa.distanceTo(hd);
  for (const zz of [z, -z]) {
    const p0 = at(30), p1 = at(L * .5), p2 = at(L + 90);
    between(bike, [p0.x, p0.y, zz], [p1.x, p1.y, zz], 24, lower, 24);
    between(bike, [at(L * .45).x, at(L * .45).y, zz], [p2.x, p2.y, zz], 32, upper, 28);
    put(bike, zAxis(cyl(30, 50, 20)), M.alu, fa.x, fa.y, zz);
    between(bike, [at(20).x, at(20).y, zz], [at(110).x, at(110).y, zz], 30, M.alu, 20);
    put(bike, cyl(20, 18, 20), M.gold, p2.x, p2.y + 14, zz);
  }
  for (const k of [L - 20, L + 80]) { const p = at(k); put(bike, rbox(110, 28, z * 2 + 80, 10), M.aluDark, p.x, p.y, 0, 0, 0, Math.atan2(dir.x, dir.y)); }
  return { dir, at, L };
}
function brakeLine(bike, M, pts) { tube(bike, pts, 6, M.hose, 40); for (const p of [pts[0], pts[pts.length - 1]]) put(bike, cyl(9, 16, 10), M.chrome, ...p); }
function footpegs(bike, M, x, y, z, color) {
  for (const s of [1, -1]) {
    put(bike, profile([[0, 0], [70, 40], [60, 130], [10, 150], [-30, 100], [-20, 20]], 14, 4), color || M.alu, x - 40, y - 70, s * (z - 45));
    const peg = new T.Group(); peg.position.set(x, y, s * z); bike.add(peg);
    put(peg, zAxis(cyl(16, 90, 16)), M.aluDark);
    for (let i = 0; i < 6; i++) put(peg, zAxis(cyl(18, 6, 16)), M.steel, 0, 0, -36 + i * 14);
  }
}

// ---------------------------------------------------------------- ENDURO
function enduroBike(C) {
  const M = mats(C), bike = new T.Group();
  const AXF = [770, 360], AXR = [-720, 340], HEAD = [470, 1010];
  const F = makeWheel(M, { R: 360, W: 52, knobby: true, spokes: 'wire', rimMat: M.black, hubR: 40, hubW: 110, disc: { R: 135, z: 62 } });
  const R = makeWheel(M, { R: 340, W: 78, knobby: true, spokes: 'wire', rimMat: M.black, hubR: 46, hubW: 120, disc2: { R: 110, z: -66 }, sprocket: { R: 112, z: 92, teeth: 48 } });
  F.w.position.set(...AXF, 0); R.w.position.set(...AXR, 0); bike.add(F.w, R.w);
  const fk = usdFork(bike, M, AXF, HEAD, 92, M.black, M.gold);
  const cal = axialCaliper(M, 1); cal.position.set(AXF[0] - 100, AXF[1] + 70, 62); cal.rotation.z = .9; bike.add(cal); F.parts.caliper = cal.children[0];
  const rc = axialCaliper(M, -1); rc.scale.setScalar(.8); rc.position.set(AXR[0] + 40, AXR[1] - 100, -66); rc.rotation.z = Math.PI + .3; bike.add(rc);
  brakeLine(bike, M, [[HEAD[0] - 40, HEAD[1] + 160, -300], [HEAD[0] + 30, HEAD[1] + 40, -150], [fk.at(380).x + 40, fk.at(380).y, 120], [AXF[0] - 80, AXF[1] + 100, 80]]);
  // chasis de cuna (gris) y subchasis
  const fr = M.alu, N = { h: [HEAD[0] - 30, HEAD[1] - 40], t: [200, 900], b: [-40, 860], p: [-40, 560], lo: [220, 300], f: [380, 540] };
  for (const z of [1, -1]) {
    for (const [a, b] of [['h', 't'], ['t', 'b'], ['b', 'p'], ['h', 'f'], ['f', 'lo'], ['lo', 'p']]) between(bike, [...N[a], z * (a === 'h' ? 40 : 90)], [...N[b], z * 90], 16, fr);
    between(bike, [-40, 860, z * 90], [-640, 980, z * 70], 13, fr); between(bike, [-40, 600, z * 90], [-560, 960, z * 70], 11, fr);
  }
  put(bike, profile([[380, 280], [-60, 250], [-80, 330], [380, 340]], 230, 20), M.alu);                          // cubrecárter
  // motor mono-cilindro
  const eng = put(bike, profile([[-80, 330], [260, 320], [330, 420], [300, 520], [120, 560], [-80, 520]], 220, 30), M.aluDark.clone());
  const cy = new T.Group(); cy.position.set(180, 560, 0); cy.rotation.z = -.2; bike.add(cy);
  put(cy, rbox(150, 130, 170, 24), M.aluDark, 0, 50, 0); for (let i = 0; i < 6; i++) put(cy, rbox(176, 8, 190, 4), M.fin, 0, 18 + i * 18, 0);
  put(cy, rbox(166, 60, 180, 24), M.paint, 0, 150, 0);
  for (const s of [1, -1]) { put(bike, zAxis(lathe([[0, 0], [90, 0], [90, 14], [80, 26], [0, 30]], 40)), M.alu, s > 0 ? 0 : 140, 430, s * 112).scale.z = s; }
  // radiadores con aletas plásticas, tanque, asiento plano y colín
  for (const s of [1, -1]) { put(bike, rbox(30, 260, 160, 8), M.black, 380, 720, s * 110, 0, s * .3, -.2);
    put(bike, sharp([[480, 900], [420, 660], [300, 560], [220, 640], [300, 820], [360, 940]], 20, 6), M.paint, 0, 0, s * 140);
    put(bike, sharp([[460, 860], [410, 690], [330, 620], [300, 660], [360, 800]], 22, 4), M.white, 0, 0, s * 148);
    decal(bike, 100, 340, 700, s * 160, s > 0 ? 0 : Math.PI); }
  const tank = put(bike, profile([[420, 960], [300, 1000], [120, 990], [40, 950], [120, 880], [360, 880]], 280, 60), M.white);
  put(bike, profile([[200, 1000], [-100, 990], [-640, 1010], [-650, 980], [-100, 960], [200, 960]], 230, 30), M.seat);
  put(bike, profile([[-300, 970], [-640, 1000], [-900, 1040], [-905, 1010], [-640, 960], [-300, 930]], 200, 30), M.white);
  for (const s of [1, -1]) put(bike, sharp([[-200, 940], [-560, 990], [-600, 820], [-260, 800]], 20, 6), M.paint, 0, 0, s * 120);   // tapas laterales (número)
  put(bike, rbox(30, 20, 80, 8), M.tail, -895, 1000, 0, 0, 0, .3);
  // guardabarros alto delantero y placa frontal con faro
  put(bike, profile([[620, 1010], [760, 1040], [960, 1010], [980, 990], [760, 1000], [620, 985]], 130, 12), M.white);
  const plate = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#f2f2f0'; g.fillRect(0, 0, w, h); g.fillStyle = TH.primary; g.font = 'italic 900 150px Montserrat';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('07', w / 2, h / 2 + 6); });
  put(bike, rbox(40, 260, 230, 30), M.white, 560, 1060, 0, 0, 0, -.38);
  put(bike, new T.PlaneGeometry(170, 140), new T.MeshStandardMaterial({ map: plate, roughness: .5 }), 584, 1090, 0, -.38 * 0, Math.PI / 2, 0).rotation.set(0, Math.PI / 2, -.38);
  put(bike, rbox(20, 50, 80, 10), M.led, 590, 990, 0, 0, 0, -.38);
  // escape alto (der.) y silenciador bajo el asiento
  tube(bike, [[260, 600, -60], [360, 520, -80], [330, 420, -110], [120, 480, -150], [-200, 700, -160]], 20, M.chrome, 60);
  const muf = new T.Group(); muf.position.set(-480, 860, -150); muf.rotation.z = .28; bike.add(muf);
  put(muf, lathe([[0, -170], [40, -170], [52, -140], [54, 110], [46, 160], [24, 172], [0, 172]], 40), M.alu, 0, 0, 0, 0, 0, Math.PI / 2);
  put(muf, cyl(18, 30, 20), M.black, -190, 0, 0, 0, 0, Math.PI / 2);
  // basculante, amortiguador, cadena, estribos y manubrio con cubremanos
  for (const s of [1, -1]) put(bike, profile([[0, -46], [-560, -26], [-680, -18], [-690, 22], [-560, 30], [0, 50]], 34, 10), M.alu, -40, 560, s * 120, 0, 0, Math.atan2(560 - AXR[1], -40 - AXR[0]));
  springShock(bike, M, [-200, 520], [-60, 860], 0, M.paint, M.gold);
  const ch = chainBetween(bike, M, [40, 450], 40, AXR, 118, 92);
  footpegs(bike, M, -80, 460, 200, M.aluDark);
  handlebar(bike, M, 440, 1190, 420, false);
  for (const s of [1, -1]) { put(bike, sharp([[0, 0], [150, -20], [190, 30], [140, 70], [20, 60]], 26, 8), M.paint, 360, 1200, s * 370, -Math.PI / 2 * s * .15, 0, 0);   // cubremanos
    tube(bike, [[400, 1214, s * 300], [480, 1214, s * 360], [520, 1210, s * 400]], 6, M.aluDark, 10); }
  tube(bike, [[-40, 520, 130], [-20, 300, 190], [0, 60, 230]], 10, M.aluDark, 16);                                // pata lateral
  const root = new T.Group(); bike.scale.setScalar(S); root.add(bike);
  return { bike: root, F, R, engine: eng, chain: ch, tank };
}

// ---------------------------------------------------------------- SCOOTER
function scooterBike(C) {
  const M = mats(C), bike = new T.Group();
  const AXF = [620, 230], AXR = [-560, 235], HEAD = [470, 900];
  const F = makeWheel(M, { R: 230, W: 55, spokes: 'cast', rimMat: M.black, hubR: 34, hubW: 90, disc: { R: 110, z: 52 } });
  const R = makeWheel(M, { R: 235, W: 66, spokes: 'cast', rimMat: M.black, hubR: 40, hubW: 100 });
  F.w.position.set(...AXF, 0); R.w.position.set(...AXR, 0); bike.add(F.w, R.w);
  const fk = teleFork(bike, M, AXF, HEAD, 70, M.aluDark, M.chrome, false);
  const cal = axialCaliper(M, 1); cal.scale.setScalar(.8); cal.position.set(AXF[0] - 80, AXF[1] + 60, 52); cal.rotation.z = .9; bike.add(cal); F.parts.caliper = cal.children[0];
  brakeLine(bike, M, [[HEAD[0] - 10, HEAD[1] + 120, 260], [HEAD[0] + 40, HEAD[1] - 20, 120], [fk.at(260).x + 30, fk.at(260).y, 90], [AXF[0] - 70, AXF[1] + 90, 60]]);
  // carrocería: escudo frontal, piso, túnel, cuerpo trasero curvo y asiento
  put(bike, profile([[540, 300], [600, 520], [600, 820], [520, 1000], [440, 980], [470, 760], [440, 520], [430, 330]], 420, 50), M.paint);
  put(bike, profile([[600, 600], [640, 700], [640, 860], [600, 880]], 300, 20), M.black);
  put(bike, profile([[440, 330], [-60, 320], [-120, 380], [440, 380]], 380, 20), M.black);                    // piso
  for (const z of [1, -1]) put(bike, rbox(420, 6, 60, 3), mat(0x3a3b40, .6), 160, 386, z * 120);               // estrías del piso
  put(bike, profile([[-60, 330], [-140, 560], [-340, 720], [-620, 720], [-760, 620], [-700, 480], [-420, 420], [-160, 360]], 400, 70), M.paint);
  const tank = put(bike, profile([[-100, 740], [-260, 790], [-620, 800], [-700, 760], [-640, 730], [-260, 740]], 330, 50), M.seat);
  put(bike, profile([[-620, 720], [-720, 740], [-780, 700], [-760, 660], [-660, 690]], 300, 30), M.black);       // parrilla
  put(bike, rbox(40, 50, 220, 16), M.tail, -770, 640, 0, 0, 0, .4);
  for (const z of [1, -1]) put(bike, rbox(50, 30, 30, 10), M.amber, -740, 660, z * 170);
  decal(bike, 150, -420, 560, 202); decal(bike, 150, -420, 560, -202, Math.PI);
  // motor-basculante con cárter de CVT (izq.), amortiguador y escape (der.)
  const eng = put(bike, profile([[-120, 330], [-200, 400], [-600, 300], [-620, 180], [-480, 160], [-140, 250]], 120, 30), M.alu.clone(), 0, 0, 120);
  put(bike, rbox(180, 150, 160, 30), M.aluDark, -170, 320, -20);
  springShock(bike, M, [-560, 300], [-470, 640], -130, M.paint, M.black);
  tube(bike, [[-130, 260, -60], [-240, 200, -130], [-380, 220, -170]], 18, M.steel, 20);
  put(bike, lathe([[0, -160], [50, -160], [58, -120], [60, 100], [50, 150], [0, 156]], 40), M.black, -500, 270, -170, 0, 0, Math.PI / 2 + .15);
  put(bike, rbox(80, 70, 30, 12), M.alu, -560, 230, -150);
  // manubrio con cubierta, faro, tablero y espejos
  const hb = new T.Group(); bike.add(hb);
  put(hb, profile([[380, 1000], [460, 1040], [560, 1030], [600, 980], [520, 960], [400, 960]], 300, 40), M.paint);
  put(hb, rbox(30, 60, 160, 12), M.led, 600, 990, 0, 0, 0, -.3);
  put(hb, new T.PlaneGeometry(120, 60), M.screen, 470, 1046, 0, -Math.PI / 2 + .3, 0, Math.PI / 2).rotation.set(-1.3, 0, 0);
  for (const z of [1, -1]) {
    put(bike, zAxis(cyl(18, 110, 16)), M.rubber, 420, 1000, z * 330); put(bike, zAxis(cyl(15, 20, 16)), M.alu, 420, 1000, z * 392);
    tube(bike, [[440, 1000, z * 250], [500, 990, z * 290], [520, 986, z * 360]], 7, M.alu, 16);
    tube(bike, [[420, 1030, z * 240], [400, 1120, z * 260], [380, 1180, z * 290]], 7, M.black, 12);
    put(bike, profile([[-70, -28], [60, -36], [84, 0], [52, 34], [-62, 28]], 26, 9), M.black, 374, 1200, z * 300, 0, Math.PI / 2, 0);
  }
  for (const z of [1, -1]) put(bike, profile([[0, 0], [40, 10], [40, 30], [0, 24]], 70, 6), M.black, -260, 330, z * 200);   // posapiés de pasajero
  const root = new T.Group(); bike.scale.setScalar(S); root.add(bike);
  return { bike: root, F, R, engine: eng, chain: eng, tank };
}

// ---------------------------------------------------------------- CALLE ESTILO NS 200
function ns200(C, o = {}) {
  const M = mats(C), bike = new T.Group();
  // conjuntos que se pueden desmontar (para videos de mantenimiento): se mueven como una sola pieza
  const G = {}, grp = n => G[n] || (G[n] = (() => { const g = new T.Group(); g.name = n; bike.add(g); return g; })());
  // colores de la NS 200 2024 de referencia: carrocería gris metálico, gráficos blancos, chasis, basculante y motor negros
  const flk = flakeMap().clone(); flk.needsUpdate = true; flk.repeat.set(.03, .03);
  const body = o.body ? paint(o.body, { normalMap: flk, normalScale: new T.Vector2(.25, .25) }) : paint(0x7d8288, { metalness: .55, roughness: .3, normalMap: flk, normalScale: new T.Vector2(.3, .3) }), accent = paint(o.accent ?? 0xf1f2f4);
  const silver = mat(0x16171a, .35, .55), white = paint(0xe9ebee), engM = mat(0x232428, .45, .6);
  const AXF = [690, 296], AXR = [-673, 307], HEAD = [440, 850];
  const F = makeWheel(M, { R: 296, W: 52, spokes: 'thin12', rimMat: M.black, hubR: 40, hubW: 100, disc: { R: 150, z: 70 } });
  const R = makeWheel(M, { R: 307, W: 68, spokes: 'thin12', rimMat: M.black, hubR: 46, hubW: 120, disc2: { R: 115, z: -70 }, sprocket: { R: 108, z: 100, teeth: 41 } });
  F.w.position.set(...AXF, 0); R.w.position.set(...AXR, 0); grp('frontWheel').add(F.w); grp('rearWheel').add(R.w);
  for (const W of [F.w, R.w]) put(W, zAxis(lathe([[W === F.w ? 207 : 216, -40], [W === F.w ? 211 : 220, -42], [W === F.w ? 211 : 220, 42], [W === F.w ? 207 : 216, 40]], 72)), white);   // filete blanco en el rin
  // horquilla convencional con barras cromadas y botellas negras
  // cada barra, las dos placas (tijas), el tubo de dirección y sus cunas (rodamientos) son conjuntos aparte
  const fa = V(...AXF), fdir = V(...HEAD).sub(fa).normalize(), FL = fa.distanceTo(V(...HEAD)), fat = k => fa.clone().add(fdir.clone().multiplyScalar(k));
  const fk = { dir: fdir, at: fat, L: FL }, ang = Math.atan2(fdir.x, fdir.y), seal = mat(0x2a2a2a, .5);
  const alongDir = (g, geo, m, k) => { const p = fat(k), o = put(g, geo, m, p.x, p.y, 0); o.quaternion.setFromUnitVectors(V(0, 1, 0), fdir); return o; };
  for (const [n, zz] of [['forkL', 92], ['forkR', -92]]) {
    const g = grp(n), p0 = fat(-10), p1 = fat(FL * .45), p2 = fat(FL + 80);
    between(g, [p0.x, p0.y, zz], [p1.x, p1.y, zz], 30, M.black, 28);                          // botella
    put(g, zAxis(cyl(32, 50, 24)), M.black, fa.x, fa.y, zz);
    between(g, [p1.x, p1.y, zz], [p2.x, p2.y, zz], 20, M.chrome, 28);                         // barra cromada
    for (const [k, r, h, m] of [[FL * .45 + 4, 31, 16, seal], [FL * .45 - 30, 31.5, 8, M.aluDark], [FL + 86, 21, 14, M.aluDark]]) alongDir(g, cyl(r, h, 24), m, k).position.z = zz;   // retén, aro y tapón
    alongDir(g, cyl(9, 8, 6), M.gold, FL + 94).position.z = zz;                                     // tornillo de precarga
    const cov = sharp([[0, -20], [40, 10], [44, 230], [10, 250], [-14, 200]], 12, 3, 10);           // tapa lateral de la botella
    const cp = fat(40); put(g, cov, mat(0x141518, .5, .2), cp.x, cp.y, zz + Math.sign(zz) * 30, 0, 0, -ang);
  }
  const clamp = (g, k, w) => {                                                                     // placa de dirección redondeada
    const sh = new T.Shape(); sh.moveTo(-34, -w / 2); sh.absarc(0, -w / 2, 34, Math.PI, Math.PI * 2, false); sh.lineTo(34, w / 2); sh.absarc(0, w / 2, 34, 0, Math.PI, false); sh.closePath();
    const geo = new T.ExtrudeGeometry(sh, { depth: 18, bevelEnabled: true, bevelThickness: 5, bevelSize: 4, bevelSegments: 3, curveSegments: 18 });
    geo.translate(0, 0, -9); geo.rotateX(Math.PI / 2);
    const p = fat(k), o = put(g, geo, M.aluDark, p.x, p.y, 0, 0, 0, -ang); return o;
  };
  clamp(grp('clampTop'), FL + 60, 184); { const p = fat(FL + 76); put(grp('clampTop'), cyl(16, 14, 16), M.chrome, p.x, p.y, 0, 0, 0, -ang); }
  clamp(grp('clampBottom'), FL - 40, 184);
  alongDir(grp('clampBottom'), cyl(15, 140, 16), M.steel, FL + 10);                                // vástago de dirección
  const brg = mat(0xd9a43a, .3, .9);                                                              // cunas (rodamientos de dirección): doradas para que se vean
  for (const k of [FL - 24, FL + 44]) { const o = alongDir(grp('bearings'), new T.TorusGeometry(28, 9, 12, 32), brg, k); o.quaternion.multiply(new T.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, q = fat(k); put(grp('bearings'), new T.SphereGeometry(5, 8, 6), M.chrome, q.x + Math.cos(a) * 24 * fdir.y, q.y - Math.cos(a) * 24 * fdir.x, Math.sin(a) * 24); } }
  const cal = axialCaliper(M, 1); cal.position.set(AXF[0] - 110, AXF[1] + 80, 70); cal.rotation.z = 1.0; grp('frontCaliper').add(cal); F.parts.caliper = cal.children[0];
  const rc = axialCaliper(M, -1); rc.scale.setScalar(.82); rc.position.set(AXR[0] + 40, AXR[1] - 100, -70); rc.rotation.z = Math.PI + .3; grp('rearCaliper').add(rc);
  brakeLine(grp('handlebar'), M, [[HEAD[0] - 30, HEAD[1] + 190, 280], [HEAD[0] + 30, HEAD[1] + 50, 150], [fk.at(330).x + 40, fk.at(330).y, 110], [AXF[0] - 90, AXF[1] + 120, 80]]);
  put(grp('frontFender'), zAxis(new T.LatheGeometry([[312, -56], [320, -60], [324, 0], [320, 60], [312, 56]].map(([r, y]) => new T.Vector2(r, y)), 40, 1.75, 1.55)), mat(0x141518, .4, .3), ...AXF, 0);   // salpicadera negra
  for (const zz of [1, -1]) put(grp('frontFender'), sharp([[0, 0], [130, 30], [150, 70], [10, 60]], 10, 3, 12), mat(0x141518, .4, .3), AXF[0] - 40, AXF[1] + 250, zz * 66, 0, 0, -.5);
  // chasis perimetral de tubo (plateado): tubos doblados con curvas suaves, tubo de dirección alineado con la horquilla
  for (const z of [1, -1]) {
    frameTube(bike, [[fat(FL - 20).x - 20, fat(FL - 20).y, z * 30], [300, 790, z * 95], [160, 760, z * 120], [-40, 700, z * 120], [-40, 470, z * 120]], 22, silver, 110);
    frameTube(bike, [[fat(FL - 50).x - 10, fat(FL - 50).y - 10, z * 30], [360, 520, z * 115], [200, 300, z * 120], [-50, 330, z * 120], [-40, 470, z * 120]], 17, silver, 90);
    frameTube(bike, [[-40, 520, z * 116], [-300, 700, z * 92], [-500, 832, z * 74]], 11, silver, 80);
    put(bike, sharp([[0, 0], [90, -20], [70, -110], [10, -60]], 14, 4, 18), silver, fat(FL - 20).x - 60, fat(FL - 20).y + 10, z * 40);   // escuadra de refuerzo
    put(bike, zAxis(cyl(36, 22, 24)), M.aluDark, -40, 470, z * 128);                                      // placa del pivote
  }
  frameTube(bike, [[-40, 700, 116], [-330, 800, 92], [-600, 858, 72], [-650, 862, 0], [-600, 858, -72], [-330, 800, -92], [-40, 700, -116]], 13, silver, 60);   // subchasis en U
  frameTube(bike, [[-40, 690, 120], [-40, 690, -120]], 12, silver, 10, false);
  const ht = fat(FL - 22), ht2 = fat(FL + 42); between(bike, [ht.x, ht.y, 0], [ht2.x, ht2.y, 0], 34, silver, 28);   // tubo de dirección
  // mono-cilindro refrigerado por líquido, radiador con aleta y escape bajo el motor
  const eng = put(bike, profile([[-100, 330], [220, 310], [330, 380], [320, 480], [160, 540], [-100, 500]], 240, 30), engM.clone());
  const cy = new T.Group(); cy.position.set(210, 520, 0); cy.rotation.z = -.28; bike.add(cy);
  put(cy, rbox(160, 140, 190, 26), engM, 0, 50, 0); for (let i = 0; i < 5; i++) put(cy, rbox(184, 7, 206, 3), engM, 0, 18 + i * 22, 0);
  put(cy, rbox(176, 64, 200, 26), engM, 0, 150, 0); const vc = new T.Group(); vc.name = 'valveCover'; cy.add(vc); G.valveCover = vc; put(vc, rbox(164, 40, 186, 20), M.aluDark, 0, 196, 0);
  for (const z of [-70, 0, 70]) put(vc, cyl(8, 10, 6), M.chrome, -60, 218, z);
  const pl = new T.Group(); pl.name = 'plug'; cy.add(pl); G.plug = pl; put(pl, cyl(16, 30, 16), M.rubber, 60, 228, 0);
  if (K.sparkPlug) { const sp = K.sparkPlug(); sp.scale.setScalar(.55); sp.position.set(60, 120, 0); pl.add(sp); }
  put(bike, zAxis(lathe([[0, 0], [96, 0], [96, 14], [86, 26], [0, 30]], 48)), M.aluDark, 110, 420, -122).scale.z = -1;
  put(bike, zAxis(lathe([[0, 0], [80, 0], [80, 14], [70, 26], [0, 30]], 48)), M.aluDark, -30, 430, 122);
  put(bike, zAxis(cyl(18, 6, 24)), mat(0xf5b427, .2, 0, { transparent: true, opacity: .85 }), 170, 360, -126);
  const rad = new T.Group(); rad.position.set(380, 640, 0); rad.rotation.z = -.3; bike.add(rad);
  put(rad, rbox(36, 260, 300, 10), M.black);
  const grille = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#121316'; c.fillRect(0, 0, w, h); c.fillStyle = '#3b3e45'; for (let y = 0; y < h; y += 8) c.fillRect(0, y, w, 3); });
  put(rad, new T.PlaneGeometry(260, 220), new T.MeshStandardMaterial({ map: grille, roughness: .6, metalness: .5 }), 19, 0, 0, 0, Math.PI / 2, 0);
  tube(bike, [[300, 560, 20], [380, 470, 40], [340, 280, 30], [160, 220, 0]], 22, M.chrome, 40);              // colector
  const belly = put(bike, profile([[260, 230], [180, 170], [-120, 170], [-160, 240], [-60, 280], [200, 280]], 300, 40), M.black);   // escape bajo el motor
  put(bike, rbox(80, 40, 120, 14), silver, -150, 210, -110);
  put(bike, zAxis(cyl(26, 40, 20)), M.chrome, -170, 200, -150);
  put(bike, sharp([[340, 330], [120, 240], [-130, 250], [-90, 330], [290, 380]], 270, 10), white);               // quilla blanca
  for (const z of [1, -1]) put(bike, sharp([[250, 330], [120, 270], [40, 270], [170, 330]], 8, 2, 10), silver, 0, 0, z * 137);   // corte negro en V
  // tanque estilo NS: alto adelante, techo plano con arista central, paneles de rodilla en gris y extensiones grandes
  // de dos piezas (superior en color de la moto que termina en punta junto a la farola, inferior que cubre el radiador)
  const T_ = grp('tank'), graphite = mat(0x3a3d44, .45, .5), gloss = mat(0x0b0c0e, .15, .3);
  const tank = put(T_, sharp([[430, 830], [395, 960], [310, 1004], [130, 986], [10, 946], [-40, 880], [60, 815], [300, 800]], 300, 34, 60), body);
  tube(T_, [[392, 968, 0], [305, 1018, 0], [130, 1000, 0], [10, 958, 0]], 9, body, 30);                        // arista central del techo
  for (const s of [1, -1]) {

    put(T_, sharp([[200, 840], [190, 935], [130, 958], [10, 905], [-20, 860], [110, 830]], 14, 4, 30), graphite, 0, 0, s * 156, 0, -s * .1, 0);   // panel de rodilla
    decal(T_, 90, 90, 880, s * 166, s > 0 ? -.1 : Math.PI + .1);
    // extensión grande (gris) que cubre medio tanque y baja en punta hacia la horquilla; gráfico blanco en diagonal
    put(T_, sharp([[455, 965], [480, 880], [575, 720], [540, 640], [430, 600], [330, 640], [250, 770], [200, 880], [300, 945]], 26, 7, 24), body, 0, 0, s * 214, 0, s * .11, 0);
    put(T_, sharp([[250, 915], [450, 915], [430, 885], [232, 885]], 8, 2, 6), white, 0, 0, s * 229, 0, s * .11, 0);
    put(T_, sharp([[300, 850], [500, 760], [484, 736], [282, 822]], 8, 2, 6), white, 0, 0, s * 229, 0, s * .11, 0);
    put(T_, sharp([[430, 600], [540, 640], [520, 560], [430, 520], [330, 540], [300, 600]], 22, 5, 16), gloss, 0, 0, s * 196, 0, s * .11, 0);   // panel negro interior
    for (let i = 0; i < 4; i++) put(T_, sharp([[0, 0], [70, 26], [70, 34], [0, 8]], 6, 1.5, 3), graphite, 360 + i * 30, 550 + i * 14, s * (210 - (360 + i * 30) * .11), 0, s * .11, 0);   // ranuras
  }
  put(T_, lathe([[0, 0], [38, 0], [38, 8], [32, 14], [0, 16]], 32), M.alu, 170, 992, 0, 0, 0, .22);   // tapa de gasolina
  // asiento partido, asas partidas, colín alto y delgado que se angosta, stop LED en "V" y porta placa
  put(grp('seat'), profile([[20, 860], [-60, 820], [-350, 820], [-380, 850], [-60, 870]], 260, 40), M.seat);
  put(grp('seat'), profile([[-360, 860], [-420, 880], [-600, 900], [-600, 925], [-420, 912]], 200, 30), M.seat);
  put(bike, sharp([[-330, 830], [-560, 880], [-800, 945], [-820, 925], [-600, 845], [-380, 800]], 110, 10, 26), body);    // centro del colín
  for (const s of [1, -1]) {
    const yaw = -s * .117;                                                                       // los costados se juntan hacia atrás
    put(bike, sharp([[-330, 830], [-560, 886], [-800, 956], [-845, 948], [-830, 905], [-600, 832], [-380, 786]], 16, 5, 22), body, 0, 0, s * 144, 0, yaw, 0);
    put(bike, sharp([[-500, 872], [-740, 932], [-800, 936], [-560, 860]], 10, 3, 12), accent, 0, 0, s * 153, 0, yaw, 0);
    put(bike, sharp([[-420, 800], [-640, 846], [-760, 900], [-700, 860], [-480, 790]], 10, 3, 14), gloss, 0, 0, s * 150, 0, yaw, 0);  // corte negro inferior
    tube(bike, [[-430, 878, s * 128], [-520, 906, s * 128], [-610, 920, s * 112], [-640, 912, s * 100]], 12, M.aluDark, 24);   // asa partida
    tube(bike, [[-470, 866, s * 128], [-430, 878, s * 128]], 12, M.aluDark, 4);
  }
  const tl = new T.Group(); tl.position.set(-838, 938, 0); tl.rotation.z = .3; bike.add(tl);       // stop: carcasa negra y dos franjas LED en V
  put(tl, rbox(40, 54, 130, 14), gloss);
  for (const s of [1, -1]) { put(tl, rbox(8, 12, 66, 5), M.tail, -21, 6, s * 32, -s * .5, 0, 0); put(tl, rbox(7, 8, 50, 4), M.tail, -21, -12, s * 24, -s * .5, 0, 0); }
  put(tl, rbox(4, 50, 124, 12), new T.MeshPhysicalMaterial({ color: 0x5a0a0a, roughness: .05, transparent: true, opacity: .35, clearcoat: 1 }), -22, 0, 0);
  tube(bike, [[-720, 880, 0], [-780, 760, 0], [-830, 680, 0]], 14, M.black, 12);
  put(bike, rbox(20, 150, 190, 8), M.black, -840, 650, 0, 0, 0, -.15);
  put(bike, new T.PlaneGeometry(170, 130), mat(0xf4f4f0, .5), -851, 650, 0, 0, -Math.PI / 2, -.15);
  for (const s of [1, -1]) { tube(bike, [[-800, 720, s * 70], [-810, 720, s * 150]], 6, M.black, 4); put(bike, sharp([[0, 0], [-50, 6], [-50, 20], [0, 22]], 22, 4, 6), M.amber, -790, 712, s * 160); }
  put(grp('swingarm'), zAxis(new T.LatheGeometry([[318, -72], [328, -78], [332, 0], [328, 78], [318, 72]].map(([r, y]) => new T.Vector2(r, y)), 40, 2.27, 1.15)), M.black, ...AXR, 0);
  // farola estilo NS: máscara en escudo inclinada, faro central de proyector, "ojos de lobo" (LED en diagonal a los lados),
  // visera ahumada angulosa y costados en color que se unen con las extensiones del tanque; direccionales en los costados
  const hl = new T.Group(); hl.position.set(560, 880, 0); hl.rotation.z = .3; grp('headlight').add(hl);
  const face = (pts, d, m, x, bev = 6, rd = 18) => { const g = sharp(pts, d, bev, rd); g.rotateY(Math.PI / 2); return put(hl, g, m, x, 0, 0); };
  const lens = new T.MeshPhysicalMaterial({ color: 0x26303a, roughness: .02, metalness: .3, transparent: true, opacity: .25, clearcoat: 1 });
  face([[-92, 96], [-100, 20], [-62, -96], [0, -134], [62, -96], [100, 20], [92, 96], [40, 118], [-40, 118]], 90, gloss, 4, 10, 18);   // carcasa
  face([[-78, 70], [-82, 12], [-46, -86], [0, -116], [46, -86], [82, 12], [78, 70], [30, 88], [-30, 88]], 8, mat(0x4a5058, .15, 1), 50, 2, 14);   // reflector oscuro
  put(hl, cyl(26, 10, 32), mat(0xffffff, .1, 0, { emissive: 0xfff6e6, emissiveIntensity: 2.6 }), 54, 20, 0, 0, 0, Math.PI / 2);   // proyector LED
  put(hl, new T.TorusGeometry(28, 4, 8, 32), M.black, 56, 20, 0, 0, Math.PI / 2, 0);
  for (const s of [1, -1]) put(hl, rbox(5, 8, 96, 3), M.led, 56, -40, s * 58, -s * .95, 0, 0);       // DRL por el borde inferior externo (ojo de lobo)
  face([[-80, 72], [-84, 12], [-48, -90], [0, -120], [48, -90], [84, 12], [80, 72], [30, 92], [-30, 92]], 6, lens, 60, 2, 14);   // mica
  for (const s of [1, -1]) {
    put(hl, sharp([[30, 96], [-80, 116], [-130, 30], [-70, -90], [10, -110]], 10, 3, 18), gloss, 0, 0, s * 92);   // costados negros
    tube(hl, [[-30, -70, s * 90], [-10, -80, s * 130], [10, -84, s * 150]], 6, M.black, 6);                    // varilla de direccional
    put(hl, rbox(40, 20, 26, 8), new T.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: .05, transparent: true, opacity: .8, clearcoat: 1 }), 24, -86, s * 160);
    put(hl, rbox(14, 10, 12, 4), M.amber, 22, -86, s * 160);
  }
  const vs = sharp([[-76, 0], [76, 0], [50, 110], [0, 140], [-50, 110]], 6, 2, 14); vs.rotateY(Math.PI / 2);
  put(hl, vs, new T.MeshPhysicalMaterial({ color: 0x1d2329, roughness: .05, transparent: true, opacity: .75, clearcoat: 1 }), 20, 112, 0, 0, 0, .3);   // visera ahumada
  put(grp('headlight'), rbox(30, 90, 150, 12), M.plastic, 480, 1020, 0, 0, 0, -.3);
  put(grp('headlight'), new T.PlaneGeometry(120, 70), M.screen, 496, 1024, 0).rotation.set(0, Math.PI / 2, -.3);
  handlebar(grp('handlebar'), M, 420, 1040, 380, false);
  for (const z of [1, -1]) { const p = fat(FL + 76); between(grp('handlebar'), [p.x, p.y, z * 50], [420, 1040, z * 52], 14, M.aluDark, 16); }   // torres del manubrio
  // basculante de caja, mono-amortiguador, cadena, estribos, pedales y pata lateral
  // basculante ("tijera") de caja con su pasador, mono-amortiguador y cadena: cada uno se desmonta aparte
  const SW = grp('swingarm'), swA = Math.atan2(470 - AXR[1], -40 - AXR[0]);
  for (const s of [1, -1]) { put(SW, profile([[0, -50], [-560, -30], [-650, -22], [-660, 22], [-560, 30], [0, 54]], 40, 10), silver, -40, 470, s * 140, 0, 0, swA);
    put(SW, profile([[-600, -12], [-690, -12], [-690, 12], [-600, 12]], 8, 3), M.aluDark, -40, 470, s * 164, 0, 0, swA); }        // tensores de cadena
  put(SW, zAxis(cyl(26, 300, 24)), M.aluDark, -40, 470, 0);
  put(SW, sharp([[0, -40], [-170, -40], [-180, 40], [0, 40]], 60, 8), silver, -60, 470, 0, 0, 0, swA);                            // puente con soporte del amortiguador
  put(SW, profile([[-30, 0], [-560, -140], [-570, -120], [-30, 24]], 10, 4), M.black, 0, 490, 122);
  put(grp('pivotBolt'), zAxis(cyl(11, 360, 16)), M.chrome, -40, 470, 0);
  put(grp('pivotBolt'), zAxis(cyl(22, 14, 6)), M.aluDark, -40, 470, 186); put(grp('pivotBolt'), zAxis(cyl(22, 14, 6)), M.aluDark, -40, 470, -186);
  springShock(grp('shock'), M, [-220, 420], [-80, 720], 0, M.gold, M.black);
  const ch = chainBetween(bike, M, [40, 430], 40, AXR, 114, 100); grp('chain').add(ch.parent);
  footpegs(bike, M, -110, 370, 200, silver);
  // detalles que hacen creíble la moto: cables, mangueras, arnés, tornillos de tapas, depósitos, pito y deslizador
  tube(grp('handlebar'), [[392, 1068, -330], [400, 1010, -250], [360, 860, -150], [300, 700, -90], [250, 640, -50]], 5, M.hose, 40);   // cable del acelerador
  tube(grp('handlebar'), [[392, 1068, 330], [410, 1000, 260], [360, 840, 170], [220, 620, 150], [120, 470, 140]], 5, M.hose, 40);       // cable del clutch
  for (const z of [1, -1]) tube(bike, [[350, 560, z * 70], [300, 600, z * 60], [240, 620, z * 30]], 13, M.hose, 16);                       // mangueras del radiador
  tube(bike, [[360, 520, -60], [260, 450, -110], [160, 420, -130]], 12, M.hose, 16);
  tube(bike, [[520, 840, 20], [420, 790, 60], [300, 780, 96], [100, 750, 100], [-150, 760, 60]], 6, M.black, 40);                   // arnés eléctrico
  for (const [cx, cy, R, z] of [[-30, 430, 70, 154], [110, 420, 84, -154]]) for (let i = 0; i < 8; i++) {                            // tornillos de las tapas
    const a = i / 8 * Math.PI * 2; put(bike, zAxis(cyl(6, 8, 6)), M.chrome, cx + Math.cos(a) * R, cy + Math.sin(a) * R, z); }
  const res = mat(0xe8e2d0, .3, 0, { transparent: true, opacity: .75 });
  put(bike, rbox(50, 70, 36, 10), res, 300, 520, -150); put(bike, cyl(12, 12, 10), M.black, 300, 562, -150);                          // depósito del refrigerante
  put(grp('handlebar'), rbox(46, 30, 40, 8), res, 420, 1078, -210); put(grp('handlebar'), cyl(14, 8, 12), M.black, 420, 1097, -210);   // depósito del líquido de frenos
  put(grp('headlight'), zAxis(cyl(34, 22, 24)), M.black, 520, 740, 30);                                                                 // pito
  put(grp('swingarm'), profile([[0, 0], [-260, 12], [-270, 30], [0, 26]], 12, 4), M.black, -60, 488, 146, 0, 0, Math.atan2(470 - AXR[1], -40 - AXR[0]));   // deslizador de cadena
  for (const s of [1, -1]) { put(bike, sharp([[0, 0], [60, 20], [50, 90], [0, 80]], 10, 3), silver, -380, 430, s * 170); put(bike, zAxis(cyl(12, 70, 12)), M.rubber, -350, 480, s * 205); }
  tube(bike, [[-90, 380, 190], [-10, 360, 200], [60, 380, 196]], 8, M.aluDark, 20);
  tube(bike, [[-90, 380, -190], [-10, 352, -200], [70, 352, -200]], 8, M.aluDark, 20);
  tube(bike, [[-60, 360, 130], [-40, 200, 190], [-20, 40, 230]], 10, M.aluDark, 16);
  // caja del filtro de aire bajo el asiento, ejes de rueda y tapa del filtro de aceite (desmontables)
  put(bike, rbox(260, 120, 200, 30), M.black, -170, 720, 0);
  put(grp('filter'), rbox(220, 40, 170, 16), mat(0xf28c28, .9), -170, 790, 0);
  for (let i = 0; i < 6; i++) put(grp('filter'), rbox(220, 4, 6, 2), mat(0xc96a12, .9), -170, 812, -70 + i * 28);
  for (const [n, ax, L] of [['axleF', AXF, 230], ['axleR', AXR, 330]]) { put(grp(n), zAxis(cyl(12, L, 16)), M.chrome, ...ax, 0); put(grp(n), zAxis(cyl(24, 22, 6)), M.aluDark, ax[0], ax[1], L / 2); }
  put(grp('oilCover'), zAxis(lathe([[0, 0], [52, 0], [52, 10], [44, 20], [0, 24]], 40)), silver, 250, 400, 126);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; put(grp('oilCover'), zAxis(cyl(6, 8, 6)), M.chrome, 250 + Math.cos(a) * 40, 400 + Math.sin(a) * 40, 150); }
  put(grp('oilCover'), new T.TorusGeometry(46, 4.5, 10, 40), mat(0x111111, .7), 250, 400, 124);                   // o-ring de la tapa
  put(grp('oilDrip'), new T.SphereGeometry(15, 14, 12), mat(0xc98a1a, .08, .2, { transparent: true, opacity: .9 }), 250, 352, 128).scale.y = 1.4;   // gota de aceite (anuncios)
  const root = new T.Group(); bike.scale.setScalar(S); root.add(bike);
  return { bike: root, F, R, engine: eng, chain: ch, tank, groups: G };
}

// ---------------------------------------------------------------- registrar
const prev = K.bike;
K.bike = (C, style = 'naked', o) => style === 'enduro' ? enduroBike(C) : style === 'scooter' ? scooterBike(C) : style === 'ns200' ? ns200(C, o) : style === 'ns200_red' ? ns200(C, { body: 0xb5121b, accent: 0x1c1d22, ...o }) : prev(C, style);
Object.assign(K, { enduro: enduroBike, scooter: scooterBike, ns200, makeWheel });
Object.assign(K.ITEMS, { enduro: C => enduroBike(C).bike, scooter: C => scooterBike(C).bike, ns200: C => ns200(C).bike, ns200_red: C => ns200(C, { body: 0xb5121b, accent: 0x1c1d22 }).bike });
