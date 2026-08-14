import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { getConnection, getAccessToken } from "@/lib/google/connection";
import { isGoogleConfigured } from "@/lib/google/oauth";
import { isEncryptionConfigured } from "@/lib/crypto/tokens";
import { serverConfig } from "@/lib/config";

/**
 * Motivos por los que Google puede figurar conectado y aun así no usarse.
 * Sin esto el usuario solo ve "modo demo" y no hay forma de saber por qué.
 */
export type GoogleReason =
  | "ok"
  | "sin_credenciales" // faltan GOOGLE_CLIENT_ID/SECRET
  | "demo_mode" // DEMO_MODE=true fuerza los datos simulados
  | "sin_cifrado" // falta TOKEN_ENCRYPTION_KEY: el token guardado no se puede leer
  | "sin_conexion" // nadie ha pulsado "Conectar" (o se perdió al no haber base de datos)
  | "token_rechazado"; // Google ya no acepta el token: revocado o caducado

/** GET /api/google/status — estado de la conexión y, si no vale, por qué. */
export async function GET(req: NextRequest) {
  const { userId, authed } = await resolveUser(req);
  const configured = isGoogleConfigured();
  const connection = configured ? await getConnection(userId, authed) : { connected: false };

  let usable = false;
  let reason: GoogleReason = "ok";

  if (!configured) reason = "sin_credenciales";
  else if (serverConfig.demoMode) reason = "demo_mode";
  else if (!isEncryptionConfigured()) reason = "sin_cifrado";
  else {
    try {
      usable = Boolean(await getAccessToken(userId, authed));
      if (!usable) reason = "sin_conexion";
    } catch {
      reason = "token_rechazado";
    }
  }

  return NextResponse.json({ configured, connection, usable, reason });
}
