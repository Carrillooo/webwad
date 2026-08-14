import { createHmac, timingSafeEqual } from "node:crypto";
import { serverConfig } from "../config";

/**
 * Validación de la firma X-Twilio-Signature: los webhooks de voz son públicos
 * por necesidad (los llama Twilio), así que SOLO se aceptan peticiones
 * firmadas con nuestro auth token. Esquema oficial: base64(HMAC-SHA1(url +
 * parámetros POST ordenados alfabéticamente y concatenados clave+valor)).
 */
export function twilioSignature(url: string, params: Record<string, string>, authToken?: string): string {
  const token = authToken ?? serverConfig.twilio.authToken;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", token).update(Buffer.from(data, "utf8")).digest("base64");
}

export function validTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
  authToken?: string,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(twilioSignature(url, params, authToken));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
