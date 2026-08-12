import { createHmac } from "node:crypto";
import { serverConfig } from "../config";

/** Signed OAuth `state` to bind the callback to the initiating user + prevent tampering. */
function secret(): string {
  return serverConfig.tokenEncryptionKey || serverConfig.google.clientSecret || "nova-dev";
}

export function signState(payload: { uid: string; authed: boolean }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): { uid: string; authed: boolean } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
