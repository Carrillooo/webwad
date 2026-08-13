# PROGRESS.md

Estado exhaustivo del desarrollo de ZERO. Permite a otra sesión continuar
exactamente donde se quedó.

_Última actualización: **Fases 1–10 completas** + login Supabase (enlace mágico).
Google Calendar/Tasks/Docs/Sheets reales, Supabase con persistencia + login, asistente
Anthropic (tool-calling, con fallback al motor local), Web Push, WhatsApp (API oficial
de Meta) y config de deploy. Todo se activa con credenciales; el demo funciona sin ellas.
43 tests. MVP completo._

## Fases 5–9 (resumen)
- **5 Tasks / 6 Docs+Drive / +Sheets**: providers reales; al conectar Google se
  activan a la vez. La IA puede leer/añadir filas en una **hoja de Google Sheets**
  (p. ej. tus tareas en un Excel → conviértelo a Google Sheet).
- **7 Anthropic**: `AnthropicAssistantProvider` con 15 herramientas; si Anthropic
  falla (p. ej. sin saldo), el endpoint **cae al motor local** automáticamente.
- **8 Web Push**: `/api/push/{subscribe,send}`, `usePush`, botón en Ajustes, VAPID.
- **9 Deploy**: `vercel.json` (región `cdg1`, cabeceras SW/manifest), `/api/health`.

---

## 🚨 URGENTE — credenciales filtradas en GitHub (rotar YA)

El repositorio `Carrillooo/webwad` es **público** y en `main` se subió el fichero
`.env.local` con secretos reales (commit `79f07c1 Add .env.local file`). Ya se ha
quitado del repositorio y `.gitignore` vuelve a cubrirlo, **pero sigue en el
historial de git**, así que todo lo que había ahí debe considerarse comprometido.

Consecuencia ya observada: la `ANTHROPIC_API_KEY` devuelve **401 «API key is
invalid»** (Anthropic revoca automáticamente las claves que detecta en GitHub).
Eso es exactamente lo que hacía que ZERO respondiera en modo básico.

**Hay que rotar, en este orden:**
1. `ANTHROPIC_API_KEY` — console.anthropic.com → API Keys → borrar la vieja y crear otra.
2. `GOOGLE_CLIENT_SECRET` — Google Cloud → Credenciales → restablecer secreto.
3. `SUPABASE_SERVICE_ROLE_KEY` (si el proyecto sigue vivo) y cualquier clave de BD.
4. `TOKEN_ENCRYPTION_KEY` — `openssl rand -base64 32` (al cambiarla hay que volver
   a conectar Google/Outlook: los refresh tokens guardados dejan de descifrarse).
5. `VAPID_PRIVATE_KEY` — `npx web-push generate-vapid-keys` (hay que resuscribir el push).

Las claves nuevas van **sólo** en `.env.local` (local) y en Vercel →
Settings → Environment Variables (producción). Nunca en el repositorio.
Recomendado además: poner el repositorio en **privado**.

## 🔗 Google preconfigurado (sin botón de "Conectar")

ZERO lo usa una sola persona, así que la cuenta de Google puede quedar fija:
se autoriza **una vez** y a partir de ahí entra solo, también tras reiniciar,
redesplegar o quedarse sin base de datos.

```bash
npm run google:token     # abre el navegador, autorizas y te imprime el token
```

Pega lo que imprime en `.env.local` y en Vercel:

```
GOOGLE_ACCOUNT_EMAIL=danielrolmovil@gmail.com
GOOGLE_REFRESH_TOKEN=1//...
```

- El script escucha en el redirect que ya está dado de alta
  (`http://localhost:3000/api/google/callback`), así que **no hay que tocar
  Google Cloud** — pero cierra antes `npm run dev`, que ocupa ese puerto.
- Con `GOOGLE_REFRESH_TOKEN` puesto, Ajustes → Integraciones muestra
  «Siempre enlazado» y desaparece el botón de conectar/desconectar.
- Una conexión hecha a mano (el flujo de siempre) tiene prioridad sobre la
  preconfigurada, así que ambas conviven.
- El access token se cachea en el proceso con 60 s de margen: una llamada a
  Google menos por petición.
- Si el token se revoca, ZERO **no se cae**: degrada a los mocks y deja el
  motivo en la terminal.
- ⚠️ **Pantalla de consentimiento en «Testing» = el token caduca a los 7 días.**
  Google Cloud → APIs y servicios → Pantalla de consentimiento → **Publicar**.
- Ya no hace falta `TOKEN_ENCRYPTION_KEY` para Google (no se guarda nada);
  sigue haciendo falta para Outlook y para el enlace del calendario.

## 📅 Calendario suscribible (iCal)

`GET /api/calendar/feed.ics?token=…` publica la agenda que ve ZERO en formato
iCalendar (RFC 5545) para suscribirse desde iPhone/Mac, Google Calendar u
Outlook. Ventana: 90 días atrás y 365 por delante.

