import { serverConfig } from "../../config";
import { AssistantProvider } from "../types";
import { Providers } from "../index";
import { MockAssistantProvider } from "./mock";

/**
 * Assistant factory. Uses Anthropic when ANTHROPIC_API_KEY is present and
 * demo mode is off; otherwise the deterministic Mock brain. Both act only
 * through the injected providers (real or mock).
 */
export function getAssistant(providers: Providers): AssistantProvider {
  const hasKey = serverConfig.anthropic.apiKey.trim().length > 0;
  if (!hasKey || serverConfig.demoMode) {
    return new MockAssistantProvider(providers);
  }
  // TODO(Phase 7): return new AnthropicAssistantProvider(providers);
  return new MockAssistantProvider(providers);
}
