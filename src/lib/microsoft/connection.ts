import { serviceClient, isSupabaseConfigured } from "../supabase/server";
import { encryptToken, decryptToken, isEncryptionConfigured } from "../crypto/tokens";
import { MsTokens, refreshMsToken } from "./oauth";

/**
 * Stores the Microsoft (Outlook) connection + encrypted tokens. Mirrors the
 * Google connection store: Supabase for authed users, in-memory otherwise.
 * Microsoft rotates refresh tokens on each refresh — always persist the new one.
 */
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
  return authed && isSupabaseConfigured();
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
    const db = serviceClient();
    await db.from("oauth_credentials").upsert(
      {
        user_id: userId,
        provider: "microsoft",
        refresh_token_enc: refreshTokenEnc,
        access_token_enc: accessTokenEnc,
        access_token_expiry: new Date(tokens.expiresAt).toISOString(),
        updated_at: connectedAt,
      },
      { onConflict: "user_id,provider" },
    );
    await db.from("integration_connections").upsert(
      { user_id: userId, provider: "microsoft", status: "connected", account_email: email, connected_at: connectedAt },
      { onConflict: "user_id,provider" },
    );
    return;
  }
  mem().set(userId, { refreshTokenEnc, accessTokenEnc, accessTokenExpiry: tokens.expiresAt, email, connectedAt });
}

async function load(userId: string, authed: boolean): Promise<Stored | null> {
  if (shouldUseDb(authed)) {
    const { data } = await serviceClient()
      .from("oauth_credentials")
      .select("refresh_token_enc, access_token_enc, access_token_expiry")
      .eq("user_id", userId)
      .eq("provider", "microsoft")
      .maybeSingle();
    if (!data) return null;
    const { data: conn } = await serviceClient()
      .from("integration_connections")
      .select("account_email, connected_at")
      .eq("user_id", userId)
      .eq("provider", "microsoft")
      .maybeSingle();
    return {
      refreshTokenEnc: data.refresh_token_enc as string,
      accessTokenEnc: (data.access_token_enc as string | null) ?? undefined,
      accessTokenExpiry: data.access_token_expiry ? new Date(data.access_token_expiry as string).getTime() : undefined,
      email: (conn?.account_email as string | null) ?? undefined,
      connectedAt: (conn?.connected_at as string | null) ?? new Date().toISOString(),
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
    await serviceClient().from("oauth_credentials").delete().eq("user_id", userId).eq("provider", "microsoft");
    await serviceClient().from("integration_connections").delete().eq("user_id", userId).eq("provider", "microsoft");
    return;
  }
  mem().delete(userId);
}

/** Valid access token, refreshing (and persisting the rotated refresh token). */
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
    await serviceClient()
      .from("oauth_credentials")
      .update({
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        access_token_expiry: new Date(fresh.expiresAt).toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "microsoft");
  } else {
    mem().set(userId, { ...s, accessTokenEnc, refreshTokenEnc, accessTokenExpiry: fresh.expiresAt });
  }
  return fresh.accessToken;
}
