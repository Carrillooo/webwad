export const metadata = { title: "Términos del servicio · ZERO" };

/** Términos del servicio. Plantilla razonable para lanzar; conviene que un
 *  abogado la revise antes de facturar en serio. */
export default function Terminos() {
  return (
    <>
      <h1>Términos del servicio</h1>
      <p className="text-faint">Última actualización: 14 de agosto de 2026</p>

      <h2>1. Qué es ZERO</h2>
      <p>
        ZERO es un asistente personal con inteligencia artificial, por voz y en español, que
        te ayuda a gestionar tu calendario, tus tareas, tus documentos y tu correo conectando
        tus propias cuentas de Google y Microsoft. El servicio se presta tal cual
        («as is»), como herramienta de productividad personal.
      </p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>Necesitas una cuenta para usar ZERO. Eres responsable de mantener tu acceso seguro.</li>
        <li>Debes ser mayor de 18 años o contar con autorización de tu tutor legal.</li>
        <li>Puedes borrar tu cuenta cuando quieras; al hacerlo se eliminan tus datos y conexiones.</li>
      </ul>

      <h2>3. Precio y prueba gratuita</h2>
      <ul>
        <li>ZERO Pro cuesta <strong>20 € al mes</strong> (impuestos incluidos salvo que se indique lo contrario).</li>
        <li>Toda cuenta nueva disfruta de <strong>14 días de prueba gratis</strong>, sin tarjeta.</li>
        <li>Al terminar la prueba, el acceso se pausa hasta que actives la suscripción. Tus datos y conexiones no se borran.</li>
        <li>Puedes cancelar en cualquier momento; el acceso dura hasta el final del periodo pagado.</li>
      </ul>

      <h2>4. Uso razonable</h2>
      <ul>
        <li>No uses ZERO para actividades ilegales, para enviar spam ni para vulnerar derechos de terceros.</li>
        <li>Las respuestas del asistente las genera una IA y pueden contener errores: revisa siempre antes de actuar sobre información importante (citas, correos, documentos).</li>
        <li>Nos reservamos el derecho de suspender cuentas que abusen del servicio.</li>
      </ul>

      <h2>5. Servicios de terceros</h2>
      <p>
        ZERO se apoya en servicios de terceros para funcionar: Google (Calendar, Tasks, Drive,
        Docs, Gmail), Microsoft (Outlook, To Do), Anthropic (modelo de lenguaje) y ElevenLabs
        (síntesis de voz). Tu uso de esas plataformas se rige también por sus propios términos.
        Si un tercero interrumpe su servicio, alguna función de ZERO puede verse afectada.
      </p>

      <h2>6. Responsabilidad</h2>
      <p>
        En la máxima medida permitida por la ley, ZERO no responde de daños indirectos derivados
        del uso del servicio (una cita mal apuntada, un correo enviado por error tras tu
        confirmación, etc.). Nuestra responsabilidad total se limita al importe pagado en los
        últimos 12 meses.
      </p>

      <h2>7. Cambios</h2>
      <p>
        Podemos actualizar estos términos; si el cambio es relevante te avisaremos dentro de la
        app con antelación razonable. Seguir usando ZERO tras el aviso supone aceptarlos.
      </p>

      <h2>8. Contacto</h2>
      <p>
        Para cualquier duda: <strong>asistentezerodc@gmail.com</strong>. Legislación aplicable:
        española. Jurisdicción: los juzgados del domicilio del consumidor.
      </p>
    </>
  );
}
