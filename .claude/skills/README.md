# Skills instaladas

Skills de diseño e interfaz de [emilkowalski/skills](https://github.com/emilkowalski/skills)
(MIT, © 2026 Emil Kowalski — ver `LICENSE-emilkowalski`), más `scroll-cinematic`
de [zubair-trabzada/scroll-cinematic-claude](https://github.com/zubair-trabzada/scroll-cinematic-claude)
(ver `scroll-cinematic/SOURCE.md`).

Están en el repositorio a propósito: así cualquier sesión que continúe ZERO las
tiene sin volver a descargarlas.

| Skill | Para qué |
| --- | --- |
| `apple-design` | Interfaz y movimiento al estilo Apple: gestos, muelles, materiales translúcidos, tipografía, accesibilidad. |
| `animate` | Construir una animación desde cero tomando las decisiones en el orden correcto. |
| `animation-vocabulary` | Traducir «quiero que haga tal cosa» al nombre técnico del efecto. |
| `emil-design-eng` | Criterio general de pulido de UI y diseño de componentes. |
| `find-animation-opportunities` | Buscar sitios de la web que deberían animarse y descartar los que no. |
| `improve-animations` | Auditar el movimiento del proyecto y sacar un plan priorizado. |
| `review-animations` | Revisar animaciones ya escritas contra un listón alto. |
| `pick-ui-library` | Elegir librería para una necesidad concreta de frontend. |
| `prototype` | Varias versiones distintas de una pieza de UI para compararlas. |
| `ask-sonner` | Guía de Sonner (toasts en React). |
| `scroll-cinematic` | Sitios «3D scroll» (secuencia de frames en canvas al hacer scroll) desde un solo prompt. |

## `scroll-cinematic` — requisitos y aviso

Construye landings de tipo «3D scroll» (Apple/Awwwards): genera un vídeo cinemático,
lo trocea en ~180 JPG con ffmpeg y los dibuja en un `<canvas>` según el progreso del
scroll. No es Three.js.

- **Necesita el MCP de Higgsfield conectado y con créditos** (~1–2 $ por sitio) para
  generar imagen y clips. Sin él, el pipeline completo no se puede ejecutar.
- ffmpeg se instala solo (`scripts/ensure-ffmpeg.sh` descarga un binario estático a
  `/tmp/ffmpeg-bin` si no está en el sistema).
- `templates/Launch Demo.command` usa `open` y `lsof`: es de macOS. En Linux, sirve la
  carpeta con `python3 -m http.server <puerto>`.
- Es una herramienta para **sitios nuevos aparte**, no para ZERO: el cristal de ZERO no
  se toca y las secuencias de frames (decenas de MB) no entran en la PWA.

Ojo con la regla del proyecto: **el cristal de ZERO no se toca** y el
funcionamiento manda sobre cualquier animación (`CLAUDE.md`).
