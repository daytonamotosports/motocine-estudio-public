// Estilo "maqueta" minimalista: fondo crema, cámara isométrica (sin perspectiva), objetos sencillos en colores
// pastel con sombras suaves, cada pieza aparece con un rebote justo cuando se nombra y la cámara se acerca a ella.
// Encima: cápsula de la marca, título con letra serif elegante y subtítulo en caja negra con letra de máquina.
// Referencia del usuario (20-oct-2026): video "Dashboards 3D" (ciudad isométrica en pastel sobre fondo claro).
const MC = window.MC;
const { T, render3d, view } = MC.three;
const { rbox } = MC.kit;

export const PAL = { cream: 0xf1efea, slab: 0xe6e5e1, slabTop: 0xefeeea, road: 0xd8d7d3, blue: 0x2f45d8, mint: 0x46c79a,
  purple: 0x8b55dc, orange: 0xf0894a, pink: 0xf07fae, yellow: 0xf3c24a, red: 0xe3141b, dark: 0x2a2b31, wood: 0xc8955a,
  green: 0x5cc76a, trunk: 0x8a5a36, white: 0xfafaf8, grey: 0xb9bcc2, steel: 0x9aa0a8 };
const M = {};
const m = (hex, rough = .75, metal = 0) => M[hex + ':' + rough] || (M[hex + ':' + rough] = new T.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }));
const add = (g, geo, mat, x = 0, y = 0, z = 0, ry = 0) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const cyl = (r, h, s = 20) => new T.CylinderGeometry(r, r, h, s);

function label(text, bg = '#e3141b', fg = '#fff') {                     // letrero (textura) para fachadas
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128); g.fillStyle = fg; g.font = '800 64px Montserrat';
  const fs = Math.min(64, 64 * 470 / g.measureText(text).width); g.font = `800 ${fs}px Montserrat`;   // texto largo: cabe g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return new T.MeshStandardMaterial({ map: t, roughness: .6 });
}

// ---------------------------------------------------------------- objetos sencillos (unidades: cm de maqueta)
const KIND = {
  tree(o) { const g = new T.Group(); add(g, cyl(5, 30, 10), m(PAL.trunk), 0, 15); add(g, new T.SphereGeometry(26, 18, 14), m(o.color || PAL.green, .8), 0, 52); return g; },
  house(o) { const g = new T.Group(); add(g, rbox(80, 60, 70, 6), m(PAL.white), 0, 30);
    const roof = add(g, new T.ConeGeometry(64, 40, 4), m(o.color || PAL.orange), 0, 80, 0, Math.PI / 4); roof.scale.set(1, 1, .9);
    add(g, rbox(18, 34, 4, 2), m(o.color || PAL.orange), 0, 17, 36); return g; },
  taller(o) {                                        // el taller Daytona: nave azul con techo de canales y letrero rojo
    const g = new T.Group(), c = o.color || PAL.blue;
    add(g, rbox(300, 130, 190, 8), m(c), 0, 65);
    for (let i = 0; i < 9; i++) add(g, rbox(300, 10, 12, 4), m(new T.Color(c).multiplyScalar(.75).getHex()), 0, 134, -84 + i * 21);
    for (let i = 0; i < 3; i++) add(g, rbox(66, 82, 4, 3), m(PAL.white, .5), -95 + i * 95, 41, 96);
    for (let i = 0; i < 5; i++) add(g, rbox(26, 14, 4, 2), m(PAL.white, .4), -120 + i * 60, 108, 96);
    const sign = add(g, new T.BoxGeometry(150, 34, 6), label(o.text || 'DAYTONA'), 40, 150, 70); sign.castShadow = false;
    return g; },
  tower(o) { const g = new T.Group(), c = o.color || PAL.mint, h = o.h || 330; add(g, rbox(110, h, 110, 4), m(c), 0, h / 2);
    for (let y = 30; y < h - 10; y += 22) add(g, new T.BoxGeometry(112, 6, 112), m(new T.Color(c).lerp(new T.Color(0xffffff), .5).getHex()), 0, y);
    add(g, rbox(70, 14, 70, 3), m(new T.Color(c).multiplyScalar(.8).getHex()), 0, h + 7); return g; },
  box(o) { const g = new T.Group(); add(g, rbox(o.w || 26, o.hh || 22, o.d || 26, 3), m(o.color || PAL.wood), 0, (o.hh || 22) / 2); return g; },
  moto(o) {                                          // moto de juguete en color pastel
    const g = new T.Group(), c = o.color || PAL.red;
    for (const x of [-34, 34]) { const w = add(g, new T.TorusGeometry(15, 6, 10, 24), m(PAL.dark, .9), x, 21); add(g, cyl(8, 6, 12), m(PAL.grey, .4, .5), x, 21).rotation.x = Math.PI / 2; }
    add(g, rbox(52, 18, 18, 6), m(c), 2, 42); add(g, rbox(28, 9, 16, 4), m(PAL.dark), -14, 54); add(g, rbox(20, 18, 16, 5), m(PAL.grey, .5, .4), 4, 28);
    const fork = add(g, cyl(2.5, 34, 8), m(PAL.grey, .4, .6), 30, 38); fork.rotation.z = .35; add(g, rbox(6, 6, 34, 2), m(PAL.dark), 24, 56);
    add(g, rbox(8, 8, 8, 3), m(PAL.yellow, .4), 38, 46); return g; },
  pump(o) { const g = new T.Group(); add(g, rbox(34, 70, 26, 5), m(o.color || PAL.red), 0, 35); add(g, rbox(24, 18, 4, 2), m(PAL.white, .4), 0, 52, 13);
    add(g, rbox(8, 26, 6, 2), m(PAL.dark), 20, 36, 0); return g; },
  tire(o) { const g = new T.Group(), s = o.s || 1; const t = add(g, new T.TorusGeometry(26 * s, 11 * s, 14, 32), m(PAL.dark, .9), 0, 38 * s, Math.PI / 4); add(g, cyl(16 * s, 10 * s, 20), m(PAL.grey, .4, .5), 0, 38 * s).rotation.set(Math.PI / 2, 0, Math.PI / 4, 'YXZ');
    if (o.flat) t.scale.y = .8; return g; },
  gauge(o) { const g = new T.Group(); add(g, cyl(16, 6, 24), m(PAL.white, .4), 0, 30).rotation.x = Math.PI / 2; add(g, new T.TorusGeometry(16, 3, 8, 24), m(PAL.dark), 0, 30);
    const n = add(g, new T.BoxGeometry(2, 12, 2), m(o.color || PAL.red), 0, 34, 4); n.rotation.z = -.9; add(g, cyl(3, 24, 8), m(PAL.dark), 0, 12); return g; },
  filter(o) { const g = new T.Group(); add(g, rbox(70, 22, 46, 6), m(o.color || PAL.orange, .9), 0, 11);
    for (let i = 0; i < 8; i++) add(g, rbox(4, 6, 44, 1), m(new T.Color(o.color || PAL.orange).multiplyScalar(.75).getHex(), .9), -28 + i * 8, 24);
    if (o.dirty) add(g, rbox(66, 3, 42, 1), m(0x6d5a44, .95), 0, 27); return g; },
  plug(o) { const g = new T.Group(); add(g, cyl(5, 24, 12), m(PAL.white, .3), 0, 40); add(g, cyl(8, 10, 6), m(PAL.steel, .3, .8), 0, 24);
    add(g, cyl(4, 16, 12), m(PAL.steel, .3, .8), 0, 12); add(g, cyl(3.5, 8, 10), m(PAL.dark), 0, 56);
    if (o.worn) add(g, new T.SphereGeometry(4, 8, 6), m(0x3a2a20, .9), 0, 3); return g; },
  drum(o) { const g = new T.Group(); add(g, cyl(16, 44, 20), m(o.color || PAL.purple, .6), 0, 22); for (const y of [12, 32]) add(g, new T.TorusGeometry(16.3, 1.4, 6, 24), m(PAL.dark), 0, y).rotation.x = Math.PI / 2; return g; },
  person(o) { const g = new T.Group(); add(g, cyl(9, 30, 12), m(o.color || PAL.blue, .7), 0, 15); add(g, new T.SphereGeometry(8, 12, 10), m(0xf1c7a0, .7), 0, 38); return g; },
  number(o) {                                        // número grande de pie sobre una ficha (para "tres razones")
    const g = new T.Group(), c = o.color || PAL.yellow; add(g, cyl(34, 12, 32), m(c, .5), 0, 6);
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x2 = cv.getContext('2d');
    x2.fillStyle = '#1d1d1f'; x2.font = '400 230px "DM Serif Display"'; x2.textAlign = 'center'; x2.textBaseline = 'alphabetic'; x2.fillText(String(o.n || 1), 128, 210);
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4;
    const p = new T.Mesh(new T.PlaneGeometry(96, 96), new T.MeshBasicMaterial({ map: tx, transparent: true, alphaTest: .4 }));
    p.position.y = 58; p.rotation.y = Math.PI / 4; p.castShadow = true; g.add(p); return g; },
  // ---- muebles del taller (interior)
  banco(o) { const g = new T.Group(), c = o.color || PAL.wood;              // banco de trabajo con prensa y herramientas
    add(g, rbox(170, 12, 70, 4), m(c, .7), 0, 84); for (const x of [-75, 75]) for (const z of [-28, 28]) add(g, rbox(8, 80, 8, 2), m(PAL.dark), x, 40, z);
    add(g, rbox(160, 6, 60, 2), m(PAL.dark, .8), 0, 22); add(g, rbox(26, 22, 20, 4), m(PAL.blue, .5, .3), -55, 101, 0);
    add(g, rbox(40, 10, 10, 3), m(PAL.orange), 10, 95, 12, .4); add(g, rbox(30, 18, 22, 4), m(PAL.red, .5), 55, 99, -8); return g; },
  tablero(o) { const g = new T.Group();                                     // tablero de herramientas en la pared
    add(g, rbox(230, 140, 6, 4), m(o.color || 0xcfe3dd, .8), 0, 0); const cols = [PAL.red, PAL.blue, PAL.orange, PAL.purple, PAL.mint, PAL.yellow];
    for (let i = 0; i < 6; i++) { const t = add(g, rbox(10, 70 - (i % 3) * 12, 6, 3), m(cols[i], .5), -90 + i * 36, 4, 6, 0); t.rotation.z = (i % 2 ? .25 : -.2); }
    for (let i = 0; i < 3; i++) add(g, new T.TorusGeometry(14, 4, 8, 16), m(cols[i + 2], .5), -60 + i * 60, -46, 6); return g; },
  estante(o) { const g = new T.Group();                                     // repisa con botellas de aceite
    for (const y of [70, 140]) add(g, rbox(140, 8, 44, 3), m(PAL.white, .7), 0, y); for (const x of [-66, 66]) add(g, rbox(6, 150, 40, 2), m(PAL.grey, .6), x, 75);
    const cols = [PAL.yellow, PAL.red, PAL.blue, PAL.yellow, PAL.mint];
    cols.forEach((c, i) => { add(g, cyl(9, 36, 14), m(c, .45), -48 + i * 24, 92, 0); add(g, cyl(4, 8, 8), m(PAL.dark), -48 + i * 24, 114, 0); });
    for (let i = 0; i < 3; i++) add(g, rbox(30, 24, 30, 3), m(PAL.wood), -36 + i * 36, 160); return g; },
  llantas(o) { const g = new T.Group();                                     // torre de llantas
    for (let i = 0; i < (o.n || 3); i++) { const t = add(g, new T.TorusGeometry(30, 12, 12, 28), m(PAL.dark, .9), 0, 13 + i * 24); t.rotation.x = Math.PI / 2; }
    return g; },
  elevador(o) { const g = new T.Group();                                    // elevador de motos (plataforma)
    add(g, rbox(o.w || 420, 26, 120, 6), m(0x3b3e45, .6, .2), 0, 13); add(g, rbox(o.w || 420, 4, 122, 1), m(PAL.red, .5), 0, 22);
    add(g, rbox(60, 10, 120, 3), m(PAL.yellow, .5), (o.w || 420) / 2 - 30, 27); return g; },
  letrero(o) { const g = new T.Group(); const s2 = add(g, new T.BoxGeometry(o.w || 260, 56, 6), label(o.text || 'DAYTONA MOTO SPORT'), 0, 0); s2.castShadow = false; return g; },
  mecanico(o) {                                      // el mecánico de la marca (habla, saluda, señala); se anima en cada cuadro
    const M = MC.kit.mechanic({ brand: o.color || PAL.red }); M.g.userData.M = M; return M.g; },
  moto_grande(o) {                                   // moto de juguete detallada (cadena, escape, motor) para señalar piezas
    const B = MC.kit.toyBike({ brand: o.color || PAL.red }); B.bike.userData.B = B; return B.bike; },
};
// piezas de la moto grande (coordenadas propias de la moto): para señalarlas y acercar la cámara
const PARTS = { cadena: [-100, 96, 34], llanta: [175, 80, 0], llanta_trasera: [-175, 80, 0], escape: [-158, 94, -46],
  motor: [-10, 130, 0], tanque: [40, 250, 0], farola: [150, 330, 0], freno: [175, 80, 30],
  acelerador: [120, 302, 84], manubrio_izq: [120, 302, -84], visor_aceite: [10, 95, 45], culata: [0, 200, 22] };

