import { NextResponse } from "next/server";
import { SandboxXProvider } from "@/lib/providers/x/sandbox";
import { LiveXProvider } from "@/lib/providers/x/live";
import { getLiveXStatus, getSettingsMap, upsertSetting } from "@/lib/db/settings-helper";
import { resolveLLMFromSettings } from "@/lib/providers/llm/factory";

export async function GET() {
  const settingsMap = await getSettingsMap();

  const xGate = getLiveXStatus(settingsMap);
  const hasXKeys = xGate.hasBearerToken || xGate.hasAccessToken;
  const llmConfig = resolveLLMFromSettings(settingsMap);
  const llmProvider = llmConfig.provider;
  const llmModel = llmConfig.model;
  const hasLLMKey = llmConfig.hasKey;

  if (hasXKeys) {
    try {
      const live = new LiveXProvider({
        bearerToken: settingsMap.x_bearer_token || settingsMap.x_access_token,
        accessToken: settingsMap.x_access_token || settingsMap.x_bearer_token,
      });
      const health = await live.getHealth();
      const verified = xGate.hasAllTokens && Boolean(health.connected);
      await upsertSetting("x_live_verified", verified ? "true" : "");

      return NextResponse.json({
        ...health,
        connected: xGate.hasAllTokens ? health.connected : false,
        error: !xGate.hasAllTokens
          ? health.error || "Both Bearer Token and User OAuth 2.0 Access Token are required to unlock Live mode."
          : health.error,
        hasLLMKey,
        llmProvider,
        llmModel,
        hasBearerToken: xGate.hasBearerToken,
        hasAccessToken: xGate.hasAccessToken,
        liveVerified: verified,
        rate_limit_remaining: health.endpoints?.dm_send?.remaining ?? null,
        mode: "live",
      });
    } catch (err: unknown) {
      await upsertSetting("x_live_verified", "");
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({
        connected: false,
        error: msg,
        hasLLMKey,
        llmProvider,
        llmModel,
        hasBearerToken: xGate.hasBearerToken,
        hasAccessToken: xGate.hasAccessToken,
        liveVerified: false,
        rate_limit_remaining: null,
        mode: "live",
      });
    }
  }

  if (settingsMap.x_live_verified) {
    await upsertSetting("x_live_verified", "");
  }

  // Fallback to Sandbox
  const sandbox = new SandboxXProvider();
  const health = await sandbox.getHealth();
  return NextResponse.json({
    ...health,
    hasLLMKey,
    llmProvider,
    llmModel,
    hasBearerToken: false,
    hasAccessToken: false,
    liveVerified: false,
    rate_limit_remaining: health.endpoints?.dm_send?.remaining ?? 15,
    note: "Running in Safe Sandbox Mode. Zero X API credits consumed.",
  });
}
