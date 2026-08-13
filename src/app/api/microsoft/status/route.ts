import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { getMsConnection } from "@/lib/microsoft/connection";
import { isMicrosoftConfigured } from "@/lib/microsoft/oauth";
import { serverConfig } from "@/lib/config";

/**
 * GET /api/microsoft/status — estado de Outlook.
 *
 * Incluye pistas (no secretos) para diagnosticar el caso más común: creas un
 * secreto nuevo en Azure, lo pegas en Vercel y sigue fallando porque el
 * despliegue en marcha aún tiene el viejo. Con estas pistas se compara de un
 * vistazo con lo que muestra Azure, sin exponer el secreto.
 */
export async function GET(req: NextRequest) {
  const { userId, authed } = await resolveUser(req);
  const configured = isMicrosoftConfigured();
  const connection = configured ? await getMsConnection(userId, authed) : { connected: false };
  const { clientId, clientSecret, tenant } = serverConfig.microsoft;

  return NextResponse.json({
    configured,
    connection,
    config: {
      clientId, // no es secreto: viaja en la URL de login
      tenant,
      // Azure enseña las 3 primeras letras del secreto ("hint"): compara.
      secretPista: clientSecret ? `${clientSecret.slice(0, 2)}…` : null,
      secretLargo: clientSecret.length,
      // Un espacio o salto de línea al pegarlo lo invalida sin que se note.
      secretConEspacios: clientSecret !== clientSecret.trim(),
    },
  });
}
