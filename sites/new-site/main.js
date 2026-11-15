// Origen — scroll, intro, configurador y pedido (demo, sin cobro)
import { createCupScene, CAPACITY } from './scene.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) document.documentElement.classList.add('reduced');
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const money = (n) => eur.format(Math.round(n * 100) / 100);

// los scripts clásicos (gsap, ScrollTrigger, Lenis) llevan defer: ya están cargados
const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   Datos
   ============================================================ */
const STEPS = [
  { id: 'base', label: 'Base', legend: '¿Qué café?', options: [
    { id: 'espresso', name: 'Espresso', note: 'Un shot de 30 ml', price: 1.8, h: 0.16, color: '#331a0b' },
    { id: 'doble', name: 'Doble', note: 'Dos shots, más cuerpo', price: 2.4, h: 0.26, color: '#331a0b' },
    { id: 'filtro', name: 'Filtro V60', note: 'Limpio, a fruta roja y panela', price: 2.6, h: 0.56, color: '#3d200f' },
    { id: 'coldbrew', name: 'Cold brew', note: '18 horas en frío, con hielo', price: 3.2, h: 0.5, color: '#24140b', ice: true },
  ] },
  { id: 'milk', label: 'Leche', legend: '¿Con leche?', options: [
    { id: 'none', name: 'Sin leche', note: 'Solo café', price: 0, h: 0 },
    { id: 'entera', name: 'Entera', note: 'De granja, en Guadarrama', price: 0, h: 0.36, color: '#efe6d6', word: 'leche' },
    { id: 'avena', name: 'Avena', note: 'Barista, sin azúcar añadido', price: 0.4, h: 0.36, color: '#e6d5b8', word: 'avena' },
    { id: 'almendra', name: 'Almendra', note: 'Tostada, un punto dulce', price: 0.4, h: 0.36, color: '#eedfc6', word: 'almendra' },
  ] },
  { id: 'foam', label: 'Espuma', legend: '¿Cuánta espuma?', options: [
    { id: 'none', name: 'Sin espuma', note: 'Liso hasta arriba', price: 0, h: 0 },
    { id: 'ligera', name: 'Ligera', note: 'Un dedo, textura sedosa', price: 0, h: 0.07 },
    { id: 'cremosa', name: 'Cremosa', note: 'Alta, como un capuchino', price: 0, h: 0.14 },
  ] },
  { id: 'syrup', label: 'Sirope', legend: '¿Algo dulce en el fondo?', options: [
    { id: 'none', name: 'Sin sirope', note: 'El café tal cual', price: 0, h: 0 },
    { id: 'caramelo', name: 'Caramelo', note: 'Con un punto de sal', price: 0.5, h: 0.05, color: '#a65a1e' },
    { id: 'vainilla', name: 'Vainilla', note: 'De Madagascar', price: 0.5, h: 0.05, color: '#d9b77a' },
    { id: 'avellana', name: 'Avellana', note: 'Tostada en casa', price: 0.5, h: 0.05, color: '#7a4a25' },
  ] },
  { id: 'topping', label: 'Topping', legend: '¿Y por encima?', options: [
    { id: 'none', name: 'Nada', note: 'Limpio', price: 0 },
    { id: 'cacao', name: 'Cacao', note: 'Cacao puro espolvoreado', price: 0.3 },
    { id: 'canela', name: 'Canela', note: 'De Ceilán, molida al momento', price: 0.3 },
    { id: 'caramelo', name: 'Hilo de caramelo', note: 'En zigzag, como debe ser', price: 0.5 },
  ] },
  { id: 'size', label: 'Tamaño', legend: '¿De qué tamaño?', options: [
    { id: 'S', name: 'Pequeño', note: '180 ml', price: -0.3, k: 0.9 },
    { id: 'M', name: 'Mediano', note: '240 ml', price: 0, k: 1 },
    { id: 'L', name: 'Grande', note: '350 ml', price: 0.6, k: 1.1 },
  ] },
];
const DEFAULT = { base: 'doble', milk: 'avena', foam: 'cremosa', syrup: 'none', topping: 'cacao', size: 'M' };

