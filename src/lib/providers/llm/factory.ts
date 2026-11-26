import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { HeuristicSandboxProvider } from "./heuristic-sandbox";
import { getProviderConfig, resolveModelForProvider, type LLMProviderId } from "./catalog";
import type { ILLMProvider } from "./types";

export interface ResolvedLLM {
  provider: LLMProviderId;
  model: string;
  apiKey: string;
  hasKey: boolean;
  llm: ILLMProvider;
}

/**
 * Resolves the active LLM provider, selected model, API key, and concrete ILLMProvider instance
 * from saved settings (falling back cleanly to HeuristicSandboxProvider when unconfigured).
 */
export function resolveLLMFromSettings(settingsMap: Record<string, string>): ResolvedLLM {
  const providerConfig = getProviderConfig(settingsMap.llm_provider);
  const model = resolveModelForProvider(providerConfig.value, settingsMap.llm_model);
  const rawKey = settingsMap[providerConfig.keyName] || process.env[providerConfig.envVar] || "";
  const apiKey = rawKey.trim().replace(/^['"]+|['"]+$/g, "");
  const hasKey = Boolean(apiKey);

  let llm: ILLMProvider;
  if (!hasKey) {
    llm = new HeuristicSandboxProvider();
  } else {
    switch (providerConfig.value) {
      case "openai":
        llm = new OpenAIProvider(apiKey, model);
        break;
      case "anthropic":
        llm = new AnthropicProvider(apiKey, model);
        break;
      case "gemini":
      default:
        llm = new GeminiProvider(apiKey, model);
        break;
    }
  }

  return {
    provider: providerConfig.value,
    model,
    apiKey,
    hasKey,
    llm,
  };
}
