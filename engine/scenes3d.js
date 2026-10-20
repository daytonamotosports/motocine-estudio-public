// Escenas en 3D real (three.js, WebGL por software). Se dibujan en un canvas WebGL
// aparte y se componen sobre el canvas 2D principal, así que cintas, etiquetas,
// insignias y subtítulos del núcleo funcionan igual que en las escenas 2D.
// Unidades: ~1 unidad = 1 px del diseño. Eje Y hacia arriba. Giro positivo = antihorario.
import * as T from './vendor/three.min.js';

const MC = window.MC;
const PITCH = 32;                       // paso de la cadena

// ================================================================ renderer y estudio
const R3 = { r: null, env: null, w: 0, h: 0 };
function renderer(w, h) {
  if (!R3.r) {                            // sin multimuestreo: el suavizado lo hace la pasada FXAA (3x más barata)
    const r = new T.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    R3.env = studioEnvironment(r);
    R3.r = r;
  }
  const sc = window.__SCALE || 1;
  if (R3.w !== w || R3.h !== h || R3.sc !== sc) { R3.r.setSize(Math.round(w * sc), Math.round(h * sc), false); R3.w = w; R3.h = h; R3.sc = sc; }
  return R3.r;
}

// Estudio de fotografía de producto: fondo negro, paneles de luz y una franja roja de la marca.
// El metal refleja estos paneles: eso da los brillos nítidos que se mueven al girar la cámara.
function studioEnvironment(r) {
  const s = new T.Scene();
  s.background = new T.Color(0x050506);
  const panel = (w, h, color, k, pos, look) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(k), side: T.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); s.add(m);
  };
  panel(8, 3, 0xffffff, 6, [0, 7, 2], [0, 0, 0]);          // panel cenital
  panel(3, 6, 0xffffff, 4.5, [-7, 1, 3], [0, 0, 0]);       // caja de luz izquierda
  panel(2, 5, 0xfff4e8, 2.5, [6, 0, 5], [0, 0, 0]);        // relleno cálido derecho
  panel(.6, 8, TH.accent, 7, [5, 1, -5], [0, 0, 0]);       // franja roja de la marca (contraluz)
  panel(12, 1.2, 0xffffff, 1.6, [0, -4, 6], [0, 0, 0]);    // rebote del piso
  panel(7, 4, 0xffffff, 1.0, [1, 1, 9], [0, 0, 0]);         // relleno frontal (las caras que miran a cámara)
  panel(4, 2, 0xffffff, 1.1, [-3, -3, 7], [0, 0, 0]);       // relleno bajo
  const pm = new T.PMREMGenerator(r);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return tex;
}

// Textura de torneado: anillos concéntricos finos para el relieve de las caras de las ruedas.
let LATHE = null;
function latheTexture() {
  if (LATHE) return LATHE;
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 1024, 1024);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let r = 4; r < 512; r += 1.6) {
    const v = 118 + rnd() * 26 + (r % 11 < 1.6 ? 18 : 0);
    g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1.2 + rnd() * .8;
    g.beginPath(); g.arc(512, 512, r, 0, Math.PI * 2); g.stroke();
  }
  LATHE = new T.CanvasTexture(c);
  LATHE.colorSpace = T.NoColorSpace;
  return LATHE;
}
function latheFor(R) {                    // las UV de ExtrudeGeometry son coordenadas x,y de la forma
  const t = latheTexture().clone();
  t.needsUpdate = true;
  t.repeat.set(1 / (2 * (R + 20)), 1 / (2 * (R + 20)));
  t.offset.set(.5, .5);
  return t;
}

