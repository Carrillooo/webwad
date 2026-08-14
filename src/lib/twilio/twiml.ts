/**
 * TwiML mínimo para la conversación telefónica. Voz "Polly.Lucia" (español de
 * España, neuronal en cuentas que lo soportan) y reconocimiento es-ES.
 */

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const VOICE = 'language="es-ES" voice="Polly.Lucia"';

/** Dice algo y escucha la respuesta (Gather de voz). actionUrl recibe SpeechResult. */
export function speakAndListen(say: string, actionUrl: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    `<Gather input="speech" language="es-ES" speechTimeout="auto" action="${xmlEscape(actionUrl)}" method="POST">` +
    `<Say ${VOICE}>${xmlEscape(say)}</Say>` +
    `</Gather>` +
    // Si no contesta nada, despedida educada y colgar (evita silencio eterno).
    `<Say ${VOICE}>No le escucho bien. Llamaré en otro momento. Adiós.</Say>` +
    `<Hangup/>` +
    `</Response>`
  );
}

/** Dice la despedida y cuelga. */
export function speakAndHangup(say: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Say ${VOICE}>${xmlEscape(say)}</Say><Hangup/></Response>`
  );
}
