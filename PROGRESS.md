# PROGRESS.md

Estado exhaustivo del desarrollo de ZERO. Permite a otra sesión continuar
exactamente donde se quedó.

_Última actualización: **«Continuar con Google/Microsoft», correo propio y
calendario de Outlook**. Entrar con Google u Outlook crea la cuenta y deja la
integración enlazada en un solo viaje; `send_email` sale desde el Gmail/Outlook
del PROPIO usuario (el SMTP compartido queda como último recurso); y con solo
Outlook conectado su calendario real (Graph) sustituye al mock. Todo lo
anterior sigue: multiusuario SaaS, ZERO Pro 20 €/mes con 14 días de prueba y
paywall (la pasarela de pago sigue siendo lo ÚNICO que falta), datos por
cuenta, crons multiusuario, iCal por usuario, WhatsApp. 147 tests._

## 🆕 Última sesión (5) — Historial, atajos y accesibilidad

- **Historial de conversaciones**: las tablas `assistant_sessions` /
  `assistant_messages` existían sin usar y al recargar se perdía todo. Ahora
  cada turno se guarda **después** de responder y sin esperar (latencia
  intacta). Monitor → **Historial** tiene dos pestañas: *Conversaciones*
  (agrupadas: los turnos seguidos van juntos; si pasan +2 h se abre una nueva,
  con «Hoy/Ayer», despliegue de la charla y botón de borrar todo) y
  *Actividad* (los recibos de siempre). API: `/api/conversations` (GET/DELETE).
- **Atajos en la pantalla de inicio**: cuatro sugerencias pulsables
  («¿Qué tengo hoy?», «¿Qué huecos tengo mañana?»…) para quien abre ZERO y no
  sabe qué decir. Van por un evento (`nova:ask`) que NovaApp convierte en una
  petición, igual que si se hubiera dicho en voz alta. En móvil se reservó
  hueco abajo: la piedra los tapaba y se comía el toque.
- **Accesibilidad** (Ajustes → Accesibilidad): **tamaño del texto** en tres
  pasos (mueve el tamaño base, así que escala TODA la interfaz —botones y
  espacios incluidos— porque Tailwind mide en rem) y **alto contraste**
  (grises secundarios casi negros, bordes marcados, sin brillos ni cuadrícula).
  Ambos persisten por usuario. 6 tests nuevos (172 en total).

## Sesión anterior — Calendarios enlazados por iCal

- **Ajustes → Otros calendarios**: se enlaza cualquier calendario por su URL
  iCal (iCloud público, otro Google compartido, festivos, Calendly, horarios…;
  `webcal://` se convierte solo). Sus eventos aparecen en el calendario de
  ZERO **en solo lectura** y cuentan al buscar huecos (freeBusy).
- Piezas: parser ICS propio (`ics-parse.ts`: plegado, escapes, TZID vía Intl,
  VALUE=DATE, RRULE DAILY/WEEKLY/MONTHLY/YEARLY con INTERVAL/COUNT/UNTIL/
  BYDAY, expansión limitada a la ventana con tope), `calendar/external.ts`
  (tabla `external_calendars` + memoria, fetch con guardas SSRF —localhost e
  IPs privadas bloqueadas—, 2 MB máx., caché 10 min) y
  `MergedCalendarProvider` (envuelve Google/Outlook/mock; ids `ext:` no se
  pueden editar). Ruta guardada `/api/external-calendars` que comprueba el
  enlace EN EL ALTA (nada de enlaces muertos). Máx. 10 por usuario. 8 tests.

## Sesión anterior — ZERO llama por teléfono (Twilio)

- **«Llama a la peluquería y pide cita el viernes por la tarde»**: herramienta
  `make_phone_call` (ALTO RIESGO: repite número+objetivo y exige un "sí")
  y `list_phone_calls`. La llamada la hace Twilio y ZERO conversa por turnos:
  Gather de voz es-ES ↔ cerebro Anthropic (salida forzada JSON: frase, done,
  resultado) ↔ voz Polly.Lucia. Al colgar, push con el resultado.
