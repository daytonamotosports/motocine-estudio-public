// Kit 3D de MotoCine: modelos de juguete reutilizables para cualquier video (motos, mecánico mascota,
// repuestos, herramientas y escenarios). Todo se arma con figuras simples redondeadas: no depende de
// archivos externos, pesa nada y se puede pintar con los colores de cualquier marca.
// Uso desde otro módulo: const { toyBike, mechanic, helmet, ... } = MC.kit;
const MC = window.MC;
const { T } = MC.three;

// ---------------------------------------------------------------- piezas básicas
function rbox(w, h, d, b) {              // caja redondeada (aspecto juguete)
  b = Math.min(b ?? Math.min(w, h, d) * .16, w / 2 - .5, h / 2 - .5, d / 2 - .5);
  const iw = w - 2 * b, ih = h - 2 * b, rc = Math.min(iw, ih) * .12;
  const s = new T.Shape();
  s.moveTo(-iw / 2 + rc, -ih / 2); s.lineTo(iw / 2 - rc, -ih / 2); s.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + rc);
  s.lineTo(iw / 2, ih / 2 - rc); s.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - rc, ih / 2);
  s.lineTo(-iw / 2 + rc, ih / 2); s.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - rc);
  s.lineTo(-iw / 2, -ih / 2 + rc); s.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + rc, -ih / 2);
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(.5, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}
const mat = (color, rough = .55, metal = 0, extra = {}) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const paint = (color, extra = {}) => new T.MeshPhysicalMaterial({ color, roughness: .32, metalness: .1, clearcoat: .8, clearcoatRoughness: .12, ...extra });
function put(parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o;
}
function rod(parent, a, b, r, m) {        // cilindro entre dos puntos
  const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A);
  const o = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 12), m);
  o.position.copy(A).add(B).multiplyScalar(.5);
  o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  parent.add(o); return o;
}

