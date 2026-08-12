# PROGRESS.md

Estado exhaustivo del desarrollo de NOVA. Permite a otra sesión continuar
exactamente donde se quedó.

_Última actualización: Fases 1–7 construidas. Google Calendar/Tasks/Docs reales,
Supabase con persistencia (modo un-solo-dueño) y asistente Anthropic con
tool-calling; todo se activa al añadir credenciales. El demo sigue sin ellas._

---

## ✅ Qué funciona (verificado)

- **Arranque en demo sin credenciales.** `DEMO_MODE` está ON por defecto (sólo se
  desactiva con `DEMO_MODE=false`). Badge «DEMO» visible en la UI.
- **UI holográfica** (Fase 1): Home, TopBar con reloj en vivo, Monitor con 7 vistas
  y transiciones blur/scale, Núcleo (esfera energética) con estados, Configuración
  lateral que retinta la UI en vivo, PWA (manifest + SW + iconos + offline).
  Verificado con capturas: fondo oscuro correcto, núcleo renderiza, contraste bien.
- **Voz** (Fase 2): push-to-talk, medidor de micro real (Web Audio), Web Speech
  STT/TTS, fallback por teclado (Composer + `Cmd/Ctrl+K`).
- **Agente NLU en español** (Fase 7 demo, `MockAssistantProvider`), verificado por
  tests y por la UP end-to-end:
  - «¿Qué tengo hoy/mañana/el viernes?» → lista + abre Calendar en el día correcto.
  - «Añádeme entrenamiento mañana a las 19:30 durante hora y media.» → crea evento
    real en el store demo, confirma tras persistir.
  - Detección de **conflictos** → propone alternativa, no crea hasta confirmar.
  - «¿Qué huecos tengo mañana?» → slots libres.
  - «Muéveme…», «Bórrame…» (borrado = confirmación explícita, riesgo alto).
  - Tareas: crear, listar, completar.
  - **Planner**: «Organízame mañana…» → propuesta (riesgo medio) → confirmar → crea.
  - **Briefing** hablado. Documentos: buscar, resumir (extractivo), crear.
  - **Idempotencia**: crear el mismo evento dos veces no duplica.
- **API**: `/api/assistant`, `/api/calendar`, `/api/tasks`, `/api/tasks/mutate`,
  `/api/documents`, `/api/briefing`, `/api/capabilities`, `/api/preferences`,
  `/api/memory`, `/api/google/{authorize,callback,status,disconnect}`. `/setup` operativo.
- **Calidad**: `lint` ✅, `typecheck` ✅, `test` ✅ (40 tests), `build` ✅.

### Fase 3 — Supabase (construida; se activa con credenciales)
- Migración `supabase/migrations/0001_init.sql`: las 12 tablas con RLS estricto,
  FKs a `auth.users`, índices, timestamps, triggers `updated_at`. `oauth_credentials`
  queda sin políticas de cliente → sólo accesible con service_role.
- Cliente server (`src/lib/supabase/server.ts`), cifrado de tokens AES-256-GCM
  (`src/lib/crypto/tokens.ts`), resolución de usuario (`src/lib/auth.ts`).
- `StorageProvider` (Supabase ↔ memoria) para preferencias y **memoria controlada**
  (`/api/preferences`, `/api/memory`: remember/forget/list). Fallback a local/memoria
  cuando no hay sesión.

### Fase 4 — Google Calendar real (construida; se activa con credenciales)
- OAuth 2.0 oficial en backend: `src/lib/google/oauth.ts` (+ `state.ts` firmado HMAC).
- Conexión y **refresh token cifrado** en reposo (`src/lib/google/connection.ts`;
  Supabase para usuarios autenticados, memoria para demo). Refresco automático del
  access token.
- `GoogleCalendarProvider` (REST oficial): list/get/create/update/move/delete,
  freeBusy, conflictos, idempotencia por id determinista, conferencia opcional.