const EXTRAS = [
  { id: 'croissant', name: 'Croissant de mantequilla', note: 'Hojaldre de 27 capas', price: 2.2, ph: 'ph-croissant' },
  { id: 'cookie', name: 'Cookie de chocolate', note: 'Chocolate 70 % y sal en escamas', price: 2.5, ph: 'ph-cookie' },
  { id: 'banana', name: 'Banana bread', note: 'Con nueces, tostado a la plancha', price: 3.0, ph: 'ph-banana' },
  { id: 'bolsa', name: 'Huila, 250 g en grano', note: 'El café de esta taza, para casa', price: 14.5, ph: 'ph-bolsa' },
];

const optOf = (stepId, optId) => STEPS.find((s) => s.id === stepId).options.find((o) => o.id === optId);

/* ============================================================
   Escena 3D
   ============================================================ */
const canvas = $('#cup');
const cup = createCupScene(canvas, { reduced });
if (!cup) {
  document.body.classList.add('no-3d');
  canvas.remove();
}

/* ============================================================
   Scroll suave (Lenis) conectado a ScrollTrigger
   ============================================================ */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ autoRaf: false, lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToEl(el) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.4 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const el = id === '#top' ? document.body : $(id);
  if (!el) return;
  e.preventDefault();
  if (id === '#top') { lenis ? lenis.scrollTo(0) : scrollTo(0, 0); return; }
  scrollToEl(el);
});

// cabecera sólida al bajar
const nav = $('#nav');
ScrollTrigger.create({ start: 40, end: 'max', onToggle: (s) => nav.classList.toggle('is-solid', s.isActive) });

/* ============================================================
   Taza: anclas por sección + vertido
   ============================================================ */
const mobileQ = matchMedia('(max-width: 760px)');
const anchors = { hero: null, origen: null, crea: null };
function measure() {
  const vh = innerHeight;
  const rest = (el, sec, hk = 1) => {
    const r = el.getBoundingClientRect();
    const sr = sec.getBoundingClientRect();
    return {
      nx: ((r.left + r.width / 2) / innerWidth) * 2 - 1,
      ny: -(((r.top - sr.top + r.height / 2) / vh) * 2 - 1),
      size: (r.height * hk) / vh,
    };
  };
  anchors.hero = rest($('#anchorHero'), $('#hero'));
  anchors.origen = rest($('#anchorOrigen'), $('.origen-inner'));
  anchors.crea = rest($('#creaStage'), $('#crea'), mobileQ.matches ? 0.9 : 0.74);
}

const pin = ScrollTrigger.create({
  trigger: '.origen-inner', start: 'top top', end: () => '+=' + Math.round(innerHeight * 2.2), pin: true, anticipatePin: 1,
});
const toOrigen = ScrollTrigger.create({ trigger: '#origen', start: 'top bottom', end: 'top top' });
const toCrea = ScrollTrigger.create({ trigger: '#crea', start: 'top bottom', end: 'top top' });
const outCrea = ScrollTrigger.create({ trigger: '#complementos', start: 'top bottom', end: 'top top' });
ScrollTrigger.addEventListener('refreshInit', () => gsap.set('.origen-inner', { clearProps: 'transform' }));
ScrollTrigger.addEventListener('refresh', measure);

let mode = 'pour';
ScrollTrigger.create({
  trigger: '#crea', start: 'top 65%',
  onEnter: () => setMode('config'),
  onLeaveBack: () => setMode('pour'),
});

const chapters = $$('.chapter');
const creaEl = $('#crea');
const pourBar = $('#pourBar');
let level = 0;
let lastChapter = -1;
const ease = (x) => x * x * (3 - 2 * x);
const mix = (a, b, t) => a + (b - a) * t;