// ciudad de noche para la ventana (textura pintada una sola vez)
function cityTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, '#0b1230'); sky.addColorStop(1, '#1d2a5c');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let layer = 0; layer < 2; layer++) {
    for (let bx = -20; bx < 1024;) {
      const bw = 50 + rnd() * 90, bh = (layer ? 180 : 120) + rnd() * (layer ? 260 : 200);
      g.fillStyle = layer ? '#0e1531' : '#18214a'; g.fillRect(bx, 512 - bh, bw, bh);
      for (let wy = 512 - bh + 12; wy < 500; wy += 16) for (let wx = bx + 8; wx < bx + bw - 10; wx += 14) {
        if (rnd() < (layer ? .42 : .25)) { g.fillStyle = rnd() < .8 ? '#ffd58a' : '#9fc4ff'; g.globalAlpha = .55 + rnd() * .45; g.fillRect(wx, wy, 7, 9); g.globalAlpha = 1; }
      }
      bx += bw + 6;
    }
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- la moto de juguete
function toyBike(C) {
  const bike = new T.Group();
  const red = paint(C.brand), black = paint(0x15161a), metal = mat(0xc4c9cf, .22, 1), dark = mat(0x3a3e45, .45, .8),
        rubber = mat(0x141414, .85), gold = mat(0xd9a53a, .3, .9), satin = mat(0x2a2c31, .5, .3);
  const wheel = (x, front) => {
    const w = new T.Group(); w.position.set(x, 80, 0); bike.add(w);
    put(w, new T.TorusGeometry(62, 18, 16, 48), rubber);                                         // llanta
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; put(w, new T.BoxGeometry(5, 3, 22), mat(0x0b0b0b, .9), Math.cos(a) * 79.5, Math.sin(a) * 79.5, 0, 0, 0, a + Math.PI / 2).rotation.y = i % 2 ? .35 : -.35; }
    put(w, new T.TorusGeometry(47, 4.5, 10, 48), red);                                         // aro del rin
    put(w, new T.CylinderGeometry(47, 47, 6, 40, 1, true), red, 0, 0, 0, Math.PI / 2);
    for (let i = 0; i < 6; i++) {                                                               // 3 radios dobles curvos
      const g = put(w, rbox(6, 40, 8, 2), red, 0, 0, 0, 0, 0, i * Math.PI / 3 + (i % 2 ? .12 : -.12)); g.geometry.translate(0, 24, 0);
    }
    put(w, new T.CylinderGeometry(13, 13, 34, 20), metal, 0, 0, 0, Math.PI / 2);
    const parts = {};
    if (front) {
      parts.disc = put(w, new T.CylinderGeometry(40, 40, 4, 40), mat(0xdfe3e8, .25, .85), 0, 0, 19, Math.PI / 2);
      for (let i = 0; i < 12; i++) put(w, new T.CylinderGeometry(2.6, 2.6, 6, 8), mat(0x222222, .5), 31 * Math.cos(i * .5236), 31 * Math.sin(i * .5236), 20, Math.PI / 2);
      put(w, new T.CylinderGeometry(20, 20, 6, 6), dark, 0, 0, 20, Math.PI / 2);
      parts.caliper = put(bike, rbox(28, 42, 18, 6), mat(0xf5b427, .35), x - 30, 80 + 24, 28, 0, 0, .5);
    } else {
      parts.sprocket = put(w, new T.CylinderGeometry(31, 31, 5, 30), mat(0xc9ced4, .28, .9), 0, 0, 30, Math.PI / 2);
      for (let i = 0; i < 30; i++) put(w, new T.BoxGeometry(5, 7, 5), mat(0xc9ced4, .28, .9), 33 * Math.cos(i * .2094), 33 * Math.sin(i * .2094), 30, 0, 0, i * .2094);
      put(w, new T.CylinderGeometry(14, 14, 7, 6), dark, 0, 0, 31, Math.PI / 2);
    }
    return { w, parts };
  };
  const F = wheel(175, true), R = wheel(-175, false);
  // guardabarros
  put(bike, new T.CylinderGeometry(86, 86, 40, 24, 1, true, -.15, 1.25), black, 175, 80, 0, Math.PI / 2, 0, 0).material.side = T.DoubleSide;
  put(bike, new T.CylinderGeometry(88, 88, 30, 24, 1, true, .9, .9), black, -175, 80, 0, Math.PI / 2, 0, 0);
  // motor
  const engine = put(bike, rbox(122, 94, 86, 16), mat(0x8c9198, .38, .7), -5, 110, 0);
  put(bike, new T.CylinderGeometry(34, 34, 10, 32), mat(0x6c7178, .3, .9), 10, 104, 44, Math.PI / 2);       // tapa del embrague
  put(bike, new T.TorusGeometry(34, 3, 8, 32), metal, 10, 104, 49);
  put(bike, rbox(46, 40, 10, 6), satin, -40, 106, 46);                                                       // tapa del piñón
  put(bike, rbox(64, 76, 72, 12), mat(0x9aa0a8, .32, .7), 42, 160, 0, 0, 0, -.35);
  for (let i = 0; i < 5; i++) put(bike, new T.BoxGeometry(72, 3.5, 76), dark, 40 + 3 * i, 136 + i * 12, 0, 0, 0, -.35);
  // chasis tipo enrejado (color de marca) y basculante
  for (const z of [24, -24]) {
    rod(bike, [125, 252, z], [-40, 128, z], 6, red); rod(bike, [125, 252, z], [40, 116, z], 6, red);
    rod(bike, [40, 116, z], [-40, 128, z], 5, red); rod(bike, [70, 200, z], [-10, 130, z], 4, red);
  }
  put(bike, rbox(150, 16, 12, 4), satin, -100, 100, 18, 0, 0, .13); put(bike, rbox(150, 16, 12, 4), satin, -100, 100, -18, 0, 0, .13);
  rod(bike, [-60, 150, 22], [-150, 210, 22], 7, mat(0xf5b427, .4)); rod(bike, [-60, 150, 22], [-150, 210, 22], 3, metal);   // amortiguador
  // tanque con tapas laterales y grafismo
  const tank = put(bike, rbox(150, 72, 98, 24), black, 55, 230, 0, 0, 0, -.08);
  put(bike, rbox(128, 16, 100, 6), red, 50, 224, 0, 0, 0, -.08);
  for (const z of [52, -52]) put(bike, rbox(70, 56, 8, 4), red, 95, 205, z, 0, z > 0 ? .25 : -.25, -.3);
  put(bike, new T.CylinderGeometry(12, 12, 6, 16), metal, 70, 268, 0);                                       // tapón
  // asiento, cola y luz trasera
  put(bike, rbox(150, 24, 74, 10), mat(0x1b1b1d, .85), -72, 216, 0, 0, 0, .05);
  put(bike, rbox(100, 34, 56, 12), red, -150, 230, 0, 0, 0, .18);
  put(bike, rbox(20, 14, 40, 5), mat(0xff2a2a, .3, 0, { emissive: 0xff1010, emissiveIntensity: 1.4 }), -202, 240, 0, 0, 0, .18);
  put(bike, rbox(8, 46, 60, 3), satin, -205, 196, 0, 0, 0, -.2);                                             // porta placa
  // suspensión delantera (barras doradas), máscara con faro y manubrio con espejos
  for (const z of [30, -30]) { rod(bike, [175, 80, z], [150, 170, z], 10, gold); rod(bike, [150, 170, z], [128, 278, z], 8, metal); }
  put(bike, rbox(46, 46, 74, 12), black, 135, 268, 0);
  put(bike, rbox(30, 70, 84, 12), red, 158, 270, 0, 0, 0, -.25);
  put(bike, new T.CylinderGeometry(20, 20, 16, 28), mat(0xffffff, .15, 0, { emissive: 0xfff1cc, emissiveIntensity: 2 }), 172, 268, 0, 0, 0, Math.PI / 2);
  rod(bike, [120, 302, -78], [120, 302, 78], 5, dark);
  for (const z of [84, -84]) { put(bike, new T.CylinderGeometry(7.5, 7.5, 30, 12), rubber, 120, 302, z, Math.PI / 2); rod(bike, [118, 304, z * .8], [106, 360, z * .95], 2.5, dark);
    put(bike, rbox(34, 20, 8, 4), black, 104, 366, z * .97, 0, z > 0 ? .3 : -.3, 0); }
  // estribos
  for (const z of [44, -44]) put(bike, new T.CylinderGeometry(4, 4, 30, 8), dark, -30, 86, z, Math.PI / 2);
  // escape con silenciador
  rod(bike, [20, 80, -40], [-60, 66, -46], 9, metal);
  put(bike, new T.CylinderGeometry(20, 17, 90, 24), mat(0x2b2d31, .35, .8), -105, 82, -46, 0, 0, Math.PI / 2 - .2);
  put(bike, new T.CylinderGeometry(9, 9, 10, 16), metal, -152, 92, -46, 0, 0, Math.PI / 2 - .2);
  // cadena: eslabones a lo largo del recorrido (piñón → corona)
  const cA = new T.Vector2(-30, 110), rA = 13, cB = new T.Vector2(-175, 80), rB = 32, pts = [];
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + Math.PI * i / 10; pts.push(new T.Vector3(cA.x + rA * Math.cos(a), cA.y + rA * Math.sin(a), 32)); }
  for (let i = 0; i <= 14; i++) { const a = Math.PI / 2 + Math.PI * i / 14; pts.push(new T.Vector3(cB.x + rB * Math.cos(a), cB.y + rB * Math.sin(a), 32)); }
  const curve = new T.CatmullRomCurve3(pts, true), chainM = mat(0xb0b5bc, .3, .9);
  const chain = new T.Group(); bike.add(chain);
  const N = 70, link = rbox(9, 6, 9, 2), mats = [chainM, mat(0x5d6168, .4, .8)];
  for (let i = 0; i < N; i++) {
    const u = i / N, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
    const m = put(chain, link, mats[i % 2], p.x, p.y, p.z); m.rotation.z = Math.atan2(tg.y, tg.x);
  }
  chain.material = chainM;                                     // para el brillo de "la pieza de la que se habla"
  return { bike, F, R, engine, chain: chain.children[0], chainGroup: chain, tank };
}