- **Solo lectura.** Quien tenga el enlace ve la agenda; no puede modificarla.
- **El token va en la URL** porque los clientes de calendario piden el enlace
  sin cabeceras de autenticación. Se deriva por HMAC de `CALENDAR_FEED_SECRET`
  (o `TOKEN_ENCRYPTION_KEY`), así que no hace falta tabla y se revocan todos
  los enlaces cambiando ese secreto.
- **El enlace está en Ajustes → Suscribir el calendario**, con botón de copiar
  y un `webcal://` que abre el diálogo de suscripción en Apple.
- Horas en UTC (cada cliente las pasa a su zona) y `VALUE=DATE` en los eventos
  de todo el día, calculado en Madrid — en UTC salían un día antes.
- `UID` estable por evento: al refrescar se actualiza en vez de duplicarse.
- Verificado con `ical.js` (el parser de Thunderbird): 4 eventos leídos con la
  hora correcta de Madrid.

**Cuánto tarda en aparecer un evento nuevo:** lo decide el cliente, no ZERO.
Apple deja elegir (hasta cada 5 min), Outlook ~1 h, y **Google Calendar
refresca las suscripciones cada 8-24 h** — es un límite suyo. Para que en
Google aparezca al instante, lo correcto es conectar Google en ZERO: entonces
escribe directamente en su calendario real.

## 🆕 Última sesión — asistente "todo terreno" (voz real, email, memoria, avisos)

Verificado con `lint` ✅ · `typecheck` ✅ · `test` ✅ (67) · `build` ✅ · captura sin
errores de consola. Lo que **no** se pudo probar en vivo aquí: ElevenLabs,
Open-Meteo, Google y SMTP están **bloqueados por la red del sandbox** (se validan
con `fetch` simulado en tests y en la máquina de Daniel).

1. **Voz ultra-realista (ElevenLabs)** — `/api/tts` hace de proxy (la key nunca
   sale del servidor), modelo `eleven_multilingual_v2`. `useAssistant.speak()`
   la usa primero y **cae a la voz del navegador** si no está configurada o falla
   (y deja de reintentar durante la sesión).
2. **Enviar emails** — herramienta `send_email` + `src/lib/mail/send.ts`
   (nodemailer). ALTO RIESGO: el modelo enseña el borrador y **exige un "sí"**.
   Nunca finge: el recibo sólo es OK si el SMTP aceptó el destinatario.
3. **Memoria personal persistente** — `remember_fact` / `list_memories` /
   `forget_memory` sobre `memory_items` (Supabase) y **se inyecta en el prompt**,
   así ZERO recuerda a Daniel entre conversaciones.
4. **El tiempo** — `get_weather` vía Open-Meteo (sin API key), Madrid, 7 días.
5. **Briefing matinal automático** — `/api/cron/briefing` (cron Vercel 08:00
   Madrid) manda push con agenda + tareas + tiempo.
6. **Avisos 30 min antes** — `/api/cron/reminders` (cada 15 min) con ventana
   [+30, +45) para no repetir aviso.
7. **Barra espaciadora = hablar** (`usePushToTalkKey`) además de las 2 palmadas.
8. **Beep de activación** (`src/lib/sound.ts`), respeta Ajustes → sonidos.
9. **"Deshacer"** y más ejemplos coloquiales en el prompt del calendario.
10. **Hoja de tareas de los trabajadores por defecto**
    (`1ZVRJ1FLYXJ7lphgXS7ipI3ptuGouN5T4tKteEsNgYMA`): la IA la escanea antes de
    escribir, edita **en su sitio** y firma `(by zerodc)`.

También: el motor local ahora dice claramente que está en **«modo básico»** en vez
de «no le he entendido», para distinguir un fallo de IA de un fallo de comprensión.

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

Mientras tanto, ZERO sigue funcionando con los MockProviders.

---

### USER ACTION REQUIRED — SMTP para enviar correo desde daniel@rolmovil.com
- **QUÉ NECESITO:** servidor SMTP, puerto, usuario y contraseña del buzón.
- **DÓNDE:** el panel del proveedor del dominio `rolmovil.com` (Ionos, Hostinger,
  Google Workspace, Microsoft 365…). Si es Gmail/Workspace hay que crear una
  **contraseña de aplicación**, no vale la contraseña normal.
- **VARIABLES .ENV:**
  ```
  SMTP_HOST=
  SMTP_PORT=587
  SMTP_USER=daniel@rolmovil.com
  SMTP_PASS=
  MAIL_FROM=daniel@rolmovil.com
  ```
- **CÓMO COMPROBAR:** pídele a ZERO «manda un correo a X» → enseña borrador →
  dices «sí» → responde con el id del mensaje sólo si el SMTP lo aceptó.

### USER ACTION REQUIRED — ElevenLabs (voz humana)
- **VARIABLES .ENV:** `ELEVENLABS_API_KEY=` (y `ELEVENLABS_VOICE_ID=` si quieres
  otra voz; por defecto "Daniel").
- **CÓMO COMPROBAR:** `GET /api/tts` → `{"configured":true}`. Si falla la síntesis,
  ZERO sigue hablando con la voz del navegador (nunca se queda mudo).

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
