import { titular } from "@/lib/legal";

export const metadata = { title: "Términos del servicio · ZERO" };

/** Términos del servicio. Plantilla razonable para lanzar; conviene que un
 *  abogado la revise antes de facturar en serio. */
export default function Terminos() {
  const t = titular();
  const TITULAR_EMAIL = t.email;
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

      <h2>4. Derecho de desistimiento</h2>
      <p>
        Si contratas como <strong>persona consumidora</strong>, tienes derecho a desistir del
        contrato <strong>en 14 días naturales</strong> desde que lo celebras, sin justificar la
        decisión y sin penalización (artículos 102 y siguientes del Real Decreto Legislativo
        1/2007).
      </p>
      <ul>
        <li>
          Para ejercerlo basta con escribir a <strong>{TITULAR_EMAIL}</strong> diciendo que
          desistes. Te devolveremos lo pagado en un máximo de 14 días, por el mismo medio con el
          que pagaste.
        </li>
        <li>
          Si nos pides empezar a usar el servicio <em>dentro</em> de esos 14 días y lo aceptas
          expresamente, solo pagarás la parte proporcional al tiempo usado hasta que desistas.
        </li>
        <li>
          El derecho se pierde cuando el servicio se ha ejecutado por completo habiéndolo tú
          solicitado y reconocido de forma expresa.
        </li>
      </ul>
      <p className="text-faint">
        Ten en cuenta que los 14 días de prueba gratuita son anteriores a cualquier cobro: durante
        la prueba no hay nada que devolver porque no has pagado nada.
      </p>

      <h2>5. Uso razonable</h2>
      <ul>
        <li>No uses ZERO para actividades ilegales, para enviar spam ni para vulnerar derechos de terceros.</li>
        <li>Las respuestas del asistente las genera una IA y pueden contener errores: revisa siempre antes de actuar sobre información importante (citas, correos, documentos).</li>
        <li>Nos reservamos el derecho de suspender cuentas que abusen del servicio.</li>
      </ul>

      <h2>6. Servicios de terceros</h2>
      <p>
        ZERO se apoya en servicios de terceros para funcionar: Google (Calendar, Tasks, Drive,
        Docs, Gmail), Microsoft (Outlook, To Do), Anthropic (modelo de lenguaje) y ElevenLabs
        (síntesis de voz). Tu uso de esas plataformas se rige también por sus propios términos.
        Si un tercero interrumpe su servicio, alguna función de ZERO puede verse afectada.
      </p>

      <h2>7. Responsabilidad</h2>
      <p>
        En la máxima medida permitida por la ley, ZERO no responde de daños indirectos derivados
        del uso del servicio (una cita mal apuntada, un correo enviado por error tras tu
        confirmación, etc.). Nuestra responsabilidad total se limita al importe pagado en los
        últimos 12 meses.
      </p>

      <h2>8. Cambios</h2>
      <p>
        Podemos actualizar estos términos; si el cambio es relevante te avisaremos dentro de la
        app con antelación razonable. Seguir usando ZERO tras el aviso supone aceptarlos.
      </p>

      <h2>9. Reclamaciones y contacto</h2>
      <p>
        Para cualquier duda o reclamación: <strong>{TITULAR_EMAIL}</strong>. Contestamos a toda
        reclamación en un plazo máximo de un mes. Los datos completos del titular están en el{" "}
        <a href="/legal/aviso-legal" style={{ color: "rgb(var(--nova-accent))" }}>Aviso legal</a>.
      </p>
      <p>
        Si eres persona consumidora y no quedas conforme con la respuesta, puedes acudir a las
        juntas arbitrales de consumo o a los servicios de consumo de tu comunidad autónoma.
        Legislación aplicable: española. Jurisdicción: los juzgados del domicilio del consumidor.
      </p>
    </>
  );
}