// ---------------------------------------------------------------- el mecánico (mascota de la marca)
function mechanic(C) {
  const g = new T.Group(), suit = mat(0x1a1b20, .7), red = paint(C.brand), glove = mat(0xe9e9e6, .6), boot = mat(0x2a1d14, .7);
  // piernas con botas (fijas al piso); todo lo demás va en "up" (cadera hacia arriba) para respirar y cambiar el peso
  const legL = new T.Group(), legR = new T.Group(); legL.position.set(-26, 70, 0); legR.position.set(26, 70, 0); g.add(legL, legR);
  for (const L of [legL, legR]) { put(L, rbox(38, 64, 40, 12), suit, 0, -18, 0); put(L, rbox(44, 26, 58, 10), boot, 0, -58, 8); }
  const up = new T.Group(); up.position.set(0, 70, 0); g.add(up);
  // cuerpo: overol con franja de la marca, cinturón, bolsillo con trapo rojo y logo estampado
  put(up, rbox(124, 126, 90, 30), suit, 0, 58, 0);
  put(up, rbox(124, 12, 90, 5), red, 0, 108, 0);                                                    // cuello del overol
  put(up, rbox(124, 10, 90, 4), mat(0x3b2a1e, .6), 0, 4, 0);                                        // cinturón
  put(up, rbox(18, 30, 10, 3), red, 58, 14, 30, 0, .6, .2);                                          // trapo en el costado
  if (MC.logo) {                       // logo grande estampado en el pecho: sigue la tela, con brillo propio para leerse
    const lt = new T.Texture(MC.logo); lt.colorSpace = T.SRGBColorSpace; lt.anisotropy = 8; lt.needsUpdate = true;
    const print = new T.MeshStandardMaterial({ map: lt, emissiveMap: lt, emissive: 0xffffff, emissiveIntensity: .75, transparent: true,
                                               roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 });
    // se pega a la tela: sigue el borde redondeado del torso (bisel de 30) en ancho y en alto
    const geo = new T.PlaneGeometry(100, 100, 24, 24), pos = geo.attributes.position, B = 30;
    const roll = (v, half) => { const o = Math.abs(v) - (half - B); return o > 0 ? B - Math.sqrt(Math.max(0, B * B - Math.min(o, B) ** 2)) : 0; };
    for (let i = 0; i < pos.count; i++) pos.setZ(i, -roll(pos.getX(i), 62) - roll(pos.getY(i) + (124 - 128), 63));
    geo.computeVertexNormals();
    put(up, geo, print, 0, 54, 45.8);
  }
  // cabeza: casco-cabeza redondeada roja, ojos con brillo, boca que habla, gorra con visera
  const head = new T.Group(); head.position.set(0, 178, 0); up.add(head);
  put(head, rbox(150, 126, 126, 40), red);
  const eyeM = mat(0x0c0c0e, .25), shine = mat(0xffffff, .2, 0, { emissive: 0xffffff, emissiveIntensity: .8 });
  const eyes = [];
  for (const ex of [-32, 32]) { const e = new T.Group(); e.position.set(ex, 8, 63); head.add(e); put(e, rbox(22, 46, 8, 7), eyeM); put(e, new T.SphereGeometry(4, 10, 8), shine, 4, 12, 4.5); eyes.push(e); }
  for (const ex of [-52, 52]) put(head, new T.CircleGeometry(10, 16), mat(0xff7a7a, .8, 0, { transparent: true, opacity: .45 }), ex, -22, 63.5);   // mejillas
  const mouth = new T.Group(); mouth.position.set(0, -34, 63); head.add(mouth);
  put(mouth, rbox(34, 18, 6, 8), mat(0x2a0608, .6)); put(mouth, rbox(20, 6, 4, 3), mat(0xd0525a, .7), 0, -4, 1.5);   // boca y lengua
  mouth.scale.y = .32;
  const cap = put(head, new T.SphereGeometry(80, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), suit, 0, 46, -2); cap.scale.set(1, .5, .9);
  put(head, rbox(118, 9, 56, 4), suit, 0, 56, 82, .12);                                                                        // visera
  put(head, rbox(40, 22, 6, 4), red, 0, 72, 62, -.3);                                                                            // logo de la gorra
  // brazos con hombro, codo y guante, separados del torso (hombros en ±86) para que nunca lo atraviesen
  const arm = side => {
    const sh = new T.Group(); sh.position.set(side * 86, 102, 0); up.add(sh);
    put(sh, new T.SphereGeometry(21, 16, 12), suit);
    put(sh, rbox(34, 56, 36, 12), suit, 0, -26, 0);
    const el = new T.Group(); el.position.set(0, -50, 0); sh.add(el);
    put(el, new T.SphereGeometry(16, 12, 10), suit);
    put(el, rbox(31, 44, 33, 12), suit, 0, -20, 0);
    put(el, rbox(38, 32, 38, 12), glove, 0, -54, 0); put(el, rbox(12, 20, 12, 5), glove, -side * 9, -46, 20, 0, 0, side * .4);   // guante y pulgar
    return { sh, el };
  };
  const R = arm(1), L = arm(-1);
  const wrench = put(R.el, rbox(12, 96, 8, 3), mat(0xc9ced4, .25, 1), 0, -76, 18, .5);
  return { g, up, head, mouth, armL: L.sh, armR: R.sh, elbowL: L.el, elbowR: R.el, legL, legR, wrench, eyes };
}

