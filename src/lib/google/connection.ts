import { database, isDatabaseConfigured } from "../db/server";
import { encryptToken, decryptToken, isEncryptionConfigured } from "../crypto/tokens";
import { GoogleTokens, refreshAccessToken } from "./oauth";

export interface GoogleConnection {
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

interface Stored {
  refreshTokenEnc: string;
  accessTokenEnc?: string;
  accessTokenExpiry?: number;
  email?: string;
  connectedAt: string;
}

const g = globalThis as unknown as { __novaGoogle?: Map<string, Stored> };
function mem() {
  if (!g.__novaGoogle) g.__novaGoogle = new Map();
  return g.__novaGoogle;
}

function shouldUseDb(authed: boolean) {
  return authed && isDatabaseConfigured();
}

function millis(value: unknown): number | undefined {
  if (!value) return undefined;
  const n = new Date(value instanceof Date ? value : String(value)).getTime();
  return Number.isFinite(n) ? n : undefined;
}

export async function saveConnection(
  userId: string,
  authed: boolean,
  tokens: GoogleTokens,
  email?: string,
): Promise<void> {
  if (!tokens.refreshToken) throw new Error("Google no devolvió refresh token (usa prompt=consent)");
  const refreshTokenEnc = encryptToken(tokens.refreshToken);
  const accessTokenEnc = encryptToken(tokens.accessToken);
  const connectedAt = new Date().toISOString();

  if (shouldUseDb(authed)) {
    const sql = await database();
    await sql`
      insert into oauth_credentials
        (user_id, provider, refresh_token_enc, access_token_enc, access_token_expiry, updated_at)
      values
        (${userId}, 'google', ${refreshTokenEnc}, ${accessTokenEnc}, ${new Date(tokens.expiresAt)}, ${connectedAt})
      on conflict (user_id, provider) do update set
        refresh_token_enc = excluded.refresh_token_enc,
        access_token_enc = excluded.access_token_enc,
        access_token_expiry = excluded.access_token_expiry,
        updated_at = excluded.updated_at
    `;
    await sql`
      insert into integration_connections
        (user_id, provider, status, account_email, connected_at)
      values (${userId}, 'google', 'connected', ${email ?? null}, ${connectedAt})
      on conflict (user_id, provider) do update set
        status = 'connected', account_email = excluded.account_email, connected_at = excluded.connected_at
    `;
    return;
  }

  mem().set(userId, {
    refreshTokenEnc,
    accessTokenEnc,
    accessTokenExpiry: tokens.expiresAt,
    email,
    connectedAt,
  });
}

async function load(userId: string, authed: boolean): Promise<Stored | null> {
  if (shouldUseDb(authed)) {
    const sql = await database();
    const creds = await sql`
      select refresh_token_enc, access_token_enc, access_token_expiry
      from oauth_credentials
      where user_id = ${userId} and provider = 'google'
      limit 1
    `;
    const data = creds[0] as Record<string, unknown> | undefined;
    if (!data) return null;
    const connections = await sql`
      select account_email, connected_at
      from integration_connections
      where user_id = ${userId} and provider = 'google'
      limit 1
    `;
    const conn = connections[0] as Record<string, unknown> | undefined;
    return {
      refreshTokenEnc: String(data.refresh_token_enc),
      accessTokenEnc: data.access_token_enc == null ? undefined : String(data.access_token_enc),
      accessTokenExpiry: millis(data.access_token_expiry),
      email: conn?.account_email == null ? undefined : String(conn.account_email),
      connectedAt: conn?.connected_at ? new Date(conn.connected_at as string | Date).toISOString() : new Date().toISOString(),
    };
  }
  return mem().get(userId) ?? null;
}

export async function getConnection(userId: string, authed: boolean): Promise<GoogleConnection> {
  const s = await load(userId, authed);
  if (!s) return { connected: false };
  return { connected: true, email: s.email, connectedAt: s.connectedAt };
}

export async function disconnect(userId: string, authed: boolean): Promise<void> {
  if (shouldUseDb(authed)) {
    const sql = await database();
    await sql`delete from oauth_credentials where user_id = ${userId} and provider = 'google'`;
    await sql`delete from integration_connections where user_id = ${userId} and provider = 'google'`;
    return;
  }
  mem().delete(userId);
}

export async function getAccessToken(userId: string, authed: boolean): Promise<string | null> {
  if (!isEncryptionConfigured()) return null;
  const s = await load(userId, authed);
  if (!s) return null;

  if (s.accessTokenEnc && s.accessTokenExpiry && s.accessTokenExpiry > Date.now()) {
    return decryptToken(s.accessTokenEnc);
  }

  const fresh = await refreshAccessToken(decryptToken(s.refreshTokenEnc));
  const accessTokenEnc = encryptToken(fresh.accessToken);

  if (shouldUseDb(authed)) {
    const sql = await database();
    await sql`
      update oauth_credentials
      set access_token_enc = ${accessTokenEnc}, access_token_expiry = ${new Date(fresh.expiresAt)}, updated_at = now()
      where user_id = ${userId} and provider = 'google'
    `;
  } else {
    mem().set(userId, { ...s, accessTokenEnc, accessTokenExpiry: fresh.expiresAt });
  }
  return fresh.accessToken;
}
