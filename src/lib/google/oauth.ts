import { serverConfig } from "../config";

/**
 * Google OAuth 2.0 (authorization code + refresh) using the official endpoints.
 * All token handling stays on the backend. Refresh tokens are encrypted at rest
 * by the connection store — never returned to the client.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "openid",
  "email",
];

export function isGoogleConfigured(): boolean {
  return (
    serverConfig.google.clientId.trim().length > 0 &&
    serverConfig.google.clientSecret.trim().length > 0
  );
}

export function buildAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: serverConfig.google.clientId,
    redirect_uri: serverConfig.google.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  scope?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token error ${res.status}: ${text.slice(0, 200)}`);
  }
  const j = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: Date.now() + (j.expires_in - 60) * 1000,
    scope: j.scope,
  };
}

export function exchangeCode(code: string): Promise<GoogleTokens> {
  return tokenRequest({
    code,
    client_id: serverConfig.google.clientId,
    client_secret: serverConfig.google.clientSecret,
    redirect_uri: serverConfig.google.redirectUri,
    grant_type: "authorization_code",
  });
}

export function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: serverConfig.google.clientId,
    client_secret: serverConfig.google.clientSecret,
    grant_type: "refresh_token",
  });
}

/** Fetch the connected account's email (best-effort, for display). */
export async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { email?: string };
    return j.email;
  } catch {
    return undefined;
  }
}
