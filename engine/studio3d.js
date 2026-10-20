// Estudio 3D tipo comercial de autos: sala de exhibición clara (pared redonda, franja roja, LED, logo), tarima,
// contraluz rojo de la marca y azul,
// polvo flotando en el haz de luz, y la moto o las piezas del kit en 3D. La cámara cambia de toma cada ~1.5 s
// (vuelta, acercamiento, toma baja, cenital, macro, lateral) para que el ojo nunca se aburra. Encima puede ir el
// juego "¿mito o realidad?" (quiz), títulos e insignias. Unidades: las piezas se escalan a su tamaño (size).
const MC = window.MC;
const { T, render3d, view, shadowed } = MC.three;
const K = MC.kit;

const ST = {};
function build(key, p) {
  if (ST[key]) return ST[key];
  const C = { brand: new T.Color(TH.primary).getHex() };
  const scene = new T.Scene(); scene.environment = MC.three.R3.env; scene.environmentIntensity = .9;
  // sala de exhibición clara: pared redonda gris perla con franja roja de la marca, tubos LED verticales, logo en la
  // pared y piso de concreto pulido. Antes era un vacío negro y el usuario lo veía "todo muy oscuro, sin escenario".
  scene.add(new T.HemisphereLight(0xf4f6ff, 0x6a5a4a, 1.5));
  const key1 = new T.SpotLight(0xfff4e6, 16, 0, .6, .5, 0); key1.position.set(350, 1500, 800); key1.castShadow = true;
  key1.shadow.mapSize.set(1024, 1024); key1.shadow.bias = -.0005; scene.add(key1, key1.target);
  const rimR = new T.DirectionalLight(new T.Color(TH.accent), 2.4); rimR.position.set(-900, 500, -700); scene.add(rimR);
  const rimB = new T.DirectionalLight(0x9cc4ff, 1.2); rimB.position.set(900, 400, -600); scene.add(rimB);
  const fill = new T.DirectionalLight(0xffffff, 1.3); fill.position.set(0, 400, 1400); scene.add(fill);
  const RW = 2700, HW = 2300;
  const floor = new T.Mesh(new T.CircleGeometry(RW + 10, 72), new T.MeshPhysicalMaterial({ color: 0x7d8087, roughness: .55, metalness: .05, clearcoat: .3, clearcoatRoughness: .45 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new T.Mesh(new T.CylinderGeometry(RW, RW, HW, 72, 1, true), new T.MeshStandardMaterial({ color: 0xd9dce2, roughness: .85, side: T.BackSide }));
  wall.position.y = HW / 2; scene.add(wall);
  const band = new T.Mesh(new T.CylinderGeometry(RW - 4, RW - 4, 150, 72, 1, true), new T.MeshStandardMaterial({ color: new T.Color(TH.primary), roughness: .5, side: T.BackSide, emissive: new T.Color(TH.primary), emissiveIntensity: .25 }));
  band.position.y = 520; scene.add(band);
  const skirt = new T.Mesh(new T.CylinderGeometry(RW - 3, RW - 3, 90, 72, 1, true), new T.MeshStandardMaterial({ color: 0x1b1c20, roughness: .6, side: T.BackSide }));
  skirt.position.y = 45; scene.add(skirt);
  const led = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.2 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const m = new T.Mesh(new T.BoxGeometry(26, 1500, 26), led);
    m.position.set(Math.cos(a) * (RW - 30), 1250, Math.sin(a) * (RW - 30)); scene.add(m); }
  const ringL = new T.Mesh(new T.TorusGeometry(900, 14, 8, 96), led); ringL.rotation.x = Math.PI / 2; ringL.position.y = 2100; scene.add(ringL);   // aro de luz arriba
  if (MC.logo) {                                   // logo de la marca en la pared, en dos lados
    const lt = new T.Texture(MC.logo); lt.colorSpace = T.SRGBColorSpace; lt.needsUpdate = true; const ar = MC.logo.width / MC.logo.height;
    for (const a of [-Math.PI / 2, Math.PI / 2 + .9]) { const m = new T.Mesh(new T.PlaneGeometry(700 * ar, 700), new T.MeshBasicMaterial({ map: lt, transparent: true, color: 0x222222 }));
      m.position.set(Math.cos(a) * (RW - 40), 1150, Math.sin(a) * (RW - 40)); m.lookAt(0, 1150, 0); scene.add(m); }
  }
  const ring = new T.Mesh(new T.RingGeometry(700, 716, 96), new T.MeshBasicMaterial({ color: new T.Color(TH.accent), transparent: true, opacity: .8 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 1; scene.add(ring);
  const disc = new T.Mesh(new T.CylinderGeometry(690, 700, 18, 72), new T.MeshPhysicalMaterial({ color: 0x1d1e22, roughness: .3, clearcoat: 1 }));   // tarima giratoria
  disc.position.y = 9; disc.receiveShadow = true; scene.add(disc);
  // reflejos: el cromo y la pintura reflejan ESTA sala (paredes, franja roja, tubos LED), no un estudio genérico
  try {
    const envScene = new T.Scene(); envScene.add(new T.HemisphereLight(0xffffff, 0x8a8478, 2.2));
    for (const o of scene.children) if (o.isMesh) envScene.add(o.clone());
    const pm = new T.PMREMGenerator(MC.three.renderer(1080, 1920));
    scene.environment = pm.fromScene(envScene, .015, 10, 9000, { position: new T.Vector3(0, 420, 0) }).texture; scene.environmentIntensity = .85;
    pm.dispose();
  } catch (e) { /* si falla, queda el estudio genérico */ }
  // sombra de contacto: mancha suave pegada al piso bajo cada pieza (sin ella las piezas parecen flotar)
  const aoc = document.createElement('canvas'); aoc.width = aoc.height = 128; const ag = aoc.getContext('2d'), rg = ag.createRadialGradient(64, 64, 4, 64, 64, 64);
  rg.addColorStop(0, 'rgba(0,0,0,.75)'); rg.addColorStop(.55, 'rgba(0,0,0,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); ag.fillStyle = rg; ag.fillRect(0, 0, 128, 128);
  const aoTex = new T.CanvasTexture(aoc), aoMat = new T.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false });
  // piezas
  const items = (p.items || [{ item: p.item || 'naked' }]).map((it, i) => {
    const g = new T.Group(), make = it.item === 'modelo' ? () => K.modelBike(C, p.model_url, p.model_setup).bike : (K.ITEMS[it.item] || K.ITEMS.naked);
    const obj = make(C); g.add(obj);
    const b = new T.Box3().setFromObject(obj), sz = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
    const k = (it.size || 620) / Math.max(sz.x, sz.y, sz.z); obj.scale.multiplyScalar(k); obj.position.sub(new T.Vector3(c.x, b.min.y, c.z).multiplyScalar(k));
    g.position.set(it.x || 0, (it.y || 0) + 18, it.z || 0);
    const ao = new T.Mesh(new T.PlaneGeometry(sz.x * k * 1.25, sz.z * k * 1.6), aoMat); ao.rotation.x = -Math.PI / 2; ao.position.y = .6; ao.userData.keep = true; g.add(ao); g.rotation.y = it.yaw || 0; scene.add(shadowed(g));
    return { g, it, h: sz.y * k, w: Math.max(sz.x, sz.z) * k };
  });
  // polvo en el haz de luz
  const N = 260, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (hash(i * 1.3) - .5) * 1600; pos[i * 3 + 1] = hash(i * 2.7) * 1100; pos[i * 3 + 2] = (hash(i * 4.1) - .5) * 1200; }
  const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(pos, 3));
  const dust = new T.Points(dg, new T.PointsMaterial({ color: 0xffe6c8, size: 4, transparent: true, opacity: .55, depthWrite: false })); scene.add(dust);
  if (!window.__NOBAKE) MC.three.bake(scene, new Set(items.map(o => o.g)));
  const cam = new T.PerspectiveCamera(32, 1080 / 1920, 10, 12000);
  return (ST[key] = { scene, cam, items, dust, key1 });
}

const KINDS = ['orbit', 'push', 'low', 'top', 'macro', 'side'];
function shotAt(t, s, p) {
  const list = p.cuts && !(p.shots && p.shots.length) ? [s.start, ...p.cuts].map((at, i) => ({ at, kind: KINDS[(i + (p.shot_offset || 0)) % KINDS.length] }))
    : p.shots && p.shots.length ? p.shots.map((q, i) => ({ ...q, at: has(q.at) ? q.at : s.start + i * 1.6 }))
    : Array.from({ length: Math.ceil((s.end - s.start) / (p.cut_every || 1.6)) + 1 }, (_, i) => ({ at: s.start + i * (p.cut_every || 1.6), kind: KINDS[(i + (p.shot_offset || 0)) % KINDS.length] }));
  let cur = list[0], i0 = 0;
  list.forEach((q, i) => { if (t >= q.at) { cur = q; i0 = i; } });
  // (sin s._cuts: el barrido del núcleo emborrona; cada toma entra con un destello propio)
  const end = i0 + 1 < list.length ? list[i0 + 1].at : s.end;
  return { q: cur, u: prog(t, cur.at, end), d: t - cur.at, idx: i0 };
}

MC.scenes.studio = function (t, s, p) {
  const st = build('studio' + s.start, p);
  const lt = t - s.start;
  // fondo: negro con resplandor de marca detrás de la pieza
  x.fillStyle = '#c9ccd2'; x.fillRect(0, 0, W, H);
  for (const o of st.items) if (o.it.spin !== false) o.g.rotation.y = (o.it.yaw || 0) + lt * (o.it.spin || .25);
  st.dust.rotation.y = lt * .05; st.dust.position.y = -((lt * 14) % 60);
  // cámara según la toma
  const { q, u, d, idx } = shotAt(t, s, p), main = st.items[0], H0 = Math.max(...st.items.map(o => o.h)), R = Math.max(...st.items.map(o => Math.hypot(o.it.x || 0, o.it.z || 0) + o.w * .5)) + H0 * .3;   // incluye lo separadas que están las piezas
  const tg = new T.Vector3(0, H0 * .45, 0), e = eio(u);
  let yaw = .5 + idx * 1.3, pitch = .16, dist = R * 3.1;
  switch (q.kind) {
    case 'orbit': yaw += .7 * u; pitch = .2; dist = R * 3.0; break;
    case 'push': dist = R * (3.6 - 1.3 * e); pitch = .1; yaw += .1 * u; break;
    case 'low': pitch = .02; dist = R * 2.5; yaw += .35 * u; tg.y = H0 * .32; break;
    case 'top': pitch = .95 - .2 * e; dist = R * 3.1; yaw += .5 * u; break;
    case 'macro': dist = R * (1.95 - .25 * e);                  // no tan cerca: la pieza se debe reconocer pitch = .12; yaw += .25 * u; if (q.focus || main.it.focus) { const f = q.focus || main.it.focus; tg.set(f[0] * main.w, f[1] * H0, f[2] * main.w); } break;
    case 'side': yaw = Math.PI / 2 + .05; pitch = .08; dist = R * 2.9; tg.x = (u - .5) * R * .6; break;
  }
  tg.y += H0 * (p.lift || 0);                                   // >0: la pieza baja en pantalla (deja sitio al texto)
  if (has(q.yaw)) yaw = q.yaw + .3 * u; if (has(q.dist)) dist = R * q.dist; if (has(q.pitch)) pitch = q.pitch;
  const c = st.cam;
  c.position.set(tg.x + dist * Math.sin(yaw) * Math.cos(pitch), tg.y + dist * Math.sin(pitch), tg.z + dist * Math.cos(yaw) * Math.cos(pitch));
  c.lookAt(tg); c.updateMatrixWorld();
  // barrido de luz: el foco principal pasea por la pieza
  st.key1.position.x = 350 + 500 * Math.sin(lt * .9); st.key1.target.position.set(0, H0 * .3, 0);
  render3d(st.scene, view(c, 1080, 1920, 0, 0), .2);
  // destello de corte (cada toma entra con un flash suave)
  const fl = 1 - prog(d, 0, .18); if (fl > 0 && idx > 0) { x.fillStyle = `rgba(255,255,255,${.28 * fl})`; x.fillRect(0, 0, W, H); }
  stackLines(t, p.lines, p.lines_y || 330);
  if (p.badges) badgesAt(t, p.badges, p.badges_y || 1250);
  if (p.quiz) MC.scenes.quiz(t, s, p.quiz);
};
