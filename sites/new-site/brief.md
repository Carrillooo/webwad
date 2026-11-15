# BRIEF — Origen (tostador de café de especialidad)
Path: A (concepto 2, ampliado por el usuario con pedido online + configurador 3D)
Stack: index.html + style.css + main.js, sin build. GSAP 3.13 + ScrollTrigger + Lenis 1.3 + three.js 0.18x
       como módulos ES vía import map, servidos desde `vendor/` (copias locales de npm, versiones fijadas).
Language of copy: español (es-ES)

## Concept
Pitch: Al hacer scroll se sirve tu café, y luego lo construyes tú, capa a capa, en una taza 3D que puedes girar.
Signature mechanic: Model hero with scroll camera (3D en código) — el scroll vierte el café en una taza de cristal
  3D (el nivel de líquido sube, la cámara orbita) mientras cuenta el viaje finca → tueste → taza.
First 3 seconds: negro total; cae una gota, se abre una onda, aparece una taza de cristal vacía en el centro
  con el titular detrás; al primer scroll empieza a caer un chorro de café dentro.
Secondary: configurador de capas — la misma taza pasa al centro de «Crea tu café»; cada opción elegida
  (base, leche, espuma, sirope, topping) se añade como capa visible en 3D; arrastrar para girar.
Pedido: flujo completo carrito → complementos → hora de recogida → confirmación (ver Log: pagos).

## Art direction
Background: DARK   Density: MEDIUM   Header: transparente sobre el hero, fondo #0B0907 al bajar; «Pedir» + carrito siempre visibles
Palette: #0B0907 bg, #F0EDE8 text, #C8763A accent (cobre/caramelo), #3B2416 espresso, #D9A066 crema, #8A8178 secundario
Display font: Fraunces 700, clamp(3.5rem, 11vw, 11rem), line-height 0.9, tracking -0.03em, sentence case
Body font: Manrope 16px (UI 14–15px), 400/500, line-height 1.5
Texture/visual language: borde orgánico «rasgado» entre bandas; grano fino 3 % sobre negro; vapor sutil
Motion: expo.out / power3.out, reveals 0.9–1.2 s, stagger 0.06; scrub en el vertido y la órbita de cámara;
  muelles suaves (scale .97) en botones; prefers-reduced-motion → taza llena estática, sin scrub

## References → 3 signature moves
Refs estudiadas (shoot.mjs, imágenes de CDN bloqueadas por red; maqueta, tipos y colores sí):
- Apocalypse Coffee Roasters — https://apocalypsecoffee.com/ · mismo nicho, oscuro #090705, acento naranja, Lenis
- WMF Coffee Machines — https://www.wmf-coffeemachines.com/ · mismo nicho, escenario negro, acento bronce
- Little Amps Coffee — https://littleampscoffee.com/ · mismo nicho, pedido online prominente, GSAP + ScrollTrigger
- Virtual Car Showroom — https://labs.otherlife.xyz/virtual-car-showroom · otro nicho, técnica de configurador 3D
  (no cargó: timeout WebGL; se usa sólo su descripción en library.md)
1. Titular a dos tonos: primera línea #F0EDE8, segunda línea en cobre #C8763A (de WMF)
2. Tarjetas ligeramente giradas y solapadas sobre una banda oscura con borde rasgado para la historia de origen (de Apocalypse)
3. Pedir siempre a un toque: «Pedir» y carrito fijos en la cabecera (de Little Amps)

## Sections
1. Intro + Hero — gota → onda (I9, todo en código) → taza de cristal 3D vacía en el centro, titular gigante detrás
   «El café, / desde el origen.»; CTA «Crea tu café».
2. El vertido / Origen — sección fijada: el scroll vierte el café (nivel 0 → 100 %), la cámara orbita;
   3 capítulos de texto entran a la izquierda: Finca (Huila, Colombia), Tueste (lote pequeño, Madrid), Taza. img-01..03 como tarjetas giradas.
3. Crea tu café (configurador) — taza 3D centrada, arrastrable; pasos: Base (espresso, doble, filtro, cold brew) →
   Leche (ninguna, entera, avena, almendra) → Espuma → Sirope → Topping → Tamaño. Cada elección añade/cambia una capa 3D; precio en vivo.
4. Complementos — bollería y extras (croissant, cookie, banana bread, bolsa de grano 250 g); img-04..07.
5. Pedido — cajón de carrito: líneas, recogida en tienda + franja horaria, nombre/teléfono, confirmación con número de pedido.
6. Visítanos / pie — dirección, horario, enlaces.

## Visual world
Register: R4 — Cinematic Moody (cálido)
Palette: #0B0907, #3B2416, #C8763A, #D9A066, #F0EDE8 · background tone: #0B0907
Light: clave baja, una fuente lateral cálida (ámbar 3200 K) con contraluz, vapor que atrapa la luz
Capture feel: foto de producto de cerca con poca profundidad de campo, 85–100 mm macro
Grade & texture: contraste alto pero sombras abiertas, saturación moderada, grano fino
Set & props: madera oscura, piedra negra, cerámica mate, granos verdes y tostados, sacos de yute, tostador de hierro
Hero subject lock: taza de cristal de doble pared, cilíndrica con base gruesa (la del 3D)
Motion language (video): no se necesita vídeo en el héroe
Never in this world: neón, fondos blancos, gente sonriendo a cámara, latte art perfecto de stock, texto en imagen

## Assets
Hero-critical (P4): ninguno — la taza, el líquido, el chorro y las capas se construyen en three.js.
Placeholders for P7: img-01 finca, img-02 tostador, img-03 taza servida, img-04..07 complementos.

## Allowed exceptions
[none]

## Log
2026-11-15 P1: concepto 2 elegido; el usuario añade pedido online y configurador con taza 3D central y complementos.
2026-11-15 P2: la red del entorno bloquea CDNs de las refs → capturas sin imágenes; Virtual Car Showroom no cargó.
  Se elimina el vídeo de vertido: el vertido se hace en 3D sobre la misma taza (une la mecánica principal y la secundaria).
2026-11-15 Pagos: el usuario elige PAGO DE DEMO (sin cobro). Avisos visibles en carrito, confirmación y pie.
2026-11-15 P4: sin assets críticos (todo 3D en código). Librerías y fuentes alojadas en vendor/ y assets/fonts (sin CDN).
2026-11-15 P5: construido hero + viaje (vertido con scroll) + configurador 3D + complementos + pedido + visítanos.
2026-11-15 P6: QA ronda 1–4. Arreglado: la página saltaba a «Crea» al cargar (scrollIntoView), cristal demasiado
  opaco, desbordamiento horizontal del panel en móvil, hilo de caramelo enterrado en la espuma, la taza flotaba
  sobre el panel al seguir bajando. Flujo de pedido probado en escritorio y móvil: 0 errores de consola.