- Piezas: `src/lib/twilio/` (store BD+memoria con tabla `phone_calls`, firma
  X-Twilio-Signature validada en tiempo constante, REST sin SDK, TwiML con
  escape XML, cerebro con reglas de llamada) + rutas `/api/calls` (guardada,
  rate limit 4 llamadas/10 min por usuario) y `/api/twilio/{voice,status}`
  (públicas pero SOLO con firma válida y CallSid propio). Tope de 5 min por
  llamada (TimeLimit) y 30 turnos.
- Sin Twilio configurado el asistente lo dice claro y no finge llamar.
- ⚠️ Cuenta de prueba de Twilio: solo llama a números verificados y mete una
  locución inicial; para llamar a cualquiera hay que cargar saldo.

## Sesión anterior — Admin, legal, monitorización y estreno limpio

- **Panel `/admin`** (solo cuenta máster; enlace en Ajustes → Cuenta): lista de
  cuentas con métricas (total/activas/prueba/caducadas) y acciones Activar
  (pago sin caducidad), Cortar (paywall ya), +14 días y Borrar (todo en
  cascada). La máster no puede tocarse a sí misma. API: `/api/admin/users`.
- **Reseteo total** `POST /api/admin/reset` con `Authorization: Bearer
  $CRON_SECRET`: vacía TODAS las cuentas y datos (incluido el dueño legado).
  La siguiente cuenta que entre —p. ej. con Google— es la máster. La herencia
  `adoptLegacyOwnerData` se ha eliminado del código: estreno limpio.
- **Legal**: `/legal/terminos` y `/legal/privacidad` (con cláusula de Uso
  Limitado de datos de Google — requisito para la verificación de la app en
  Google Cloud), enlazadas desde la pantalla de entrada.
- **Monitorización**: los errores de JavaScript del navegador se mandan a
  `POST /api/log` (rate limit por IP) y quedan en los logs de Vercel con
  prefijo `[client-error]`. Recomendado además: UptimeRobot (gratis) sobre
  `/api/health` y Sentry cuando haya cuenta.

## Sesión anterior — Entrar con Google/Microsoft, correo propio, calendario Outlook

- **«Continuar con Google» / «Continuar con Microsoft»** en la pantalla de
  entrada (`/api/auth/{google,microsoft}/start`). Reutilizan los callbacks de
  siempre con `login:true` en el `state` firmado (no hay que registrar URIs
  nuevas). El callback crea la cuenta si no existe (fundador/prueba igual que
  el registro normal), abre sesión y **guarda la conexión** del proveedor: un
  solo consentimiento deja calendario, tareas, documentos y correo enlazados.
  Cuentas OAuth no tienen contraseña (`password_hash` ya es nullable).
- **`send_email` envía desde el correo del PROPIO usuario**
  (`src/lib/mail/user-mail.ts`): Gmail API (`gmail.send`) → Graph
  `/me/sendMail` (`Mail.Send`) → SMTP del servicio si existe → fallo honesto
  pidiendo conectar una cuenta. El prompt dice el remitente real
  (`ctx.mailFrom`) y el borrador+confirmación siguen siendo obligatorios.
  ⚠️ Conexiones de Google hechas ANTES de este cambio no tienen el permiso
  `gmail.send`: hay que desconectar y volver a conectar Google en Ajustes.
- **Calendario de Outlook** (`MicrosoftCalendarProvider`, Graph
  calendarView/events): con Outlook conectado y sin Google, es el calendario
  real de ZERO — al enlazar la cuenta aparecen todos los eventos que ya tenía.
  Idempotencia por título+comienzo, día completo datado en Madrid, freeBusy
  para conflictos. Con solo Outlook, las herramientas de Google Tasks/Docs se
  niegan con honestidad (sugieren Outlook o conectar Google) en vez de fingir.
- **Caché de memoria por usuario**: la caché de 20 s del prompt era global y
  podía mezclar recuerdos entre cuentas; ahora va con clave por usuario.
- Azure necesita AHORA los permisos delegados: `Tasks.ReadWrite`,
  `offline_access`, `Calendars.ReadWrite`, `Mail.Send` (+ `User.Read`).
  Google Cloud: habilitar **Gmail API** y añadir el scope `gmail.send` a la
  pantalla de consentimiento.

