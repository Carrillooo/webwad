import { titular, faltaEnAvisoLegal } from "@/lib/legal";

export const metadata = { title: "Aviso legal · ZERO" };

/**
 * Aviso legal (artículo 10 de la LSSI-CE).
 *
 * Es obligatorio en España para cualquier web con actividad económica y hoy no
 * existía. Los datos salen de variables de entorno; si faltan, la página lo
 * dice en vez de inventárselos.
 */
export default function AvisoLegal() {
  const t = titular();
  const falta = faltaEnAvisoLegal(t);

  return (
    <>
      <h1>Aviso legal</h1>
      <p className="text-faint">Información exigida por el artículo 10 de la Ley 34/2002 (LSSI-CE).</p>

      {falta.length > 0 && (
        <div
          className="rounded-xl px-3 py-2.5 text-[13px]"
          style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(180,83,9,0.45)" }}
        >
          <strong style={{ color: "rgb(180 83 9)" }}>Pendiente de completar por el titular.</strong>{" "}
          Faltan por definir estas variables de entorno en Vercel:
          <ul>
            {falta.map((f) => (
              <li key={f}>
                <code>{f}</code>
              </li>
            ))}
          </ul>
          Hasta entonces este aviso legal está incompleto y el servicio no debería cobrarse.
        </div>
      )}

      <h2>1. Titular del servicio</h2>
      <ul>
        <li><strong>Denominación:</strong> {t.nombre || "— pendiente —"}</li>
        <li><strong>NIF / CIF:</strong> {t.nif || "— pendiente —"}</li>
        <li><strong>Domicilio:</strong> {t.domicilio || "— pendiente —"}</li>
        <li><strong>Correo de contacto:</strong> {t.email}</li>
        {t.telefono && <li><strong>Teléfono:</strong> {t.telefono}</li>}
        {t.registro && <li><strong>Datos registrales:</strong> {t.registro}</li>}
        <li><strong>Nombre comercial:</strong> {t.marca}</li>
      </ul>

      <h2>2. Objeto</h2>
      <p>
        {t.marca} es un asistente personal por voz que ayuda a gestionar calendario, tareas,
        documentos y correo conectando las cuentas de Google y Microsoft del propio usuario. El
        acceso se presta mediante suscripción, en las condiciones descritas en los{" "}
        <a href="/legal/terminos" style={{ color: "rgb(var(--nova-accent))" }}>Términos del servicio</a>.
      </p>

      <h2>3. Condiciones de uso</h2>
      <p>
        El acceso a esta web y su uso implican aceptar este aviso legal, los Términos del servicio
        y la Política de privacidad. El usuario se compromete a usar el servicio conforme a la ley
        y a no realizar actividades que puedan dañar la plataforma, a terceros o a su
        funcionamiento normal.
      </p>

      <h2>4. Propiedad intelectual e industrial</h2>
      <p>
        El código, el diseño, los textos, la marca y los elementos gráficos de {t.marca} pertenecen
        a su titular o se usan con licencia. Queda prohibida su reproducción, distribución o
        transformación sin autorización expresa. El contenido que el usuario aporta o genera
        (eventos, tareas, notas, correos) sigue siendo suyo.
      </p>

      <h2>5. Responsabilidad</h2>
      <p>
        El titular no se hace responsable de las interrupciones causadas por terceros de los que
        depende el servicio (Google, Microsoft, proveedores de alojamiento o de inteligencia
        artificial), ni del uso que el usuario haga de las respuestas del asistente, que se generan
        con inteligencia artificial y pueden contener errores. Se recomienda revisar siempre antes
        de actuar sobre información importante.
      </p>

      <h2>6. Enlaces a terceros</h2>
      <p>
        Esta web puede enlazar a sitios de terceros. El titular no controla su contenido ni asume
        responsabilidad sobre ellos.
      </p>

      <h2>7. Legislación aplicable</h2>
      <p>
        Estas condiciones se rigen por la legislación española. Para los conflictos con personas
        consumidoras, será competente el juzgado del domicilio del consumidor.
      </p>
    </>
  );
}
