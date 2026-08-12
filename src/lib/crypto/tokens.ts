import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { serverConfig } from "../config";

/**
 * AES-256-GCM encryption for OAuth refresh/access tokens at rest.
 * Key is derived from TOKEN_ENCRYPTION_KEY (any string) via SHA-256 → 32 bytes.
 * Output format: base64(iv):base64(tag):base64(ciphertext).
 */
function key(): Buffer {
  const raw = serverConfig.tokenEncryptionKey;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY no está configurada");
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Token cifrado con formato inválido");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function isEncryptionConfigured(): boolean {
  return serverConfig.tokenEncryptionKey.trim().length > 0;
}