// ---------------------------------------------------------------- escena
const IS = {};
function build(key, p) {
  if (IS[key]) return IS[key];
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xffffff, 0xd9d2c6, 2.1));
  const sun = new T.DirectionalLight(0xfff6ea, 2.4); sun.position.set(-500, 900, 350); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 3000 });
  sun.shadow.bias = -.0004; sun.shadow.radius = 4; scene.add(sun, sun.target);
  const W0 = p.board ? p.board[0] : 900, D0 = p.board ? p.board[1] : 700;
  const slab = add(scene, rbox(W0, 40, D0, 14), m(PAL.slab, .9), 0, -20); slab.castShadow = false;
  if (p.room) {                                      // interior del taller: piso de baldosa clara y dos paredes (casa de muñecas)
    const R = p.room, H = R.h || 300, wc = R.wall || 0xf4f0e9;
    add(scene, new T.BoxGeometry(W0 - 30, 1, D0 - 30), m(0xe9e6e0, .85), 0, .6).castShadow = false;
    for (let gx = -W0 / 2 + 80; gx < W0 / 2; gx += 80) add(scene, new T.BoxGeometry(2, 1, D0 - 30), m(0xdcd8d1, .9), gx, 1.2).castShadow = false;
    for (let gz = -D0 / 2 + 80; gz < D0 / 2; gz += 80) add(scene, new T.BoxGeometry(W0 - 30, 1, 2), m(0xdcd8d1, .9), 0, 1.2, gz).castShadow = false;
    const back = add(scene, rbox(W0, H, 24, 6), m(wc, .9), 0, H / 2, -D0 / 2 + 12); back.castShadow = false;
    const left = add(scene, rbox(24, H, D0, 6), m(wc, .9), -W0 / 2 + 12, H / 2, 0); left.castShadow = false;
    for (const [w, d, x0, z0] of [[W0, 4, 0, -D0 / 2 + 25], [4, D0, -W0 / 2 + 25, 0]]) {   // franja roja y zócalo
      add(scene, new T.BoxGeometry(w, 16, d), m(PAL.red, .6), x0, 120, z0).castShadow = false;
      add(scene, new T.BoxGeometry(w, 22, d), m(0xcfc9bf, .8), x0, 11, z0).castShadow = false; }
  } else for (const r of p.roads || [[0, 0, W0 - 60, 46, 0]]) { const o = add(scene, new T.BoxGeometry(r[2], 1, r[3]), m(PAL.road, .95), r[0], 1.2, r[1], r[4] || 0); o.castShadow = false;
    for (let i = -r[2] / 2 + 30; i < r[2] / 2; i += 60) { const d = add(scene, new T.BoxGeometry(24, 1, 3), m(PAL.white, .9), r[0] + Math.cos(r[4] || 0) * i, 1.8, r[1] - Math.sin(r[4] || 0) * i, r[4] || 0); d.castShadow = false; } }
  const objs = (p.objects || []).map(o => {
    const make = KIND[o.kind] || KIND.box, inner = make(o), g = new T.Group(); g.add(inner);
    g.position.set(o.x || 0, o.y || 0, o.z || 0); g.rotation.y = o.rot || 0; inner.scale.setScalar(o.scale || 1); scene.add(g);
    return { o, g, inner };
  });
  const cam = new T.OrthographicCamera(-540, 540, 960, -960, -4000, 6000);
  const st = { scene, cam, objs, sun };
  for (const it of objs) { if (it.inner.userData.M) st.M = it.inner.userData.M; if (it.inner.userData.B) st.B = it.inner.userData.B; }
  return (IS[key] = st);
}

