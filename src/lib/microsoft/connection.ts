import { database, isDatabaseConfigured } from "../db/server";
import { encryptToken, decryptToken, isEncryptionConfigured } from "../crypto/tokens";
import { MsTokens, refreshMsToken } from "./oauth";

export interface MsConnection {
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

const g = globalThis as unknown as { __novaMs?: Map<string, Stored> };
function mem() {
  if (!g.__novaMs) g.__novaMs = new Map();
  return g.__novaMs;
}
function shouldUseDb(authed: boolean) {
  return authed && isDatabaseConfigured();
}
function millis(value: unknown): number | undefined {
  if (!value) return undefined;
  const n = new Date(value instanceof Date ? value : String(value)).getTime();
  return Number.isFinite(n) ? n : undefined;
}

export async function saveMsConnection(
  userId: string,
  authed: boolean,
  tokens: MsTokens,
  email?: string,
): Promise<void> {
  if (!tokens.refreshToken) throw new Error("Microsoft no devolvió refresh token (falta offline_access)");
  const refreshTokenEnc = encryptToken(tokens.refreshToken);
  const accessTokenEnc = encryptToken(tokens.accessToken);
  const connectedAt = new Date().toISOString();

  if (shouldUseDb(authed)) {
    const sql = await database();
    await sql`
      insert into oauth_credentials
        (user_id, provider, refresh_token_enc, access_token_enc, access_token_expiry, updated_at)
      values
        (${userId}, 'microsoft', ${refreshTokenEnc}, ${accessTokenEnc}, ${new Date(tokens.expiresAt)}, ${connectedAt})
      on conflict (user_id, provider) do update set
        refresh_token_enc = excluded.refresh_token_enc,
        access_token_enc = excluded.access_token_enc,
        access_token_expiry = excluded.access_token_expiry,
        updated_at = excluded.updated_at
    `;
    await sql`
      insert into integration_connections
        (user_id, provider, status, account_email, connected_at)
      values (${userId}, 'microsoft', 'connected', ${email ?? null}, ${connectedAt})
      on conflict (user_id, provider) do update set
        status = 'connected', account_email = excluded.account_email, connected_at = excluded.connected_at
    `;
    return;
  }
  mem().set(userId, { refreshTokenEnc, accessTokenEnc, accessTokenExpiry: tokens.expiresAt, email, connectedAt });
}

async function load(userId: string, authed: boolean): Promise<Stored | null> {
  if (shouldUseDb(authed)) {
    const sql = await database();
    const creds = await sql`
      select refresh_token_enc, access_token_enc, access_token_expiry
      from oauth_credentials
      where user_id = ${userId} and provider = 'microsoft'
      limit 1
    `;
    const data = creds[0] as Record<string, unknown> | undefined;
    if (!data) return null;
    const connections = await sql`
      select account_email, connected_at
      from integration_connections
      where user_id = ${userId} and provider = 'microsoft'
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

export async function getMsConnection(userId: string, authed: boolean): Promise<MsConnection> {
  const s = await load(userId, authed);
  if (!s) return { connected: false };
  return { connected: true, email: s.email, connectedAt: s.connectedAt };
}

export async function disconnectMs(userId: string, authed: boolean): Promise<void> {
  if (shouldUseDb(authed)) {
    const sql = await database();
    await sql`delete from oauth_credentials where user_id = ${userId} and provider = 'microsoft'`;
    await sql`delete from integration_connections where user_id = ${userId} and provider = 'microsoft'`;
    return;
  }
  mem().delete(userId);
}

export async function getMsAccessToken(userId: string, authed: boolean): Promise<string | null> {
  if (!isEncryptionConfigured()) return null;
  const s = await load(userId, authed);
  if (!s) return null;

  if (s.accessTokenEnc && s.accessTokenExpiry && s.accessTokenExpiry > Date.now()) {
    return decryptToken(s.accessTokenEnc);
  }
  const fresh = await refreshMsToken(decryptToken(s.refreshTokenEnc));
  const accessTokenEnc = encryptToken(fresh.accessToken);
  const refreshTokenEnc = fresh.refreshToken ? encryptToken(fresh.refreshToken) : s.refreshTokenEnc;

  if (shouldUseDb(authed)) {
    const sql = await database();
    await sql`
      update oauth_credentials
      set access_token_enc = ${accessTokenEnc},
          refresh_token_enc = ${refreshTokenEnc},
          access_token_expiry = ${new Date(fresh.expiresAt)},
          updated_at = now()
      where user_id = ${userId} and provider = 'microsoft'
    `;
  } else {
    mem().set(userId, { ...s, accessTokenEnc, refreshTokenEnc, accessTokenExpiry: fresh.expiresAt });
  }
  return fresh.accessToken;
}
