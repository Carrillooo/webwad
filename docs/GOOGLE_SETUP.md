# Google Setup (Calendar / Tasks / Drive / Docs)

Sigue estos pasos para conectar tu Google real. Mientras tanto, ZERO usa mocks.

## 1. Proyecto y APIs

1. Entra en https://console.cloud.google.com/ y crea o selecciona un proyecto.
2. «APIs y servicios» → «Biblioteca». Habilita:
   - **Google Calendar API**
   - **Google Tasks API**
   - **Google Drive API**
   - **Google Docs API**

## 2. Pantalla de consentimiento OAuth

1. «APIs y servicios» → «Pantalla de consentimiento OAuth».
2. Tipo de usuario: **External**. Rellena nombre de app, correo de soporte y logo opcional.
3. Ámbitos (scopes): añade sólo los necesarios:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/tasks`
   - `https://www.googleapis.com/auth/drive`  (o `drive.file` si prefieres mínimo)
   - `https://www.googleapis.com/auth/documents`
4. Añade tu correo como **usuario de prueba**.

## 3. Credenciales

1. «Credenciales» → «Crear credenciales» → «ID de cliente de OAuth».
2. Tipo: **Aplicación web**.
3. URIs de redirección autorizados:
   - `http://localhost:3000/api/google/callback`
   - `https://TU-DOMINIO/api/google/callback` (producción)
4. Copia **Client ID** y **Client Secret**.

## 4. Cifrado de tokens

```bash
openssl rand -base64 32   # → TOKEN_ENCRYPTION_KEY
```

## 5. Variables `.env.local`

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
TOKEN_ENCRYPTION_KEY=...
DEMO_MODE=false
```

## 6. Comprobar

- `/setup` → «Google OAuth» = **READY**.
- (Fase 4) Conecta la cuenta desde Configuración; ZERO guardará el refresh token
  cifrado en backend y usará `GoogleCalendarProvider` en vez del mock.

## Seguridad

Los secretos y el refresh token nunca se envían al frontend. Ver `docs/SECURITY.md`.