function tick() {
  const p = pin.progress;
  // capítulos de texto
  const ch = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
  if (ch !== lastChapter) {
    chapters.forEach((c, i) => c.classList.toggle('is-active', i === ch));
    lastChapter = ch;
  }
  pourBar.style.transform = `scaleY(${p})`;
  if (!cup || !anchors.hero) return;

  const S = cup.state;
  // colocación: héroe → viaje → crea
  const a = ease(toOrigen.progress);
  const c = ease(toCrea.progress);
  const A = anchors;
  S.nx = mix(mix(A.hero.nx, A.origen.nx, a), A.crea.nx, c);
  S.ny = mix(mix(A.hero.ny, A.origen.ny, a), A.crea.ny, c);
  S.size = mix(mix(A.hero.size, A.origen.size, a), A.crea.size, c);
  S.tilt = mix(mix(0.3, 0.46, a), 0.26, c);
  // cuando «Crea» ya llegó arriba, la taza se va con la sección (no flota sobre el panel)
  const creaTop = creaEl.getBoundingClientRect().top;
  if (c >= 1 && creaTop < 0) S.ny += (-creaTop / innerHeight) * 2;

  // fuera de vista → no renderizar
  const visible = outCrea.progress < 1;
  if (visible !== S.visible) { S.visible = visible; canvas.classList.toggle('is-off', !visible); }

  if (mode === 'pour') {
    const target = reduced ? 1 : p;
    const prev = level;
    level += (target - level) * 0.14;
    const L = cup.layerState;
    L.coffee.h = level * 0.62 * CAPACITY;
    L.coffee.color.set('#3d200f');
    const pouring = !reduced && p > 0.015 && p < 0.97;
    const flow = pouring ? Math.min(1, 0.35 + Math.abs(level - prev) * 140) : 0;
    S.stream += (flow - S.stream) * 0.2;
    S.spin = p * Math.PI * 1.1;
  } else {
    S.stream += (0 - S.stream) * 0.25;
  }
  cup.frame();
}

/* ============================================================
   Configurador
   ============================================================ */
const cfg = { ...DEFAULT };
let stepIdx = 0;
const stepsEl = $('#steps');
const bodyEl = $('#stepBody');

function priceOf(c) {
  return STEPS.reduce((sum, s) => sum + optOf(s.id, c[s.id]).price, 0);
}
function nameOf(c) {
  const base = optOf('base', c.base).name;
  const milk = optOf('milk', c.milk);
  return milk.id === 'none' ? base : `${base} con ${milk.word}`;
}
function descOf(c) {
  const parts = [];
  const f = optOf('foam', c.foam); if (f.id !== 'none') parts.push(`Espuma ${f.name.toLowerCase()}`);
  const s = optOf('syrup', c.syrup); if (s.id !== 'none') parts.push(`Sirope de ${s.name.toLowerCase()}`);
  const t = optOf('topping', c.topping); if (t.id !== 'none') parts.push(t.name);
  parts.push(optOf('size', c.size).name);
  return parts.join(' · ');
}

function renderSteps() {
  stepsEl.innerHTML = STEPS.map((s, i) => `
    <li role="presentation"><button type="button" role="tab" id="tab-${s.id}" aria-controls="panel-${s.id}"
      aria-selected="${i === stepIdx}" tabindex="${i === stepIdx ? 0 : -1}" data-i="${i}">${s.label}</button></li>`).join('');
  bodyEl.innerHTML = STEPS.map((s, i) => `
    <fieldset role="tabpanel" id="panel-${s.id}" aria-labelledby="tab-${s.id}" ${i === stepIdx ? '' : 'hidden'}>
      <legend>${s.legend}</legend>
      ${s.options.map((o) => `
        <label class="opt">
          <input type="radio" name="${s.id}" value="${o.id}" ${cfg[s.id] === o.id ? 'checked' : ''}>
          <span class="opt-name">${o.name}<span class="opt-note">${o.note}</span></span>
          <span class="opt-price">${s.id === 'base' ? money(o.price) : o.price > 0 ? '+' + money(o.price) : o.price < 0 ? '−' + money(-o.price) : ''}</span>
        </label>`).join('')}
    </fieldset>`).join('');
}
function showStep(i, focus = false) {
  stepIdx = Math.max(0, Math.min(STEPS.length - 1, i));
  $$('[role=tab]', stepsEl).forEach((b, j) => {
    b.setAttribute('aria-selected', j === stepIdx);
    b.tabIndex = j === stepIdx ? 0 : -1;
  });
  $$('fieldset', bodyEl).forEach((f, j) => { f.hidden = j !== stepIdx; });
  $('#prevStep').disabled = stepIdx === 0;
  $('#nextStep').disabled = stepIdx === STEPS.length - 1;
  const tab = $$('[role=tab]', stepsEl)[stepIdx];
  // solo desplaza la fila de pasos, nunca la página
  stepsEl.scrollTo({ left: tab.offsetLeft - stepsEl.clientWidth / 2 + tab.clientWidth / 2, behavior: 'smooth' });
  if (focus) tab.focus();
}
function updateSummary() {
  $('#summaryLine').textContent = `${nameOf(cfg)} · ${descOf(cfg)}`;
  $('#price').textContent = money(priceOf(cfg));
}

