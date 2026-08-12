import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken, isEncryptionConfigured } from "./tokens";

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips a refresh token", () => {
    const secret = "1//0abcDEF_google-refresh-token-example";
    const enc = encryptToken(secret);
    expect(enc).not.toContain(secret);
    expect(enc.split(":").length).toBe(3);
    expect(decryptToken(enc)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("rejects a tampered ciphertext", () => {
    const enc = encryptToken("secret");
    const [iv, tag, data] = enc.split(":");
    const flipped = data.slice(0, -2) + (data.slice(-2) === "AA" ? "BB" : "AA");
    expect(() => decryptToken(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  it("reports configured when key present", () => {
    expect(isEncryptionConfigured()).toBe(true);
  });
});