const TMP = { v: null };
function partPos(st, name) {                        // posición en el mundo de una pieza de la moto grande
  if (!st.B || !PARTS[name]) return null;
  TMP.v = TMP.v || new T.Vector3(); TMP.v.set(...PARTS[name]); st.B.bike.localToWorld(TMP.v); return TMP.v.clone();
}
function focusAt(t, s, p, st) {                      // a dónde mira la cámara: [x, z, zoom] por momentos (suave)
  const list = (p.focus || []).map(f => { let q = { ...f, at: f.at ?? s.start };
    if (f.part && st) { const w = partPos(st, f.part); if (w) q = { ...q, x: w.x + (f.dx || 0), z: w.z + (f.dz || 0) }; }
    if (f.with_mech && st && st.M && q.x !== undefined) {           // encuadra la pieza Y al mecánico (dónde va a estar)
      const mo = st.objs.find(r => r.inner.userData.M).o, m = walkAt(q.at + 1.2, mo);
      q = { ...q, x: q.x * .55 + m.x * .45, z: q.z * .55 + m.z * .45 }; }
    return q; }).sort((a, b) => a.at - b.at);   // en orden de tiempo aunque un ancla falle
  let a = { x: 0, z: 0, zoom: 1, at: 0 }, b = a, u = 1;
  for (let i = 0; i < list.length; i++) if (t >= list[i].at) { a = i ? list[i - 1] : list[i]; b = list[i]; u = eout(prog(t, b.at, b.at + (b.dur || .45))); }
  const L = (k, d = 0) => (a[k] ?? d) + ((b[k] ?? d) - (a[k] ?? d)) * u, nx = list.find(q => q.at > t);
  const hold = prog(t, b.at + (b.dur || .45), nx ? nx.at : b.at + 6);              // 0→1 mientras dura la toma
  st && (st.camMove = u < 1 ? 1 : 0);
  return { x: L('x'), z: L('z'), zoom: L('zoom', 1), yaw: L('yaw') + (a.orbit || 0) * (1 - u), pitch: L('pitch'), hold, orbit: b.orbit || 0 };
}

MC.scenes.iso = function (t, s, p) {
  const st = build('iso' + s.start, p), lt = t - s.start;
  x.fillStyle = p.bg || '#f1efea'; x.fillRect(0, 0, W, H);
  for (const { o, g, inner } of st.objs) {           // aparición con rebote; salida hundiéndose; movimiento por camino
    const a = o.at ?? s.start, k = back(prog(t, a, a + .45)), out = has(o.until) ? eio(prog(t, o.until, o.until + .35)) : 0;
    const sc = (o.scale || 1) * Math.max(0, k * (1 - out));
    inner.scale.setScalar(Math.max(.0001, sc)); g.visible = sc > .001;
    if (o.spin) inner.rotation.y = lt * o.spin;
    if (o.path) { const P = o.path, L = P.length, u = ((lt * (o.speed || .25)) % 1) * L, i = Math.floor(u), f = u - i, A = P[i % L], B = P[(i + 1) % L];
      g.position.x = A[0] + (B[0] - A[0]) * f; g.position.z = A[1] + (B[1] - A[1]) * f; g.rotation.y = -Math.atan2(B[1] - A[1], B[0] - A[0]); }
    if (o.hop) inner.position.y = Math.abs(Math.sin((t - a) * 3)) * o.hop;
    if (o.turns) g.rotation.y = keyed(t, o.turns, 'rot', o.rot || 0, .9);      // la moto gira para mostrar cada lado
    if (o.moves) { const w = walkAt(t, o); g.position.x = w.x; g.position.z = w.z; g.rotation.y = w.rot; o._walk = w.walking; }
  }
  if (st.M) {                                        // mecánico: pose según el momento, boca al hablar
    const P = p.poses || [], cur = [...P].reverse().find(q => t >= q.at) || { name: 'idle', at: s.start }, i = P.indexOf(cur);
    const prev = i > 0 ? P[i - 1] : { name: 'idle' }, w = eio(prog(t, cur.at, cur.at + .45));
    const tk = talking(t), name = cur.name === 'auto' ? (tk > 0 ? 'explain' : 'idle') : cur.name;
    MC.kit.pose(st.M, name, 1, lt, { from: { name: prev.name === 'auto' ? 'explain' : prev.name, k: 1 }, w, talk: tk });
    const mo = st.objs.find(q => q.inner.userData.M).o, wk = mo._walk || 0;      // piernas y vaivén al caminar
    st.M.legL.rotation.x = .55 * wk * Math.sin(lt * 11); st.M.legR.rotation.x = -.55 * wk * Math.sin(lt * 11);
    st.M.up.position.y = 70 + 6 * wk * Math.abs(Math.sin(lt * 11));
  }
  const f = focusAt(t, s, p, st);
  // golpe de acercamiento en la palabra clave (+8 % y vuelve) y deriva lenta dentro de cada toma (nunca queda quieta)
  let punch = 0; for (const pt of p.punches || []) { const u = (t - pt) / .45; if (u > 0 && u < 1) punch = Math.max(punch, Math.sin(Math.PI * u) * (1 - u * .4)); }
  const zoom = (p.zoom || 1.15) * f.zoom * (1 + .08 * punch) * (1 + .045 * f.hold) * (1 + .012 * Math.sin(lt * .5));
  // giro alrededor de la escena durante cada toma (orbit) + vaivén: la cámara nunca queda quieta
  const c = st.cam, yaw = Math.PI / 4 + f.yaw + f.orbit * f.hold + .05 * Math.sin(lt * .31) + (p.yaw || 0), pitch = (p.pitch ?? .62) + f.pitch;
  if (st.M) {                                        // el mecánico mira a la cámara: la cabeza siempre; el cuerpo al explicar
    const mo = st.objs.find(q => q.inner.userData.M), P = p.poses || [], cur = [...P].reverse().find(q => t >= q.at) || { name: 'idle', at: 0 };
    const wk = mo.o._walk || 0, pt = cur.name === 'point';
    const turn = (pt ? 1 - eio(prog(t, cur.at, cur.at + .4)) : eio(prog(t, cur.at, cur.at + .5))) * (1 - wk);
    const body = mo.g.rotation.y + angDiff(mo.g.rotation.y, yaw) * turn; mo.g.rotation.y = body;
    const dh = Math.max(-1.15, Math.min(1.15, angDiff(body, yaw)));
    st.M.head.rotation.y = dh * .9 + .05 * Math.sin(lt * .8); st.M.up.rotation.y = dh * .2;
    // la cámara mira desde arriba: levanta la cabeza (y un poco el pecho) hacia ella, como quien le habla al celular.
    // Cuanto más de frente a la cámara, más sube la mirada; al señalar a un lado la baja hacia la pieza.
    const face = Math.cos(dh), tk = talking(t), up = (p.look_up ?? .42) * face * (pt ? .5 : 1);
    st.M.head.rotation.x = -up + tk * .05 * Math.sin(lt * 6.1); st.M.up.rotation.x = -.1 * face;
  }
  c.left = -540 / zoom; c.right = 540 / zoom; c.top = 960 / zoom; c.bottom = -960 / zoom; c.updateProjectionMatrix();
  const tg = new T.Vector3(f.x, 0, f.z).add(new T.Vector3(0, p.lift || 0, 0));
  if (p.impact) { const u = t - (p.impact.at || 0); if (u >= 0 && u < .5) { const a = 28 * (1 - u / .5);   // sacudón del golpe
    tg.x += a * Math.sin(u * 83); tg.z += a * Math.cos(u * 71); } }
  c.position.set(tg.x + 2000 * Math.sin(yaw) * Math.cos(pitch), tg.y + 2000 * Math.sin(pitch), tg.z + 2000 * Math.cos(yaw) * Math.cos(pitch));
  c.lookAt(tg); c.updateMatrixWorld();
  st.sun.target.position.copy(tg); st.sun.position.set(tg.x - 500, 900, tg.z + 350);
  const v = view(c, 1080, 1920, 0, 0);
  if (st.M) {                                        // estado para el vigilante de sincronía (python -m motocine sincronia)
    const hp = new T.Vector3(); st.M.head.getWorldPosition(hp); const [hx, hy] = v.project(hp.x, hp.y, hp.z);
    const cur = [...(p.poses || [])].reverse().find(q => t >= q.at);
    const fp = new T.Vector3(); st.M.g.getWorldPosition(fp); const [fx, fy] = v.project(fp.x, fp.y, fp.z);
    MC.isoState = { t, head: [Math.round(hx), Math.round(hy)], feet: [Math.round(fx), Math.round(fy)], part: null,
                    visible: hx > 40 && hx < W - 40 && hy > 150 && hy < H - 300,
                    pose: cur ? cur.name : 'idle', talk: talking(t), cam: [Math.round(f.x), Math.round(f.z), +zoom.toFixed(3), +yaw.toFixed(3)] };
  }
  const dd = (p.details || []).find(d => t >= d.at && t < d.until + .35);
  const dk = dd ? Math.min(eout(prog(t, dd.at, dd.at + .4)), 1 - eio(prog(t, dd.until, dd.until + .35))) : 0;
  if (dk < 1) render3d(st.scene, v, 0);
  if (dk > 0) detailRender(t, dd, dk);              // "por dentro": se abre en un círculo sobre la maqueta
  if (dk < .5) { isoMarks(t, p.marks, st, v); isoBubbles(t, p.bubbles, st, v); }
  isoOverlay(t, s, p);
  isoStats(t, p.stats); isoChecks(t, p.checks); isoTimer(t, p.timer); isoOptions(t, p.options); isoCountdown(t, p.countdown);
  isoImpact(t, p.impact);
};

