// Diorama 3D: un taller de motos en miniatura (estilo juguete, luz cálida de lámparas, ciudad de
// noche por la ventana) que la cámara recorre en una sola toma, de estación en estación.
// Los textos son tarjetas con título, subtítulo y "píldoras" de colores que se van sumando.
// Unidades: ~1 unidad = 1 cm del taller en miniatura. Eje Y hacia arriba; la cámara mira desde +z.
const MC = window.MC;
const { T, render3d, view, shotCamera, shadowed } = MC.three;

const { rbox, mat, paint, put, rod, cityTexture, bike, mechanic, pose } = MC.kit;

// ---------------------------------------------------------------- el taller completo
function buildShop(key, style = 'naked', p = {}) {
  if (MC.cache[key]) return MC.cache[key];
  const C = { brand: new T.Color(TH.primary).getHex() };
  const scene = new T.Scene();
  scene.environment = MC.three.R3.env; scene.environmentIntensity = 1.05;
  // luz más alegre y con menos fuentes (cada luz cuesta en cada píxel): cielo/rebote, luna fría, frontal cálida y el foco con sombra
  scene.add(new T.HemisphereLight(0xa6b4ee, 0x6a4c30, 2.6));
  const moon = new T.DirectionalLight(0xbfccff, 1.1); moon.position.set(600, 900, 900); scene.add(moon);
  const warm = new T.DirectionalLight(0xffe0b8, 2.1); warm.position.set(-200, 700, 1300); scene.add(warm);
  // piso y paredes
  const floorM = mat(0xa39684, .62), wallM = mat(0x5f6c9e, .85), trim = mat(C.brand, .5);
  put(scene, rbox(1700, 60, 1100, 18), floorM, 0, -30, 0);
  put(scene, new T.BoxGeometry(1702, 10, 6), trim, 0, -4, 552);
  put(scene, new T.BoxGeometry(6, 10, 1102), trim, 852, -4, 0);
  const wall = (w, h, x, y) => put(scene, new T.BoxGeometry(w, h, 24), wallM, x, y, -538);
  wall(700, 600, -500, 300); wall(300, 600, 700, 300); wall(500, 140, 300, 70); wall(500, 120, 300, 540);    // ventana x 50..550, y 140..480
  put(scene, new T.BoxGeometry(24, 600, 1100), wallM, -838, 300, 0);
  for (const mx of [175, 300, 425]) put(scene, rbox(10, 340, 30, 4), mat(0x22252b, .5), mx, 310, -532);
  put(scene, rbox(500, 10, 30, 4), mat(0x22252b, .5), 300, 310, -532);
  put(scene, new T.PlaneGeometry(1400, 700), new T.MeshBasicMaterial({ map: cityTexture() }), 300, 330, -1000);
  // logo de la marca en la pared izquierda
  if (MC.logo) {
    const lt = new T.Texture(MC.logo); lt.colorSpace = T.SRGBColorSpace; lt.needsUpdate = true;
    const ar = MC.logo.width / MC.logo.height;
    put(scene, new T.PlaneGeometry(340 * ar, 340), new T.MeshStandardMaterial({ map: lt, transparent: true, roughness: .6 }), -824, 360, -40, 0, Math.PI / 2, 0);
  }
  // elevador con la moto
  const liftM = mat(0x2b2f36, .45, .6);
  put(scene, rbox(600, 22, 230, 6), liftM, 0, 128, 40); put(scene, new T.BoxGeometry(602, 6, 6), trim, 0, 126, 156);
  put(scene, rbox(540, 12, 200, 4), liftM, 0, 6, 40);
  for (const s of [-1, 1]) { put(scene, rbox(300, 16, 14, 6), liftM, 0, 66, 40 + s * 80, 0, 0, .38); put(scene, rbox(300, 16, 14, 6), liftM, 0, 66, 40 + s * 80, 0, 0, -.38);
    put(scene, new T.CylinderGeometry(10, 10, 20, 16), mat(0xc9ced4, .2, 1), 0, 66, 40 + s * 92, Math.PI / 2); }
  put(scene, rbox(120, 46, 70, 14), mat(C.brand, .4), 250, 30, 40); put(scene, rbox(40, 120, 40, 12), mat(0x2b2b2b, .5), 330, 60, 120, 0, 0, -.6);   // bomba y pedal del elevador
  const B = style === 'modelo' ? MC.kit.modelBike(C, p.model_url, p.model_setup) : bike(C, style); B.bike.position.set(0, 139, 40); scene.add(shadowed(B.bike));
  // mecánico
  const M = mechanic(C); M.g.position.set(-400, 0, 270); M.g.rotation.y = .75; scene.add(shadowed(M.g));
  // tablero de herramientas + caja roja
  put(scene, rbox(440, 250, 10, 4), mat(0x23272f, .7), -470, 330, -522);
  for (let i = 0; i < 20; i++) for (let j = 0; j < 9; j++) put(scene, new T.CylinderGeometry(2.2, 2.2, 3, 6), mat(0x0e1014, .6), -680 + i * 22, 220 + j * 26, -516, Math.PI / 2);   // perforaciones
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const K = MC.kit, hang = (o, x, y, sc, rz = 0) => { o.scale.setScalar(sc); o.position.set(x, y, -510); o.rotation.z = rz; scene.add(o); return o; };
  for (let i = 0; i < 7; i++) hang(K.comboWrench(150 + i * 14), -660 + i * 26, 360, .62, Math.PI / 2);       // llaves en escalera
  hang(K.ratchet(), -440, 380, .55, Math.PI / 2);
  for (let i = 0; i < 3; i++) hang(K.screwdriver(C), -390 + i * 26, 330, .5, 0);
  hang(K.pliers(C), -300, 360, .5, Math.PI / 2);
  for (let i = 0; i < 6; i++) put(scene, new T.CylinderGeometry(7 + i, 7 + i, 18, 6), mat(0xc9ced4, .2, 1), -650 + i * 30, 245, -510, Math.PI / 2);   // dados
  const box = put(scene, rbox(240, 200, 120, 12), paint(C.brand), -500, 100, -450);
  for (let i = 0; i < 4; i++) { put(scene, new T.BoxGeometry(232, 3, 4), mat(0x5a0303, .6), -500, 40 + i * 40, -389); put(scene, rbox(60, 8, 8, 3), mat(0xd0d4da, .2, 1), -500, 58 + i * 40, -386); }
  // estante de llantas
  const rackM = mat(0x30343b, .5, .6), tires = [];
  for (const y of [70, 210]) put(scene, rbox(300, 12, 120, 5), rackM, 640, y - 64, -440);
  for (const x of [500, 780]) put(scene, rbox(14, 300, 120, 5), rackM, x, 140, -440);
  for (const y of [70, 210]) for (let i = 0; i < 4; i++) {
    const tg = new T.Group(); tg.position.set(545 + i * 64, y, -440); tg.rotation.y = Math.PI / 2; scene.add(tg);
    const ti = K.tire(46, 15); tg.add(ti); tires.push(ti.children[0]);
  }
  // banco de trabajo con aceites y lámpara
  put(scene, rbox(280, 20, 150, 5), mat(0x7a5236, .7), -560, 150, 150);
  for (const [x, z] of [[-690, 85], [-430, 85], [-690, 215], [-430, 215]]) put(scene, new T.CylinderGeometry(8, 8, 140, 12), mat(0x2b2b2b, .6), x, 70, z);
  put(scene, rbox(260, 12, 130, 4), mat(0x2b2b2b, .6), -560, 40, 150);                                 // repisa baja
  const vise = new T.Group(); vise.position.set(-445, 160, 120); scene.add(vise);                          // prensa de banco
  put(vise, rbox(60, 30, 50, 8), mat(C.brand, .4), 0, 18, 0); put(vise, rbox(16, 40, 50, 4), mat(0x8f959c, .3, 1), -24, 40, 0); put(vise, rbox(16, 40, 50, 4), mat(0x8f959c, .3, 1), 18, 40, 0);
  put(vise, new T.CylinderGeometry(5, 5, 80, 10), mat(0xc9ced4, .2, 1), 50, 30, 0, 0, 0, Math.PI / 2);
  const onBench = (o, x, z, sc, ry = 0) => { o.scale.setScalar(sc); o.position.set(x, 160, z); o.rotation.y = ry; scene.add(o); return o; };
  onBench(K.oilBottle(C), -650, 130, .5, .3); onBench(K.oilBottle(C), -615, 175, .5, -.2);
  onBench(K.sprayCan(C), -560, 120, .45, .4); onBench(K.oilFilter(C), -520, 185, .5);
  const gz = K.gauge(C); gz.scale.setScalar(.45); gz.position.set(-600, 172, 200); gz.rotation.set(-1.2, 0, .4); scene.add(gz);
  const hm = K.helmet(C); hm.scale.setScalar(.6); hm.position.set(-500, 266, -450); hm.rotation.y = .7; scene.add(hm);          // casco sobre la caja
  const bt = K.battery(C); bt.scale.setScalar(.55); bt.position.set(260, 33, 230); bt.rotation.y = -.5; scene.add(bt);        // batería en el piso
  put(scene, new T.ConeGeometry(48, 56, 20, 1, true), mat(0x1c1c1c, .5, .5, { side: T.DoubleSide }), -480, 310, 150);
  put(scene, new T.SphereGeometry(14, 12, 10), mat(0xffffff, .3, 0, { emissive: 0xffd08a, emissiveIntensity: 2.5 }), -480, 292, 150);
  rod(scene, [-480, 340, 150], [-520, 160, 150], 4, mat(0x1c1c1c, .5));
  // cono de seguridad
  put(scene, new T.ConeGeometry(32, 90, 20), mat(0xff6a13, .6), 700, 50, 400); put(scene, rbox(80, 10, 80, 4), mat(0x1c1c1c, .6), 700, 5, 400);
  // lámpara colgante sobre el elevador (luz principal, cálida, con sombra)
  put(scene, new T.ConeGeometry(70, 60, 24, 1, true), mat(0x1c1c1c, .5, .5, { side: T.DoubleSide }), 0, 640, 40);
  put(scene, new T.SphereGeometry(18, 12, 10), mat(0xffffff, .3, 0, { emissive: 0xffd08a, emissiveIntensity: 3 }), 0, 618, 40);
  const spot = new T.SpotLight(0xffd29a, 13, 0, .85, .55, 0); spot.position.set(0, 620, 40); spot.target.position.set(0, 0, 40);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.0006; scene.add(spot, spot.target);
  shadowed(scene); scene.traverse(o => { if (o.isMesh && o.material.isMeshBasicMaterial) { o.castShadow = o.receiveShadow = false; } });
  // juntar mallas por material (de ~1500 dibujos a unos cientos): solo quedan sueltas las piezas que se mueven
  const dyn = new Set([...Object.values(B.groups || {}), B.F.w, B.R.w, M.g, M.up, M.head, M.mouth, ...(M.eyes || []), M.armL, M.armR, M.elbowL, M.elbowR, M.legL, M.legR].filter(Boolean));
  if (!window.__NOBAKE) MC.three.bake(scene, dyn);
  const cam = new T.PerspectiveCamera(30, 1080 / 1920, 20, 9000);
  const glow = { brakes: [B.F.parts.disc, B.F.parts.caliper], chain: [B.chain, B.R.parts.sprocket], tires: tires, engine: [B.engine] };
  for (const k in glow) glow[k] = glow[k].filter(m => m && m.material && !Array.isArray(m.material));   // un modelo descargado puede no tener todas
  return (MC.cache[key] = { scene, cam, B, M, glow });
}

