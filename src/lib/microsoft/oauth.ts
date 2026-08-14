import { serverConfig } from "../config";

/**
 * Microsoft identity platform OAuth 2.0 (authorization code + refresh) for
 * Outlook tasks (Microsoft To Do via Graph). Token handling stays on the
 * backend; refresh tokens are encrypted at rest by the connection store.
 */
export const MS_SCOPES = [
  "offline_access",
  "User.Read",
  "Tasks.ReadWrite",
  // Calendario de Outlook como calendario real cuando no hay Google.
  "Calendars.ReadWrite",
  // Enviar correo desde el buzón del usuario (send_email).
  "Mail.Send",
];

function base(): string {
  return `https://login.microsoftonline.com/${serverConfig.microsoft.tenant}/oauth2/v2.0`;
}

export function isMicrosoftConfigured(): boolean {
  return (
    serverConfig.microsoft.clientId.trim().length > 0 &&
    serverConfig.microsoft.clientSecret.trim().length > 0
  );
}

export function buildMsAuthUrl(state: string, redirectUri?: string): string {
  const p = new URLSearchParams({
    client_id: serverConfig.microsoft.clientId,
    response_type: "code",
    redirect_uri: redirectUri ?? serverConfig.microsoft.redirectUri,
    response_mode: "query",
    scope: MS_SCOPES.join(" "),
    prompt: "select_account",
    state,
  });
  return `${base()}/authorize?${p.toString()}`;
}

export interface MsTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

async function tokenRequest(body: Record<string, string>): Promise<MsTokens> {
  const res = await fetch(`${base()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token error ${res.status}: ${text.slice(0, 200)}`);
  }
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: Date.now() + (j.expires_in - 60) * 1000,
  };
}

export function exchangeMsCode(code: string, redirectUri?: string): Promise<MsTokens> {
  return tokenRequest({
    client_id: serverConfig.microsoft.clientId,
    client_secret: serverConfig.microsoft.clientSecret,
    code,
    redirect_uri: redirectUri ?? serverConfig.microsoft.redirectUri,
    grant_type: "authorization_code",
    scope: MS_SCOPES.join(" "),
  });
}

/** NOTE: Microsoft rotates refresh tokens — persist the new one when returned. */
export function refreshMsToken(refreshToken: string): Promise<MsTokens> {
  return tokenRequest({
    client_id: serverConfig.microsoft.clientId,
    client_secret: serverConfig.microsoft.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: MS_SCOPES.join(" "),
  });
}

/** Email y nombre de la cuenta (best-effort). El nombre sirve para crear la
 *  cuenta de ZERO al entrar con Microsoft. */
export async function fetchMsProfile(
  accessToken: string,
): Promise<{ email?: string; name?: string }> {
  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return {};
    const j = (await res.json()) as {
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
    };
    return { email: j.mail ?? j.userPrincipalName, name: j.displayName };
  } catch {
    return {};
  }
}

/** Connected account's email (best-effort, for display). */
export async function fetchMsEmail(accessToken: string): Promise<string | undefined> {
  return (await fetchMsProfile(accessToken)).email;
}
