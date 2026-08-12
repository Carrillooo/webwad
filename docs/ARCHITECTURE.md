# Arquitectura

## Visión

ZERO es una PWA (Next.js App Router). El cliente renderiza el shell holográfico y
captura voz/texto; el servidor (route handlers) ejecuta el asistente y los
proveedores. Todo lo externo está detrás de interfaces para poder correr 100% en
mocks (demo) y cambiar a implementaciones reales cuando hay credenciales.

```
Voz / Teclado ──► useAssistant ──► POST /api/assistant
                                       │
                                       ▼
                             getAssistant() (mock|anthropic)
                                       │  usa herramientas
                                       ▼
                     getProviders() → Calendar/Tasks/Documents
                                       │
                        (demo) demo/store.ts  |  (real) Google + Supabase
```

## Capas

- **UI** (`components/nova/*`): `NovaCore` (esfera de estados), `Monitor`
  (transforma entre vistas), `TopBar`, `Composer` (teclado + confirmaciones),
  `Settings`. Estado en `lib/store.ts` (Zustand). Los tokens visuales son CSS
  variables retintables en vivo (`useThemeSync`).
- **Voz** (`hooks/useVoice`, `useMicLevel`, `providers/speech`): push-to-talk,
  nivel real de micrófono (Web Audio), STT/TTS del navegador con fallback.
- **API** (`app/api/*`): validación con Zod, nunca devuelve secretos.
- **Asistente** (`providers/assistant`): `MockAssistantProvider` (NLU es-ES,
  orquesta intents→herramientas) hoy; `AnthropicAssistantProvider` con tool-calling
  mañana, sobre la misma capa de herramientas.
- **Proveedores** (`providers/{calendar,tasks,documents}`): interfaces +
  `Mock*` (store en memoria) + `Google*` (previsto).
- **Datos** (`demo/store.ts` hoy; Supabase Postgres + RLS mañana).

## Principios

1. Nunca fingir éxito: un `ActionReceipt` refleja una mutación real.
2. Datos externos = UNTRUSTED (`docs/SECURITY.md`).
3. El modelo sólo actúa por herramientas (Zod + permisos + idempotencia + confirmación).
4. Fecha/zona centralizadas (`lib/datetime.ts`, Europe/Madrid, DST correcto).
5. Preparado para Capacitor (sin dependencias de servidor en el shell).

## Contrato de herramientas

Cada herramienta declara: schema Zod, validación, permisos, usuario propietario,
logging, error handling, idempotency key (cuando aplica) y política de confirmación
según riesgo. Lista completa en `IMPLEMENTATION_PLAN.md`.
