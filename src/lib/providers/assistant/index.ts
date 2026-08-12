import { serverConfig } from "../../config";
import { AssistantProvider } from "../types";
import { MockAssistantProvider } from "./mock";

/**
 * Assistant factory. Uses Anthropic when ANTHROPIC_API_KEY is present and
 * demo mode is off; otherwise the deterministic Mock brain. The Anthropic
 * provider (Phase 7) shares the same tool layer as the mock.
 */
export function getAssistant(): AssistantProvider {
  const hasKey = serverConfig.anthropic.apiKey.trim().length > 0;
  if (!hasKey || serverConfig.demoMode) {
    return new MockAssistantProvider();
  }
  // TODO(Phase 7): return new AnthropicAssistantProvider();
  return new MockAssistantProvider();
}