// ---------------------------------------------------------------- poses del mecánico
// Cada pose da ángulos de hombro y codo [x, y, z] de los dos brazos. x negativo = hacia adelante; z siempre hacia
// AFUERA del cuerpo (positivo a la derecha, negativo a la izquierda) para que la mano no se meta en el torso.
// Poses: idle, point (señala), wave (saluda desde el codo), thumbs (pulgar arriba), wrench (aprieta), think.
function poseAngles(name, t) {
  const idle = { sR: [-.12 + .08 * Math.sin(t * 1.6), 0, .1], eR: [-.25 - .05 * Math.sin(t * 1.6), 0, 0],
                 sL: [.06 * Math.sin(t * 1.3 + 1), 0, -.1], eL: [-.2, 0, 0] };
  const P = {
    idle,
    point: { ...idle, sR: [-1.4, 0, .22], eR: [-.12, 0, 0] },
    wave: { ...idle, sR: [-.25, 0, 1.25], eR: [0, 0, 1.55 + .38 * Math.sin(t * 8)] },
    thumbs: { ...idle, sR: [-.85, 0, .3], eR: [-1.15, 0, 0] },
    wrench: { sR: [-.75 + .25 * Math.sin(t * 7), 0, .22], eR: [-.9 - .2 * Math.sin(t * 7), 0, 0], sL: [-.55, 0, -.2], eL: [-.7, 0, 0] },
    think: { ...idle, sR: [-1.2, 0, .38], eR: [-2.0, 0, 0] },
    // ¡para!: brazo derecho al frente con el antebrazo hacia arriba (palma a la cámara)
    stop: { ...idle, sR: [-1.3, 0, .32], eR: [-1.45, 0, 0], sL: [-.15, 0, -.2], eL: [-.35, 0, 0] },
    // explica: las dos manos al frente, moviéndose al ritmo de lo que dice (como quien habla con las manos)
    explain: { sR: [-.55 + .14 * Math.sin(t * 4.1), 0, .28 + .06 * Math.sin(t * 2.3)], eR: [-.95 - .25 * Math.sin(t * 4.1 + .8), 0, 0],
               sL: [-.45 + .12 * Math.sin(t * 3.4 + 2), 0, -.26], eL: [-.9 - .22 * Math.sin(t * 3.4 + 2.6), 0, 0] },
  };
  return P[name] || idle;
}
// pose(M, nombre, k, t, o): k = cuánto de la pose (0 = reposo). o.from = { name, k } funde desde la pose anterior
// (o.w = 0..1 avance de la fusión) para que los brazos nunca salten; o.talk = 0..1 abre la boca al hablar.
function pose(M, name, k = 1, t = 0, o = {}) {
  const mix = (A, B, u) => { const r = {}; for (const j in A) r[j] = A[j].map((v, i) => v + (B[j][i] - v) * u); return r; };
  const idle = poseAngles('idle', t);
  let A = mix(idle, poseAngles(name, t), k);
  if (o.from) A = mix(mix(idle, poseAngles(o.from.name, t), o.from.k), A, o.w ?? 1);
  if (M.elbowR) {
    M.armR.rotation.set(...A.sR); M.elbowR.rotation.set(...A.eR); M.armL.rotation.set(...A.sL); M.elbowL.rotation.set(...A.eL);
  } else { M.armR.rotation.set(...A.sR); M.armL.rotation.set(...A.sL); }
  const talk = o.talk || 0;
  // respiración, cambio de peso de una pierna a otra y cabeza que acompaña lo que dice
  if (M.up) { M.up.scale.y = 1 + .012 * Math.sin(t * 1.9); M.up.rotation.z = .03 * Math.sin(t * .9); M.up.position.x = 4 * Math.sin(t * .9);
              M.up.rotation.x = .03 * talk * Math.sin(t * 5.3); }
  M.head.position.y = (M.up ? 178 : 248) + 3 * Math.sin(t * 2.2);
  M.head.rotation.y = .16 * Math.sin(t * .8) + (name === 'point' ? .25 * k : 0);
  M.head.rotation.x = talk * .06 * Math.sin(t * 6.1) - .04;
  M.head.rotation.z = -.04 * Math.sin(t * .9);                                                  // compensa el balanceo del cuerpo
  if (M.mouth) M.mouth.scale.y = .32 + talk * (.45 + .45 * Math.abs(Math.sin(t * 15.5)) * (.6 + .4 * Math.sin(t * 4.7)));
  const blink = (t % 3.7) < .12 ? .12 : 1;                // parpadeo cada ~4 s
  if (M.eyes) for (const e of M.eyes) e.scale.y = blink;
}

