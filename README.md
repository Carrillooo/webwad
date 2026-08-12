# NOVA

> Asistente personal inteligente, visual y conversacional — una PWA holográfica
> inspirada en la sensación de tener un asistente tipo JARVIS, con identidad propia.

NOVA escucha, transcribe, entiende, consulta tus herramientas (Calendar, Tasks,
Drive, Docs), ejecuta acciones reales cuando tiene permisos y te responde por voz
y texto — todo dentro de un monitor holográfico que se transforma según lo que
está haciendo.

**Funciona hoy mismo sin ninguna credencial** gracias al modo demo (proveedores
mock). Conecta Google, Supabase y Anthropic cuando quieras para activar el modo real.

## Estado actual

- ✅ **Fase 0** — Fundaciones (Next.js 16, TS strict, Tailwind v4, tests, docs)
- ✅ **Fase 1** — UI holográfica: Home, Monitor transformable, Núcleo con 10 estados,
  Calendar/Tasks/Docs/Planner/Briefing/History, Configuración en vivo, PWA base
- ✅ **Fase 2** — Voz: push-to-talk, Web Audio (nivel real de micro), Web Speech STT/TTS,
  fallback por teclado, estados visuales
- ✅ **Fase 7 (demo)** — Agente NLU en español: crear/mover/borrar eventos, detección de
  conflictos, planificador, tareas, briefing, resúmenes; confirmaciones por riesgo;
  datos externos tratados como no confiables
- ✅ **Fase 3** — Supabase: migración con 12 tablas + RLS, cifrado de tokens
  (AES-256-GCM), `StorageProvider`, preferencias y memoria controlada (se activa con credenciales)
- ✅ **Fase 4** — Google Calendar **real**: OAuth 2.0, refresh token cifrado,
  `GoogleCalendarProvider` REST detrás del factory, conexión desde Ajustes (se activa con credenciales)
- ✅ **Fase 5** — Google Tasks **real** (`GoogleTasksProvider`)
- ✅ **Fase 6** — Google Drive + Docs **real** (`GoogleDocumentsProvider`: buscar/leer/crear/append/update)
- ✅ **Fase 7** — Asistente **Anthropic** conversacional con tool-calling (15 herramientas,
  incl. Google Sheets); con `ANTHROPIC_API_KEY`. Sin ella (o si falla), el motor NLU local.
- ✅ **Fase 8** — **Web Push**: suscripción, envío (VAPID), botón en Ajustes, SW con
  handlers de notificación. Instalación PWA en iPhone documentada.
- ✅ **Fase 9** — Despliegue: `vercel.json` (región París), `/api/health`, checklist.
- ⏸️ **Fase 10** — WhatsApp (opcional, solo API oficial; no iniciado por diseño)

Consulta `PROGRESS.md` para el estado exacto y el próximo paso.

## Arranque rápido

```bash
npm install
cp .env.example .env.local      # opcional: NOVA arranca en demo sin esto
npm run dev                     # http://localhost:3000
```

Abre la app y pulsa el núcleo (o pulsa `Cmd/Ctrl+K` para escribir). Prueba:

- «¿Qué tengo mañana?»
- «Añádeme entrenamiento mañana a las 19:30 durante hora y media.»
- «¿Qué huecos tengo mañana?»
- «Apúntame llamar al proveedor el jueves.»
- «Organízame mañana: estudiar una hora, trabajar dos horas y entrenar.»
- «Dame mi briefing.»

Comprueba el estado de integraciones en **`/setup`**.

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | Vitest (unidad + integración) |
| `npm run gen:icons` | Regenera los iconos PNG desde el SVG |

## Documentación

- `IMPLEMENTATION_PLAN.md` — plan por fases
- `PROGRESS.md` — estado detallado + credenciales pendientes + próximo paso
- `DECISIONS.md` — decisiones de arquitectura
- `CLAUDE.md` — guía para agentes que continúen el desarrollo
- `docs/ARCHITECTURE.md`, `docs/VOICE.md`, `docs/SECURITY.md`,
  `docs/GOOGLE_SETUP.md`, `docs/SUPABASE_SETUP.md`, `docs/ANTHROPIC_SETUP.md`,
  `docs/PWA_IOS.md`, `docs/DEPLOYMENT.md`, `docs/WHATSAPP_OPTIONAL.md`

## Stack

Next.js 16 · React 19 · TypeScript strict · Tailwind CSS v4 · Motion · Zustand ·
Zod · Web Audio / Web Speech API · Supabase (previsto) · Google APIs (previsto) ·
Anthropic (previsto) · Vitest · Playwright · Vercel.

Defaults: zona horaria `Europe/Madrid`, idioma `es-ES`, formato 24h, semana desde
lunes, propietario «Señor Carrillo».