## Sesión anterior — ZERO multiusuario, listo para vender (sólo falta la pasarela)

Pivote a SaaS pedido por Adrián: cuentas propias, nada compartido entre usuarios.

- **Cuentas y sesiones** (`src/lib/auth/users.ts` + `/api/auth/{register,login,logout,me}`):
  contraseñas con **scrypt** (`v1:salt:hash`), sesiones opacas con el token
  **hasheado (SHA-256)** en BD y cookie httpOnly `zero_session` (60 días). Rate
  limit por IP (6 registros/min, 10 logins/min). Tablas `auth_users` y
  `auth_sessions` se crean solas (idempotente) en Vercel Postgres.
- **La primera cuenta registrada = fundadora**: `is_owner`, suscripción `active`
  para siempre y **hereda todos los datos del dueño anterior** (conexiones
  Google/Outlook, memoria, preferencias, push… — `adoptLegacyOwnerData` migra el
  `user_id` legado en las 11 tablas). Adrián debe registrarse EL PRIMERO tras el
  deploy. Las demás cuentas: **14 días de prueba** y después paywall.
- **Plan único ZERO Pro — 20 €/mes** (`PLAN` en `users.ts`). Sin pasarela: para
  cobrar de momento se activa a mano (`update auth_users set
  subscription_status='active' where email='...'`). La pantalla de paywall ya
  existe con el botón «Suscribirme» deshabilitado («muy pronto»).
- **Guardia de API** (`src/lib/api-guard.ts`): con BD y sin `DEMO_MODE`, toda
  ruta de datos exige sesión → `401 auth_required` / `402 subscription_required`.
  Sin BD (desarrollo) la app queda abierta en modo demo como siempre.
- **UI**: `AuthScreen` (entrar/crear cuenta + tarjeta del plan), `PaywallScreen`,
  sección **Cuenta** en Ajustes (nombre, email, plan, estado, cerrar sesión) y
  saludo con el nombre del usuario. Gate en `NovaApp` vía `useAccount`.
- **Aislamiento real por usuario**: conexiones Google/Outlook, memoria,
  preferencias, push, iCal (`/api/calendar/feed.ics?u=<id>&token=…` con HMAC por
  usuario) y crons (briefing/recordatorios iteran las cuentas facturables con
  push activo). El WhatsApp entrante se enruta a la cuenta fundadora.
- **Fuera lo preconfigurado**: eliminados `GOOGLE_REFRESH_TOKEN`/cuenta fija (y
  `scripts/google-token.mjs`), el Excel por defecto `1ZVRJ…` (ahora
  `TASKS_SPREADSHEET_ID` es opcional; sin él la IA busca la hoja por nombre en el
  Drive del usuario), el correo fijo de Daniel (SMTP opcional, `MAIL_FROM` cae a
  `SMTP_USER`, el remitente muestra el nombre de la cuenta) y los restos de
  Supabase. El prompt del asistente ya no dice «Daniel»: usa el nombre de la
  cuenta.

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
3. `MICROSOFT_CLIENT_SECRET` — se pegó un secreto en el chat de esta sesión:
   Azure → Certificates & secrets → crear otro y borrar el viejo (tras verificar
   que Outlook conecta).
4. `ELEVENLABS_API_KEY` — también se pegó en el chat en su día.
5. `TOKEN_ENCRYPTION_KEY` — `openssl rand -base64 32` (al cambiarla hay que volver
   a conectar Google/Outlook: los refresh tokens guardados dejan de descifrarse).
6. `VAPID_PRIVATE_KEY` — `npx web-push generate-vapid-keys` (hay que resuscribir el push).

Las claves nuevas van **sólo** en `.env.local` (local) y en Vercel →
Settings → Environment Variables (producción). Nunca en el repositorio.
Recomendado además: poner el repositorio en **privado**.

## 🔊 Voz fija, de hombre y en español de España

- **ElevenLabs**: la voz se elige en Ajustes → Voz de ZERO (lista sacada de la
  cuenta con `/api/tts/voices`) y se guarda en `ttsVoiceId`, así suena
  EXACTAMENTE igual en el móvil, en el Mac y en el PC. `ELEVENLABS_VOICE_ID`
  sigue siendo el valor por defecto del servidor.
