import { serverConfig } from "../../config";
import { AssistantProvider } from "../types";
import { Providers } from "../index";
import { MockAssistantProvider } from "./mock";
import { AnthropicAssistantProvider, AssistantExtras } from "./anthropic";

export type { AssistantExtras } from "./anthropic";

/**
 * Assistant factory. Uses Anthropic (conversational, tool-calling) when
 * ANTHROPIC_API_KEY is present; otherwise the deterministic Mock brain. Both
 * act only through the injected providers (real or mock). `extras` carries
 * per-request capabilities like the persistent memory closures.
 */
export function getAssistant(providers: Providers, extras: AssistantExtras = {}): AssistantProvider {
  const hasKey = serverConfig.anthropic.apiKey.trim().length > 0;
  if (hasKey) return new AnthropicAssistantProvider(providers, extras);
  return new MockAssistantProvider(providers);
}