// estaciones de cámara: punto que se mira, distancia, giro, inclinación
const STATIONS = {
  overview: { target: [-120, 120, -60], dist: 2750, yaw: .36, pitch: .7, fov: 30 },
  bike: { target: [0, 300, 40], dist: 1500, yaw: .3, pitch: .26 },
  brakes: { target: [170, 230, 60], dist: 900, yaw: .3, pitch: .18 },
  chain: { target: [-100, 215, 70], dist: 760, yaw: -.06, pitch: .14 },
  engine: { target: [10, 290, 40], dist: 1000, yaw: .45, pitch: .28 },
  tires: { target: [640, 170, -440], dist: 1100, yaw: .2, pitch: .2 },
  tools: { target: [-470, 300, -470], dist: 1100, yaw: .1, pitch: .16 },
  mechanic: { target: [-400, 240, 270], dist: 1100, yaw: .45, pitch: .14 },
  hello: { target: [-390, 300, 270], dist: 1150, yaw: .62, pitch: .1 },          // primer plano del mecánico (saludo)
  fork: { target: [150, 330, 90], dist: 1000, yaw: .6, pitch: .12 },             // dirección, barras y placas
  swingarm: { target: [-160, 210, 80], dist: 1150, yaw: -.35, pitch: .2 },     // tijera, amortiguador y cadena
  logo: { target: [-820, 360, -40], dist: 1100, yaw: 1.25, pitch: .08 },
  side: { target: [0, 260, 40], dist: 1700, yaw: .12, pitch: .14 },
  front: { target: [190, 230, 60], dist: 1150, yaw: .55, pitch: .16 },
  rear: { target: [-180, 230, 60], dist: 1150, yaw: -.5, pitch: .16 },
  engine_top: { target: [40, 330, 40], dist: 950, yaw: .35, pitch: .6 },
  seat: { target: [-40, 380, 40], dist: 1300, yaw: .3, pitch: .4 },
};