- Factory `resolveProviders(userId, authed)`: usa Google real cuando está conectado
  y configurado; si no, mocks (nunca lanza; degrada al mock). El asistente y las
  rutas ya reciben providers inyectados.
- UI: sección **Integraciones** en Configuración (Conectar/Desconectar Google).

### Fase 5 — Google Tasks real ✅ (se activa con conexión Google)
- `GoogleTasksProvider` (Tasks API oficial): listas, listar, crear, actualizar,
  completar, reabrir, borrar. `due` como fecha (Tasks no guarda hora). Enchufado en
  `resolveProviders` junto a Calendar.

### Fase 6 — Google Drive + Docs real ✅ (se activa con conexión Google)
- `GoogleDocumentsProvider` (Drive + Docs API): buscar, recientes, leer (extrae
  texto — UNTRUSTED), crear, append, update con confirmación de sobrescritura.

### Fase 7 — Asistente Anthropic (conversacional, tool-calling) ✅ (con API key)
- `AnthropicAssistantProvider`: bucle agéntico con Claude y 12 herramientas
  (datetime, calendar CRUD + disponibilidad, tasks, docs) ejecutadas contra los
  providers reales/mock. `getAssistant` usa Anthropic si hay `ANTHROPIC_API_KEY`,
  si no el mock NLU. System prompt con seguridad: no fingir éxito, datos externos
  UNTRUSTED, confirmaciones por riesgo, conflictos. Conversación multi-turno nativa.

## ⚠️ Qué falta para producción (faltan credenciales o fases posteriores)

- **Credenciales**: sin `GOOGLE_*` + `TOKEN_ENCRYPTION_KEY` no hay Calendar real;
  sin `SUPABASE_*` la persistencia es en memoria/local. El código ya está listo:
  al ponerlas y `DEMO_MODE=false`, `resolveProviders` usa Google real.
- **Supabase Auth (UI de login)**: falta la pantalla de login (magic link). Hoy
  `resolveUser` devuelve el usuario demo salvo que llegue un `sb-access-token`
  válido. Con login, la persistencia por usuario (RLS) se activa sola.
- **Google Tasks/Drive/Docs reales**: Fases 5/6 (Calendar ya es real). El factory
  devuelve mocks de tasks/documents aunque Google esté conectado.
- **Anthropic real**: usa el `MockAssistantProvider` (NLU local); tool-calling listo
  para enchufar `AnthropicAssistantProvider`.
- **Web Push**: SW preparado pero sin backend VAPID.

## 🐛 Bugs conocidos / notas

- El store demo del servidor vive en `globalThis` → sobrevive a hot-reload pero se
  reinicia al reiniciar el proceso (aceptable en demo).
- Web Speech STT no existe en algunos navegadores (p. ej. Firefox); la UI cae a
  teclado automáticamente (probar mensaje de aviso en producción).
- El resumen de documentos es extractivo simple (demo); el real usará Anthropic.

## 🗂️ Archivos principales

- Núcleo visual: `src/components/nova/NovaCore.tsx`
- Monitor + vistas: `src/components/nova/Monitor.tsx`, `.../views/*`
- Estado: `src/lib/store.ts` (zustand)
- Cerebro demo: `src/lib/providers/assistant/mock.ts`
- NLU fechas ES: `src/lib/nlu/spanish-datetime.ts`
- Fechas/timezone: `src/lib/datetime.ts` (Europe/Madrid, DST)
- Proveedores: `src/lib/providers/*`
- Voz: `src/hooks/useVoice.ts`, `useMicLevel.ts`, `src/lib/providers/speech/browser.ts`
- Config/capacidades: `src/lib/config.ts`, `/setup`

## 🔑 Credenciales pendientes → USER ACTION REQUIRED