// ---------------------------------------------------------------- variantes de moto
// style: naked (la base), sport (carenado y parabrisas), enduro (alta, llantas de tacos), scooter.
function bike(C, style = 'naked') {
  if (style === 'scooter') return scooter(C);
  const B = toyBike(C), red = paint(C.brand), black = paint(0x15161a);
  if (style === 'sport') {
    put(B.bike, rbox(130, 120, 110, 30), red, 130, 230, 0, 0, 0, -.25);                       // carenado frontal
    put(B.bike, rbox(150, 60, 96, 20), black, 30, 140, 0, 0, 0, .05);                        // quilla
    put(B.bike, rbox(60, 70, 8, 4), new T.MeshPhysicalMaterial({ color: 0x9fb8d0, transmission: .6, roughness: .05, transparent: true, opacity: .55 }), 150, 305, 0, Math.PI / 2, 0, -.6);
  }
  if (style === 'enduro') {
    for (const W of [B.F.w, B.R.w]) {
      W.scale.setScalar(1.18); W.position.y = 94;
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; put(W, new T.BoxGeometry(10, 8, 26), mat(0x141414, .9), Math.cos(a) * 80, Math.sin(a) * 80, 0, 0, 0, a); }
    }
    put(B.bike, rbox(90, 10, 50, 4), red, 190, 200, 0, 0, 0, -.2);                          // salpicadera alta
    B.bike.position.y += 0; B.bike.scale.y = 1.08;
  }
  return B;
}
function scooter(C) {
  const bike = new T.Group(), red = paint(C.brand), black = paint(0x15161a), rubber = mat(0x141414, .85), metal = mat(0xb9bec5, .25, 1);
  const wheel = x => { const w = new T.Group(); w.position.set(x, 50, 0); bike.add(w); put(w, new T.TorusGeometry(38, 14, 12, 32), rubber); put(w, new T.CylinderGeometry(26, 26, 10, 24), metal, 0, 0, 0, Math.PI / 2); return { w, parts: {} }; };
  const F = wheel(150), R = wheel(-140);
  put(bike, rbox(150, 26, 80, 10), black, 10, 70, 0);                                          // piso
  put(bike, rbox(170, 110, 90, 30), red, -95, 130, 0);                                         // cuerpo trasero
  put(bike, rbox(120, 26, 70, 10), mat(0x1b1b1d, .8), -90, 196, 0);                            // asiento
  put(bike, rbox(50, 170, 90, 20), red, 120, 150, 0, 0, 0, -.25);                              // escudo
  rod(bike, [150, 50, 0], [118, 250, 0], 9, metal);
  rod(bike, [118, 262, -60], [118, 262, 60], 6, black);
  put(bike, new T.CylinderGeometry(16, 16, 14, 20), mat(0xffffff, .2, 0, { emissive: 0xfff1cc, emissiveIntensity: 1.6 }), 132, 250, 0, 0, 0, Math.PI / 2);
  const engine = put(bike, rbox(90, 50, 40, 10), mat(0x8c9198, .4, .7), -120, 60, -30);
  return { bike, F, R, engine, chain: engine, tank: engine };
}

