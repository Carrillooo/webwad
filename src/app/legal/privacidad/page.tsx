import { titular } from "@/lib/legal";

export const metadata = { title: "Política de privacidad · ZERO" };

/** Política de privacidad + cláusula de Datos de Google (Limited Use), que es
 *  requisito para la verificación de la app en Google Cloud. */
export default function Privacidad() {
  const t = titular();
  return (
    <>
      <h1>Política de privacidad</h1>
      <p className="text-faint">Última actualización: 18 de agosto de 2026</p>

      <h2>1. Qué datos tratamos</h2>
      <ul>
        <li><strong>Cuenta:</strong> tu nombre, tu email y (si te registras con contraseña) un hash seguro de la misma — nunca la contraseña en claro.</li>
        <li><strong>Conexiones:</strong> si enlazas Google u Outlook, guardamos los tokens de acceso <strong>cifrados (AES-256-GCM)</strong> para poder actuar en tu nombre cuando tú lo pidas.</li>
        <li><strong>Memoria personal:</strong> los datos que tú pidas recordar a ZERO («recuerda que…»). Puedes verlos y borrarlos cuando quieras.</li>
        <li><strong>Uso técnico:</strong> registros mínimos de errores y actividad para mantener el servicio estable.</li>
      </ul>

      <h2>2. Datos de Google (cláusula de uso limitado)</h2>
      <p>
        El uso que ZERO hace de la información recibida de las APIs de Google se ajusta a la{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
          style={{ color: "rgb(var(--nova-accent))" }}
        >
          Política de Datos de Usuario de los Servicios API de Google
        </a>
        , incluidos los requisitos de <strong>Uso Limitado</strong> (Limited Use). En concreto:
      </p>
      <ul>
        <li>Tu calendario, tareas, documentos y correo se usan <strong>solo</strong> para ejecutar lo que tú pides al asistente.</li>
        <li><strong>No vendemos</strong> tus datos ni los usamos para publicidad. Nunca.</li>
        <li>Ningún humano lee tu contenido, salvo obligación legal o con tu permiso explícito para resolver una incidencia.</li>
        <li>No usamos tus datos de Google para entrenar modelos de inteligencia artificial.</li>
        <li>Puedes revocar el acceso en cualquier momento desde Ajustes de ZERO o desde tu cuenta de Google.</li>
      </ul>

      <h2>3. Con quién se comparte</h2>
      <p>
        Con nadie para fines comerciales. Para funcionar, ZERO envía lo imprescindible a sus
        proveedores técnicos: el texto de tu petición al modelo de lenguaje (Anthropic), el texto
        de la respuesta al sintetizador de voz (ElevenLabs) y las órdenes que confirmes a Google
        o Microsoft.
      </p>
      <p>Los encargados del tratamiento son, a día de hoy:</p>
      <ul>
        <li><strong>Vercel</strong> — alojamiento de la web y registros técnicos.</li>
        <li><strong>Neon / Vercel Postgres</strong> — base de datos.</li>
        <li><strong>Anthropic</strong> — el modelo de lenguaje que entiende y redacta.</li>
        <li><strong>ElevenLabs</strong> — la voz que oyes.</li>
        <li><strong>Google</strong> y <strong>Microsoft</strong> — solo si tú enlazas tus cuentas.</li>
        <li><strong>Twilio</strong> — solo si usas las llamadas telefónicas.</li>
      </ul>
      <p>
        Algunos están fuera del Espacio Económico Europeo. En ese caso la transferencia se ampara
        en las cláusulas contractuales tipo aprobadas por la Comisión Europea (SCC) y, cuando
        aplica, en el Marco de Privacidad de Datos UE-EE. UU.
      </p>

      <h2>4. Cuánto tiempo</h2>
      <ul>
        <li>Mientras tu cuenta exista. Si la borras (o la borras desde Ajustes), tus datos, tokens y memoria se eliminan.</li>
        <li>Los registros técnicos se conservan un máximo de 90 días.</li>
      </ul>

      <h2>5. Tus derechos (RGPD)</h2>
      <p>
        Puedes ejercer acceso, rectificación, supresión, oposición, limitación y portabilidad.
        Dos de ellos los tienes a un clic dentro de la app, en <strong>Ajustes → Tus datos</strong>:
      </p>
      <ul>
        <li><strong>Descargar todos mis datos</strong> — portabilidad, en un fichero legible.</li>
        <li><strong>Borrar mi cuenta</strong> — supresión inmediata y definitiva.</li>
      </ul>
      <p>
        Para el resto, o si prefieres hacerlo por escrito, escribe a <strong>{t.email}</strong>.
        Respondemos en un plazo máximo de un mes. También puedes reclamar ante la Agencia Española
        de Protección de Datos (aepd.es).
      </p>

      <h2>6. Cookies</h2>
      <p>
        ZERO usa una única cookie técnica (<code>zero_session</code>) imprescindible para mantener
        tu sesión iniciada. No hay cookies de publicidad ni de seguimiento de terceros, y por eso
        no verás un banner pidiéndote permiso. El detalle está en la{" "}
        <a href="/legal/cookies" style={{ color: "rgb(var(--nova-accent))" }}>Política de cookies</a>.
      </p>

      <h2>7. Responsable del tratamiento</h2>
      <ul>
        <li><strong>Titular:</strong> {t.nombre || "— pendiente de completar —"}</li>
        <li><strong>NIF:</strong> {t.nif || "— pendiente de completar —"}</li>
        <li><strong>Domicilio:</strong> {t.domicilio || "— pendiente de completar —"}</li>
        <li><strong>Contacto:</strong> {t.email}</li>
      </ul>
      <p>
        Los datos completos están en el{" "}
        <a href="/legal/aviso-legal" style={{ color: "rgb(var(--nova-accent))" }}>Aviso legal</a>.
      </p>

      <h2>8. Base jurídica de cada tratamiento</h2>
      <ul>
        <li><strong>Tu cuenta y la prestación del servicio:</strong> ejecución del contrato (art. 6.1.b RGPD).</li>
        <li><strong>Conexión con Google y Microsoft:</strong> tu consentimiento explícito, que otorgas al enlazar y puedes retirar cuando quieras (art. 6.1.a).</li>
        <li><strong>Seguridad y registros técnicos:</strong> interés legítimo en mantener el servicio estable y protegido (art. 6.1.f).</li>
        <li><strong>Facturación y conservación fiscal:</strong> obligación legal (art. 6.1.c).</li>
      </ul>
      <p>
        No se toman decisiones automatizadas con efectos jurídicos sobre ti, ni se hace
        elaboración de perfiles.
      </p>
    </>
  );
}