// Suavizado de bordes (FXAA) en una pasada: mucho más barato que el multimuestreo por software.
// La escena se dibuja lineal en un búfer de media precisión; esta pasada aplica el tono, el color
// sRGB y suaviza los bordes. Mantiene la transparencia premultiplicada igual que el dibujo directo.
const FX = { rt: null, q: null };
function fxaaRender(r, scene, cam) {
  const w = r.domElement.width, h = r.domElement.height;
  if (!FX.rt || FX.rt.width !== w || FX.rt.height !== h) {
    if (FX.rt) FX.rt.dispose();
    FX.rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, colorSpace: T.LinearSRGBColorSpace });
  }
  if (!FX.q) {
    const mat = new T.ShaderMaterial({
      uniforms: { tex: { value: null }, px: { value: new T.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `uniform sampler2D tex; uniform vec2 px; varying vec2 vUv;
        vec4 tap(vec2 uv){ vec4 c = texture2D(tex, uv); float a = clamp(c.a, 0., 1.);
          vec3 o = linearToOutputTexel(vec4(toneMapping(c.rgb / max(a, 1e-4)), 1.)).rgb; return vec4(o * a, a); }
        float lum(vec4 c){ return dot(c.rgb, vec3(.299, .587, .114)); }
        void main(){
          vec4 m = tap(vUv), nw = tap(vUv + vec2(-1., 1.) * px), ne = tap(vUv + vec2(1., 1.) * px),
               sw = tap(vUv + vec2(-1., -1.) * px), se = tap(vUv + vec2(1., -1.) * px);
          float lM = lum(m), lNW = lum(nw), lNE = lum(ne), lSW = lum(sw), lSE = lum(se);
          float lo = min(lM, min(min(lNW, lNE), min(lSW, lSE))), hi = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
          if (hi - lo < max(.0312, hi * .125)) { gl_FragColor = m; return; }
          vec2 d = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
          float red = max((lNW + lNE + lSW + lSE) * .03125, 1. / 128.);
          d = clamp(d / (min(abs(d.x), abs(d.y)) + red), -8., 8.) * px;
          vec4 A = .5 * (tap(vUv + d * (1. / 3. - .5)) + tap(vUv + d * (2. / 3. - .5)));
          vec4 B = A * .5 + .25 * (tap(vUv - d * .5) + tap(vUv + d * .5));
          float lB = lum(B); gl_FragColor = (lB < lo || lB > hi) ? A : B;
        }`,
      depthTest: false, depthWrite: false, blending: T.NoBlending,
    });
    FX.q = new T.Mesh(new T.PlaneGeometry(2, 2), mat); FX.q.frustumCulled = false;
    FX.scene = new T.Scene(); FX.scene.add(FX.q); FX.cam = new T.Camera();
  }
  r.setRenderTarget(FX.rt); r.render(scene, cam); r.setRenderTarget(null);
  FX.q.material.uniforms.tex.value = FX.rt.texture; FX.q.material.uniforms.px.value.set(1 / w, 1 / h);
  r.render(FX.scene, FX.cam);
}

function view(cam, rw, rh, dx, dy) {
  return {
    rw, rh, dx, dy, cam,
    project(px, py, pz) {
      const v = new T.Vector3(px, py, pz).project(cam);
      return [(v.x + 1) / 2 * rw + dx, (1 - v.y) / 2 * rh + dy];
    },
  };
}
function render3d(scene, v, glow = .22) {
  if (window.__SKIP3D) return;                    // solo para medir el costo del resto del cuadro
  const r = renderer(v.rw, v.rh);
  if (window.__NOGLOW) glow = 0;                 // borrador: sin resplandor ni sombras
  r.shadowMap.enabled = !window.__NOSHADOW;
  // la sombra solo se recalcula cada 2 cuadros (la cámara no la cambia; las piezas se mueven poco entre cuadros):
  // ahorra ~1/3 del costo 3D. Siempre se calcula en el primer cuadro de cada escena y tras un salto en el tiempo.
  const fi = MC.fi ?? 0, last = scene.userData.shadowAt;
  r.shadowMap.autoUpdate = false;
  r.shadowMap.needsUpdate = last === undefined || fi < last || fi - last >= 2 || window.__SHADOW_EVERY === 1;
  if (r.shadowMap.needsUpdate) scene.userData.shadowAt = fi;
  if (window.__AA !== false) fxaaRender(r, scene, v.cam); else r.render(scene, v.cam);
  x.drawImage(r.domElement, v.dx, v.dy, v.rw, v.rh);
  if (glow > 0) {                          // resplandor en los brillos (halación de lente), en 1/8 de resolución
    if (!R3.small) { R3.small = document.createElement('canvas'); R3.sx = R3.small.getContext('2d'); }
    const sw = v.rw >> 3, sh = v.rh >> 3;            // 1/8: el resplandor es borroso de todos modos (4x menos trabajo que 1/4)
    if (R3.small.width !== sw || R3.small.height !== sh) { R3.small.width = sw; R3.small.height = sh; }
    R3.sx.clearRect(0, 0, sw, sh);
    R3.sx.filter = 'blur(1.5px) brightness(.8) contrast(3.2)';   // solo los brillos fuertes pasan el umbral
    R3.sx.drawImage(MC.canvas, v.dx, v.dy, v.rw, v.rh, 0, 0, sw, sh);   // desde el lienzo 2D: evita otra lectura de WebGL
    x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = glow; x.imageSmoothingQuality = 'low';   // ampliar con calidad 'alta' costaba ~100 ms
    x.drawImage(R3.small, v.dx, v.dy, v.rw, v.rh);
    x.restore();
  }
}

// ================================================================ cámara por tomas
// Una toma es una lista de claves {u (0..1 de la escena) | at (segundos), target, dist, yaw, pitch, fov}.
const SHOTS = await (await fetch('shots.json')).json();
function shotCamera(cam, keys, t, s, shake = 0) {
  const ks = keys.map(k => ({ ...k, time: has(k.at) ? k.at : s.start + (k.u || 0) * (s.end - s.start) }));
  s._cuts = ks.filter(k => k.cut).map(k => k.time);            // el núcleo dibuja un barrido en cada corte
  let a = ks[0], b = ks[ks.length - 1];
  for (let i = 0; i < ks.length - 1; i++) if (t >= ks[i].time && t < ks[i + 1].time) { a = ks[i]; b = ks[i + 1]; break; }
  if (t < ks[0].time) b = a;
  if (t >= ks[ks.length - 1].time) a = b;
  const k = (b === a || b.cut) ? 0 : eio((t - a.time) / (b.time - a.time));   // antes de un corte la toma se sostiene
  const L = (p, q) => p + (q - p) * k;
  const tgt = new T.Vector3(L(a.target[0], b.target[0]), L(a.target[1], b.target[1]), L(a.target[2], b.target[2]));
  const dist = L(a.dist, b.dist);
  const yaw = L(a.yaw, b.yaw) + .012 * Math.sin(t * .7) + .006 * Math.sin(t * 1.9);     // cámara en mano
  const pitch = L(a.pitch, b.pitch) + .008 * Math.sin(t * .9 + 1);
  const fov = L(a.fov || 28, b.fov || 28);
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  cam.position.set(tgt.x + dist * Math.sin(yaw) * Math.cos(pitch) + shake * Math.sin(t * 61),
                   tgt.y + dist * Math.sin(pitch) + shake * Math.cos(t * 47),
                   tgt.z + dist * Math.cos(yaw) * Math.cos(pitch));
  cam.lookAt(tgt);
  return dist;
}

// ================================================================ materiales y luces
function materials(R1, R2) {
  const std = (color, metalness, roughness, extra = {}) => new T.MeshPhysicalMaterial({ color, metalness, roughness, ...extra });
  const sprocketMat = R => std(0xb9c0c8, 1, .2, { clearcoat: .35, clearcoatRoughness: .12, bumpMap: latheFor(R), bumpScale: .45 });
  return {
    sprocket1: sprocketMat(R1), sprocket2: sprocketMat(R2),
    dark: std(0x24262b, .85, .35),
    red: std(new T.Color(TH.primary), .6, .22, { clearcoat: .8, clearcoatRoughness: .08 }),
    outer: std(0xbfc6ce, 1, .16, { clearcoat: .2 }),
    inner: std(0x6c737c, 1, .28),
    roller: std(0x8d959e, 1, .24),
    pin: std(0xeef1f4, 1, .08),
    oil: new T.MeshPhysicalMaterial({ color: 0xf5b427, metalness: 0, roughness: .03, clearcoat: 1, emissive: 0x6a4300, emissiveIntensity: .45 }),
    white: std(0xeeeeee, .1, .35, { clearcoat: .6 }),
  };
}
const BASE = { outer: [0xbfc6ce, 1, .16], inner: [0x6c737c, 1, .28], roller: [0x8d959e, 1, .24], pin: [0xeef1f4, 1, .08] };
const RUST = { outer: 0x3d1e0a, inner: 0x2a1407, roller: 0x331909, pin: 0x4a2a12 };
function setChainLook(m, rust, shine) {
  for (const k of ['outer', 'inner', 'roller', 'pin']) {
    const [c, me, ro] = BASE[k];
    m[k].color.copy(new T.Color(c).lerp(new T.Color(RUST[k]), rust).lerp(new T.Color(0xd9a94a), .2 * shine));
    m[k].metalness = me - .85 * rust;
    m[k].roughness = Math.max(.04, ro + .72 * rust - .12 * shine);
    m[k].clearcoat = .2 * (1 - rust) + .9 * shine;            // película de lubricante
    m[k].clearcoatRoughness = .05;
  }
}
function lights(scene, ground = -330) {
  scene.environment = R3.env;
  scene.environmentIntensity = 1.15;
  const key = new T.DirectionalLight(0xffffff, 1.8);
  key.position.set(-350, 900, 650); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -0.0008;
  Object.assign(key.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, near: 100, far: 2600 });
  scene.add(key);
  const rim = new T.DirectionalLight(new T.Color(TH.accent), 2.4); rim.position.set(700, -100, -700); scene.add(rim);
  const spec = new T.PointLight(0xffffff, 2.6, 0, 0); spec.position.set(-380, 520, 760); scene.add(spec);
  scene.add(new T.AmbientLight(0xffffff, .06));
  const fc = document.createElement('canvas'); fc.width = fc.height = 256;
  const fg = fc.getContext('2d'), gr = fg.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, '#fff'); gr.addColorStop(.55, '#777'); gr.addColorStop(1, '#000'); fg.fillStyle = gr; fg.fillRect(0, 0, 256, 256);
  const alpha = new T.CanvasTexture(fc);
  const floor = new T.Mesh(new T.CircleGeometry(1400, 64), new T.MeshStandardMaterial({ color: 0x0e0f12, metalness: .35, roughness: .32, transparent: true, alphaMap: alpha, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = ground; floor.receiveShadow = true; scene.add(floor);
}
const shadowed = o => { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };

// ================================================================ geometría
// Perfil de rueda dentada para cadena: valles circulares (asiento del rodillo) y dientes.
// hook > 0 dibuja dientes gastados en forma de gancho (inclinados en el sentido del giro).
function sprocketShape(n, R, hook = 0, tip = 15) {
  const rr = 10, da = 2 * Math.PI / n, S = 16, shape = new T.Shape();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < S; j++) {
      const u = j / S, du = Math.min(u, 1 - u), arc = du * da * R;
      let r;
      if (arc < rr) r = R - Math.sqrt(Math.max(0, rr * rr - arc * arc));
      else { const k = Math.min(1, (arc - rr) / (da * R * .5 - rr)); r = R + tip * Math.pow(k, hook ? .55 : .85); }
      const a = i * da + u * da + hook * da * .32 * Math.pow(Math.sin(Math.PI * u), 2);
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0 && j === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
    }
  }
  shape.closePath();
  return shape;
}
function addHoles(shape, R, rear) {
  const hole = (cx, cy, r) => { const p = new T.Path(); p.absarc(cx, cy, r, 0, Math.PI * 2, true); shape.holes.push(p); };
  if (rear) {
    hole(0, 0, R * .2);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      const p = new T.Path(); p.absellipse(Math.cos(a) * R * .58, Math.sin(a) * R * .58, R * .16, R * .1, 0, Math.PI * 2, true, a); shape.holes.push(p);
      hole(Math.cos(a + Math.PI / 5) * R * .33, Math.sin(a + Math.PI / 5) * R * .33, 7);
    }
  } else hole(0, 0, R * .28);
}
function sprocketMesh(n, R, rear, hook, m, mat) {
  const sh = sprocketShape(n, R, hook); addHoles(sh, R, rear);
  const depth = rear ? 10 : 13;
  const g = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 1.8, bevelSize: 1.5, bevelSegments: 3, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  const grp = new T.Group();
  grp.add(new T.Mesh(g, mat));
  const hubR = R * (rear ? .2 : .28) + 7;
  const hub = new T.Mesh(new T.CylinderGeometry(hubR, hubR, depth + 14, 48), m.red); hub.rotation.x = Math.PI / 2; grp.add(hub);
  const nut = new T.Mesh(new T.CylinderGeometry(hubR * .55, hubR * .55, depth + 28, 6), m.dark); nut.rotation.x = Math.PI / 2; grp.add(nut);
  if (rear) for (let i = 0; i < 5; i++) {                  // tornillos de la corona
    const a = i / 5 * Math.PI * 2 + Math.PI / 5;
    const b = new T.Mesh(new T.CylinderGeometry(9, 9, depth + 10, 6), m.dark);
    b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * R * .33, Math.sin(a) * R * .33, 0); grp.add(b);
  }
  return shadowed(grp);
}
function plateGeometry(thick) {
  const r = 12.5, w = 8, s = new T.Shape();
  s.moveTo(-PITCH / 2, r);
  s.quadraticCurveTo(0, w, PITCH / 2, r);
  s.absarc(PITCH / 2, 0, r, Math.PI / 2, -Math.PI / 2, true);
  s.quadraticCurveTo(0, -w, -PITCH / 2, -r);
  s.absarc(-PITCH / 2, 0, r, -Math.PI / 2, Math.PI / 2, true);
  const g = new T.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: .9, bevelSize: .9, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -thick / 2);
  return g;
}