// ---------------------------------------------------------------- repuestos y herramientas
function helmet(C, color) {
  const g = new T.Group(), shell = paint(color ?? C.brand), R = 100;
  const sh = put(g, new T.SphereGeometry(R, 40, 28), shell); sh.scale.set(1, .95, 1.1);
  const visor = put(g, new T.SphereGeometry(R * 1.02, 32, 16, Math.PI / 2 - .85, 1.7, 1.15, .62),
    new T.MeshPhysicalMaterial({ color: 0x0b0d12, roughness: .04, metalness: .2, clearcoat: 1, side: T.DoubleSide }));
  visor.scale.set(1, .95, 1.1);
  for (const dx of [-16, 16]) { const st = put(g, new T.TorusGeometry(R * 1.01, 5, 8, 48, Math.PI * .92), paint(0xffffff), dx, 0, 0, 0, Math.PI / 2, .1); st.scale.set(1, .95, 1.1); }
  put(g, new T.CylinderGeometry(R * .93, R * .98, 26, 40, 1, true), mat(0x15161a, .7), 0, -R * .82, 0);
  put(g, new T.BoxGeometry(70, 10, 30), paint(0x15161a), 0, -R * .55, R * 1.02, -.5);              // mentonera
  return g;
}
function tire(R = 70, r = 22, knobs = 34) {
  const g = new T.Group(), rub = mat(0x161616, .9);
  put(g, new T.TorusGeometry(R, r, 16, 48), rub);
  for (let i = 0; i < knobs; i++) { const a = i / knobs * Math.PI * 2; put(g, new T.BoxGeometry(r * .5, 7, r * 1.6), rub, Math.cos(a) * (R + r * .92), Math.sin(a) * (R + r * .92), 0, 0, 0, a + Math.PI / 2).rotation.y = (i % 2 ? .4 : -.4); }
  put(g, new T.CylinderGeometry(R - r * .7, R - r * .7, 12, 32), mat(0x3a3e45, .4, .8), 0, 0, 0, Math.PI / 2);
  return g;
}
function labelTexture(lines, bg = '#C10608', fg = '#fff') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => { g.font = `italic 900 ${i ? 34 : 56}px Montserrat`; g.fillText(l, 128, 100 + i * 64); });
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function oilBottle(C, text = ['ACEITE', '4T']) {
  const g = new T.Group();
  put(g, rbox(90, 150, 54, 16), mat(0x15161a, .45));
  put(g, new T.PlaneGeometry(72, 90), new T.MeshStandardMaterial({ map: labelTexture(text), roughness: .5 }), 0, -6, 27.5);
  put(g, new T.CylinderGeometry(14, 16, 26, 16), mat(0xf5b427, .4), 22, 86, 0);
  put(g, rbox(26, 60, 40, 8), mat(0x15161a, .45), -40, 40, 0);                                  // asa
  return g;
}
function wrench(len = 220) {
  const s = new T.Shape(), w = 18, R = 30;
  s.moveTo(-len / 2 + R, -w / 2); s.lineTo(len / 2 - R, -w / 2); s.absarc(len / 2 - R + 10, 0, R, -Math.PI * .75, Math.PI * .75, false);
  s.lineTo(len / 2 - R, w / 2); s.lineTo(-len / 2 + R, w / 2); s.absarc(-len / 2 + R - 6, 0, R * .85, Math.PI * .3, Math.PI * 1.7, false);
  const hole = new T.Path(); hole.absarc(-len / 2 + R - 6, 0, R * .45, 0, Math.PI * 2, true); s.holes.push(hole);
  const jaw = new T.Path(); jaw.moveTo(len / 2 + 14, -12); jaw.lineTo(len / 2 + 50, -14); jaw.lineTo(len / 2 + 50, 14); jaw.lineTo(len / 2 + 14, 12); jaw.closePath(); s.holes.push(jaw);
  const g = new T.ExtrudeGeometry(s, { depth: 8, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2 });
  g.translate(0, 0, -4);
  return new T.Mesh(g, mat(0xd5d9de, .3, .55));
}
function gauge(C) {                         // manómetro de llanta con aguja (g.userData.needle)
  const g = new T.Group();
  put(g, new T.CylinderGeometry(70, 70, 30, 40), paint(0x15161a), 0, 0, 0, Math.PI / 2);
  const c = document.createElement('canvas'); c.width = c.height = 256; const x2 = c.getContext('2d');
  x2.fillStyle = '#f4f4f2'; x2.beginPath(); x2.arc(128, 128, 124, 0, 7); x2.fill();
  x2.strokeStyle = '#111'; x2.lineWidth = 4;
  for (let i = 0; i <= 10; i++) { const a = Math.PI * (.75 + 1.5 * i / 10); x2.beginPath(); x2.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); x2.lineTo(128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82); x2.stroke(); }
  x2.strokeStyle = '#C10608'; x2.lineWidth = 12; x2.beginPath(); x2.arc(128, 128, 108, Math.PI * .75, Math.PI * 1.05); x2.stroke();
  x2.strokeStyle = '#3DBE6A'; x2.beginPath(); x2.arc(128, 128, 108, Math.PI * 1.35, Math.PI * 1.65); x2.stroke();
  x2.fillStyle = '#111'; x2.font = '900 30px Montserrat'; x2.textAlign = 'center'; x2.fillText('PSI', 128, 190);
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace;
  put(g, new T.CircleGeometry(62, 40), new T.MeshStandardMaterial({ map: tx, roughness: .4 }), 0, 0, 16);
  const needle = new T.Group(); needle.position.z = 18; g.add(needle);
  put(needle, new T.BoxGeometry(6, 54, 3), mat(C.brand, .4), 0, 22, 0);
  put(g, new T.CylinderGeometry(8, 8, 6, 12), mat(0x111111, .4), 0, 0, 20, Math.PI / 2);
  put(g, new T.TorusGeometry(68, 6, 8, 40), mat(0xc9ced4, .25, 1), 0, 0, 14);
  rod(g, [0, -70, 0], [0, -150, 0], 9, mat(0x15161a, .6));
  g.userData.needle = needle;              // needle.rotation.z = -2.35 (mín) … +2.35 (máx)
  return g;
}
function battery(C) {
  const g = new T.Group();
  put(g, rbox(160, 110, 90, 10), mat(0x1b1c20, .6));
  put(g, new T.PlaneGeometry(120, 60), new T.MeshStandardMaterial({ map: labelTexture(['12V', 'BATERÍA'], '#F5B427', '#111'), roughness: .5 }), 0, -5, 45.5);
  put(g, new T.CylinderGeometry(10, 10, 18, 12), mat(C.brand, .4), -50, 64, 0); put(g, new T.CylinderGeometry(10, 10, 18, 12), mat(0x111111, .4), 50, 64, 0);
  return g;
}
function sparkPlug() {
  const g = new T.Group();
  put(g, new T.CylinderGeometry(14, 16, 90, 20), mat(0xf2f0ea, .25), 0, 70, 0);
  put(g, new T.CylinderGeometry(24, 24, 22, 6), mat(0xc9ced4, .25, 1), 0, 14, 0);
  put(g, new T.CylinderGeometry(12, 12, 40, 16), mat(0xb0b4ba, .35, 1), 0, -16, 0);
  for (let i = 0; i < 8; i++) put(g, new T.TorusGeometry(12.5, 1.6, 6, 16), mat(0x9a9ea4, .3, 1), 0, -32 + i * 4.5, 0, Math.PI / 2);
  put(g, new T.BoxGeometry(4, 10, 4), mat(0x777b80, .3, 1), 0, -40, 0);
  put(g, new T.CylinderGeometry(8, 8, 14, 12), mat(0xc9ced4, .25, 1), 0, 122, 0);
  return g;
}
function brakeSet(C, worn = 0) {           // disco + pastilla (worn 0..1 adelgaza el material)
  const g = new T.Group();
  const disc = put(g, new T.CylinderGeometry(120, 120, 8, 48), mat(0xdfe3e8, .3, .85), 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 18; i++) put(g, new T.CylinderGeometry(5, 5, 10, 8), mat(0x222222, .5), 92 * Math.cos(i * .349), 92 * Math.sin(i * .349), 0, Math.PI / 2);
  put(g, new T.CylinderGeometry(50, 50, 12, 6), paint(C.brand), 0, 0, 0, Math.PI / 2);
  const cal = new T.Group(); cal.position.set(0, 112, 0); g.add(cal);
  put(cal, rbox(110, 60, 70, 14), mat(0xf5b427, .4));
  const pad = put(cal, rbox(90, 40, 14 * (1 - .7 * worn) + 4, 3), mat(0x3b3226, .9), 0, -6, 14);
  return { g, disc, pad };
}
function cone() { const g = new T.Group(); put(g, new T.ConeGeometry(32, 90, 20), mat(0xff6a13, .6), 0, 50, 0); put(g, rbox(80, 10, 80, 4), mat(0x1c1c1c, .6), 0, 5, 0); put(g, new T.CylinderGeometry(20, 24, 14, 20), mat(0xffffff, .5), 0, 54, 0); return g; }

