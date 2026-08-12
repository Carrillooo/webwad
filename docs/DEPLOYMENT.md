# Despliegue (Vercel)

## Requisitos

- Repo en GitHub. Proyecto en Vercel apuntando a este repo.
- Node 20+ (Vercel lo gestiona). Framework: **Next.js** (autodetectado).

## Variables de entorno (Vercel → Settings → Environment Variables)

Copia las de `.env.example`. Para producción real:

```
APP_URL=https://TU-DOMINIO
NEXT_PUBLIC_APP_URL=https://TU-DOMINIO
DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://TU-DOMINIO/api/google/callback
TOKEN_ENCRYPTION_KEY
ANTHROPIC_API_KEY / ANTHROPIC_MODEL
NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT   # push (Fase 8)
```

> Puedes desplegar en **DEMO_MODE=true** para una demo pública sin credenciales.

## Pasos

1. `Import Project` en Vercel.
2. Añade las variables de entorno.
3. Deploy. Vercel ejecuta `next build`.
4. Actualiza el **redirect URI** de Google con el dominio de producción.
5. Configura el dominio y verifica HTTPS (necesario para PWA/micrófono).

## Checklist de release

- `npm run lint && npm run typecheck && npm test` en verde.
- `npm run build` sin errores.
- QA en iPhone (instalación PWA, micrófono, voz, safe areas).
- Revisión de seguridad (RLS, secretos sólo backend, prompt-injection).
- Performance: 60 FPS en interacciones; partículas degradan con
  `prefers-reduced-motion`, batería/tab oculto o «efectos reducidos».