// ---------------------------------------------------------------- escenas "por dentro" (mecanismos explicados)
// Cada una es un mecanismo grande y limpio en el mismo estilo pastel, animado en el tiempo y con los nombres de
// las piezas. Fases por tiempo: d.phases = [{at, mode}] (balancines: 'normal' | 'tic' | 'ajuste' | 'gasta').
const DT = {};
function lobeShape(r0, lift) {                       // perfil del lóbulo del árbol de levas
  const sh = new T.Shape();
  for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, r = r0 + lift * Math.pow(Math.max(0, Math.cos(a)), 3);
    const px = r * Math.sin(a), py = r * Math.cos(a); i ? sh.lineTo(px, py) : sh.moveTo(px, py); }
  return sh;
}
function buildBalancines() {
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xffffff, 0xd9d2c6, 2.2));
  const sun = new T.DirectionalLight(0xfff6ea, 2.2); sun.position.set(-300, 500, 600); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -400, right: 400, top: 400, bottom: -400, near: 10, far: 2000 }); scene.add(sun);
  const back = add(scene, new T.PlaneGeometry(2000, 2000), m(0xf1efea, 1), 0, 0, -80); back.castShadow = false;
  const metal = m(PAL.steel, .35, .7), dark = m(PAL.dark, .6, .3);
  const cam = new T.Group(); cam.position.set(-90, -10, 0); scene.add(cam);
  const lobe = new T.Mesh(new T.ExtrudeGeometry(lobeShape(42, 26), { depth: 50, bevelEnabled: true, bevelSize: 3, bevelThickness: 3, bevelSegments: 2 }), m(PAL.orange, .5, .3));
  lobe.position.z = -25; lobe.castShadow = true; cam.add(lobe);
  const shaft = add(cam, cyl(14, 140, 20), metal, 0, 0, 0); shaft.rotation.x = Math.PI / 2;
  const rocker = new T.Group(); rocker.position.set(0, 120, 0); scene.add(rocker);            // pivote del balancín
  add(rocker, rbox(240, 26, 40, 10), m(PAL.blue, .45, .2), 0, 0, 0);
  add(rocker, cyl(15, 60, 20), metal, 0, 0, 0).rotation.x = Math.PI / 2;
  add(rocker, rbox(34, 16, 40, 6), m(0x2c3a9e, .5), -90, -20, 0);                             // patín sobre la leva
  const screw = new T.Group(); screw.position.set(90, -13, 0); rocker.add(screw);           // tornillo de ajuste + contratuerca
  add(screw, cyl(7, 46, 14), metal, 0, -18, 0); add(screw, cyl(13, 12, 6), m(PAL.yellow, .4, .5), 0, 4, 0);
  const valve = new T.Group(); valve.position.set(90, 0, 0); scene.add(valve);
  add(valve, cyl(7, 200, 14), metal, 0, -100, 0); add(valve, cyl(36, 10, 32), metal, 0, -205, 0);
  const spring = new T.Group(); valve.add(spring);
  for (let i = 0; i < 7; i++) { const r = add(spring, new T.TorusGeometry(20, 4, 8, 24), m(PAL.mint, .4, .3), 0, -150 + i * 13, 0); r.rotation.x = Math.PI / 2; }
  add(valve, rbox(60, 8, 60, 3), dark, 0, -78, 0);                                         // retén del resorte
  const head = add(scene, rbox(330, 40, 120, 10), m(0xd8d3cb, .8), 30, -230, 0); head.castShadow = false;   // culata (base)
  const gauge = add(scene, rbox(110, 3, 34, 1), m(PAL.yellow, .4, .4), 260, 0, 10); gauge.castShadow = false;
  const wrench = new T.Group(); scene.add(wrench);
  add(wrench, rbox(18, 150, 10, 5), m(PAL.red, .45, .3), 0, 85, 0); add(wrench, new T.TorusGeometry(20, 7, 8, 18), m(PAL.red, .45, .3), 0, 0, 0);
  const camera = new T.OrthographicCamera(-540, 540, 960, -960, -3000, 3000);
  return { scene, camera, cam, lobe, rocker, screw, valve, spring, gauge, wrench, sun };
}
// estado del mecanismo en t: holgura que se cierra en "ajuste"; cada ciclo el balancín empuja la válvula
function balState(t, d) {
  const ph = [...(d.phases || [])].reverse().find(q => t >= q.at) || { mode: 'tic', at: d.at };
  const gapBig = 16, gapOk = 2, adj = d.phases.find(q => q.mode === 'ajuste');
  const gap = adj ? gapBig + (gapOk - gapBig) * eio(prog(t, adj.at + .6, adj.at + 2.2)) : gapBig;
  const ang = (t - d.at) * (d.speed || 5.2);                 // vueltas del árbol de levas (lento para entender)
  const top = (a) => 42 + 26 * Math.pow(Math.max(0, Math.cos(a)), 3);
  const lift = top(ang) - 42, swing = Math.atan(lift / 90);
  const push = Math.max(0, 90 * Math.sin(swing) - gap), contact = 90 * Math.sin(swing) - gap;
  return { mode: ph.mode, gap, ang, lift, swing, push, contact };
}
function buildCadena() {
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xffffff, 0xd9d2c6, 2.2));
  const sun = new T.DirectionalLight(0xfff6ea, 2.2); sun.position.set(-300, 500, 600); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -500, right: 500, top: 500, bottom: -500, near: 10, far: 2000 }); scene.add(sun);
  const back = add(scene, new T.PlaneGeometry(3000, 3000), m(0xf1efea, 1), 0, 0, -80); back.castShadow = false;
  const gear = new T.Group(); scene.add(gear);
  add(gear, cyl(108, 20, 48), m(PAL.steel, .35, .7), 0, 0, 0).rotation.x = Math.PI / 2;
  add(gear, cyl(40, 30, 24), m(PAL.dark, .5, .4), 0, 0, 0).rotation.x = Math.PI / 2;
  const teeth = [];
  const toothMat = new T.MeshStandardMaterial({ color: PAL.steel, roughness: .35, metalness: .7 });   // propio: se pone rojo solo
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, tth = add(gear, rbox(16, 22, 14, 3), toothMat, 116 * Math.cos(a), 116 * Math.sin(a), 0);
    tth.rotation.z = a - Math.PI / 2; teeth.push(tth); }
  const links = [], chainMats = [m(0x9aa0a8, .5, .6), m(0x5d6168, .55, .5)];
  for (let i = 0; i < 46; i++) { const l = add(scene, rbox(32, 16, 26, 5), chainMats[i % 2].clone(), 0, 0, 12); links.push(l); }
  const can = new T.Group(); scene.add(can);
  add(can, cyl(26, 110, 20), m(PAL.blue, .4, .3), 0, 0, 0); add(can, cyl(10, 18, 12), m(PAL.white, .4), 0, 64, 0);
  add(can, rbox(20, 8, 8, 2), m(PAL.dark), 12, 70, 0); can.rotation.z = -.9;
  const camera = new T.OrthographicCamera(-540, 540, 960, -960, -3000, 3000);
  return { scene, camera, gear, teeth, links, can };
}
// camino de la cadena: arriba recto (de izq. a der.), media vuelta alrededor del piñón, abajo recto de regreso
function chainPos(u, R, L) {
  const arc = Math.PI * R, total = 2 * L + arc; let s2 = ((u % total) + total) % total;
  if (s2 < L) return [-L + s2, R, 0];
  s2 -= L; if (s2 < arc) { const a = Math.PI / 2 - s2 / R; return [R * Math.cos(a), R * Math.sin(a), a - Math.PI / 2 + Math.PI / 2]; }
  s2 -= arc; return [-s2, -R, Math.PI];
}
function detailCadena(t, d, k) {
  const D = DT.cad || (DT.cad = buildCadena()), ph = [...(d.phases || [])].reverse().find(q => t >= q.at) || { mode: 'seca' };
  const lub = (d.phases || []).find(q => q.mode === 'lubrica'), gas = (d.phases || []).find(q => q.mode === 'estira');
  const wet = lub ? eio(prog(t, lub.at + .3, lub.at + 1.6)) : 0, worn = gas ? eio(prog(t, gas.at, gas.at + .8)) : 0;
  const rot = (t - d.at) * 1.4; D.gear.rotation.z = -rot;
  const R = 132, L = 520, pitch = 34 * (1 + .12 * worn);              // estirada: los eslabones se separan
  D.links.forEach((l, i) => { const [px, py, a] = chainPos(i * pitch + rot * R, R, L); l.position.set(px, py, 12); l.rotation.z = -a;
    l.material.color.setHex(i % 2 ? (wet > .5 ? 0x3d4148 : 0x5d6168) : (wet > .5 ? 0x7d848e : 0x9aa0a8)); l.material.roughness = .55 - .35 * wet; });
  D.teeth.forEach(th => { th.scale.set(1 - .45 * worn, 1 + .25 * worn, 1); th.material.color.setHex(worn > .3 ? PAL.red : PAL.steel); });
  const ca = lub ? eio(prog(t, lub.at - .2, lub.at + .3)) * (1 - eio(prog(t, lub.at + 2.2, lub.at + 2.6))) : 0;
  D.can.visible = ca > .01; D.can.position.set(-280 - 250 * (1 - ca), R + 40, 60);
  const c = D.camera, z = 2.3 * (1 + .03 * Math.sin((t - d.at) * .7)), yaw = .3 + .05 * Math.sin((t - d.at) * .4), pitch2 = .18;
  c.left = -540 / z; c.right = 540 / z; c.top = 960 / z; c.bottom = -960 / z; c.updateProjectionMatrix();
  const tg = new T.Vector3(-40, 20, 0);
  c.position.set(tg.x + 1500 * Math.sin(yaw) * Math.cos(pitch2), tg.y + 1500 * Math.sin(pitch2), tg.z + 1500 * Math.cos(yaw) * Math.cos(pitch2));
  c.lookAt(tg); c.updateMatrixWorld();
  const v = view(c, 1080, 1920, 0, 0), r = Math.hypot(W, H) / 2 * k;
  x.save(); x.beginPath(); x.arc(W / 2, H * .5, r, 0, Math.PI * 2); x.clip();
  x.fillStyle = '#f1efea'; x.fillRect(0, 0, W, H);
  render3d(D.scene, v, 0);
  const [cx0, cy0] = v.project(-10, R + 6, 12);                     // donde la cadena entra al piñón (roce)
  if (wet < .5) {                                                  // seca: chispas y chillido
    for (let i = 0; i < 14; i++) { const a = hash(i * 7.1 + Math.floor((t - d.at) * 12)) * Math.PI - Math.PI, ln = 30 + 70 * hash(i * 3.3 + Math.floor((t - d.at) * 12));
      x.strokeStyle = i % 2 ? '#f0894a' : '#f3c24a'; x.lineWidth = 4; x.globalAlpha = (1 - wet * 2);
      x.beginPath(); x.moveTo(cx0, cy0); x.lineTo(cx0 + ln * Math.cos(a), cy0 + ln * Math.sin(a)); x.stroke(); }
    const sq = (Math.sin((t - d.at) * 3.1 * Math.PI * 2) + 1) / 2;
    x.globalAlpha = (1 - wet * 2) * (.4 + .6 * sq); x.font = '900 italic 80px Montserrat'; x.fillStyle = '#e3141b'; x.textAlign = 'center';
    x.fillText('¡ÑIIIK!', cx0 + 120, cy0 - 140); x.globalAlpha = 1;
  }
  if (ca > .01) {                                                  // nube del spray
    const [sx, sy] = v.project(-280 - 250 * (1 - ca) + 50, R + 100, 60);
    for (let i = 0; i < 10; i++) { const u = ((t - lub.at) * 1.5 + i / 10) % 1;
      x.globalAlpha = .45 * (1 - u) * ca; x.fillStyle = '#cfe8ff'; x.beginPath(); x.arc(sx + (cx0 - sx) * u, sy + (cy0 - sy) * u, 14 + 30 * u, 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1;
  }
  const lab = (txt, px, py, dx, dy, at, col = '#1d1d1f') => { const kk = eout(prog(t, at, at + .35)); if (kk <= 0) return;
    x.font = '800 40px "JetBrains Mono"'; const tw = x.measureText(txt).width + 40, lx = Math.min(W - 24 - tw / 2, Math.max(24 + tw / 2, px + dx)), ly = py + dy;
    x.globalAlpha = kk; x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.moveTo(px, py); x.lineTo(lx, ly); x.stroke();
    x.fillStyle = col; x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2); x.fill(); rrect(lx - tw / 2, ly - 32, tw, 64, 14); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, lx, ly + 2); x.globalAlpha = 1; };
  const la = d.label_at || [d.at + .3, d.at + .8];
  const [gx, gy] = v.project(0, -60, 0), [lx2, ly2] = v.project(-300, R, 12);
  lab(worn > .3 ? 'PIÑÓN GASTADO' : 'PIÑÓN', gx, gy, 280, 40, la[1] ?? la[0], worn > .3 ? '#e3141b' : '#1d1d1f');
  lab('ESLABONES', lx2, ly2, 40, -200, la[0]);
  if (wet < .5) lab('SIN GRASA', cx0, cy0, -220, 180, d.at + .6, '#e3141b');
  if (lub && t > lub.at + 1.6 && !(gas && t > gas.at)) lab('LUBRICADA ✓', cx0, cy0, 230, 170, lub.at + 1.6, '#2e9e6a');
  if (gas && t > gas.at) lab('SE ESTIRA', lx2, ly2, 220, 200, gas.at + .2, '#e3141b');
  x.restore();
  if (k < 1) { x.save(); x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(W / 2, H * .5, r, 0, Math.PI * 2); x.stroke(); x.restore(); }
}
function detailRender(t, d, k) {
  if (d.kind === 'cadena') return detailCadena(t, d, k);
  if (d.kind !== 'balancines') return;
  const D = DT.bal || (DT.bal = buildBalancines()), S = balState(t, d);
  D.lobe.parent.rotation.z = -S.ang; D.rocker.rotation.z = -S.swing;
  D.valve.position.y = -S.push; D.spring.scale.y = 1 - S.push / 150;
  D.lobe.material.color.setHex(S.mode === 'gasta' ? PAL.red : PAL.orange);
  const adj = (d.phases || []).find(q => q.mode === 'ajuste'), ga = adj ? eio(prog(t, adj.at, adj.at + .6)) * (1 - eio(prog(t, adj.at + 2.6, adj.at + 3.1))) : 0;
  const tipY = 120 - 13 - 41 - 90 * Math.sin(S.swing);         // punta del tornillo (aprox.)
  D.gauge.position.set(90 + 150 * (1 - ga), tipY - S.gap / 2 - 2, 10); D.gauge.visible = ga > .01;
  D.wrench.visible = ga > .01; D.wrench.position.set(90, 120 - 13 - 6 - 90 * Math.sin(S.swing), 30);
  D.wrench.rotation.z = adj ? .6 * Math.sin(prog(t, adj.at + .6, adj.at + 2.2) * Math.PI * 3) : 0;
  const c = D.camera, z = 2.55 * (1 + .03 * Math.sin((t - d.at) * .7)), yaw = .32 + .05 * Math.sin((t - d.at) * .4), pitch = .2;
  c.left = -540 / z; c.right = 540 / z; c.top = 960 / z; c.bottom = -960 / z; c.updateProjectionMatrix();
  const tg = new T.Vector3(10, 10, 0);                          // mecanismo un poco abajo: arriba va el título
  c.position.set(tg.x + 1500 * Math.sin(yaw) * Math.cos(pitch), tg.y + 1500 * Math.sin(pitch), tg.z + 1500 * Math.cos(yaw) * Math.cos(pitch));
  c.lookAt(tg); c.updateMatrixWorld();
  const v = view(c, 1080, 1920, 0, 0), r = Math.hypot(W, H) / 2 * k;
  x.save(); x.beginPath(); x.arc(W / 2, H * .5, r, 0, Math.PI * 2); x.clip();
  x.fillStyle = '#f1efea'; x.fillRect(0, 0, W, H);
  render3d(D.scene, v, 0);
  // nombres de las piezas (aparecen uno tras otro) y lo que pasa
  const lab = (txt, wx, wy, dx, dy, at, col = '#1d1d1f') => { const kk = eout(prog(t, at, at + .35)); if (kk <= 0) return;
    const [px, py] = v.project(wx, wy, 0); x.font = '800 40px "JetBrains Mono"'; const tw0 = x.measureText(txt).width + 40;
    const lx = Math.min(W - 24 - tw0 / 2, Math.max(24 + tw0 / 2, px + dx)), ly = py + dy;     // nunca se sale de la pantalla
    x.globalAlpha = kk; x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.moveTo(px, py); x.lineTo(lx, ly); x.stroke();
    x.fillStyle = col; x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2); x.fill();
    x.font = '800 40px "JetBrains Mono"'; const tw = x.measureText(txt).width + 40; x.fillStyle = col; rrect(lx - tw / 2, ly - 32, tw, 64, 14); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, lx, ly + 2); x.globalAlpha = 1; };
  const la = d.label_at || [d.at + .3, d.at + .8, d.at + 1.3];     // cada nombre aparece cuando la voz lo dice
  lab('ÁRBOL DE LEVAS', -90, -10, -40, 210, la[0], S.mode === 'gasta' ? '#e3141b' : '#1d1d1f');
  lab('BALANCÍN', -50, 130, -150, -60, la[1]);
  lab('VÁLVULA', 90, -190, 120, 120, la[2]);
  if (S.mode === 'tic' || S.mode === 'ajuste') {                 // la holgura marcada en rojo
    const [gx, gy] = v.project(90, 120 - 13 - 41 - 90 * Math.sin(S.swing) - S.gap / 2, 0), gh = Math.max(4, S.gap * v.rw / (c.right - c.left));
    x.strokeStyle = '#e3141b'; x.lineWidth = 5; x.beginPath(); x.moveTo(gx + 40, gy - gh / 2); x.lineTo(gx + 60, gy - gh / 2); x.lineTo(gx + 60, gy + gh / 2); x.lineTo(gx + 40, gy + gh / 2); x.stroke();
    if (S.gap > 6) lab('HOLGURA', 90, 120 - 13 - 41 - 90 * Math.sin(S.swing) - S.gap / 2, 260, -40, d.at + 1.4, '#e3141b');
  }
  if (S.mode === 'tic' && S.contact > 0 && S.contact < 7) {        // golpe: destello y "TIC" en el instante del contacto
    const [hx, hy] = v.project(90, 120 - 13 - 41 - 90 * Math.sin(S.swing), 0), u = S.contact / 7;
    x.globalAlpha = 1 - u; x.strokeStyle = '#e3141b'; x.lineWidth = 6;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; x.beginPath(); x.moveTo(hx + 30 * Math.cos(a), hy + 30 * Math.sin(a)); x.lineTo(hx + (60 + 40 * u) * Math.cos(a), hy + (60 + 40 * u) * Math.sin(a)); x.stroke(); }
    x.font = '900 italic 90px Montserrat'; x.fillStyle = '#e3141b'; x.textAlign = 'center'; x.fillText('¡TIC!', hx + 190, hy - 120); x.globalAlpha = 1;
  }
  if (adj && t > adj.at) { lab('GALGA', 90, 120 - 13 - 41 - S.gap / 2, 280, 140, adj.at + .3, '#b8860b');
    if (t > adj.at + 2.2) lab('AJUSTADO ✓', 90, 60, 240, -260, adj.at + 2.2, '#2e9e6a'); }
  if (S.mode === 'gasta') lab('SE GASTA', -90, 30, 200, -120, (d.phases.find(q => q.mode === 'gasta') || {}).at || t, '#e3141b');
  x.restore();
  if (k < 1) { x.save(); x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(W / 2, H * .5, r, 0, Math.PI * 2); x.stroke(); x.restore(); }
}