// ---------------------------------------------------------------- escenario: carretera de montaña
function roadScene(C) {
  const g = new T.Group();
  const grass = mat(0x3f6b3a, .9), asphalt = mat(0x2c2e33, .8), line = mat(0xf2f2ee, .5), rock = mat(0x7d7466, .9);
  put(g, rbox(2400, 40, 1600, 12), grass, 0, -20, 0);
  const curve = new T.CatmullRomCurve3([[-1200, 2, 500], [-500, 2, 350], [0, 2, 100], [450, 2, -150], [1200, 2, -350]].map(p => new T.Vector3(...p)));
  const shape = new T.Shape(); shape.moveTo(-110, 0); shape.lineTo(110, 0); shape.lineTo(110, 4); shape.lineTo(-110, 4); shape.closePath();
  const road = new T.Mesh(new T.ExtrudeGeometry(shape, { steps: 120, extrudePath: curve }), asphalt); g.add(road);
  for (let i = 0; i < 40; i++) {                                                                // línea central discontinua
    const u = (i + .25) / 40, p = curve.getPointAt(u), q = curve.getTangentAt(u);
    const m = put(g, new T.BoxGeometry(46, 3, 7), line, p.x, 8, p.z); m.rotation.y = -Math.atan2(q.z, q.x);
  }
  for (let i = 0; i < 26; i++) {                                                                // árboles y rocas
    const a = i * 2.4, r = 500 + (i * 137) % 600, x0 = Math.cos(a) * r, z0 = Math.sin(a) * r * .7;
    if (Math.abs(z0 - (curve.getPointAt(Math.min(1, Math.max(0, (x0 + 1200) / 2400))).z)) < 180) continue;
    if (i % 3) { put(g, new T.ConeGeometry(60, 170, 8), mat(0x2f5a34, .8), x0, 110, z0); put(g, new T.CylinderGeometry(10, 12, 40, 8), mat(0x5a3a22, .9), x0, 20, z0); }
    else put(g, new T.DodecahedronGeometry(40 + (i % 5) * 8, 0), rock, x0, 20, z0);
  }
  for (const [x0, z0, h] of [[-700, -650, 520], [100, -760, 700], [800, -700, 460]]) put(g, new T.ConeGeometry(420, h, 7), mat(0x4d6a8c, .95), x0, h / 2 - 20, z0);
  return { g, curve };
}

