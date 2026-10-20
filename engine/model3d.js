// Modelos 3D descargados (GLB/glTF, FBX, OBJ, STL) para usar una moto real en el taller en miniatura.
// El modelo se endereza (adelante = +x, arriba = +y), se lleva a milímetros reales con su largo total y sus
// piezas se agrupan por nombre en los mismos conjuntos desmontables que las motos hechas a mano (frontWheel, forkL,
// tank, swingarm...), así sirven igual "moves", "marks" y el desarme. Para ver los nombres de las piezas de un
// archivo: python -m motocine piezas ruta/al/modelo.glb
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from './vendor/jsm/loaders/FBXLoader.js';
import { OBJLoader } from './vendor/jsm/loaders/OBJLoader.js';
import { STLLoader } from './vendor/jsm/loaders/STLLoader.js';
import { clone as skClone } from './vendor/jsm/utils/SkeletonUtils.js';

const MC = window.MC;
const { T } = MC.three;
MC.models = MC.models || {};

async function loadModel(url) {
  if (MC.models[url]) return MC.models[url];
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  let root;
  if (ext === 'glb' || ext === 'gltf') root = (await new GLTFLoader().loadAsync(url)).scene;
  else if (ext === 'fbx') root = await new FBXLoader().loadAsync(url);
  else if (ext === 'obj') root = await new OBJLoader().loadAsync(url);
  else if (ext === 'stl') root = new T.Mesh(await new STLLoader().loadAsync(url), new T.MeshStandardMaterial({ color: 0x8a8f96, roughness: .4, metalness: .4 }));
  else throw new Error('Formato de modelo no soportado: .' + ext + ' (usa GLB, glTF, FBX, OBJ o STL)');
  // materiales "viejos" (Phong/Lambert de FBX y OBJ) a materiales físicos, para que respondan igual a la luz del taller
  root.traverse(o => {
    if (!o.isMesh) return;
    const fix = m => (m.isMeshStandardMaterial ? m : new T.MeshStandardMaterial({ color: m.color || 0x888888, map: m.map || null,
      roughness: m.shininess !== undefined ? Math.max(.15, 1 - m.shininess / 100) : .5, metalness: .2, transparent: !!m.transparent, opacity: m.opacity ?? 1 }));
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
  });
  return (MC.models[url] = root);
}

// precarga los modelos que piden las escenas (lo llama MC.init antes del primer cuadro)
MC.preload3d = async spec => {
  for (const s of spec.scenes) if (s.params && s.params.model_url) await loadModel(s.params.model_url);
};

const ORIENT = { '+x': 0, '-x': Math.PI, '+z': Math.PI / 2, '-z': -Math.PI / 2 };
const wild = p => new RegExp('^' + p.split('*').map(q => q.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');

// arma la moto a partir del modelo. cfg: { forward: '+x'|'-x'|'+z'|'-z', up: '+y'|'+z', length (mm, largo total),
// parts: { frontWheel: ['rueda_del*', ...], ... }, glow: { disc: [...], caliper: [...], chain: [...], engine: [...] } }
function modelBike(C, url, cfg = {}) {
  const src = MC.models[url]; if (!src) throw new Error('Modelo no cargado: ' + url);
  const model = skClone(src), fix = new T.Group(), bike = new T.Group(), root = new T.Group();
  if ((cfg.up || '+y') === '+z') model.rotation.x = -Math.PI / 2;
  fix.add(model); fix.rotation.y = ORIENT[cfg.forward || '+x'] ?? 0;
  fix.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(fix), size = box.getSize(new T.Vector3());
  const k = (cfg.length || 2000) / size.x;                                      // a milímetros reales
  fix.scale.setScalar(k); fix.updateMatrixWorld(true);
  box.setFromObject(fix); const c = box.getCenter(new T.Vector3());
  fix.position.set(-c.x + (cfg.shift || [0, 0, 0])[0], -box.min.y + (cfg.shift || [0, 0, 0])[1], -c.z + (cfg.shift || [0, 0, 0])[2]);
  bike.add(fix); bike.updateMatrixWorld(true);
  // agrupar piezas por nombre (un objeto entra en el primer conjunto que lo nombre; sus hijos van con él)
  const G = {}, used = new Set(), byPattern = pats => { const res = [], re = pats.map(wild);
    fix.traverse(o => { if (o === fix || o === model) return; let a = o.parent; while (a) { if (used.has(a) || res.includes(a)) return; a = a.parent; }
      if (re.some(r => r.test(o.name || ''))) res.push(o); }); return res; };
  for (const [name, pats] of Object.entries(cfg.parts || {})) {
    const objs = byPattern([].concat(pats)); if (!objs.length) { console.warn('modelo: ninguna pieza coincide con', name, pats); continue; }
    const g = new T.Group(); g.name = name; bike.add(g); G[name] = g;
    for (const o of objs) { used.add(o); g.attach(o); }
  }
  // ruedas: un pivote en el centro de cada una para que giren sobre su eje
  const pivot = gname => {
    const g = G[gname], w = new T.Group(); if (!g) { bike.add(w); return { w, parts: {} }; }
    const b = new T.Box3().setFromObject(g), cc = b.getCenter(new T.Vector3()); bike.worldToLocal(cc);
    w.position.copy(cc); g.add(w); for (const ch of [...g.children]) if (ch !== w) w.attach(ch);
    return { w, parts: {} };
  };
  const F = pivot('frontWheel'), R = pivot('rearWheel');
  const pick = pats => { if (!pats) return null; let m = null; const re = [].concat(pats).map(wild); bike.traverse(o => { if (!m && o.isMesh && re.some(r => r.test(o.name || ''))) m = o; }); return m; };
  const gl = cfg.glow || {};
  F.parts.disc = pick(gl.disc); F.parts.caliper = pick(gl.caliper); R.parts.sprocket = pick(gl.sprocket);
  bike.scale.setScalar(MC.kit.moto.S); root.add(bike);
  return { bike: root, F, R, engine: pick(gl.engine), chain: pick(gl.chain), tank: pick(gl.tank), groups: G, model: true };
}

// lista de piezas (para mapear nombres): árbol con tamaño en mm ya enderezado y escalado
MC.modelParts = async (url, cfg = {}) => {
  await loadModel(url);
  const B = modelBike({}, url, { ...cfg, parts: {} }), out = [], b = new T.Box3(), s = new T.Vector3(), cc = new T.Vector3();
  const inner = B.bike.children[0]; inner.scale.setScalar(1); inner.updateMatrixWorld(true);
  const walk = (o, d) => { if (d > 0) { b.setFromObject(o); b.getSize(s); b.getCenter(cc);
      let tris = 0; o.traverse(m => { if (m.isMesh) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
      out.push({ d, name: o.name || '(sin nombre)', mesh: !!o.isMesh, size: [s.x, s.y, s.z].map(Math.round), at: [cc.x, cc.y, cc.z].map(Math.round), tris: Math.round(tris) }); }
    if (d < 12) for (const ch of o.children) walk(ch, d + 1); };
  walk(inner.children[0], 0);
  return out;
};

Object.assign(MC.kit, { loadModel, modelBike });