stepsEl.addEventListener('click', (e) => {
  const b = e.target.closest('[role=tab]');
  if (b) showStep(+b.dataset.i);
});
stepsEl.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { e.preventDefault(); showStep(stepIdx + 1, true); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); showStep(stepIdx - 1, true); }
});
bodyEl.addEventListener('change', (e) => {
  if (e.target.type !== 'radio') return;
  cfg[e.target.name] = e.target.value;
  updateSummary();
  if (mode === 'config') applyConfig();
});
$('#prevStep').addEventListener('click', () => showStep(stepIdx - 1));
$('#nextStep').addEventListener('click', () => showStep(stepIdx + 1));
$('#creaForm').addEventListener('submit', (e) => {
  e.preventDefault();
  addToCart({ type: 'coffee', key: 'c:' + STEPS.map((s) => cfg[s.id]).join('-'), name: nameOf(cfg), desc: descOf(cfg), unit: priceOf(cfg) });
  toast(`${nameOf(cfg)} añadido · ahora, ¿algo para acompañar?`);
  setTimeout(() => scrollToEl($('#complementos')), 650);
});

// capas 3D a partir de la configuración
function layerTargets(c) {
  const base = optOf('base', c.base);
  const milk = optOf('milk', c.milk);
  const foam = optOf('foam', c.foam);
  const syrup = optOf('syrup', c.syrup);
  let hs = { syrup: syrup.h, milk: milk.h, coffee: base.h, foam: foam.h };
  const total = hs.syrup + hs.milk + hs.coffee + hs.foam;
  if (total > 0.9) { // que no rebose: recorta leche y café a partes iguales
    const k = (0.9 - hs.syrup - hs.foam) / (hs.milk + hs.coffee);
    hs.milk *= k; hs.coffee *= k;
  }
  return {
    h: Object.fromEntries(Object.entries(hs).map(([k, v]) => [k, v * CAPACITY])),
    color: { syrup: syrup.color, milk: milk.color, coffee: base.color },
    cap: foam.h > 0 ? (foam.id === 'cremosa' ? 1 : 0.55) : 0,
    ice: base.ice ? 1 : 0,
    topping: c.topping,
    size: optOf('size', c.size).k,
  };
}
function applyConfig() {
  if (!cup) return;
  const T = layerTargets(cfg);
  const L = cup.layerState;
  const S = cup.state;
  const d = reduced ? 0 : 0.9;
  for (const k of cup.ORDER) {
    gsap.to(L[k], { h: T.h[k], duration: d, ease: 'power3.out', overwrite: 'auto' });
    if (T.color[k]) {
      const col = cup.colorOf(T.color[k]);
      gsap.to(L[k].color, { r: col.r, g: col.g, b: col.b, duration: d * 0.8, overwrite: 'auto' });
    }
  }
  gsap.to(S, { cap: T.cap, iceK: T.ice, sizeK: T.size, duration: d, ease: 'power3.out', overwrite: 'auto' });
  if (T.topping !== S.topping) {
    const next = T.topping;
    gsap.to(S, {
      toppingK: 0, duration: d * 0.25, overwrite: 'auto',
      onComplete: () => {
        S.topping = next;
        cup.setTopping(next, T.cap * 0.13);
        if (next !== 'none') gsap.to(S, { toppingK: 1, duration: d * 0.6, ease: 'power2.out' });
      },
    });
  } else if (T.topping === 'caramelo') {
    cup.setTopping('caramelo', T.cap * 0.13);
  }
}
function setMode(m) {
  if (m === mode) return;
  mode = m;
  if (!cup) return;
  const S = cup.state;
  if (m === 'config') {
    applyConfig();
  } else {
    const L = cup.layerState;
    gsap.killTweensOf([L.syrup, L.milk, L.coffee, L.foam, S]);
    gsap.to([L.syrup, L.milk, L.foam], { h: 0, duration: 0.5 });
    gsap.to(S, { cap: 0, iceK: 0, toppingK: 0, sizeK: 1, duration: 0.5, onComplete: () => { S.topping = 'none'; } });
  }
}