- **Voz del navegador** (repuesto): la elección ahora es determinista y
  prefiere hombre en `es-ES`. Antes el navegador elegía por su cuenta y en un
  Mac salía "Paulina" (mexicana, mujer); ahora sale "Jorge", y en Edge
  "Álvaro Online (Natural)". A igualdad de puntos gana el nombre menor, así no
  cambia entre recargas.
- Cubierto por tests con las voces reales de macOS y de Edge.

## 🔗 Google y Outlook: cada usuario conecta su cuenta

Ya **no existe** la cuenta de Google preconfigurada (`GOOGLE_REFRESH_TOKEN`,
`GOOGLE_ACCOUNT_EMAIL`, `npm run google:token` — todo eliminado): era
incompatible con vender la app, porque todos los usuarios compartían el mismo
Google. Ahora cada cuenta conecta la suya desde Ajustes → Integraciones y el
refresh token se guarda **cifrado (AES-256-GCM) por usuario** en Postgres.

- El `redirect_uri` se deriva del origen de la petición (`x-forwarded-host`),
  así el mismo deploy funciona en localhost y en Vercel sin tocar variables.
- Si un token se revoca, ZERO **no se cae**: degrada a los mocks y la sección
  Estado + `/api/google/status` dicen el motivo exacto.
- ⚠️ **Pantalla de consentimiento en «Testing» = el token caduca a los 7 días.**
  Google Cloud → APIs y servicios → Pantalla de consentimiento → **Publicar**.
- `TOKEN_ENCRYPTION_KEY` es obligatoria para guardar conexiones (Google y
  Outlook) y firma también el enlace del calendario.

## 📅 Calendario suscribible (iCal)

`GET /api/calendar/feed.ics?u=<usuario>&token=…` publica la agenda de ESA cuenta
en formato iCalendar (RFC 5545) para suscribirse desde iPhone/Mac, Google
Calendar u Outlook. Ventana: 90 días atrás y 365 por delante. El token es un
HMAC **por usuario**: el enlace de uno no sirve para ver la agenda de otro.

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

## Sesión anterior — asistente "todo terreno" (voz real, email, memoria, avisos)

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
10. **Hoja de tareas**: la IA la escanea antes de escribir, edita **en su sitio**
    y firma `(by zerodc)`. (El ID fijo por defecto se retiró en el pivote SaaS:
    ahora `TASKS_SPREADSHEET_ID` es opcional y sin él se busca por nombre en el
    Drive del usuario conectado.)

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

## ⚠️ Qué falta para salir al mercado

- **La pasarela de pago** (Stripe o similar) — lo ÚNICO pendiente de código. El
  plan, el trial, el paywall y los estados ya existen; sólo falta cambiar el
  botón «Suscribirme — muy pronto» por el checkout y marcar
  `subscription_status='active'` al cobrar. Hasta entonces, activación manual en
  la BD.
- **Rotar las credenciales filtradas** (sección URGENTE de arriba) — sin la
  `ANTHROPIC_API_KEY` nueva la IA responde en modo básico.
- **Azure**: para Outlook faltan los permisos delegados `Tasks.ReadWrite`,
  `offline_access`, `Calendars.ReadWrite` y `Mail.Send` (hoy sólo tiene
  `User.Read`) y corregir el redirect de localhost a `/api/microsoft/callback`.
- **Google Cloud**: habilitar la **Gmail API** (además de Calendar/Tasks/
  Drive/Docs/Sheets) y añadir el scope `gmail.send` en la pantalla de
  consentimiento. Quien conectó Google antes debe desconectar y reconectar
  para poder enviar correo.
- **Pantalla de consentimiento de Google en «Publicar»** para que los refresh
  tokens de los clientes no caduquen a los 7 días.

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
     **Tasks API**, **Drive API**, **Docs API**, **Sheets API** y **Gmail API**
     (Gmail para que ZERO envíe correo desde la cuenta del usuario).
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