// Recorrido de la cadena (eje Y hacia arriba), sentido antihorario: arriba hacia el piñón.
function chainPath(C1, R1, C2, R2, sag) {
  const d = C2[0] - C1[0], phi = Math.asin((R2 - R1) / d);
  const nu = [-Math.sin(phi), Math.cos(phi)], nl = [-Math.sin(phi), -Math.cos(phi)];
  const P = (c, r, n) => [c[0] + r * n[0], c[1] + r * n[1]];
  const p2u = P(C2, R2, nu), p1u = P(C1, R1, nu), p1l = P(C1, R1, nl), p2l = P(C2, R2, nl);
  const pts = [];
  const line = (a, b, n) => { for (let i = 0; i < n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); };
  const arc = (c, r, a0, a1, n) => { for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } };
  line(p2u, p1u, 60);
  const aU = Math.PI / 2 + phi;
  arc(C1, R1, aU, 2 * Math.PI - aU, 90);                       // por la izquierda del piñón
  for (let i = 0; i < 70; i++) { const k = i / 70; pts.push([p1l[0] + (p2l[0] - p1l[0]) * k, p1l[1] + (p2l[1] - p1l[1]) * k - Math.sin(Math.PI * k) * sag]); }
  arc(C2, R2, -aU, aU, 180);                                   // por la derecha de la corona
  pts.push([p2u[0], p2u[1]]);
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, total: len[len.length - 1], p1u, p2u, p1l, p2l };
}
function pathAt(path, s) {
  const { pts, len, total } = path; s = ((s % total) + total) % total;
  let lo = 0, hi = len.length - 1;
  while (hi - lo > 1) { const mI = (lo + hi) >> 1; if (len[mI] <= s) lo = mI; else hi = mI; }
  const k = (s - len[lo]) / ((len[hi] - len[lo]) || 1), a = pts[lo], b = pts[hi];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

// ================================================================ chain_drive (3D)
const DRIVE = { C1: [-235, 0], n1: 17, C2: [235, 0], n2: 40 };
DRIVE.R1 = DRIVE.n1 * PITCH / (2 * Math.PI);
DRIVE.R2 = DRIVE.n2 * PITCH / (2 * Math.PI);

function buildDrive(key, p) {
  if (MC.cache[key]) return MC.cache[key];
  renderer(1080, 1100);
  const scene = new T.Scene(); lights(scene, -DRIVE.R2 - 120);
  const m = materials(DRIVE.R1, DRIVE.R2);
  const front = sprocketMesh(DRIVE.n1, DRIVE.R1, false, p.worn ? 1 : 0, m, m.sprocket1); front.position.set(DRIVE.C1[0], DRIVE.C1[1], 0);
  const rear = sprocketMesh(DRIVE.n2, DRIVE.R2, true, p.worn ? 1 : 0, m, m.sprocket2); rear.position.set(DRIVE.C2[0], DRIVE.C2[1], 0);
  scene.add(front, rear);
  const maxN = 90;
  const mk = (geo, mat) => { const im = new T.InstancedMesh(geo, mat, maxN); im.castShadow = true; im.receiveShadow = true; scene.add(im); return im; };
  const roller = mk(new T.CylinderGeometry(9.5, 9.5, 17, 24).rotateX(Math.PI / 2), m.roller);
  const pin = mk(new T.CylinderGeometry(4.6, 4.6, 33, 16).rotateX(Math.PI / 2), m.pin);
  const inner = mk(plateGeometry(2.4), m.inner);
  const outer = mk(plateGeometry(2.4), m.outer);
  // aceitera para lubricar
  const can = new T.Group();
  const body = new T.Mesh(new T.CylinderGeometry(30, 30, 120, 40), m.red); can.add(body);
  const cap = new T.Mesh(new T.CylinderGeometry(18, 30, 26, 40), m.white); cap.position.y = -73; can.add(cap);
  const noz = new T.Mesh(new T.CylinderGeometry(3.5, 10, 66, 20), m.white); noz.position.y = -118; can.add(noz);
  can.rotation.z = .55; can.visible = false; scene.add(shadowed(can));
  const drops = [];
  for (let i = 0; i < 7; i++) { const d = new T.Mesh(new T.SphereGeometry(6.5, 20, 14), m.oil); d.visible = false; scene.add(d); drops.push(d); }
  const cam = new T.PerspectiveCamera(28, 1080 / 1100, 10, 8000);
  return (MC.cache[key] = { scene, m, front, rear, roller, pin, inner, outer, can, drops, cam, dummy: new T.Object3D() });
}

MC.scenes.chain_drive = function (t, s, p) {
  const st = buildDrive('drive' + s.start, p);
  const { C1, C2, R1, R2 } = DRIVE, lt = t - s.start;
  const sag0 = has(p.sag) ? p.sag : 30, sag1 = has(p.sag_to) ? p.sag_to : sag0;
  const sagAt = has(p.sag_at) ? p.sag_at : s.start;
  const sag = sag0 + (sag1 - sag0) * eio(prog(t, sagAt, sagAt + 1.2));
  const jump = has(p.jump_at) ? Math.max(0, 1 - Math.abs(t - p.jump_at - .3) / .6) : 0;
  const flap = (p.flap ? 14 * Math.sin(t * 9) * (sag / 90) : 0) + jump * 60 * Math.sin(t * 30);
  const path = chainPath(C1, R1, C2, R2, sag + flap);
  const dist = (p.speed || 230) * lt;
  let rust = has(p.rust) ? p.rust : 0;
  let wipe = -1;
  if (has(p.clean_at)) { const k = prog(t, p.clean_at, p.clean_at + 1.1); rust *= 1 - k; if (k > 0 && k < 1) wipe = k; }
  const shine = has(p.lube_at) ? prog(t, p.lube_at + .4, p.lube_at + 1.2) : 0;
  setChainLook(st.m, rust, shine);

  // eslabones: placas internas y externas alternadas, rodillos y pasadores
  const N = Math.round(path.total / PITCH), sp = path.total / N, D = st.dummy;
  const pos = [];
  for (let k = 0; k < N; k++) pos.push(pathAt(path, dist + k * sp));
  let ni = 0, no = 0;
  for (let k = 0; k < N; k++) {
    const [ax, ay] = pos[k], [bx, by] = pos[(k + 1) % N];
    D.rotation.set(0, 0, 0); D.position.set(ax, ay, 0); D.updateMatrix();
    st.roller.setMatrixAt(k, D.matrix); st.pin.setMatrixAt(k, D.matrix);
    const ang = Math.atan2(by - ay, bx - ax), mx = (ax + bx) / 2, my = (ay + by) / 2;
    const isOuter = k % 2 === 1, zz = isOuter ? 12.6 : 9.6;
    for (const sgn of [-1, 1]) {
      D.position.set(mx, my, sgn * zz); D.rotation.set(0, 0, ang); D.updateMatrix();
      if (isOuter) st.outer.setMatrixAt(no++, D.matrix); else st.inner.setMatrixAt(ni++, D.matrix);
    }
  }
  st.roller.count = N; st.pin.count = N; st.inner.count = ni; st.outer.count = no;
  for (const im of [st.roller, st.pin, st.inner, st.outer]) im.instanceMatrix.needsUpdate = true;

  // las ruedas giran con la cadena: un valle de cada rueda alineado con un rodillo asentado
  const seat = (C, R, left) => {
    let best = null, bd = 1e9;
    for (const [px, py] of pos) { const d = Math.abs(Math.hypot(px - C[0], py - C[1]) - R); if ((left ? px < C[0] : px > C[0]) && d < bd) { bd = d; best = [px, py]; } }
    return best ? Math.atan2(best[1] - C[1], best[0] - C[0]) : dist / R;
  };
  st.front.rotation.z = seat(C1, R1, true);
  st.rear.rotation.z = seat(C2, R2, false);

  // aceitera y gotas
  const topY = x0 => path.p2u[1] + (path.p1u[1] - path.p2u[1]) * (x0 - path.p2u[0]) / (path.p1u[0] - path.p2u[0]);
  st.can.visible = has(p.lube_at) && t > p.lube_at - .5;
  const dropX = 40, tipY = topY(dropX) + 150;
  st.can.position.set(dropX - Math.sin(.55) * 151, tipY + Math.cos(.55) * 151, 0);
  st.drops.forEach((d, i) => {
    const e = (p.lube_at || 0) + i * .22, a = t - e;
    const y = tipY - 4 - 700 * a * a;
    d.visible = has(p.lube_at) && a > 0 && y > topY(dropX) + 10;
    d.position.set(dropX, y, 0);
    d.scale.set(1, 1 + Math.min(.6, a * 1.5), 1);
  });

  // cámara (toma de cine) y entrada con rebote
  const keys = p.camera || SHOTS[p.shot || 'wide'] || SHOTS.wide;
  const pk = back(prog(lt, 0, .45));
  shotCamera(st.cam, keys.map(k => ({ ...k, dist: k.dist / Math.max(.5, (has(k.u) && k.u === 0) ? pk : 1) })), t, s, jump * 14);
  const v = view(st.cam, 1080, 1100, 0, 360);
  render3d(st.scene, v);

  // paño de limpieza (2D sobre el tramo superior)
  if (wipe >= 0) {
    const xx = path.p2u[0] + (path.p1u[0] - path.p2u[0]) * wipe;
    const [sx, sy] = v.project(xx, topY(xx), 20);
    x.save(); x.globalAlpha = .92; x.translate(sx, sy); x.rotate(-.15);
    x.fillStyle = '#EDEDED'; rrect(-60, -46, 120, 92, 18); x.fill(); x.fillStyle = TH.primary; x.fillRect(-60, -7, 120, 14);
    x.restore();
  }
  // regla de holgura
  if (has(p.measure_at)) {
    const mm = prog(t, p.measure_at, p.measure_at + .4);
    if (mm > 0) {
      const mxw = (path.p1l[0] + path.p2l[0]) / 2, myw = (path.p1l[1] + path.p2l[1]) / 2;
      const [ax, ay] = v.project(mxw, myw, 16), [bx, by] = v.project(mxw, myw - sag - flap, 16);
      const [l0x, l0y] = v.project(mxw - 170, myw, 16), [l1x, l1y] = v.project(mxw + 170, myw, 16);
      const ok = has(p.ok_at) && t >= p.ok_at;
      x.save(); x.globalAlpha = mm; x.strokeStyle = ok ? '#fff' : TH.accent; x.fillStyle = x.strokeStyle; x.lineWidth = 6;
      x.setLineDash([14, 10]); x.beginPath(); x.moveTo(l0x, l0y); x.lineTo(l1x, l1y); x.stroke(); x.setLineDash([]);
      x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
      for (const [px, py, dir] of [[ax, ay, 1], [bx, by, -1]]) { x.beginPath(); x.moveTo(px - 14, py + 16 * dir); x.lineTo(px + 14, py + 16 * dir); x.lineTo(px, py); x.closePath(); x.fill(); }
      x.font = FONT(900, 42); x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeStyle = '#000'; x.lineWidth = 8;
      const lbl = (p.measure_label || 'HOLGURA') + (ok ? ' ✓' : '');
      x.strokeText(lbl, bx, Math.max(ay, by) + 60); x.fillStyle = ok ? '#fff' : TH.accent; x.fillText(lbl, bx, Math.max(ay, by) + 60);
      x.restore();
    }
  }
  for (const lb of p.labels || []) {
    const spot = {
      front: [...v.project(C1[0], C1[1] + R1 + 22, 0), 200, 470, -1],
      rear: [...v.project(C2[0] + R2 * .62, C2[1] + R2 * .62, 0), 860, 470, 1],
      chain: [...v.project(0, topY(0) + 10, 12), 620, 470, 1],
    }[lb.part];
    if (spot) label(t, lb.at, spot[0], spot[1], spot[2], spot[3], lb.text, spot[4]);
  }
  badgesAt(t, p.badges, 1250);
};

// ================================================================ sprocket_wear (3D)
function buildWear(key) {
  if (MC.cache[key]) return MC.cache[key];
  renderer(1080, 1100);
  const n = 30, R = n * PITCH / (2 * Math.PI);
  const scene = new T.Scene(); lights(scene, -R - 110);
  const m = materials(R, R);
  const good = sprocketMesh(n, R, true, 0, m, m.sprocket1); good.position.set(-255, 0, 0);
  const worn = sprocketMesh(n, R, true, 1, m, m.sprocket2); worn.position.set(255, 0, 0);
  scene.add(good, worn);
  const cam = new T.PerspectiveCamera(28, 1080 / 1100, 10, 8000);
  return (MC.cache[key] = { scene, good, worn, cam, R });
}
MC.scenes.sprocket_wear = function (t, s, p) {
  const st = buildWear('wear' + s.start), lt = t - s.start;
  const showW = has(p.worn_at) ? p.worn_at : s.start + .6;
  const kg = back(prog(lt, 0, .45)), kw = back(prog(t, showW, showW + .45));
  st.good.scale.setScalar(Math.max(.001, kg)); st.worn.scale.setScalar(Math.max(.001, kw));
  st.good.rotation.z = lt * .35; st.worn.rotation.z = lt * .35;
  st.good.rotation.y = st.worn.rotation.y = .22 * Math.sin(lt * .8);
  const hl = has(p.highlight_at) ? p.highlight_at : null;
  const close = [255 + st.R * .55, st.R * .55, 0];
  const keys = p.camera || [
    { u: 0, target: [0, 0, 0], dist: 2150, yaw: -.38, pitch: .16 },
    { at: has(hl) ? hl - .2 : s.start + (s.end - s.start) * .5, target: [80, 0, 0], dist: 1850, yaw: -.18, pitch: .12 },
    { at: has(hl) ? hl + .9 : s.start + (s.end - s.start) * .75, target: close, dist: 760, yaw: -.42, pitch: .3 },
    { u: 1, target: close, dist: 820, yaw: -.25, pitch: .26 },
  ];
  shotCamera(st.cam, keys, t, s);
  const v = view(st.cam, 1080, 1100, 0, 250);
  render3d(st.scene, v);
  const fadeLabels = has(hl) ? 1 - prog(t, hl + .2, hl + .6) : 1;   // en el acercamiento quedan solo los dientes
  const items = [[-255, kg, p.good_label || 'BUENO', 'check', false], [255, kw, p.worn_label || 'GASTADO', 'cross', true]];
  for (const [cx, k, txt, icon, bad] of items) {
    if (k <= 0 || fadeLabels <= 0) continue;
    const [sx, sy] = v.project(cx, -st.R - 70, 0);
    x.save(); x.globalAlpha = fadeLabels; x.translate(sx, sy); x.scale(k, k);
    x.fillStyle = bad ? TH.accent : TH.primary; x.beginPath(); x.arc(0, 0, 44, 0, 7); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 5; x.stroke(); drawIcon(icon, 1.2);
    x.font = FONT(900, 52); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = bad ? TH.accent : TH.text;
    x.fillText(txt, 0, 92);
    x.restore();
  }
  if (has(hl)) {
    const h = prog(t, hl + .9, hl + 1.3);
    if (h > 0) {
      const [hx, hy] = v.project(255 + st.R * .72, st.R * .72, 10);
      x.save(); x.strokeStyle = TH.accent; x.lineWidth = 10; x.globalAlpha = h;
      x.beginPath(); x.arc(hx, hy, 120 + 8 * Math.sin(t * 8), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * eio(h)); x.stroke();
      x.font = FONT(900, 46); x.textAlign = 'center'; x.fillStyle = TH.accent; x.strokeStyle = '#000'; x.lineWidth = 8;
      x.strokeText(p.hook_label || 'DIENTES EN GANCHO', hx - 120, hy - 160); x.fillText(p.hook_label || 'DIENTES EN GANCHO', hx - 120, hy - 160);
      x.restore();
    }
  }
  badgesAt(t, p.badges, 1300);
};

// Piezas compartidas con otros módulos 3D (diorama3d.js)

// ================================================================ "hornear" la escena (menos dibujos = render más rápido)
// SwiftShader dibuja en la CPU: cada malla cuesta una llamada de dibujo (y otra para la sombra). Esta función junta,
// dentro de cada pieza que se mueve (y del resto fijo), todas las mallas que comparten material en UNA sola malla.
// `dyn` = conjunto de objetos que se animan (se conservan como grupos; sus hijos se juntan dentro de ellos).
function bake(root, dyn = new Set()) {
  root.updateMatrixWorld(true);
  const owners = [root, ...[...dyn].filter(o => o !== root)];
  let before = 0, after = 0;
  for (const owner of owners) {
    const inv = owner.matrixWorld.clone().invert(), buckets = new Map(), victims = [];
    const walk = o => {
      for (const c of o.children) {
        if (dyn.has(c)) continue;                                  // otra pieza móvil: se hornea aparte
        if (c.isMesh && c.visible && !c.isSkinnedMesh && !c.isInstancedMesh && !Array.isArray(c.material) && c.geometry.attributes.position && !c.userData.keep) {
          const k = c.material.uuid + (c.castShadow ? 'c' : '') + (c.receiveShadow ? 'r' : '');
          (buckets.get(k) || buckets.set(k, []).get(k)).push(c); victims.push(c);
        }
        walk(c);
      }
    };
    walk(owner);
    for (const list of buckets.values()) {
      before += list.length;
      if (list.length < 2) { after++; continue; }
      let n = 0; for (const m of list) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count);
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), v = new T.Vector3(), nm = new T.Matrix3(), M4 = new T.Matrix4();
      let o = 0;
      for (const m of list) {
        const g = m.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, idx = g.index;
        M4.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(M4);
        const cnt = idx ? idx.count : pos.count, flip = M4.determinant() < 0;
        for (let i = 0; i < cnt; i++) {
          const j = idx ? idx.getX(flip ? i - (i % 3) + 2 - (i % 3) : i) : (flip ? i - (i % 3) + 2 - (i % 3) : i);
          v.fromBufferAttribute(pos, j).applyMatrix4(M4); P.set([v.x, v.y, v.z], o * 3);
          if (nor) { v.fromBufferAttribute(nor, j).applyMatrix3(nm).normalize(); N.set([v.x, v.y, v.z], o * 3); }
          if (uv) { U[o * 2] = uv.getX(j); U[o * 2 + 1] = uv.getY(j); }
          o++;
        }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('normal', new T.BufferAttribute(N, 3)); geo.setAttribute('uv', new T.BufferAttribute(U, 2));
      geo.computeBoundingSphere();
      const mesh = new T.Mesh(geo, list[0].material); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
      mesh.userData.baked = list; owner.add(mesh); after++;
      for (const m of list) m.parent.remove(m);
    }
  }
  return { before, after };
}

MC.three = { T, renderer, render3d, view, shotCamera, shadowed, R3, bake };
await import('./kit3d.js');
await import('./kit3d_pro.js');
await import('./kit3d_moto.js');
await import('./kit3d_moto2.js');
await import('./model3d.js');
await import('./studio3d.js');
await import('./iso3d.js');
await import('./diorama3d.js');

window.MC_READY = true;
