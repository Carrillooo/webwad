# IMPLEMENTATION_PLAN.md

Plan por fases para NOVA. El orden prioriza funcionamiento real y seguridad.

## Fase 0 — Foundation ✅
- Next.js 16 + React 19 + TS strict + Tailwind v4.
- Estructura de carpetas, design tokens (CSS variables), `.env.example`.
- Documentación base. Vitest configurado.

## Fase 1 — JARVIS UI ✅
- Home (resumen calmado), TopBar (saludo/fecha/hora/estado/DEMO/config).
- Monitor holográfico transformable con transiciones (blur/scale/opacity).
- Núcleo NOVA (esfera energética) con 10 estados.
- Vistas: Calendar (timeline día), Tasks, Documents, Planner, Briefing, History.
- Configuración lateral con tokens en vivo (tema/colores/glow/partículas/voz).
- PWA base: manifest, service worker, iconos, offline shell, safe-areas.
- Responsive mobile-first, accesibilidad (teclado, ARIA, reduced-motion).

## Fase 2 — Voice ✅
- Push-to-talk sobre el núcleo. Web Audio API → nivel real de micrófono.
- `SpeechToTextProvider` (Web Speech) + fallback a teclado.
- `TextToSpeechProvider` (SpeechSynthesis) con voz/velocidad/volumen configurables.
- Estados visuales: listening/transcribing/thinking/executing/speaking/success.
- No se almacenan grabaciones.

## Fase 3 — Supabase ⏳ (requiere credenciales)
- Auth, Postgres, RLS, migraciones. Tablas: profiles, user_preferences,
  integration_connections, oauth_credentials (cifrado), assistant_sessions,
  assistant_messages, tool_executions, action_receipts, memory_items,
  notifications, push_subscriptions, audit_logs.
- Persistir preferencias/memoria/logs por usuario. Nada cross-user.

## Fase 4 — Google Calendar ⏳ (requiere credenciales)
- OAuth 2.0 (backend), refresh token cifrado.
- `GoogleCalendarProvider`: list/get/create/update/move/delete, freeBusy,
  conflictos, undo. Sustituye al mock cuando el usuario conecta.

## Fase 5 — Google Tasks ⏳
- `GoogleTasksProvider` real. Estrategia para horas (Tasks sólo guarda fecha):
  usar notas o crear evento en Calendar.

## Fase 6 — Docs + Drive ⏳
- `GoogleDocumentsProvider`: buscar, recientes, leer, crear, append, update
  (con confirmación de sobrescritura), resumir (ejecutivo/puntos/tareas/fechas/
  decisiones/personas). Contenido = UNTRUSTED.

## Fase 7 — AI Agent ⏳ (demo funcionando; falta Anthropic real)
- `AnthropicAssistantProvider` con tool-calling sobre la misma capa de herramientas.
- Herramientas con Zod + permisos + idempotencia + confirmation policy.
- Planner, briefing, memoria (remember/forget/list), defensa prompt-injection.
- El `MockAssistantProvider` ya implementa toda la lógica de orquestación en demo.

## Fase 8 — PWA avanzada ⏳
- Instalación iPhone (documentada), Web Push (VAPID), offline shell, QA móvil.

## Fase 9 — Production ⏳
- Testing (unit/e2e/Playwright), auditoría de seguridad, performance (60 FPS,
  degradación de partículas), despliegue en Vercel.

## Fase 10 — WhatsApp ⏸️ (opcional)
- Sólo API oficial de WhatsApp Business/Meta. No iniciar hasta petición explícita.

## Herramientas del agente (contrato)
`get_current_datetime, get_user_profile, get_user_preferences,
update_user_preferences, get_daily_briefing, list_calendars, list_calendar_events,
get_calendar_event, check_calendar_availability, create_calendar_event,
update_calendar_event, delete_calendar_event, list_task_lists, list_tasks,
create_task, update_task, complete_task, delete_task, search_drive_files,
get_google_document, create_google_document, append_google_document,
update_google_document, summarize_document` — cada una con Zod, validación,
permisos, propietario, logging, error handling, idempotencia y confirmation policy.
