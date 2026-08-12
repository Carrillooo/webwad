import { serviceClient, isSupabaseConfigured } from "../supabase/server";
import { encryptToken, decryptToken, isEncryptionConfigured } from "../crypto/tokens";
import { GoogleTokens, refreshAccessToken } from "./oauth";

/**
 * Stores the Google connection + encrypted tokens. Authenticated users →
 * Supabase (oauth_credentials, RLS-protected, service-role only). Demo users →
 * in-memory (globalThis), so the OAuth flow is testable without a database.
 */
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
  return authed && isSupabaseConfigured();
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
    const db = serviceClient();
    await db.from("oauth_credentials").upsert(
      {
        user_id: userId,
        provider: "google",
        refresh_token_enc: refreshTokenEnc,
        access_token_enc: accessTokenEnc,
        access_token_expiry: new Date(tokens.expiresAt).toISOString(),
        updated_at: connectedAt,
      },
      { onConflict: "user_id,provider" },
    );
    await db.from("integration_connections").upsert(
      { user_id: userId, provider: "google", status: "connected", account_email: email, connected_at: connectedAt },
      { onConflict: "user_id,provider" },
    );
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
    const { data } = await serviceClient()
      .from("oauth_credentials")
      .select("refresh_token_enc, access_token_enc, access_token_expiry")
      .eq("user_id", userId)
      .eq("provider", "google")
      .maybeSingle();
    if (!data) return null;
    const { data: conn } = await serviceClient()
      .from("integration_connections")
      .select("account_email, connected_at")
      .eq("user_id", userId)
      .eq("provider", "google")
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

export async function getConnection(userId: string, authed: boolean): Promise<GoogleConnection> {
  const s = await load(userId, authed);
  if (!s) return { connected: false };
  return { connected: true, email: s.email, connectedAt: s.connectedAt };
}

export async function disconnect(userId: string, authed: boolean): Promise<void> {
  if (shouldUseDb(authed)) {
    await serviceClient().from("oauth_credentials").delete().eq("user_id", userId).eq("provider", "google");
    await serviceClient().from("integration_connections").delete().eq("user_id", userId).eq("provider", "google");
    return;
  }
  mem().delete(userId);
}

/** Returns a valid access token, refreshing (and re-persisting) when expired. */
export async function getAccessToken(userId: string, authed: boolean): Promise<string | null> {
  if (!isEncryptionConfigured()) return null;
  const s = await load(userId, authed);
  if (!s) return null;

  if (s.accessTokenEnc && s.accessTokenExpiry && s.accessTokenExpiry > Date.now()) {
    return decryptToken(s.accessTokenEnc);
  }
  // Refresh.
  const refreshToken = decryptToken(s.refreshTokenEnc);
  const fresh = await refreshAccessToken(refreshToken);
  const accessTokenEnc = encryptToken(fresh.accessToken);

  if (shouldUseDb(authed)) {
    await serviceClient()
      .from("oauth_credentials")
      .update({ access_token_enc: accessTokenEnc, access_token_expiry: new Date(fresh.expiresAt).toISOString() })
      .eq("user_id", userId)
      .eq("provider", "google");
  } else {
    mem().set(userId, { ...s, accessTokenEnc, accessTokenExpiry: fresh.expiresAt });
  }
  return fresh.accessToken;
}
