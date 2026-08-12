# Instalar ZERO en iPhone (PWA)

ZERO es una PWA instalable. En iPhone se instala desde Safari.

## Pasos

1. Abre **Safari** (no Chrome) y entra en la URL de ZERO (p. ej. tu despliegue de Vercel).
2. Toca el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Elige **«Añadir a pantalla de inicio»**.
4. Confirma el nombre «ZERO» y toca **Añadir**.
5. Abre ZERO desde el icono de la pantalla de inicio: se ejecuta en **modo standalone**
   (sin barra de Safari), a pantalla completa.

## Requisitos y detalles

- **HTTPS**: iOS sólo instala PWAs servidas por HTTPS (Vercel lo da). En local usa
  `npm run dev` en el navegador; la instalación real requiere el despliegue.
- **Manifest**: `/manifest.webmanifest` (`display: standalone`, theme color oscuro).
- **Iconos**: `apple-touch-icon.png` (180×180) + `icon-192/512` + `maskable-512`.
- **Safe areas**: la UI respeta `env(safe-area-inset-*)` (notch y barra inferior).
- **Micrófono**: en la PWA instalada, iOS pedirá permiso de micrófono la primera vez
  que pulses el núcleo.
- **Voz**: el reconocimiento de voz depende de Safari; si no está disponible, usa el
  teclado (siempre presente).

## Comprobación

Instalada correctamente: el icono aparece en la pantalla de inicio, al abrir no se
ve la barra de Safari y el color de estado es oscuro. Sin conexión, se muestra la
pantalla `offline.html`.
