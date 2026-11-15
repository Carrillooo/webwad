// Origen — taza de cristal 3D, capas de líquido, chorro y toppings (todo en código).
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';

// Medidas de la taza (unidades locales; base en y = 0)
const CUP_H = 1.15;
const R_OUT = 0.5;
const R_IN = 0.44;
const FLOOR = 0.14;           // grosor del fondo de cristal
const LIQ_R = R_IN - 0.006;
export const CAPACITY = 0.94; // altura útil de líquido
const ORDER = ['syrup', 'milk', 'coffee', 'foam'];

export function createCupScene(canvas, { reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null; // sin WebGL: main.js muestra la versión sin 3D
  }
  const mobile = matchMedia('(max-width: 760px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 7);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xffb06a, 3.2);
  key.position.set(-3.5, 2.5, 3);
  const rim = new THREE.DirectionalLight(0xffd8b0, 2.2);
  rim.position.set(3, 2, -3);
  const fill = new THREE.DirectionalLight(0x8fa4c4, 0.35);
  fill.position.set(2, -1, 3);
  scene.add(key, rim, fill);

  // place (posición en pantalla) → tilt (inclinación) → spin (giro) → cup
  const place = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  const cup = new THREE.Group();
  scene.add(place); place.add(tilt); tilt.add(spin); spin.add(cup);
  cup.position.y = -CUP_H / 2;
  tilt.rotation.x = 0.32;

  // ---------- cristal ----------
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.1,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 3.2, side: THREE.DoubleSide, depthWrite: false,
    specularIntensity: 1, ior: 1.5,
  });
  const profile = [
    [0, 0], [R_OUT - 0.04, 0], [R_OUT - 0.008, 0.012], [R_OUT, 0.05],
    [R_OUT, CUP_H - 0.02], [R_OUT - 0.008, CUP_H], [R_IN + 0.012, CUP_H], [R_IN, CUP_H - 0.02],
    [R_IN, FLOOR + 0.04], [R_IN - 0.04, FLOOR], [0, FLOOR],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), glassMat);
  glass.renderOrder = 3;
  cup.add(glass);

  // asa de cristal macizo (hace visible el giro)
  const handleMat = glassMat.clone();
  handleMat.opacity = 0.16;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.045, 24, 64, Math.PI), handleMat);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(R_OUT - 0.01, CUP_H * 0.56, 0);
  handle.scale.set(1, 1.05, 1);
  handle.renderOrder = 3;
  cup.add(handle);

  // sombra de contacto
  const shadowTex = radialTexture([[0, 'rgba(0,0,0,0.85)'], [0.45, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.005;
  cup.add(shadow);

  // ---------- líquidos ----------
  const liquidGeo = new THREE.CylinderGeometry(LIQ_R, LIQ_R, 1, 96, 1, false);
  liquidGeo.translate(0, 0.5, 0);
  const layers = {};
  const layerState = {};
  const defs = {
    syrup: { color: '#a65a1e', roughness: 0.15, clearcoat: 1 },
    milk: { color: '#efe6d6', roughness: 0.45, clearcoat: 0.2 },
    coffee: { color: '#2b170d', roughness: 0.3, clearcoat: 0.5 },
    foam: { color: '#f3ece0', roughness: 0.92, clearcoat: 0 },
  };
  for (const k of ORDER) {
    const m = new THREE.Mesh(liquidGeo, new THREE.MeshPhysicalMaterial({ ...defs[k], color: new THREE.Color(defs[k].color), envMapIntensity: k === 'coffee' || k === 'syrup' ? 0.35 : 0.8 }));
    m.visible = false;
    cup.add(m);
    layers[k] = m;
    layerState[k] = { h: 0, color: new THREE.Color(defs[k].color) };
  }

  // crema sobre el café cuando es la capa de arriba
  const crema = new THREE.Mesh(
    new THREE.CircleGeometry(LIQ_R, 96),
    new THREE.MeshPhysicalMaterial({ map: cremaTexture(), roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.7 })
  );
  crema.rotation.x = -Math.PI / 2;
  cup.add(crema);

  // cúpula de espuma
  const domeGeo = new THREE.SphereGeometry(LIQ_R, 96, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, layers.foam.material);
  cup.add(dome);

  // toppings
  const dustCacao = dustTexture('#3a2114', '#24130a');
  const dustCanela = dustTexture('#9a5a2a', '#6e3b18');
  const dustMat = new THREE.MeshStandardMaterial({ map: dustCacao, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const dustDome = new THREE.Mesh(domeGeo, dustMat);
  const dustDisc = new THREE.Mesh(new THREE.CircleGeometry(LIQ_R, 96), dustMat);
  dustDisc.rotation.x = -Math.PI / 2;
  cup.add(dustDome, dustDisc);
  const drizzleMat = new THREE.MeshPhysicalMaterial({ color: '#b5631f', roughness: 0.12, clearcoat: 1, envMapIntensity: 1.2 });
  let drizzle = new THREE.Mesh(drizzleGeometry(0), drizzleMat);
  cup.add(drizzle);

  // hielo (cold brew)
  const iceMat = new THREE.MeshPhysicalMaterial({ color: '#e8f0f4', roughness: 0.08, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 2 });
  const ice = [];
  const iceGeo = roundedBox(0.17, 0.035);
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(iceGeo, iceMat);
    c.userData = { a: (i / 4) * Math.PI * 2 + 0.4, r: 0.2 + (i % 2) * 0.06, ph: i * 1.7, rot: new THREE.Euler(i * 0.7, i * 1.3, i * 0.4) };
    cup.add(c);
    ice.push(c);
  }

  // chorro del vertido
  const streamGeo = new THREE.CylinderGeometry(0.03, 0.026, 1, 20, 1, true);
  streamGeo.translate(0, 0.5, 0);
  const stream = new THREE.Mesh(streamGeo, new THREE.MeshPhysicalMaterial({ color: '#2b170d', roughness: 0.1, clearcoat: 1, envMapIntensity: 1.4 }));
  stream.position.x = 0.06;
  cup.add(stream);
  const splash = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.075, 48),
    new THREE.MeshBasicMaterial({ color: '#a8703f', transparent: true, opacity: 0.5, depthWrite: false })
  );
  splash.rotation.x = -Math.PI / 2;
  cup.add(splash);

  // ---------- estado animable (lo mueve main.js con GSAP) ----------
  const state = {
    nx: 0, ny: 0, size: 0.5,        // ancla en pantalla (-1..1) y altura relativa
    introY: 0, introS: 1,           // entrada
    tilt: 0.32,
    spin: 0, autoSpin: !reduced,
    stream: 0,                      // 0..1 grosor del chorro
    cap: 0,                         // 0..1 cúpula de espuma
    topping: 'none', toppingK: 0,
    iceK: 0,
    visible: true,
    sizeK: 1,                       // tamaño S/M/L
  };

  const drag = { on: false, x: 0, v: 0, angle: 0 };
  let w = 1, h = 1;
  function resize() {
    w = canvas.clientWidth || innerWidth;
    h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  function stackTop() {
    let y = FLOOR;
    for (const k of ORDER) y += Math.max(layerState[k].h, 0);
    return y;
  }

  // altura visible del cuadro a la distancia de la cámara
  const viewH = () => 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  const clock = new THREE.Clock();
  let t = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    if (!state.visible) return;

    // colocación según el ancla de la sección
    const H = viewH();
    const W = H * camera.aspect;
    const s = (state.size * H) / (CUP_H * 1.1) * state.introS * state.sizeK;
    place.position.set((state.nx * W) / 2, (state.ny * H) / 2 + state.introY, 0);
    place.scale.setScalar(s);
    tilt.rotation.x = state.tilt;

    // giro: auto + arrastre con inercia
    if (!drag.on) {
      drag.v *= 0.94;
      drag.angle += drag.v;
      if (state.autoSpin) drag.angle += dt * 0.22;
    }
    spin.rotation.y = state.spin + drag.angle;

    // capas
    let y = FLOOR;
    let topKey = null;
    for (const k of ORDER) {
      const L = layers[k];
      const hh = layerState[k].h;
      L.visible = hh > 0.002;
      L.position.y = y;
      L.scale.y = Math.max(hh, 0.0001);
      L.material.color.copy(layerState[k].color);
      if (L.visible) topKey = k;
      y += Math.max(hh, 0);
    }
    const top = y;
    crema.visible = topKey === 'coffee';
    crema.position.y = top + 0.0015;
    const domeH = 0.13 * state.cap;
    dome.visible = state.cap > 0.01 && layerState.foam.h > 0.01;
    dome.position.y = top - 0.001;
    dome.scale.set(1, Math.max(domeH / LIQ_R, 0.001), 1);

    // toppings
    const tk = state.toppingK;
    const dust = state.topping === 'cacao' || state.topping === 'canela';
    dustDome.visible = dust && dome.visible && tk > 0.01;
    dustDisc.visible = dust && !dome.visible && tk > 0.01 && top > FLOOR + 0.01;
    dustMat.opacity = tk;
    dustDome.position.y = top;
    dustDome.scale.set(1.004, Math.max(domeH / LIQ_R, 0.001) * 1.04, 1.004);
    dustDisc.position.y = top + 0.003;
    drizzle.visible = state.topping === 'caramelo' && tk > 0.01 && top > FLOOR + 0.01;
    drizzle.position.y = top + 0.006;
    drizzle.scale.set(1, 1, 1).multiplyScalar(0.6 + 0.4 * tk);

    // hielo flotando en la superficie
    for (const c of ice) {
      const u = c.userData;
      c.visible = state.iceK > 0.01;
      c.scale.setScalar(state.iceK);
      c.position.set(Math.cos(u.a + t * 0.1) * u.r, top - 0.07 + Math.sin(t * 1.3 + u.ph) * 0.012, Math.sin(u.a + t * 0.1) * u.r);
      c.rotation.set(u.rot.x + t * 0.05, u.rot.y + t * 0.08, u.rot.z);
    }

    // chorro
    stream.visible = state.stream > 0.01;
    const streamTop = 4;
    stream.position.y = top;
    stream.scale.set(state.stream, streamTop - top, state.stream);
    stream.scale.x *= 1 + Math.sin(t * 40) * 0.04;
    splash.visible = stream.visible && top > FLOOR + 0.005;
    splash.position.set(0.06, top + 0.003, 0);
    const sp = (t * 2.2) % 1;
    splash.scale.setScalar(1 + sp * 3.2);
    splash.material.opacity = 0.5 * (1 - sp) * state.stream;

    renderer.render(scene, camera);
  }

  // ---------- API ----------
  // reconstruye el hilo de caramelo para la cúpula final (con o sin espuma)
  function setTopping(name, withDome) {
    if (name === 'cacao' || name === 'canela') {
      dustMat.map = name === 'canela' ? dustCanela : dustCacao;
      dustMat.needsUpdate = true;
    }
    if (name === 'caramelo') {
      drizzle.geometry.dispose();
      drizzle.geometry = drizzleGeometry(withDome || 0);
    }
  }

  function dragStart(x) { drag.on = true; drag.x = x; drag.v = 0; }
  function dragMove(x) {
    if (!drag.on) return;
    const d = ((x - drag.x) / Math.max(w, 1)) * Math.PI * 2.2;
    drag.angle += d;
    drag.v = d;
    drag.x = x;
  }
  function dragEnd() { drag.on = false; }

  function compile() { renderer.compile(scene, camera); }

  return {
    state, layerState, ORDER, CAPACITY, setTopping, frame, resize, compile,
    dragStart, dragMove, dragEnd, renderer,
    colorOf: (hex) => new THREE.Color(hex),
  };
}

// ---------- texturas y geometrías auxiliares ----------
function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cremaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  grd.addColorStop(0, '#8a5530');
  grd.addColorStop(0.55, '#6a3d1e');
  grd.addColorStop(0.9, '#4a2a15');
  grd.addColorStop(1, '#2b170d');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  // vetas de la crema
  g.globalAlpha = 0.18;
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 200;
    g.strokeStyle = Math.random() > 0.5 ? '#c08a55' : '#3b2416';
    g.lineWidth = 1 + Math.random() * 2.5;
    g.beginPath();
    g.arc(256, 256, r, a, a + 0.2 + Math.random() * 0.8);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function dustTexture(a, b) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 9000; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 230;
    const x = 256 + Math.cos(ang) * r;
    const y = 256 + Math.sin(ang) * r;
    g.fillStyle = Math.random() > 0.4 ? a : b;
    g.globalAlpha = 0.35 + Math.random() * 0.55;
    const s = 1 + Math.random() * 2.6;
    g.fillRect(x, y, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// hilo de caramelo en zigzag, siguiendo la cúpula si hay espuma
function drizzleGeometry(domeH) {
  const pts = [];
  const R = LIQ_R * 0.82;
  const rows = 7;
  for (let i = 0; i <= rows; i++) {
    const z = -R + (2 * R * i) / rows;
    const half = Math.sqrt(Math.max(R * R - z * z, 0));
    const xa = i % 2 ? half : -half;
    const xb = -xa;
    for (let j = 0; j <= 6; j++) {
      const x = xa + ((xb - xa) * j) / 6;
      const zz = z + Math.sin(j * 1.3 + i) * 0.012;
      const rr = Math.min(Math.sqrt(x * x + zz * zz) / LIQ_R, 1);
      pts.push(new THREE.Vector3(x, domeH * Math.sqrt(Math.max(1 - rr * rr, 0)) + 0.007, zz));
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 400, 0.011, 8, false);
}

function roundedBox(size, r) {
  const g = new THREE.BoxGeometry(size, size, size, 4, 4, 4);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const inner = size / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(
      Math.max(-inner, Math.min(inner, v.x)),
      Math.max(-inner, Math.min(inner, v.y)),
      Math.max(-inner, Math.min(inner, v.z))
    );
    const d = v.clone().sub(c).normalize().multiplyScalar(r);
    p.setXYZ(i, c.x + d.x, c.y + d.y, c.z + d.z);
  }
  g.computeVertexNormals();
  return g;
}