// arrastrar para girar
const stage = $('#creaStage');
stage.addEventListener('pointerdown', (e) => { if (cup) { cup.dragStart(e.clientX); stage.setPointerCapture(e.pointerId); } });
stage.addEventListener('pointermove', (e) => cup && cup.dragMove(e.clientX));
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => stage.addEventListener(t, () => cup && cup.dragEnd()));

/* ============================================================
   Complementos
   ============================================================ */
$('#compList').innerHTML = EXTRAS.map((x) => `
  <li class="comp-item">
    <div class="comp-img"><div class="ph ${x.ph}" role="img" aria-label="${x.name}"></div></div>
    <div class="comp-row"><h3>${x.name}</h3><span class="comp-price">${money(x.price)}</span></div>
    <p>${x.note}</p>
    <button class="btn btn-ghost btn-sm comp-add" type="button" data-id="${x.id}">Añadir</button>
  </li>`).join('');
$('#compList').addEventListener('click', (e) => {
  const b = e.target.closest('.comp-add');
  if (!b) return;
  const x = EXTRAS.find((i) => i.id === b.dataset.id);
  addToCart({ type: 'extra', key: 'x:' + x.id, name: x.name, desc: x.note, unit: x.price });
  b.textContent = 'Añadido ✓';
  b.classList.add('is-added');
  setTimeout(() => { b.textContent = 'Añadir otro'; }, 1400);
  toast(`${x.name} añadido`);
});
$('#openCartFromComp').addEventListener('click', () => openDrawer());

/* ============================================================
   Pedido (carrito → recogida → confirmado). Demo: no se cobra.
   ============================================================ */
const KEY = 'origen-cart-v1';
let cart = [];
try { cart = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* sin almacenamiento */ } };
const count = () => cart.reduce((n, i) => n + i.qty, 0);
const total = () => cart.reduce((n, i) => n + i.qty * i.unit, 0);

function addToCart(item) {
  const found = cart.find((i) => i.key === item.key);
  if (found) found.qty += 1; else cart.push({ ...item, qty: 1 });
  save();
  renderCount(true);
  if (drawerOpen) renderDrawer();
}
function renderCount(bump = false) {
  const n = count();
  const el = $('#cartCount');
  el.textContent = n;
  el.classList.toggle('has-items', n > 0);
  $('#cartBtn').setAttribute('aria-label', `Abrir pedido, ${n} ${n === 1 ? 'producto' : 'productos'}`);
  if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}

// franjas de recogida en hora de Madrid
function madridNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { day: parts.weekday, min: +parts.hour * 60 + +parts.minute };
}
const hoursFor = (day) => (day === 'Sat' || day === 'Sun' ? [9 * 60, 15 * 60] : [8 * 60, 20 * 60]);
const NEXT = { Mon: 'Tue', Tue: 'Wed', Wed: 'Thu', Thu: 'Fri', Fri: 'Sat', Sat: 'Sun', Sun: 'Mon' };
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function slots() {
  const { day, min } = madridNow();
  const [open, close] = hoursFor(day);
  const out = [];
  let start = Math.max(open, Math.ceil((min + 15) / 15) * 15);
  for (let m = start; m <= close - 15 && out.length < 16; m += 15) out.push({ v: `hoy-${hhmm(m)}`, label: `Hoy · ${hhmm(m)}`, say: `hoy a las ${hhmm(m)}` });
  if (!out.length) {
    const [o2, c2] = hoursFor(NEXT[day]);
    for (let m = o2 + 15; m <= c2 - 15 && out.length < 16; m += 15) out.push({ v: `man-${hhmm(m)}`, label: `Mañana · ${hhmm(m)}`, say: `mañana a las ${hhmm(m)}` });
  }
  return out;
}

const drawer = $('#drawer');
const scrim = $('#scrim');
const dBody = $('#drawerBody');
let drawerOpen = false;
let view = 'cart';
let lastFocus = null;
let order = null;

