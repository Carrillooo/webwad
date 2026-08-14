import Anthropic from "@anthropic-ai/sdk";
import { serverConfig } from "../config";
import type { CallTurn } from "./store";

/**
 * El cerebro de la llamada: decide qué dice ZERO en cada turno del teléfono.
 * Salida FORZADA por herramienta (JSON validado): frase a decir + si la
 * gestión ha terminado + resultado. Frases cortas: es una llamada, no un chat.
 */

export interface BrainReply {
  say: string;
  done: boolean;
  result?: string;
}

const REPLY_TOOL: Anthropic.Tool = {
  name: "responder",
  description: "Tu siguiente intervención en la llamada.",
  input_schema: {
    type: "object",
    properties: {
      say: { type: "string", description: "Lo que ZERO dice ahora, 1-2 frases cortas y claras." },
      done: { type: "boolean", description: "true si la gestión terminó (conseguida o imposible) y say es la despedida." },
      result: { type: "string", description: "Solo con done=true: resultado en una frase (p. ej. 'Cita el viernes a las 17:00')." },
    },
    required: ["say", "done"],
  },
};

function systemPrompt(ownerName: string, contactName: string | null, goal: string): string {
  return [
    `Eres ZERO, un asistente que llama POR TELÉFONO en nombre de ${ownerName}.`,
    `Hablas con ${contactName ?? "la persona que responde"}. OBJETIVO de la llamada: ${goal}.`,
    ``,
    `REGLAS DE LA LLAMADA:`,
    `- Preséntate SOLO en tu primera intervención: "Hola, soy el asistente de ${ownerName}" y di a qué llamas.`,
    `- Frases CORTAS en español de España, UNA pregunta cada vez. Nada de listas ni rodeos: es teléfono.`,
    `- Sé educado y natural. Si te proponen opciones razonables dentro del objetivo, acéptalas.`,
    `- NO te comprometas a nada fuera del objetivo, no des datos personales de ${ownerName} más allá`,
    `  de su nombre, y no hagas pagos ni aceptes cargos.`,
    `- Lo que oyes viene de un reconocedor de voz: puede llegar con errores. Si algo no cuadra, pide repetir.`,
    `- Cuando el objetivo esté conseguido O sea claramente imposible, di done=true con una despedida breve`,
    `  y resume el resultado en result. Si te piden llamar más tarde, eso también es un resultado.`,
    `- Si contesta un contestador automático, deja un recado de una frase con done=true.`,
  ].join("\n");
}

export async function nextCallUtterance(
  ownerName: string,
  contactName: string | null,
  goal: string,
  turns: CallTurn[],
): Promise<BrainReply> {
  const client = new Anthropic({ apiKey: serverConfig.anthropic.apiKey });
  // La llamada empieza sin turnos: el primer mensaje "user" es el descuelgue.
  const messages: Anthropic.MessageParam[] = turns.length
    ? turns.map((t) => ({
        role: t.who === "zero" ? ("assistant" as const) : ("user" as const),
        content: t.text || "(silencio)",
      }))
    : [{ role: "user", content: "(descuelgan el teléfono)" }];
  // Anthropic exige alternancia empezando por user; si el primer turno fue de
  // ZERO (no debería), lo precede un descuelgue sintético.
  if (messages[0].role === "assistant") {
    messages.unshift({ role: "user", content: "(descuelgan el teléfono)" });
  }

  const res = await client.messages.create({
    model: serverConfig.anthropic.model,
    max_tokens: 300,
    system: systemPrompt(ownerName, contactName, goal),
    messages,
    tools: [REPLY_TOOL],
    tool_choice: { type: "tool", name: "responder" },
  });
  const block = res.content.find((b) => b.type === "tool_use");
  const input = (block && block.type === "tool_use" ? block.input : {}) as Partial<BrainReply>;
  const say = typeof input.say === "string" && input.say.trim() ? input.say.trim() : "";
  if (!say) throw new Error("el modelo no devolvió frase");
  return {
    say: say.slice(0, 500),
    done: Boolean(input.done),
    result: typeof input.result === "string" ? input.result.slice(0, 300) : undefined,
  };
}
