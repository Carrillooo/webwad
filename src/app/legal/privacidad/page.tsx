export const metadata = { title: "Política de privacidad · ZERO" };

/** Política de privacidad + cláusula de Datos de Google (Limited Use), que es
 *  requisito para la verificación de la app en Google Cloud. */
export default function Privacidad() {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p className="text-faint">Última actualización: 14 de agosto de 2026</p>

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
        o Microsoft. La base de datos se aloja en la Unión Europea o bajo cláusulas contractuales
        tipo (SCC) cuando el proveedor esté fuera.
      </p>

      <h2>4. Cuánto tiempo</h2>
      <ul>
        <li>Mientras tu cuenta exista. Si la borras (o la borras desde Ajustes), tus datos, tokens y memoria se eliminan.</li>
        <li>Los registros técnicos se conservan un máximo de 90 días.</li>
      </ul>

      <h2>5. Tus derechos (RGPD)</h2>
      <p>
        Puedes ejercer acceso, rectificación, supresión, oposición, limitación y portabilidad
        escribiendo a <strong>asistentezerodc@gmail.com</strong>. También puedes reclamar ante la
        Agencia Española de Protección de Datos (aepd.es).
      </p>

      <h2>6. Cookies</h2>
      <p>
        ZERO usa una única cookie técnica (<code>zero_session</code>) imprescindible para mantener
        tu sesión iniciada. No hay cookies de publicidad ni de seguimiento de terceros.
      </p>

      <h2>7. Responsable</h2>
      <p>
        Responsable del tratamiento: el titular del servicio ZERO. Contacto:{" "}
        <strong>asistentezerodc@gmail.com</strong>.
      </p>
    </>
  );
}