// el mecánico camina de un punto a otro: [{at, x, z, rot}] (rot = hacia dónde mira al llegar)
function walkAt(t, o) {
  let x = o.x || 0, z = o.z || 0, rot = o.rot || 0;
  for (const m of o.moves || []) {
    if (t < m.at) break;
    const d = Math.hypot(m.x - x, m.z - z), dur = Math.max(.4, d / (o.speed || 300)), u = prog(t, m.at, m.at + dur);
    const head = d > 1 ? Math.atan2(m.x - x, m.z - z) : rot, face = m.rot ?? head;
    if (u < 1) {                                    // caminando: gira hacia el destino en los primeros pasos
      const e = eio(u);
      return { x: x + (m.x - x) * e, z: z + (m.z - z) * e, rot: rot + angDiff(rot, head) * Math.min(1, u * 5), walking: Math.min(1, u * 6, (1 - u) * 6) };
    }
    const v = Math.min(1, (t - m.at - dur) / .35);  // llegó: se voltea hacia donde debe mirar
    x = m.x; z = m.z; rot = head + angDiff(head, face) * v;
  }
  return { x, z, rot, walking: 0 };
}
function angDiff(a, b) { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; }

function keyed(t, keys, prop, base, dur) {           // valor que cambia suave entre momentos [{at, prop}]
  let a = base, b = base, u = 1;
  for (const k of keys) if (t >= k.at) { a = b; b = k[prop]; u = eio(prog(t, k.at, k.at + dur)); }
  return a + (b - a) * u;
}
function talking(t) {                               // 0..1: ¿suena la voz en este instante? (para la boca)
  const sp = MC.spec.speech; if (!sp) return 0;
  for (const [a, b] of sp) if (t > a - .05 && t < b + .05) return Math.min(1, (t - a + .05) / .08, (b + .05 - t) / .08);
  return 0;
}
// señal sobre una pieza, en el estilo limpio: punto rojo que late, anillo fino, línea y etiqueta negra en letra de máquina
function isoMarks(t, list, st, v) {
  if (!list || MC.teasing) return;
  for (const m of list) {
    if (t < m.at || (has(m.until) && t > m.until + .25)) continue;
    const k = eout(prog(t, m.at, m.at + .3)) * (has(m.until) ? 1 - prog(t, m.until, m.until + .25) : 1);
    const w = partPos(st, m.part); if (!w || k <= 0) continue;
    const [px, py] = v.project(w.x, w.y, w.z), pulse = .5 + .5 * Math.sin((t - m.at) * 6);
    if (MC.isoState) MC.isoState.part = [Math.round(px), Math.round(py)];        // para el vigilante (¿el mecánico la tapa?)
    if (m.fx === 'humo') {                          // humo que sale del escape y sube (azul = quema aceite)
      x.save(); for (let i = 0; i < 14; i++) { const u = ((t - m.at) * .5 + i / 14) % 1, r = 16 + 85 * u;
        x.globalAlpha = k * .62 * (1 - u) * Math.min(1, u * 5); x.fillStyle = m.color || '#7f9fd8';
        x.beginPath(); x.arc(px + 120 * u + 18 * Math.sin(i * 2.1 + t * 1.3), py - 40 - 260 * u, r, 0, Math.PI * 2); x.fill(); } x.restore(); }
    if (m.fx === 'ondas') {                          // ondas de sonido (el motor en mínimo)
      x.save(); x.strokeStyle = "#1d1d1f"; x.lineWidth = 8; x.lineCap = "round";
      for (let i = 0; i < 3; i++) { const u = ((t - m.at) * .9 + i / 3) % 1; x.globalAlpha = k * (1 - u) * .8;
        for (const sd of [-1, 1]) { x.beginPath(); x.arc(px, py, 70 + 170 * u, sd > 0 ? -.6 : Math.PI - .6, sd > 0 ? .6 : Math.PI + .6); x.stroke(); } } x.restore(); }
    function side() { return 1; }
    x.font = '800 48px "JetBrains Mono"'; const tw0 = m.text ? x.measureText(m.text).width + 56 : 0;   // la etiqueta nunca se sale
    const sd = m.side || (px < W / 2 ? 1 : -1), lx = Math.min(W - 30 - tw0 / 2, Math.max(30 + tw0 / 2, px + sd * (m.dx ?? 230))), ly = py + (m.dy ?? (py - 150 < 600 ? 150 : -150));   // arriba va el título: si no cabe, debajo
    x.save(); x.globalAlpha = k; x.strokeStyle = '#e3141b'; x.fillStyle = '#e3141b';
    x.lineWidth = 7; x.beginPath(); x.arc(px, py, 40 + 8 * pulse, 0, Math.PI * 2); x.stroke();
    x.globalAlpha = k * .3 * (1 - pulse); x.beginPath(); x.arc(px, py, 44 + 44 * pulse, 0, Math.PI * 2); x.stroke();
    x.globalAlpha = k; x.beginPath(); x.arc(px, py, 8, 0, Math.PI * 2); x.fill();
    const u = eout(prog(t, m.at + .05, m.at + .35)), ang = Math.atan2(ly - py, lx - px), ax = px + Math.cos(ang) * 50, ay = py + Math.sin(ang) * 50;
    x.strokeStyle = '#1d1d1f'; x.lineWidth = 3; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + (lx - ax) * u, ay + (ly - ay) * u); x.stroke();
    if (u > .6 && m.text) { const kk = back(prog(t, m.at + .2, m.at + .5)) * k; x.translate(lx, ly); x.scale(kk, kk);
      x.font = '800 48px "JetBrains Mono"'; const tw = x.measureText(m.text).width + 56;
      x.fillStyle = '#1d1d1f'; rrect(-tw / 2, -40, tw, 80, 18); x.fill(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(m.text, 0, 3); }
    x.restore();
  }
}
// globo de diálogo del mecánico: blanco con sombra suave, letra serif, aparece con rebote y se escribe palabra por palabra
function isoBubbles(t, list, st, v) {
  if (!list || !st.M || MC.teasing) return;
  for (const b of list) {
    if (t < b.at || (has(b.until) && t > b.until + .25)) continue;
    const k = back(prog(t, b.at, b.at + .35)) * (has(b.until) ? 1 - prog(t, b.until, b.until + .25) : 1); if (k <= 0) continue;
    const hp = new T.Vector3(); st.M.head.getWorldPosition(hp); hp.y += 40;
    const [hx, hy] = v.project(hp.x, hp.y, hp.z), size = b.size || 66;
    x.save(); x.font = `400 ${size}px "DM Serif Display"`;
    const words = b.text.split(' '), shown = Math.max(1, Math.ceil(words.length * prog(t, b.at + .1, b.at + .1 + Math.min(1.2, words.length * .18))));
    const lines = []; let ln = '';
    for (const w of words) { const tr = ln ? ln + ' ' + w : w; if (x.measureText(tr).width > (b.width || 560) && ln) { lines.push(ln); ln = w; } else ln = tr; }
    lines.push(ln);
    const lw = Math.max(...lines.map(l => x.measureText(l).width)), pad = size * .55, bw = lw + pad * 2, bh = lines.length * size * 1.15 + pad * 1.2;
    const cx = Math.min(W - 50 - bw / 2, Math.max(50 + bw / 2, hx + (b.dx ?? 120) + bw / 2)), cy = hy - (b.dy ?? 60) - bh / 2;
    x.translate(hx, hy); x.scale(k, k); x.translate(-hx, -hy);
    x.shadowColor = 'rgba(40,30,20,.18)'; x.shadowBlur = 30; x.shadowOffsetY = 12; x.fillStyle = '#fff';
    rrect(cx - bw / 2, cy - bh / 2, bw, bh, 30); x.fill();
    const ey = hy < cy ? cy - bh / 2 + 2 : cy + bh / 2 - 2;      // la cola sale del borde que mira a la cabeza
    x.beginPath(); x.moveTo(cx - bw / 2 + 30, ey); x.lineTo(hx + 40, hy + (hy < cy ? 20 : -10)); x.lineTo(cx - bw / 2 + 80, ey); x.closePath(); x.fill();
    x.shadowColor = 'transparent'; x.fillStyle = '#1d1d1f'; x.textAlign = 'left'; x.textBaseline = 'middle';
    let left = shown;
    lines.forEach((l, i) => { const ws = l.split(' '), part = ws.slice(0, Math.max(0, left)).join(' '); left -= ws.length;
      x.fillText(part, cx - bw / 2 + pad, cy - bh / 2 + pad * .6 + size * 1.15 * (i + .5)); });
    x.restore();
  }
}