### USER ACTION REQUIRED — Base de datos (Vercel Postgres / Neon) ✅ HECHO
- **SERVICIO:** Vercel → Storage → Create Database → Neon (Postgres).
- **POR QUÉ:** cuentas, sesiones, conexiones OAuth cifradas, memoria, preferencias
  y push por usuario. El esquema se crea solo al arrancar (idempotente).
- **VARIABLES .ENV:** `DATABASE_URL` (la integración de Vercel la pone sola).
- **CÓMO COMPROBAR:** Ajustes → Estado → «PostgreSQL conectado · persistencia
  activa». Con BD y `DEMO_MODE=false`, la app pide login (multiusuario ON).

### USER ACTION REQUIRED — Anthropic (IA real)
- **SERVICIO:** Anthropic Console.
- **QUÉ NECESITO:** una API key.
- **POR QUÉ:** usar Claude con tool-calling en vez del asistente demo.
- **DÓNDE CONSEGUIRLO:** https://console.anthropic.com/settings/keys
- **PASOS EXACTOS:** inicia sesión → Settings → API Keys → crea una → cópiala.
- **VARIABLES .ENV:**
  ```
  ANTHROPIC_API_KEY=
  ANTHROPIC_MODEL=claude-sonnet-5
  DEMO_MODE=false
  ```
- ⚠️ La key actual está **revocada** (se filtró en GitHub): hay que crear una
  nueva o la IA seguirá en modo básico.
- **CÓMO COMPROBAR:** `/setup` → «Anthropic» = READY.

Mientras tanto, ZERO sigue funcionando con los MockProviders.

---

### USER ACTION REQUIRED — SMTP para `send_email` (OPCIONAL)
- **QUÉ NECESITO:** servidor SMTP, puerto, usuario y contraseña de un buzón
  cualquiera (Gmail/Workspace exige **contraseña de aplicación**).
- Es un buzón **del servicio** (uno para toda la app); el remitente muestra el
  nombre de la cuenta que envía. Sin SMTP la herramienta responde con un fallo
  claro, nunca finge.
- **VARIABLES .ENV:**
  ```
  SMTP_HOST=
  SMTP_PORT=587
  SMTP_USER=
  SMTP_PASS=
  MAIL_FROM=   # opcional; sin él se envía desde SMTP_USER
  ```
- **CÓMO COMPROBAR:** pídele a ZERO «manda un correo a X» → enseña borrador →
  dices «sí» → responde con el id del mensaje sólo si el SMTP lo aceptó.

### USER ACTION REQUIRED — ElevenLabs (voz humana)
- **VARIABLES .ENV:** `ELEVENLABS_API_KEY=` (y `ELEVENLABS_VOICE_ID=` si quieres
  otra voz; por defecto "Daniel").
- **CÓMO COMPROBAR:** `GET /api/tts` → `{"configured":true}`. Si falla la síntesis,
  ZERO sigue hablando con la voz del navegador (nunca se queda mudo).

## NEXT SESSION

**Orden exacta para continuar:** «Añade la pasarela de pago con **Stripe**
(Checkout en modo suscripción, 20 €/mes, webhook `checkout.session.completed` /
`customer.subscription.deleted` que actualice `auth_users.subscription_status`,
botón real en `PaywallScreen` y portal de cliente para cancelar). Mantén la
activación manual en BD como vía de emergencia. Después: página de marketing /
landing pública y textos legales (privacidad, condiciones) antes de vender.»

Notas para esa sesión:
- La primera cuenta registrada es la fundadora (`is_owner`, activa para siempre)
  y hereda los datos del dueño legado; NO tocar esa lógica al meter Stripe.
- `subscriptionOf()` en `src/lib/auth/users.ts` es el único sitio que decide
  trial/active/expired — enchufar Stripe ahí.
- El paywall devuelve `402 subscription_required` desde `guardApi`; el frontend
  ya lo pinta (`useAccount.gate === "paywall"`).

Antes de empezar: `npm install && npm run dev`, abre `/setup`. Para probar Google:
rellena `GOOGLE_*` + `TOKEN_ENCRYPTION_KEY`, `DEMO_MODE=false`, y conecta desde
Configuración → Integraciones. Ejecuta `npm run lint && npm run typecheck && npm test`.
