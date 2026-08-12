-- NOVA — esquema inicial (Fase 3)
-- Auth de Supabase + Postgres con RLS estricto. Ningún dato es legible cross-user.
-- Todas las tablas tienen FK a auth.users, timestamps e índices por user_id.

create extension if not exists "pgcrypto";

-- Utilidad: updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Señor Carrillo',
  locale text not null default 'es-ES',
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- user_preferences (settings de UI/voz)
-- ---------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- integration_connections (estado de conexión por proveedor)
-- ---------------------------------------------------------------------------
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,                 -- 'google'
  status text not null default 'connected',
  scopes text[] not null default '{}',
  account_email text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  unique (user_id, provider)
);
create index if not exists idx_conn_user on public.integration_connections(user_id);

-- ---------------------------------------------------------------------------
-- oauth_credentials (tokens CIFRADOS en app; nunca en claro)
-- ---------------------------------------------------------------------------
create table if not exists public.oauth_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  -- refresh token cifrado con AES-256-GCM (TOKEN_ENCRYPTION_KEY). Formato: iv:tag:ciphertext (base64)
  refresh_token_enc text not null,
  access_token_enc text,
  access_token_expiry timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create index if not exists idx_oauth_user on public.oauth_credentials(user_id);

-- ---------------------------------------------------------------------------
-- assistant_sessions / assistant_messages
-- ---------------------------------------------------------------------------
create table if not exists public.assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sess_user on public.assistant_sessions(user_id);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assistant_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_msg_session on public.assistant_messages(session_id);
create index if not exists idx_msg_user on public.assistant_messages(user_id);

-- ---------------------------------------------------------------------------
-- tool_executions (log de acciones del agente)
-- ---------------------------------------------------------------------------
create table if not exists public.tool_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  input jsonb,
  ok boolean not null default true,
  error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists idx_tool_user on public.tool_executions(user_id);

-- ---------------------------------------------------------------------------
-- action_receipts (recibos verificables de mutaciones reales)
-- ---------------------------------------------------------------------------
create table if not exists public.action_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  label text not null,
  ok boolean not null default true,
  undoable boolean not null default false,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_receipt_user on public.action_receipts(user_id);

-- ---------------------------------------------------------------------------
-- memory_items (memoria controlada)
-- ---------------------------------------------------------------------------
create table if not exists public.memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'preference',   -- preference | fact | note
  key text,
  value text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_mem_user on public.memory_items(user_id);

-- ---------------------------------------------------------------------------
-- notifications / push_subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on public.notifications(user_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists idx_push_user on public.push_subscriptions(user_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_user on public.audit_logs(user_id);

-- updated_at triggers
do $$
declare t text;
begin
  for t in select unnest(array['profiles','user_preferences','oauth_credentials','assistant_sessions']) loop
    execute format('drop trigger if exists trg_updated_%1$s on public.%1$s;', t);
    execute format('create trigger trg_updated_%1$s before update on public.%1$s for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuario sólo ve/gestiona lo suyo.
-- oauth_credentials: SIN políticas de cliente → sólo accesible con service_role
-- (backend), nunca con la anon key.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','user_preferences','integration_connections','oauth_credentials',
    'assistant_sessions','assistant_messages','tool_executions','action_receipts',
    'memory_items','notifications','push_subscriptions','audit_logs']) loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- profiles usa id = auth.uid(); el resto usa user_id = auth.uid().
create policy "profiles_self" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  for t in select unnest(array[
    'user_preferences','integration_connections',
    'assistant_sessions','assistant_messages','tool_executions','action_receipts',
    'memory_items','notifications','push_subscriptions']) loop
    execute format($p$create policy "%1$s_self" on public.%1$s
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());$p$, t);
  end loop;
end $$;

-- audit_logs: sólo lectura de lo propio; escritura desde backend (service_role).
create policy "audit_read_self" on public.audit_logs
  for select using (user_id = auth.uid());

-- Nota: oauth_credentials queda con RLS activo y SIN políticas → inaccesible con
-- anon key. El backend usa la service_role key para leer/escribir tokens cifrados.