// ---------------------------------------------------------------- gancho de choque
// sello rojo gigante que CAE de golpe en el cuadro 0 (de 2,3x a 1x en 0,18 s), inclinado como etiqueta de advertencia,
// con destello blanco: interrumpe el scroll antes de que la persona alcance a pasar de video
function isoImpact(t, c) {
  if (!c || MC.teasing) return;
  const u = t - (c.at || 0); if (u < 0 || (has(c.until) && t > c.until + .3)) return;
  const k = has(c.until) ? 1 - eio(prog(t, c.until, c.until + .3)) : 1, land = Math.min(1, u / .18);
  const sc = (2.3 - 1.3 * eout(land)) * (1 + .05 * Math.sin(Math.max(0, u - .18) * 30) * Math.exp(-Math.max(0, u - .18) * 8));
  const lines = String(c.text).split('\n'), size = c.size || 112, y = c.y || 470;
  x.save(); x.globalAlpha = k * Math.min(1, land * 3); x.translate(W / 2, y); x.rotate(-.07); x.scale(sc, sc);
  x.font = `900 italic ${size}px Montserrat`; const w = Math.max(...lines.map(l => x.measureText(l).width)) + 90, h = lines.length * size * 1.08 + 70;
  const fit = Math.min(1, (W - 110) / w); x.scale(fit, fit);            // nunca se sale por los lados
  x.shadowColor = 'rgba(120,0,0,.35)'; x.shadowBlur = 40; x.shadowOffsetY = 16; x.fillStyle = '#e3141b'; rrect(-w / 2, -h / 2, w, h, 26); x.fill();
  x.shadowColor = 'transparent'; x.strokeStyle = '#fff'; x.lineWidth = 8; rrect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 18); x.stroke();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => x.fillText(l, 0, (i - (lines.length - 1) / 2) * size * 1.08 + 6));
  x.restore();
  if (u < .14) { x.fillStyle = `rgba(255,255,255,${.85 * (1 - u / .14)})`; x.fillRect(0, 0, W, H); }   // destello
}

