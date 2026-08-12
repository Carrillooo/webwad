# Supabase Setup (Auth + Postgres)

## 1. Proyecto

1. Crea un proyecto en https://supabase.com/dashboard.
2. Settings → API: copia **Project URL**, **anon public** y **service_role**.

## 2. Variables `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # sólo backend, NUNCA al cliente
```

## 3. Esquema (Fase 3)

Las migraciones vivirán en `supabase/migrations`. Tablas mínimas:

`profiles, user_preferences, integration_connections, oauth_credentials,
assistant_sessions, assistant_messages, tool_executions, action_receipts,
memory_items, notifications, push_subscriptions, audit_logs`.

Requisitos por tabla:
- **RLS** activado; políticas que impidan lectura/escritura cross-user.
- Foreign keys a `profiles.id` / `auth.users`.
- Índices en columnas de consulta (user_id, fechas).
- `created_at` / `updated_at` con timestamps.
- `oauth_credentials`: refresh tokens **cifrados** (con `TOKEN_ENCRYPTION_KEY`);
  nunca en claro ni accesibles vía anon key.

## 4. Auth

Email/OAuth de Supabase. El `SupabaseStorageProvider` persistirá preferencias,
memoria, sesiones y logs por usuario, con fallback a `localStorage` cuando no haya
sesión (para no romper el demo).

## 5. Comprobar

`/setup` → «Supabase» = **READY**. Ninguna consulta debe poder leer datos de otro
usuario (verifícalo con las políticas RLS).