function openDrawer() {
  if (drawerOpen) return;
  drawerOpen = true;
  view = 'cart';
  lastFocus = document.activeElement;
  renderDrawer();
  drawer.hidden = false; scrim.hidden = false;
  requestAnimationFrame(() => { drawer.classList.add('is-open'); scrim.classList.add('is-open'); });
  document.body.classList.add('is-locked');
  lenis && lenis.stop();
  setTimeout(() => $('#closeDrawer').focus(), 60);
}
function closeDrawer() {
  if (!drawerOpen) return;
  drawerOpen = false;
  drawer.classList.remove('is-open'); scrim.classList.remove('is-open');
  setTimeout(() => { if (!drawerOpen) { drawer.hidden = true; scrim.hidden = true; } }, 500);
  document.body.classList.remove('is-locked');
  lenis && lenis.start();
  lastFocus && lastFocus.focus && lastFocus.focus();
}
$('#cartBtn').addEventListener('click', openDrawer);
$('#closeDrawer').addEventListener('click', closeDrawer);
scrim.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
  if (!drawerOpen) return;
  if (e.key === 'Escape') closeDrawer();
  if (e.key === 'Tab') { // foco atrapado en el cajón
    const f = $$('button, input, select, a[href]', drawer).filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderDrawer() {
  $('#drawerTitle').textContent = view === 'done' ? 'Pedido confirmado' : view === 'pickup' ? 'Recogida' : 'Tu pedido';
  if (view === 'done') {
    dBody.innerHTML = `
      <div class="done-wrap">
        <p class="num">${order.num}</p>
        <p class="big">Recógelo ${order.when}.</p>
        <p>${esc(order.name)}, te lo tenemos listo en Calle del Pez, 14. Di tu nombre y el número en la barra.</p>
        <p class="demo-note">Pedido de demostración: no se ha cobrado nada ni se ha enviado a ninguna tienda.</p>
        <button class="btn btn-solid" type="button" id="againBtn">Hacer otro pedido</button>
      </div>`;
    $('#againBtn').addEventListener('click', () => { closeDrawer(); scrollToEl($('#crea')); });
    return;
  }
  if (!cart.length) {
    dBody.innerHTML = `
      <div class="empty">
        <strong>Todavía no hay nada.</strong>
        <p>Empieza por el café: elige base, leche y lo demás.</p>
        <button class="btn btn-solid" type="button" id="goCrea">Crea tu café</button>
      </div>`;
    $('#goCrea').addEventListener('click', () => { closeDrawer(); scrollToEl($('#crea')); });
    return;
  }
  if (view === 'cart') {
    dBody.innerHTML = `
      ${cart.map((i, idx) => `
        <div class="line-item">
          <h3>${esc(i.name)}</h3><span class="lp">${money(i.unit * i.qty)}</span>
          <p class="desc">${esc(i.desc)}</p>
          <div class="qty">
            <button type="button" data-a="dec" data-i="${idx}" aria-label="Quitar uno de ${esc(i.name)}">−</button>
            <span aria-label="Cantidad">${i.qty}</span>
            <button type="button" data-a="inc" data-i="${idx}" aria-label="Añadir uno de ${esc(i.name)}">+</button>
            <button type="button" class="rm" data-a="rm" data-i="${idx}">Quitar</button>
          </div>
        </div>`).join('')}
      <div class="totals">
        <div class="row big"><span>Total</span><span>${money(total())}</span></div>
        <button class="btn btn-solid" type="button" id="toPickup">Elegir hora de recogida</button>
        <button class="back-link" type="button" id="addMore">Seguir añadiendo</button>
      </div>`;
    dBody.querySelectorAll('.qty button').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (b.dataset.a === 'inc') cart[i].qty += 1;
      if (b.dataset.a === 'dec') cart[i].qty -= 1;
      if (b.dataset.a === 'rm' || cart[i].qty <= 0) cart.splice(i, 1);
      save(); renderCount(); renderDrawer();
    }));
    $('#toPickup').addEventListener('click', () => { view = 'pickup'; renderDrawer(); $('#slot').focus(); });
    $('#addMore').addEventListener('click', () => { closeDrawer(); scrollToEl($('#complementos')); });
    return;
  }
  // recogida
  const s = slots();
  dBody.innerHTML = `
    <form id="pickupForm" novalidate>
      <div class="field">
        <label for="slot">Hora de recogida</label>
        <select id="slot" name="slot">${s.map((o) => `<option value="${o.v}">${o.label}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label for="cname">Nombre</label>
        <input id="cname" name="cname" autocomplete="given-name" required minlength="2" maxlength="40">
        <span class="err" id="cnameErr"></span>
      </div>
      <div class="field">
        <label for="cphone">Teléfono</label>
        <input id="cphone" name="cphone" type="tel" inputmode="tel" autocomplete="tel" placeholder="600 123 456">
        <span class="err" id="cphoneErr"></span>
      </div>
      <div class="totals">
        <div class="row"><span>${count()} ${count() === 1 ? 'producto' : 'productos'}</span><span>${money(total())}</span></div>
        <div class="row big"><span>A pagar</span><span>${money(total())}</span></div>
        <p class="demo-note">Pago de demostración: al confirmar no se cobra nada.</p>
        <button class="btn btn-solid" type="submit">Confirmar pedido</button>
        <button class="back-link" type="button" id="backCart">Volver al pedido</button>
      </div>
    </form>`;
  $('#backCart').addEventListener('click', () => { view = 'cart'; renderDrawer(); });
  ['cname', 'cphone'].forEach((id) => $('#' + id).addEventListener('input', () => { $('#' + id + 'Err').textContent = ''; $('#' + id).removeAttribute('aria-invalid'); }));
  $('#pickupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#cname').value.trim();
    const phone = $('#cphone').value.replace(/[\s-]/g, '');
    let ok = true;
    $('#cnameErr').textContent = name.length >= 2 ? '' : 'Escribe tu nombre para llamarte en la barra.';
    if (name.length < 2) ok = false;
    const phoneOk = /^(\+34)?[6-9]\d{8}$/.test(phone);
    $('#cphoneErr').textContent = phoneOk ? '' : 'Un móvil español de 9 cifras, por si hay algún problema.';
    if (!phoneOk) ok = false;
    $('#cname').setAttribute('aria-invalid', name.length < 2);
    $('#cphone').setAttribute('aria-invalid', !phoneOk);
    if (!ok) { (name.length < 2 ? $('#cname') : $('#cphone')).focus(); return; }
    const slot = s.find((o) => o.v === $('#slot').value) || s[0];
    order = { num: 'OR-' + Math.floor(1000 + Math.random() * 9000), when: slot.say, name };
    cart = []; save(); renderCount();
    view = 'done'; renderDrawer();
    $('#againBtn').focus();
  });
}

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-on'), 2600);
}

/* ============================================================
   Intro: cae una gota, se abre una onda y aparece la taza
   ============================================================ */
function intro() {
  const lines = $$('.hero-title .line > span');
  const foot = $$('.hero-foot > *, .scroll-cue');
  if (reduced) { $('#intro')?.remove(); return; }
  const S = cup && cup.state;
  if (S) { S.introS = 0.86; S.introY = -0.35; }
  const tl = gsap.timeline({ onComplete: () => { $('#intro')?.remove(); window.removeEventListener('wheel', skip); window.removeEventListener('keydown', skip); window.removeEventListener('pointerdown', skip); window.removeEventListener('touchstart', skip); } });
  gsap.set(lines, { yPercent: 110 });
  gsap.set(foot, { opacity: 0, y: 16 });
  tl.to('.intro-drop', { y: () => innerHeight / 2 + 30, duration: 0.6, ease: 'power2.in' })
    .to('.intro-drop', { scaleX: 2.4, scaleY: 0.2, opacity: 0, duration: 0.14, ease: 'power1.out' })
    .to('.intro-ring', { scale: (i) => 22 + i * 10, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, startAt: { opacity: 0.9 } }, '<')
    .to('#intro', { opacity: 0, duration: 0.7, ease: 'power2.out' }, '<+0.2');
  if (S) tl.to(S, { introS: 1, introY: 0, duration: 1.3, ease: 'expo.out' }, '<');
  tl.to(lines, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, '<+0.1')
    .to(foot, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 }, '<+0.35');
  function skip() { tl.progress(1); }
  window.addEventListener('wheel', skip, { passive: true });
  window.addEventListener('keydown', skip);
  window.addEventListener('pointerdown', skip);
  window.addEventListener('touchstart', skip, { passive: true });
}

/* ============================================================
   Arranque
   ============================================================ */
renderSteps();
showStep(0);
updateSummary();
renderCount();

addEventListener('resize', () => cup && cup.resize());
mobileQ.addEventListener('change', () => ScrollTrigger.refresh());

(async () => {
  try { await document.fonts.ready; } catch { /* nada */ }
  ScrollTrigger.refresh();
  measure();
  if (cup) cup.compile();
  gsap.ticker.add(tick);
  intro();
})();
