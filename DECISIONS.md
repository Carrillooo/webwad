# DECISIONS.md

Decisiones de arquitectura (ADR ligero). Más reciente arriba.

## ADR-009 — Modo demo ON por defecto
NOVA debe ser usable antes de cualquier credencial. `DEMO_MODE` se considera
activo salvo que se ponga explícitamente `DEMO_MODE=false`. Así una instalación
recién clonada funciona de inmediato con mocks.

## ADR-008 — CSS: sintaxis `rgb(r g b / a)` obligatoria con variables de color
Los tokens de color se guardan como triples separados por espacios
(`--nova-primary: 124 92 255`) para poder modular alpha. Debe usarse
`rgb(var(--x) / .5)`, **nunca** `rgba(var(--x), .5)` (mezcla espacios y comas →
declaración inválida → se descarta). Regla clave para no romper el tema ni el núcleo.

## ADR-007 — Confirmaciones por nivel de riesgo
- Bajo (consultar, crear evento/tarea claramente pedidos): ejecutar + ofrecer deshacer.
- Medio (planificación múltiple, mover varios): mostrar propuesta y confirmar.
- Alto (borrar, sobrescribir, enviar, desconectar): confirmación explícita.
Implementado con `Proposal` + `ConversationState.pendingProposal` que se confía
de vuelta al servidor en cada turno.

## ADR-006 — Datos externos = UNTRUSTED
Todo texto de Docs/Drive/Calendar/Tasks se marca conceptualmente como no confiable.
El agente sólo lo resume/extrae; nunca ejecuta instrucciones incrustadas. Test de
prompt-injection incluido. Ver `docs/SECURITY.md`.

## ADR-005 — El modelo no toca el sistema; sólo herramientas
El asistente (mock hoy, Anthropic mañana) actúa exclusivamente a través de una
capa de herramientas con schema Zod, validación, permisos, propietario, logging,
idempotencia y política de confirmación. Nunca acceso libre.

## ADR-004 — Voz mediante abstracciones intercambiables
`SpeechToTextProvider` / `TextToSpeechProvider`. Primera implementación: Web Speech
API del navegador con fallback a teclado. Arquitectura lista para ElevenLabs/OpenAI/
Google sin tocar la UI.

## ADR-003 — Toda la lógica de fecha por `datetime.ts` (Europe/Madrid)
Zona, idioma (es-ES), 24h y semana desde lunes son invariantes del producto. Se usa
`date-fns` + `date-fns-tz` con conversión explícita por zona IANA para que DST y
«mañana/viernes» sean correctos. Nunca se confía en la zona local del runtime.

## ADR-002 — Patrón Provider + factory (mock ↔ real)
Cada capacidad externa (calendar, tasks, documents, assistant, speech, storage,
messaging) es una interfaz. El factory elige mock vs real según credenciales y
conexión de usuario. Los mocks nunca se eliminan: son el fallback y la base del demo.

## ADR-001 — Stack: Next.js 16 (App Router) + React 19 + TS strict + Tailwind v4
PWA instalable, mobile-first, preparada para Capacitor. Estado de UI con Zustand
(ligero, persiste sólo settings + historial). Motion para animaciones; Three.js sólo
si aporta valor (no se usa aún: el núcleo es SVG/CSS/Motion, más ligero y accesible).
Design tokens como CSS variables → retintado en vivo desde Configuración.
