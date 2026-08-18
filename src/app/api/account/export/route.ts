import { NextRequest, NextResponse } from "next/server";
import { guardApi } from "@/lib/api-guard";
import { getStorage } from "@/lib/providers/storage";
import { listConversations } from "@/lib/conversations/store";
import { listExternalCalendars } from "@/lib/calendar/external";
import { subscriptionOf, PLAN } from "@/lib/auth/users";

export const runtime = "nodejs";

/**
 * GET /api/account/export — derecho de portabilidad (RGPD art. 20).
 *
 * Devuelve TODO lo que ZERO guarda de esta persona en un JSON legible por una
 * máquina y por un humano. Hasta ahora la política de privacidad decía que se
 * pedía por correo; poder descargarlo de un clic es lo que exige el
 * reglamento («en un formato estructurado, de uso común y lectura mecánica»).
 *
 * NO se incluyen los tokens de Google/Microsoft: son credenciales de acceso,
 * no datos personales del usuario, y entregarlas en claro sería un agujero de
 * seguridad. El calendario, las tareas y el correo viven en Google/Microsoft y
 * se exportan desde allí — aquí se dice dónde.
 */
export async function GET(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  const { userId, authed, user } = g.ctx;

  const almacen = getStorage(authed);
  const [preferencias, memoria, conversaciones, calendarios] = await Promise.all([
    almacen.getPreferences(userId).catch(() => null),
    almacen.listMemories(userId).catch(() => []),
    listConversations(userId).catch(() => []),
    listExternalCalendars(userId).catch(() => []),
  ]);

  const datos = {
    exportadoEl: new Date().toISOString(),
    aviso:
      "Esto es todo lo que ZERO guarda de ti. Tu calendario, tus tareas y tu correo NO están " +
      "aquí porque viven en tu propia cuenta de Google o Microsoft: descárgalos desde " +
      "takeout.google.com o desde los ajustes de tu cuenta Microsoft. Los tokens de acceso no " +
      "se incluyen a propósito: son credenciales, no datos tuyos.",
    cuenta: user
      ? {
          nombre: user.displayName,
          email: user.email,
          creadaEl: user.createdAt,
          suscripcion: { ...subscriptionOf(user), plan: PLAN },
        }
      : { anonima: true },
    preferencias: preferencias ?? {},
    memoria: memoria.map((m) => ({ tipo: m.kind, clave: m.key, valor: m.value, creadaEl: m.createdAt })),
    calendariosEnlazados: calendarios.map((c) => ({ nombre: c.name, url: c.url })),
    conversaciones,
  };

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(datos, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="zero-mis-datos-${fecha}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
