import postgres from "postgres";
import { serverConfig } from "../config";

type SqlClient = ReturnType<typeof postgres>;

type DbGlobals = {
  __zeroPostgres?: SqlClient;
  __zeroSchemaReady?: Promise<void>;
};

const g = globalThis as unknown as DbGlobals;

export function isDatabaseConfigured(): boolean {
  return serverConfig.database.url.trim().length > 0;
}

function rawClient(): SqlClient {
  if (!isDatabaseConfigured()) throw new Error("La base de datos de Vercel no está configurada");
  if (!g.__zeroPostgres) {
    g.__zeroPostgres = postgres(serverConfig.database.url, {
      max: 2,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return g.__zeroPostgres;
}

const SCHEMA_STATEMENTS = [
  `create extension if not exists "pgcrypto"`,
  `create table if not exists profiles (
    id text primary key,
    display_name text not null default 'Daniel',
    locale text not null default 'es-ES',
    timezone text not null default 'Europe/Madrid',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists user_preferences (
    user_id text primary key references profiles(id) on delete cascade,
    prefs jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists integration_connections (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    provider text not null,
    status text not null default 'connected',
    scopes text[] not null default '{}',
    account_email text,
    connected_at timestamptz not null default now(),
    last_sync_at timestamptz,
    unique (user_id, provider)
  )`,
  `create index if not exists idx_conn_user on integration_connections(user_id)`,
  `create table if not exists oauth_credentials (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    provider text not null,
    refresh_token_enc text not null,
    access_token_enc text,
    access_token_expiry timestamptz,
    updated_at timestamptz not null default now(),
    unique (user_id, provider)
  )`,
  `create index if not exists idx_oauth_user on oauth_credentials(user_id)`,
  `create table if not exists assistant_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    title text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists idx_sess_user on assistant_sessions(user_id)`,
  `create table if not exists assistant_messages (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references assistant_sessions(id) on delete cascade,
    user_id text not null references profiles(id) on delete cascade,
    role text not null check (role in ('user','assistant')),
    content text not null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists idx_msg_session on assistant_messages(session_id)`,
  `create index if not exists idx_msg_user on assistant_messages(user_id)`,
  `create table if not exists tool_executions (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    tool text not null,
    input jsonb,
    ok boolean not null default true,
    error text,
    idempotency_key text,
    created_at timestamptz not null default now(),
    unique (user_id, idempotency_key)
  )`,
  `create index if not exists idx_tool_user on tool_executions(user_id)`,
  `create table if not exists action_receipts (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    kind text not null,
    label text not null,
    ok boolean not null default true,
    undoable boolean not null default false,
    detail jsonb,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists idx_receipt_user on action_receipts(user_id)`,
  `create table if not exists memory_items (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    kind text not null default 'preference',
    key text,
    value text not null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists idx_mem_user on memory_items(user_id)`,
  `create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    title text not null,
    body text,
    scheduled_for timestamptz,
    sent_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists idx_notif_user on notifications(user_id)`,
  `create table if not exists push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    endpoint text not null,
    keys jsonb not null,
    created_at timestamptz not null default now(),
    unique (user_id, endpoint)
  )`,
  `create index if not exists idx_push_user on push_subscriptions(user_id)`,
  `create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    user_id text references profiles(id) on delete set null,
    event text not null,
    meta jsonb,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists idx_audit_user on audit_logs(user_id)`,
  // --- Cuentas propias (multiusuario) ---
  // El id también existe en profiles: todas las tablas de datos cuelgan de ahí.
  `create table if not exists auth_users (
    id text primary key references profiles(id) on delete cascade,
    email text not null unique,
    password_hash text not null,
    display_name text not null,
    subscription_status text not null default 'trial' check (subscription_status in ('trial','active')),
    trial_ends_at timestamptz,
    is_owner boolean not null default false,
    created_at timestamptz not null default now()
  )`,
  // Cuentas creadas con "Continuar con Google/Microsoft" no tienen contraseña.
  `alter table auth_users alter column password_hash drop not null`,
  // Cuándo aceptó los términos (la casilla del registro / el aviso de OAuth).
  `alter table auth_users add column if not exists accepted_terms_at timestamptz`,
  // Códigos de verificación del email en el registro (hasheados, caducan).
  `create table if not exists email_verifications (
    email text primary key,
    code_hash text not null,
    attempts int not null default 0,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`,
  // Calendarios externos enlazados por URL iCal (iCloud, festivos, Calendly…).
  `create table if not exists external_calendars (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    name text not null,
    url text not null,
    created_at timestamptz not null default now(),
    unique (user_id, url)
  )`,
  `create index if not exists idx_extcal_user on external_calendars(user_id)`,
  // Llamadas telefónicas que ZERO hace en nombre del usuario (Twilio).
  `create table if not exists phone_calls (
    id uuid primary key default gen_random_uuid(),
    user_id text not null references profiles(id) on delete cascade,
    call_sid text,
    to_number text not null,
    contact_name text,
    goal text not null,
    status text not null default 'iniciando',
    result text,
    turns jsonb not null default '[]'::jsonb,
    duration_s int,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists idx_calls_user on phone_calls(user_id)`,
  `create table if not exists auth_sessions (
    token_hash text primary key,
    user_id text not null references auth_users(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists idx_auth_sessions_user on auth_sessions(user_id)`,
] as const;

/**
 * Creates the old Supabase persistence schema directly in the Vercel Postgres
 * database. Cached per server instance; every statement is idempotent.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (!isDatabaseConfigured()) throw new Error("La base de datos de Vercel no está configurada");
  if (!g.__zeroSchemaReady) {
    const sql = rawClient();
    g.__zeroSchemaReady = (async () => {
      for (const statement of SCHEMA_STATEMENTS) await sql.unsafe(statement);
    })().catch((error) => {
      g.__zeroSchemaReady = undefined;
      throw error;
    });
  }
  await g.__zeroSchemaReady;
}

export async function database(): Promise<SqlClient> {
  await ensureDatabaseSchema();
  return rawClient();
}
