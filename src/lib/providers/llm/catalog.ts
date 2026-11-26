export type LLMProviderId = "gemini" | "openai" | "anthropic";
export type LLMTier = "free" | "paid";

export interface LLMModelOption {
  value: string;
  label: string;
  tier: LLMTier;
  tierLabel: string;
  description: string;
}

export interface LLMProviderConfig {
  value: LLMProviderId;
  label: string;
  description: string;
  keyName: "google_api_key" | "openai_api_key" | "anthropic_api_key";
  envVar: "GOOGLE_GENERATIVE_AI_API_KEY" | "OPENAI_API_KEY" | "ANTHROPIC_API_KEY";
  keyLabel: string;
  placeholder: string;
  defaultModel: string;
  models: readonly LLMModelOption[];
}

export const LLM_PROVIDERS: readonly LLMProviderConfig[] = [
  {
    value: "gemini",
    label: "Google Gemini",
    description: "Free Tier supported (Flash-Lite) + Paid high-reasoning models",
    keyName: "google_api_key",
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    keyLabel: "Gemini API Key",
    placeholder: "AIzaSy...",
    defaultModel: "gemini-3.5-flash-lite",
    models: [
      {
        value: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash-Lite (Recommended)",
        tier: "free",
        tierLabel: "Free Tier",
        description: "Fast structured scoring & drafting — works on Free Tier API key",
      },
      {
        value: "gemini-flash-lite-latest",
        label: "Gemini Flash-Lite Latest",
        tier: "free",
        tierLabel: "Free Tier",
        description: "Tracks Google's newest Flash-Lite release on Free Tier",
      },
      {
        value: "gemini-3-flash-preview",
        label: "Gemini 3 Flash Preview",
        tier: "free",
        tierLabel: "Free Tier",
        description: "Higher reasoning quality preview (Free Tier rate-limited)",
      },
      {
        value: "gemini-3.8-flash",
        label: "Gemini 3.8 Flash",
        tier: "paid",
        tierLabel: "Paid",
        description: "Flagship Flash speed & quality (requires paid billing / quota)",
      },
      {
        value: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        tier: "paid",
        tierLabel: "Paid ($$)",
        description: "Deep analysis for complex technical founders (Paid API)",
      },
    ],
  },
  {
    value: "openai",
    label: "OpenAI",
    description: "Paid API (credits required) — strict JSON & concise drafting",
    keyName: "openai_api_key",
    envVar: "OPENAI_API_KEY",
    keyLabel: "OpenAI API Key",
    placeholder: "sk-...",
    defaultModel: "gpt-4o-mini",
    models: [
      {
        value: "gpt-4o-mini",
        label: "GPT-4o mini (Recommended)",
        tier: "paid",
        tierLabel: "Paid ($)",
        description: "Low-cost fast JSON scoring & concise DM drafting",
      },
      {
        value: "gpt-4.1-mini",
        label: "GPT-4.1 mini",
        tier: "paid",
        tierLabel: "Paid ($)",
        description: "Strong instruction-following for structured schemas",
      },
      {
        value: "gpt-4o",
        label: "GPT-4o",
        tier: "paid",
        tierLabel: "Paid ($$)",
        description: "Flagship OpenAI reasoning & highest outreach nuance",
      },
    ],
  },
  {
    value: "anthropic",
    label: "Anthropic",
    description: "Paid API (credits required) — high-nuance conversational tone",
    keyName: "anthropic_api_key",
    envVar: "ANTHROPIC_API_KEY",
    keyLabel: "Anthropic API Key",
    placeholder: "sk-ant-...",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      {
        value: "claude-sonnet-4-20250514",
        label: "Claude Sonnet 4 (Recommended)",
        tier: "paid",
        tierLabel: "Paid ($$)",
        description: "High-nuance founder outreach & strict tone control",
      },
      {
        value: "claude-3-5-haiku-latest",
        label: "Claude 3.5 Haiku",
        tier: "paid",
        tierLabel: "Paid ($)",
        description: "Fast, cost-effective Claude model for batch scoring",
      },
      {
        value: "claude-3-7-sonnet-latest",
        label: "Claude 3.7 Sonnet",
        tier: "paid",
        tierLabel: "Paid ($$)",
        description: "Balanced reasoning & natural conversational tone",
      },
    ],
  },
] as const;

export function getProviderConfig(providerId?: string | null): LLMProviderConfig {
  return LLM_PROVIDERS.find((p) => p.value === providerId) || LLM_PROVIDERS[0];
}

export function resolveModelForProvider(
  providerId?: string | null,
  requestedModel?: string | null
): string {
  const provider = getProviderConfig(providerId);
  const match = provider.models.find((m) => m.value === requestedModel);
  return match ? match.value : provider.defaultModel;
}