// ---------------------------------------------------------------- vitrina: un objeto girando en estudio
const ITEMS = {
  naked: C => bike(C, 'naked').bike, sport: C => bike(C, 'sport').bike, enduro: C => bike(C, 'enduro').bike, scooter: C => bike(C, 'scooter').bike,
  mechanic: C => mechanic(C).g, helmet: C => helmet(C), tire: () => tire(), oil: C => oilBottle(C), wrench: () => wrench(),
  gauge: C => gauge(C), battery: C => battery(C), spark_plug: () => sparkPlug(), brakes: C => brakeSet(C).g, cone: () => cone(),
};

MC.kit = { rbox, mat, paint, put, rod, cityTexture, toyBike, mechanic, pose, bike, scooter, helmet, tire, oilBottle, wrench, gauge,
           battery, sparkPlug, brakeSet, cone, roadScene, labelTexture, ITEMS };

// escena "kit": vitrina de un modelo girando en un estudio oscuro (para revisar la biblioteca)
const VIT = {};
MC.scenes.kit = function (t, s, p) {
  const key = 'kit' + s.start + p.item;
  if (!VIT[key]) {
    const C = { brand: new T.Color(TH.primary).getHex() };
    const scene = new T.Scene(); scene.environment = MC.three.R3.env; scene.environmentIntensity = 1;
    scene.add(new T.HemisphereLight(0xc9d4ff, 0x3a2a1c, 1.2));
    const key1 = new T.DirectionalLight(0xffe2c0, 2.4); key1.position.set(400, 700, 600); key1.castShadow = true; key1.shadow.mapSize.set(1024, 1024);
    Object.assign(key1.shadow.camera, { left: -500, right: 500, top: 500, bottom: -500, near: 10, far: 2500 }); scene.add(key1);
    const rim = new T.DirectionalLight(new T.Color(TH.accent), 2); rim.position.set(-600, 300, -500); scene.add(rim);
    const obj = p.item === 'modelo' ? MC.kit.modelBike(C, p.model_url, p.model_setup).bike : (ITEMS[p.item] || ITEMS.cone)(C); scene.add(MC.three.shadowed(obj));
    const box = new T.Box3().setFromObject(obj), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
    obj.position.sub(new T.Vector3(c.x, box.min.y, c.z));
    const floor = put(scene, new T.CircleGeometry(Math.max(size.x, size.z) * 1.1, 48), mat(0x1a1b20, .5), 0, 0, 0, -Math.PI / 2); floor.receiveShadow = true;
    const cam = new T.PerspectiveCamera(30, 1080 / 1920, 10, 20000);
    VIT[key] = { scene, obj, cam, w: Math.max(size.x, size.z), h: size.y, dz: Math.max(size.x, size.z) / 2 };
  }
  const st = VIT[key], lt = t - s.start;
  st.obj.rotation.y = p.yaw ?? (-.6 + lt * .9);                  // yaw fijo: vistas de revisión de diseño
  const hf = Math.atan(Math.tan(15 * Math.PI / 180) * 1080 / 1920);
  const d = Math.max(st.w / 2 / Math.tan(hf) * 1.12, st.h / 2 / Math.tan(15 * Math.PI / 180) * 1.7) + st.dz * .6, z = p.zoom || 1, ly = st.h * (p.look_y ?? .5);
  st.cam.position.set(Math.sin(.35) * d / z, ly + st.h * .05 + d * .22 / z, Math.cos(.35) * d / z); st.cam.lookAt(p.look_x || 0, ly, 0);
  const g = x.createRadialGradient(W / 2, H * .45, 50, W / 2, H * .5, H * .7); g.addColorStop(0, '#2a2d36'); g.addColorStop(1, '#0b0c0f');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  MC.three.render3d(st.scene, MC.three.view(st.cam, 1080, 1920, 0, 0), .12);
  x.font = FONT(900, 70, false); x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(p.label || p.item, W / 2, 1500);
};
