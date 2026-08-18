import { titular } from "@/lib/legal";

export const metadata = { title: "Política de cookies · ZERO" };

/**
 * Política de cookies.
 *
 * ZERO NO lleva banner de cookies, y es la decisión correcta: solo usa una
 * cookie estrictamente necesaria para mantener la sesión. El artículo 5.3 de
 * la Directiva ePrivacy —y la Guía sobre el uso de cookies de la AEPD— dejan
 * exentas de consentimiento las cookies técnicas imprescindibles para prestar
 * un servicio que el usuario ha pedido expresamente. Lo que sí hay que hacer
 * es INFORMAR, y eso es esta página.
 *
 * ⚠️ Si algún día se añade analítica (Google Analytics, Vercel Analytics,
 * píxeles, mapas de calor…), esta exención desaparece y HAY QUE poner un
 * banner con rechazo tan fácil como la aceptación, antes de cargar nada.
 */
export default function Cookies() {
  const t = titular();

  return (
    <>
      <h1>Política de cookies</h1>
      <p className="text-faint">Última actualización: 18 de agosto de 2026</p>

      <h2>1. Resumen</h2>
      <p>
        {t.marca} usa <strong>una sola cookie</strong>, y es técnica: la que mantiene tu sesión
        iniciada. <strong>No hay analítica, ni publicidad, ni píxeles, ni cookies de terceros.</strong>{" "}
        Por eso no verás un banner pidiéndote permiso: la ley solo exige consentimiento para las
        cookies que no son imprescindibles.
      </p>

      <h2>2. Qué cookie se usa exactamente</h2>
      <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid rgb(var(--nova-fg) / 0.15)" }}>
            <th style={{ padding: "6px 8px 6px 0" }}>Nombre</th>
            <th style={{ padding: "6px 8px" }}>Para qué</th>
            <th style={{ padding: "6px 0 6px 8px" }}>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: "8px 8px 8px 0", verticalAlign: "top" }}>
              <code>zero_session</code>
            </td>
            <td style={{ padding: "8px", verticalAlign: "top" }}>
              Mantener tu sesión iniciada para que no tengas que escribir la contraseña en cada
              pantalla. Es propia, no viaja a terceros y no permite identificarte fuera de {t.marca}.
            </td>
            <td style={{ padding: "8px 0 8px 8px", verticalAlign: "top" }}>60 días</td>
          </tr>
        </tbody>
      </table>
      <p>
        Va marcada como <code>HttpOnly</code> (el JavaScript de la página no puede leerla),{" "}
        <code>Secure</code> (solo viaja cifrada) y <code>SameSite=Lax</code> (no se envía desde
        otras webs). Lo que guarda no es tu contraseña, sino un identificador de sesión aleatorio.
      </p>

      <h2>3. Base legal</h2>
      <p>
        Se trata de una cookie técnica necesaria para prestar un servicio que tú has solicitado
        expresamente al iniciar sesión, por lo que está exenta del deber de consentimiento previo
        conforme al artículo 22.2 de la Ley 34/2002 (LSSI-CE) y a la Guía sobre el uso de cookies
        de la Agencia Española de Protección de Datos.
      </p>

      <h2>4. Cómo desactivarla</h2>
      <p>
        Puedes bloquear o borrar las cookies desde la configuración de tu navegador. Ten en cuenta
        que, si bloqueas esta, no podrás mantener la sesión iniciada y {t.marca} dejará de
        funcionar. También puedes cerrar sesión desde Ajustes: eso la elimina en el acto.
      </p>

      <h2>5. Almacenamiento en tu propio navegador</h2>
      <p>
        Además de la cookie, {t.marca} guarda tus preferencias de interfaz (tamaño de texto,
        contraste, ajustes de voz) en el <code>localStorage</code> de tu navegador. No es una
        cookie, no se envía a ningún servidor y desaparece si borras los datos del sitio.
      </p>

      <h2>6. Si esto cambia</h2>
      <p>
        Si en el futuro se añade cualquier herramienta de medición o publicidad, se pedirá tu
        consentimiento previo mediante un banner en el que rechazar sea tan fácil como aceptar, y
        esta página se actualizará antes de activarla.
      </p>

      <h2>7. Contacto</h2>
      <p>
        Dudas sobre cookies: <strong>{t.email}</strong>.
      </p>
    </>
  );
}