// ---------------------------------------------------------------- formato "adivina"
// opciones A/B/C en tarjetas que entran cuando la voz las lee; al revelar, la correcta se pone roja con ✓
function isoOptions(t, o) {
  if (!o || MC.teasing || !o.items.length || t < o.items[0].at || (has(o.until) && t > o.until + .3)) return;
  const out = has(o.until) ? 1 - eio(prog(t, o.until, o.until + .3)) : 1, rv = has(o.reveal_at) ? eout(prog(t, o.reveal_at, o.reveal_at + .35)) : 0;
  o.items.forEach((it, i) => {
    if (t < it.at) return;
    const k = back(prog(t, it.at, it.at + .35)) * out, ok = it.letra === o.correct, y = (o.y || 1010) + i * 128, w = 760;
    x.save(); x.globalAlpha = Math.min(1, k) * (ok ? 1 : 1 - .65 * rv); x.translate(W / 2 + 60 * (1 - Math.min(1, k)), y);
    const pop = ok ? 1 + .08 * Math.sin(Math.PI * Math.min(1, rv)) : 1; x.scale(pop, pop);
    x.shadowColor = 'rgba(40,30,20,.14)'; x.shadowBlur = 24; x.shadowOffsetY = 8;
    x.fillStyle = ok && rv > .5 ? '#e3141b' : '#fff'; rrect(-w / 2, -48, w, 96, 48); x.fill(); x.shadowColor = 'transparent';
    x.fillStyle = ok && rv > .5 ? '#fff' : '#1d1d1f'; x.beginPath(); x.arc(-w / 2 + 50, 0, 32, 0, Math.PI * 2); x.fill();
    x.fillStyle = ok && rv > .5 ? '#e3141b' : '#fff'; x.font = '800 36px Montserrat'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ok && rv > .5 ? '✓' : it.letra, -w / 2 + 50, 2);
    x.fillStyle = ok && rv > .5 ? '#fff' : '#1d1d1f'; x.font = '800 40px "JetBrains Mono"'; x.textAlign = 'left';
    x.fillText(String(it.texto).toUpperCase(), -w / 2 + 104, 3); x.restore();
  });
}
// cuenta regresiva: número grande en serif con un anillo que se vacía en un segundo
function isoCountdown(t, list) {
  if (!list || MC.teasing) return;
  for (let i = 0; i < list.length; i++) {
    const c = list[i], end = i + 1 < list.length ? list[i + 1].at : c.at + .9; if (t < c.at || t > end) continue;
    const u = prog(t, c.at, end), k = back(prog(t, c.at, c.at + .25)) * (1 - eio(prog(t, end - .12, end)));
    x.save(); x.translate(W / 2, c.y || 760); x.scale(k, k);
    x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.arc(0, 0, 150, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#e3141b'; x.lineWidth = 14; x.lineCap = 'round'; x.beginPath(); x.arc(0, 0, 150, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (1 - u)); x.stroke();
    x.fillStyle = '#1d1d1f'; x.font = '400 200px "DM Serif Display"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(c.n), 0, 14);
    x.restore();
  }
}

// ---------------------------------------------------------------- números en pantalla
// tarjeta de dato: número grande en serif que cuenta hacia arriba + texto corto; o leyenda de colores (rows)
function isoStats(t, list) {
  if (!list || MC.teasing) return;
  for (const c of list) {
    if (t < c.at || (has(c.until) && t > c.until + .3)) continue;
    const k = back(prog(t, c.at, c.at + .4)) * (has(c.until) ? 1 - eio(prog(t, c.until, c.until + .3)) : 1); if (k <= 0) continue;
    const y = c.y || 1190; x.save(); x.translate(W / 2, y); x.scale(k, k);
    if (c.rows) {                                   // leyenda: ● color · texto
      x.font = '800 40px "JetBrains Mono"'; const lw = Math.max(...c.rows.map(r => x.measureText(r[1]).width)) + 130, lh = 62, h = c.rows.length * lh + 50;
      x.shadowColor = 'rgba(40,30,20,.16)'; x.shadowBlur = 30; x.shadowOffsetY = 10; x.fillStyle = '#fff'; rrect(-lw / 2, -h / 2, lw, h, 28); x.fill(); x.shadowColor = 'transparent';
      c.rows.forEach((r, i) => { const ry = -h / 2 + 25 + lh * (i + .5), kk = eout(prog(t, c.at + .15 + i * .25, c.at + .45 + i * .25));
        x.globalAlpha = kk; x.fillStyle = r[0]; x.beginPath(); x.arc(-lw / 2 + 50, ry, 17, 0, Math.PI * 2); x.fill();
        if (r[2]) { x.strokeStyle = '#e3141b'; x.lineWidth = 5; x.beginPath(); x.arc(-lw / 2 + 50, ry, 25, 0, Math.PI * 2); x.stroke(); }
        x.fillStyle = '#1d1d1f'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(r[1], -lw / 2 + 90, ry + 2); });
    } else {                                        // dato: "500 km" grande + "lubrícala cada" pequeño
      const m = String(c.big).match(/^([\d.,]+)(.*)$/), u = eout(prog(t, c.at + .1, c.at + .9));
      let big = c.big; if (m && c.count !== false) { const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.')); big = Math.round(n * u).toLocaleString('es-CO') + m[2]; }
      x.font = '400 120px "DM Serif Display"'; const bw = x.measureText(c.big).width; x.font = '800 38px "JetBrains Mono"';
      const sw = x.measureText(c.small || '').width, w = Math.max(bw, sw) + 110, h = c.small ? 230 : 170;
      x.shadowColor = 'rgba(40,30,20,.16)'; x.shadowBlur = 30; x.shadowOffsetY = 10; x.fillStyle = '#fff'; rrect(-w / 2, -h / 2, w, h, 30); x.fill(); x.shadowColor = 'transparent';
      x.fillStyle = '#e3141b'; rrect(-w / 2, -h / 2, 14, h, 7); x.fill();
      x.textAlign = 'center'; x.textBaseline = 'middle';
      if (c.small) { x.fillStyle = '#6b6c72'; x.fillText(c.small.toUpperCase(), 0, -h / 2 + 50); }
      x.fillStyle = '#1d1d1f'; x.font = '400 120px "DM Serif Display"'; x.fillText(big, 0, c.small ? 30 : 5);
    }
    x.restore();
  }
}
// lista de revisión: círculos numerados bajo el título que se marcan con ✓ rojo al revisar cada punto
function isoChecks(t, c) {
  if (!c || MC.teasing || t < c.at || (has(c.until) && t > c.until + .3)) return;
  const k = eout(prog(t, c.at, c.at + .4)) * (has(c.until) ? 1 - prog(t, c.until, c.until + .3) : 1), n = c.items.length, gap = 96, y = c.y || 125;
  x.save(); x.globalAlpha = k;
  c.items.forEach((ti, i) => {
    const cx = W / 2 + (i - (n - 1) / 2) * gap, done = eout(prog(t, ti, ti + .3)), cur = t >= ti && (i + 1 >= n || t < c.items[i + 1]);
    if (i) { x.strokeStyle = done > 0 ? '#e3141b' : '#cfcac2'; x.lineWidth = 5; x.beginPath(); x.moveTo(cx - gap + 34, y); x.lineTo(cx - 34, y); x.stroke(); }
    const r = 27 * (1 + (cur ? .14 * back(prog(t, ti, ti + .4)) : 0));
    x.fillStyle = done > 0 ? '#e3141b' : '#fff'; x.strokeStyle = done > 0 ? '#e3141b' : '#cfcac2'; x.lineWidth = 4;
    x.beginPath(); x.arc(cx, y, r, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = done > .5 ? '#fff' : '#1d1d1f'; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (done > .5) { x.font = '800 34px Montserrat'; x.fillText('✓', cx, y + 2); } else { x.font = '800 30px "JetBrains Mono"'; x.fillText(String(i + 1), cx, y + 2); }
  });
  x.restore();
}
// cronómetro: "0:07" que avanza de 0 a N segundos repartidos entre from y to (dramatiza "en 10 segundos")
function isoTimer(t, c) {
  if (!c || MC.teasing || t < c.at || (has(c.until) && t > c.until + .3)) return;
  const k = back(prog(t, c.at, c.at + .4)) * (has(c.until) ? 1 - prog(t, c.until, c.until + .3) : 1); if (k <= 0) return;
  const secs = Math.min(c.seconds || 10, (c.seconds || 10) * prog(t, c.from ?? c.at, c.to)), sx = c.x || W - 150, sy = c.y || 330;
  const full = secs >= (c.seconds || 10) - .01, txt = `0:${String(Math.floor(secs)).padStart(2, '0')}`;
  x.save(); x.translate(sx, sy); x.scale(k, k);
  x.fillStyle = full ? '#e3141b' : '#1d1d1f'; rrect(-110, -42, 220, 84, 42); x.fill();
  x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.arc(-62, 0, 20, 0, Math.PI * 2); x.stroke();
  const a = -Math.PI / 2 + 2 * Math.PI * (secs % 1 || (full ? 0 : secs % 1)); x.beginPath(); x.moveTo(-62, 0); x.lineTo(-62 + 14 * Math.cos(a), 14 * Math.sin(a)); x.stroke();
  x.fillStyle = '#fff'; x.font = '800 44px "JetBrains Mono"'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(txt, -32, 3);
  x.restore();
}

// ---------------------------------------------------------------- textos del estilo: cápsula, título serif, caja negra
function isoOverlay(t, s, p) {
  if (MC.teasing) return;
  if (p.pill) { const pa = p.pill.at ?? s.start, pu = p.pill.until, pg = p.pill.again;   // until/again: solo al inicio y al final
    let k = back(prog(t, pa, pa + .4));
    if (has(pu) && t > pu) k = has(pg) && t >= pg ? back(prog(t, pg, pg + .4)) : 1 - eio(prog(t, pu, pu + .3));
    if (k > 0) {
    x.save(); x.translate(W / 2, p.pill.y || 250); x.scale(k, k); x.font = '800 44px Montserrat'; const w = x.measureText(p.pill.text).width + 80;
    x.shadowColor = 'rgba(227,20,27,.35)'; x.shadowBlur = 24; x.shadowOffsetY = 8; x.fillStyle = '#e3141b'; rrect(-w / 2, -42, w, 84, 14); x.fill(); x.shadowColor = 'transparent';
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.pill.text, 0, 3); x.restore(); } }
  for (const ti of p.titles || []) {               // título serif negro, entra subiendo y se desvanece
    const a = ti.at ?? s.start; if (t < a || (has(ti.until) && t > ti.until + .3)) continue;
    const k = eout(prog(t, a, a + .5)) * (has(ti.until) ? 1 - prog(t, ti.until, ti.until + .3) : 1);
    x.save(); x.globalAlpha = k; x.fillStyle = ti.color || '#1d1d1f'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `400 ${ti.size || 118}px "DM Serif Display"`;
    const lines = String(ti.text).split('\n'), sz = ti.size || 118, tw = Math.max(...lines.map(l => x.measureText(l).width)) + 90;
    x.fillStyle = 'rgba(241,239,234,.9)'; rrect(W / 2 - tw / 2, (ti.y || 400) - sz * .72 + 30 * (1 - k), tw, sz * (lines.length * 1.05 + .4), 34); x.fill();   // tarjeta crema: se lee aunque detrás pase la maqueta
    x.fillStyle = ti.color || '#1d1d1f';
    lines.forEach((ln, i) => x.fillText(ln, W / 2, (ti.y || 400) + i * (ti.size || 118) * 1.05 + 30 * (1 - k)));
    x.restore();
  }
  for (const n of p.notes || []) {                 // nota pequeña junto a una pieza (texto gris, línea fina)
    const a = n.at ?? s.start; if (t < a || (has(n.until) && t > n.until + .3)) continue;
    const k = eout(prog(t, a, a + .35)) * (has(n.until) ? 1 - prog(t, n.until, n.until + .3) : 1);
    x.save(); x.globalAlpha = k; x.font = '800 40px "JetBrains Mono"'; x.textAlign = 'center'; x.fillStyle = n.color || '#55565c'; x.fillText(n.text, W / 2, n.y || 1300); x.restore();
  }
  isoCaption(t, p);
}
function isoCaption(t, p) {                         // subtítulo: caja negra redondeada, letra de máquina en mayúsculas
  const sp = MC.spec.speech, wd = MC.spec.speech_words; if (!wd || p.caption === false) return;
  let i = wd.findIndex(w => t >= w[0] - .05 && t < w[1] + .12); if (i < 0) return;
  const grp = Math.floor(i / 2) * 2, txt = wd.slice(grp, grp + 2).map(w => w[2]).join(' ').toUpperCase().replace(/[¿?¡!.,:;…"]/g, '');
  if (!txt) return;
  x.save(); x.font = '800 74px "JetBrains Mono"'; const w = Math.min(W - 80, x.measureText(txt).width + 90), y = p.caption_y || 1520;
  x.fillStyle = '#1d1d1f'; rrect(W / 2 - w / 2, y - 62, w, 124, 22); x.fill();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, W / 2, y + 4, W - 120); x.restore();
}

Object.assign(MC.kit, { ISO: KIND, PAL });
