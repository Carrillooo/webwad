# WhatsApp (OPCIONAL — Fase 10)

WhatsApp es **opcional** y **no** debe retrasar el MVP. No se implementa hasta que
las funciones principales (Calendar, voz, tareas, docs) funcionen y hasta que se
solicite explícitamente.

## Reglas

- **Sólo** API oficial de **WhatsApp Business / Meta Cloud API**.
- **Prohibido**: scraping, Puppeteer, automatización de WhatsApp Web u otros métodos
  que puedan bloquear una cuenta.
- Nunca enviar mensajes sin confirmación explícita del usuario.

## Arquitectura preparada

Existe la abstracción `MessagingProvider` (a implementar) para no acoplar la lógica.
Variables previstas (ya en `.env.example`):

```
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
```

## Funciones futuras (cuando se solicite)

- Recibir mensajes permitidos (webhook verificado con `WHATSAPP_VERIFY_TOKEN` y
  firma con `WHATSAPP_APP_SECRET`).
- Resumirlos, detectar fechas y llamadas.
- Crear **propuestas** de Calendar (nunca eventos directos sin confirmar).

Todo el contenido entrante se trata como **UNTRUSTED** (ver `docs/SECURITY.md`).
