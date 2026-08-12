import { serverConfig } from "../../config";
import { AssistantProvider } from "../types";
import { Providers } from "../index";
import { MockAssistantProvider } from "./mock";
import { AnthropicAssistantProvider } from "./anthropic";

/**
 * Assistant factory. Uses Anthropic (conversational, tool-calling) when
 * ANTHROPIC_API_KEY is present; otherwise the deterministic Mock brain. Both
 * act only through the injected providers (real or mock).
 */
export function getAssistant(providers: Providers): AssistantProvider {
  const hasKey = serverConfig.anthropic.apiKey.trim().length > 0;
  if (hasKey) return new AnthropicAssistantProvider(providers);
  return new MockAssistantProvider(providers);
}