### USER ACTION REQUIRED — Google Cloud (Calendar/Tasks/Drive/Docs)
- **SERVICIO:** Google Cloud Console.
- **QUÉ NECESITO:** OAuth Client ID + Client Secret (aplicación web).
- **POR QUÉ:** Conectar tu Google real para leer/crear eventos, tareas y documentos.
- **DÓNDE CONSEGUIRLO:** https://console.cloud.google.com/apis/credentials
- **PASOS EXACTOS:**
  1. Crea o selecciona un proyecto en Google Cloud Console.
  2. «APIs y servicios» → «Biblioteca»: habilita Google **Calendar API**,
     **Tasks API**, **Drive API** y **Docs API**.
  3. «Pantalla de consentimiento OAuth»: tipo *External*; añádete como usuario de prueba.
  4. «Credenciales» → «Crear credenciales» → «ID de cliente OAuth» → *Aplicación web*.
  5. URI de redirección autorizado: `http://localhost:3000/api/google/callback`
     (y el equivalente de producción cuando despliegues).
  6. Copia el **Client ID** y el **Client Secret**.
  7. Genera la clave de cifrado de tokens: `openssl rand -base64 32`.
- **VARIABLES .ENV:**
  ```
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
  TOKEN_ENCRYPTION_KEY=
  DEMO_MODE=false
  ```
- **CÓMO COMPROBAR:** abre `/setup` → «Google OAuth» debe aparecer **READY**.
  Luego conecta la cuenta desde Configuración (flujo OAuth, Fase 4).

### USER ACTION REQUIRED — Supabase (Auth + BD)
- **SERVICIO:** Supabase.
- **QUÉ NECESITO:** Project URL, anon key y service_role key.
- **POR QUÉ:** Auth, preferencias, memoria, sesiones, logs y tokens cifrados por usuario.
- **DÓNDE CONSEGUIRLO:** https://supabase.com/dashboard → tu proyecto → Settings → API.
- **PASOS EXACTOS:**
  1. Crea un proyecto en Supabase.
  2. Settings → API: copia *Project URL* y *anon public key*.
  3. Copia también *service_role* key (sólo backend, nunca al cliente).
  4. Aplica las migraciones (se añadirán en `supabase/migrations` en Fase 3).
- **VARIABLES .ENV:**
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  ```
- **CÓMO COMPROBAR:** `/setup` → «Supabase» = READY.

### USER ACTION REQUIRED — Anthropic (IA real)
- **SERVICIO:** Anthropic Console.
- **QUÉ NECESITO:** una API key.
- **POR QUÉ:** usar Claude con tool-calling en vez del asistente demo.
- **DÓNDE CONSEGUIRLO:** https://console.anthropic.com/settings/keys
- **PASOS EXACTOS:** inicia sesión → Settings → API Keys → crea una → cópiala.
- **VARIABLES .ENV:**
  ```
  ANTHROPIC_API_KEY=
  ANTHROPIC_MODEL=claude-opus-4-8
  DEMO_MODE=false
  ```
- **CÓMO COMPROBAR:** `/setup` → «Anthropic» = READY.

Mientras tanto, NOVA sigue funcionando con los MockProviders.

---

## NEXT SESSION

**Orden exacta para continuar:** «Completa la Fase 5 (Google Tasks real:
`GoogleTasksProvider` vía Tasks API con estrategia de hora vía notas/Calendar) y
la Fase 6 (`GoogleDocumentsProvider` con Drive+Docs API: buscar, recientes, leer,
crear, append, update con confirmación, resumir), enchúfalos en
`resolveProviders` junto al `GoogleCalendarProvider`. Luego añade la UI de login de
Supabase (magic link) para que `resolveUser` devuelva el usuario real y active RLS,
y el `AnthropicAssistantProvider` (tool-calling) sobre los providers inyectados.»

Antes de empezar: `npm install && npm run dev`, abre `/setup`. Para probar Google:
rellena `GOOGLE_*` + `TOKEN_ENCRYPTION_KEY`, `DEMO_MODE=false`, y conecta desde
Configuración → Integraciones. Ejecuta `npm run lint && npm run typecheck && npm test`.