// arma las claves de cámara: viaje suave hasta cada estación y acercamiento lento mientras se habla
function stationKeys(list, s) {
  const keys = [];
  list.forEach((st, i) => {
    const P = { ...STATIONS[st.view || 'overview'], ...(st.camera || {}) }, at = has(st.at) ? st.at : s.start;
    const next = i + 1 < list.length ? (has(list[i + 1].at) ? list[i + 1].at : s.end) : s.end;
    const arrive = i === 0 ? at : at + (st.travel || 1.1);
    if (i === 0) keys.push({ at: s.start, ...P, dist: P.dist * 1.08, yaw: P.yaw - .06 });
    keys.push({ at: arrive, ...P });
    keys.push({ at: Math.max(arrive + .1, next - .05), ...P, dist: P.dist * .9, yaw: P.yaw + .05 });
  });
  return keys;
}

// efecto maqueta (tilt-shift): arriba y abajo desenfocados, franja central nítida.
// Se desenfoca achicando la imagen (barato en CPU) y se funde con un degradado.
const TS = {};
function tiltShift(k) {
  if (!TS.s) { TS.s = document.createElement('canvas'); TS.s.width = 216; TS.s.height = 384; TS.sx = TS.s.getContext('2d');
               TS.m = document.createElement('canvas'); TS.m.width = 216; TS.m.height = 384; TS.mx = TS.m.getContext('2d'); }
  // todo el trabajo se hace en pequeño (216x384) y se amplía UNA vez con suavizado simple: ampliar con calidad
  // "alta" y enmascarar a tamaño completo costaba ~390 ms por cuadro en CPU
  TS.sx.filter = 'blur(2px)'; TS.sx.drawImage(MC.canvas, 0, 0, 216, 384); TS.sx.filter = 'none';
  const m = TS.mx; m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, 216, 384); m.drawImage(TS.s, 0, 0);
  m.globalCompositeOperation = 'destination-in';
  const g = m.createLinearGradient(0, 0, 0, 384);
  g.addColorStop(0, `rgba(0,0,0,${k})`); g.addColorStop(.3, 'rgba(0,0,0,0)'); g.addColorStop(.62, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${k})`);
  m.fillStyle = g; m.fillRect(0, 0, 216, 384);
  x.save(); x.imageSmoothingQuality = 'low'; x.drawImage(TS.m, 0, 0, W, H); x.restore();
}

// fondo de noche detrás del diorama
let NIGHT = null;
function nightBackground() {                 // se pinta una sola vez y luego se copia (copiar cuesta mucho menos que pintar)
  if (!NIGHT || NIGHT.width !== W || NIGHT.height !== H) {
    NIGHT = document.createElement('canvas'); NIGHT.width = W; NIGHT.height = H; const n = NIGHT.getContext('2d');
    const g = n.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a2560'); g.addColorStop(1, '#2a3878');
    n.fillStyle = g; n.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { n.fillStyle = `rgba(255,255,255,${.15 + .35 * hash(i * 3.3)})`; n.fillRect(hash(i * 7.1) * W, hash(i * 1.7) * H * .6, 2, 2); }
  }
  x.drawImage(NIGHT, 0, 0);
}

(MC.OPAQUE = MC.OPAQUE || new Set()).add('diorama');
MC.scenes.diorama = function (t, s, p) {
  const st = buildShop('shop' + s.start + (p.bike || ''), p.bike || 'naked', p);
  const lt = t - s.start;
  nightBackground();
  const list = p.stations && p.stations.length ? p.stations : [{ view: 'overview' }];
  shotCamera(st.cam, stationKeys(list, s), t, s);
  // animación de vida: el mecánico respira y mira, las ruedas giran cuando se habla de ellas
  const cur = list.filter(q => !has(q.at) || t >= q.at).pop() || list[0];
  const ci = list.indexOf(cur), since = t - (has(cur.at) ? cur.at : s.start);
  // el mecánico: cada estación tiene su gesto; se funde desde el gesto anterior (sin saltos) y mueve la boca con la voz
  const actOf = (q, i) => q.pose || (i === 0 ? 'wave' : ['mechanic', 'hello'].includes(q.view) ? 'thumbs' : i === list.length - 1 ? 'wave' : 'point');
  const env = d => d < 6 ? 1 : 1 - prog(d, 6, 6.6);
  const prev = ci > 0 ? list[ci - 1] : null, pAt = prev ? (has(prev.at) ? prev.at : s.start) : 0;
  pose(st.M, actOf(cur, ci), env(since), lt, {
    from: prev ? { name: actOf(prev, ci - 1), k: env(since + (has(cur.at) ? cur.at : s.start) - pAt) } : { name: 'idle', k: 0 },
    w: eio(prog(since, .1, .8)), talk: talking(t) });
  const spin = p.moves ? (cur.spin || 0) : ['chain', 'brakes', 'tires'].includes(cur.view) ? 2.2 : .35;
  st.B.R.w.rotation.z = -lt * spin; st.B.F.w.rotation.z = -lt * spin;
  // desarme y ensamble: cada conjunto se desplaza (mm) y vuelve; varias jugadas sobre una pieza se suman
  if (p.moves && st.B.groups) {
    const off = {};
    for (const m of p.moves) {
      const g = st.B.groups[m.part]; if (!g) continue;
      const d = m.dur || 1.0, k = eio(prog(t, m.at, m.at + d)) * (1 - (has(m.back_at) ? eio(prog(t, m.back_at, m.back_at + (m.back_dur || d))) : 0));
      const o = off[m.part] || (off[m.part] = { p: [0, 0, 0], r: [0, 0, 0] });
      for (let i = 0; i < 3; i++) { o.p[i] += (m.to || [0, 0, 0])[i] * k; o.r[i] += (m.rot || [0, 0, 0])[i] * k; }
    }
    for (const [n, g] of Object.entries(st.B.groups)) {
      if (!g.userData.base) g.userData.base = { p: g.position.clone(), r: g.rotation.clone() };
      const o = off[n] || { p: [0, 0, 0], r: [0, 0, 0] }, b = g.userData.base;
      g.position.set(b.p.x + o.p[0], b.p.y + o.p[1], b.p.z + o.p[2]); g.rotation.set(b.r.x + o.r[0], b.r.y + o.r[1], b.r.z + o.r[2]);
    }
  }
  for (const [name, meshes] of Object.entries(st.glow)) {
    const on = cur.view === name ? .5 + .5 * Math.sin(lt * 5) : 0;
    for (const m of meshes) { m.material.emissive = m.material.emissive || new T.Color(); m.material.emissive.setHex(new T.Color(TH.primary).getHex()); const dark = m.material.color.r + m.material.color.g + m.material.color.b < .15;   // piezas negras (llantas): brillo muy leve
      m.material.emissiveIntensity = (dark ? .035 : .22) * on; }
  }
  const v = view(st.cam, 1080, 1920, 0, 0);
  render3d(st.scene, v, .14);
  if (p.tilt_shift !== false) tiltShift(p.tilt_shift || .9);
  bubbles(t, p.bubbles, st, v);
  marks(t, p.marks, st, v);
  cards(t, p.cards);
};

// ¿está hablando el narrador en el instante t? 0..1 con entrada y salida suaves (palabras de la voz)
function talking(t) {
  const sp = MC.spec.speech; if (!sp) return 0;
  for (const [a, b] of sp) if (t > a - .05 && t < b + .05) return Math.min(1, (t - a + .05) / .08, (b + .05 - t) / .08);
  return 0;
}
// señal sobre una pieza: anillo que late encima de la pieza (sigue a la pieza aunque se mueva), línea y etiqueta.
// part = conjunto desmontable (B.groups) o point = [x, y, z] en milímetros de la moto
const MK = { box: null, v: null };
function marks(t, list, st, v) {
  if (!list || MC.teasing) return;
  MK.box = MK.box || new T.Box3(); MK.v = MK.v || new T.Vector3();
  for (const m of list) {
    if (t < m.at || (has(m.until) && t > m.until + .25)) continue;
    const k = eout(prog(t, m.at, m.at + .3)) * (has(m.until) ? 1 - prog(t, m.until, m.until + .25) : 1);
    if (k <= 0) continue;
    const g = m.part && st.B.groups && st.B.groups[m.part];
    if (g) MK.box.setFromObject(g).getCenter(MK.v);
    else if (m.point) { MK.v.set(...m.point); st.B.bike.children[0].localToWorld(MK.v); }
    else continue;
    let [px, py] = v.project(MK.v.x, MK.v.y, MK.v.z);
    if (m.offset) { px += m.offset[0]; py += m.offset[1]; }
    const side = m.side || (px < W / 2 ? 1 : -1);
    const lx = Math.min(W - 170, Math.max(170, px + side * (m.dx ?? 250))), ly = Math.min(1480, Math.max(760, py + (m.dy ?? -170)));
    const pulse = .5 + .5 * Math.sin((t - m.at) * 7), col = '#F5B427';
    x.save(); x.globalAlpha = Math.min(1, k * 1.2);
    x.strokeStyle = col; x.lineWidth = 6; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 10;
    x.beginPath(); x.arc(px, py, (30 + 8 * pulse) * k, 0, Math.PI * 2); x.stroke();                       // anillo
    x.globalAlpha *= .35 * (1 - pulse); x.lineWidth = 3; x.beginPath(); x.arc(px, py, 30 + 40 * pulse, 0, Math.PI * 2); x.stroke();   // onda
    x.globalAlpha = Math.min(1, k * 1.2); x.fillStyle = col; x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2); x.fill();
    const u = eout(prog(t, m.at + .05, m.at + .35)), ang = Math.atan2(ly - py, lx - px), r0 = 38;                   // línea que crece
    const ax = px + Math.cos(ang) * r0, ay = py + Math.sin(ang) * r0;
    x.lineWidth = 5; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + (lx - ax) * u, ay + (ly - ay) * u); x.stroke();
    x.restore();
    if (u > .6) pill(lx, ly, m.text, m.color || 'white', back(prog(t, m.at + .2, m.at + .55)) * k, m.size || 44);
  }
}

// globo de diálogo junto a la cabeza del mecánico: aparece con rebote y escribe el texto letra por letra
function bubbles(t, list, st, v) {
  if (!list || MC.teasing) return;
  for (const b of list) {
    if (t < b.at || (has(b.until) && t > b.until + .25)) continue;
    const k = back(prog(t, b.at, b.at + .35)) * (has(b.until) ? 1 - prog(t, b.until, b.until + .25) : 1);
    if (k <= 0) continue;
    const hp = new T.Vector3(); st.M.head.getWorldPosition(hp); hp.y += 60;
    const [hx, hy] = v.project(hp.x, hp.y, hp.z);
    const size = b.size || 54, full = b.text, reveal = b.type === false ? 1 : prog(t, b.at + .15, b.at + .15 + Math.min(full.length * .045, (has(b.until) ? b.until - b.at : 3) * .6));
    x.save(); x.font = FONT(800, size, false);
    const words = full.split(' '), lines = []; let ln = '';
    for (const w of words) { const tr = ln ? ln + ' ' + w : w; if (x.measureText(tr).width > (b.width || 640) && ln) { lines.push(ln); ln = w; } else ln = tr; }
    lines.push(ln);
    const lw = Math.max(...lines.map(l => x.measureText(l).width)), pad = size * .6, bw = lw + pad * 2, bh = lines.length * size * 1.22 + pad * 1.4;
    const cx = Math.min(W - 60 - bw / 2, Math.max(40 + bw / 2, hx + (b.dx ?? 160))), cy = Math.max(240 + bh / 2, hy - (b.dy ?? 230));     // debajo de la marca de agua
    x.translate(hx, hy); x.scale(k, k); x.translate(-hx, -hy);
    const tail = () => { x.beginPath(); x.moveTo(cx - 40, cy + bh / 2 - 4); x.quadraticCurveTo(cx - 60, cy + bh / 2 + 50, hx + 10, hy + 6); x.quadraticCurveTo(cx - 10, cy + bh / 2 + 30, cx + 20, cy + bh / 2 - 4); x.closePath(); };
    x.fillStyle = 'rgba(0,0,0,.35)'; x.save(); x.translate(6, 10); rrect(cx - bw / 2, cy - bh / 2, bw, bh, 38); x.fill(); tail(); x.fill(); x.restore();
    x.fillStyle = '#fff'; rrect(cx - bw / 2, cy - bh / 2, bw, bh, 38); x.fill(); tail(); x.fill();
    let left = Math.max(Math.round(full.length * reveal), full.indexOf(' ') + 1);   // la primera palabra sale de una vez
    x.fillStyle = '#141414'; x.textAlign = 'left'; x.textBaseline = 'middle';
    lines.forEach((l, i) => { const part = l.slice(0, Math.max(0, left)); left -= l.length + 1;
      const ly = cy - bh / 2 + pad * .7 + size * 1.22 * (i + .5);
      if (b.accent && part.includes(b.accent)) { x.fillText(part, cx - bw / 2 + pad, ly); const pre = x.measureText(part.slice(0, part.indexOf(b.accent))).width; x.fillStyle = TH.primary; x.fillText(b.accent, cx - bw / 2 + pad + pre, ly); x.fillStyle = '#141414'; }
      else x.fillText(part, cx - bw / 2 + pad, ly); });
    x.restore();
  }
}

// ---------------------------------------------------------------- tarjetas de texto con píldoras
const PILL = { red: [null, '#fff'], white: ['#fff', '#141414'], yellow: ['#F5B427', '#141414'], dark: ['#15161a', '#fff'], green: ['#3DBE6A', '#0d1a10'] };
function pill(cx, cy, text, color, k, size = 46) {
  size = size || 46;
  if (k <= 0) return 0;
  let [bg, fg] = PILL[color] || PILL.white; bg = bg || TH.primary;
  x.font = FONT(800, size, false); const w = x.measureText(text).width + size * 1.1, h = size * 1.5;
  x.save(); x.translate(cx, cy); x.scale(k, k);
  x.fillStyle = 'rgba(0,0,0,.35)'; rrect(-w / 2 + 4, -h / 2 + 6, w, h, h / 2); x.fill();
  x.fillStyle = bg; rrect(-w / 2, -h / 2, w, h, h / 2); x.fill();
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 0, 2);
  x.restore();
  return w;
}
function cards(t, list) {
  if (!list || MC.teasing) return;
  for (const c of list) {
    if (t < c.at || (has(c.until) && t > c.until + .3)) continue;
    const out = has(c.until) ? prog(t, c.until, c.until + .3) : 0, a = 1 - out;
    const y0 = c.y || 520;
    x.save(); x.globalAlpha = a; x.translate(0, -40 * out);
    if (c.kicker) {                                      // frase pequeña arriba del título
      const k = prog(t, c.at, c.at + .25);
      x.globalAlpha = a * k; x.font = FONT(700, 40); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#F5B427'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 12; x.fillText(c.kicker, W / 2, y0 - 78); x.shadowBlur = 0;
      x.globalAlpha = a;
    }
    if (c.title) {
      const k = back(prog(t, c.at, c.at + .45));
      x.save(); x.translate(W / 2, y0); x.scale(k, k);
      x.font = FONT(900, c.size || 96, false); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(0,0,0,.65)'; x.shadowBlur = 24; x.shadowOffsetY = 6; x.fillStyle = '#fff';
      x.fillText(c.title, 0, 0);
      if (c.accent) {                                   // una palabra del título en color de marca
        const full = x.measureText(c.title).width, pre = x.measureText(c.title.slice(0, c.title.indexOf(c.accent))).width;
        x.fillStyle = TH.accent; x.textAlign = 'left'; x.fillText(c.accent, -full / 2 + pre, 0);
      }
      x.restore();
    }
    // píldoras: filas centradas; cada una aparece en su momento (con flecha opcional entre la 1ª y la 2ª)
    const rows = []; (c.pills || []).forEach(pl => { const r = pl.row || 0; (rows[r] = rows[r] || []).push(pl); });
    rows.forEach((row, ri) => {
      x.font = FONT(800, 46, false);
      const gap = c.arrow && ri === 0 ? 120 : 28;
      const ws = row.map(pl => { x.font = FONT(800, pl.size || 46, false); return x.measureText(pl.text).width + (pl.size || 46) * 1.1; });
      let cx = W / 2 - (ws.reduce((a, b) => a + b, 0) + gap * (row.length - 1)) / 2;
      const cy = y0 + 120 + ri * 92;
      row.forEach((pl, i) => {
        const k = back(prog(t, pl.at, pl.at + .4));
        if (c.arrow && ri === 0 && i === 1 && k > 0) {
          const ax = cx - gap + 18, bx = cx - 18, u = eout(prog(t, pl.at - .1, pl.at + .25));
          x.save(); x.strokeStyle = '#F5B427'; x.lineWidth = 6; x.lineCap = 'round';
          x.beginPath(); x.moveTo(ax, cy); x.quadraticCurveTo((ax + bx) / 2, cy - 34, ax + (bx - ax) * u, cy - 4 * (1 - u)); x.stroke();
          if (u > .9) { x.beginPath(); x.moveTo(bx - 16, cy - 14); x.lineTo(bx, cy - 2); x.lineTo(bx - 18, cy + 8); x.stroke(); }
          x.restore();
        }
        pill(cx + ws[i] / 2, cy + (pl.size ? (pl.size - 46) * .6 : 0), pl.text, pl.color, k, pl.size);
        cx += ws[i] + gap;
      });
    });
    if (c.note) {                                        // comentario en cursiva debajo
      const k = prog(t, c.note_at || c.at + .6, (c.note_at || c.at + .6) + .3);
      x.globalAlpha = a * k; x.font = FONT(800, 50); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = c.note_color === 'white' ? '#fff' : '#F5B427'; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 14;
      x.fillText(c.note, W / 2, y0 + 120 + rows.length * 92 + 10);
    }
    x.restore();
  }
}
