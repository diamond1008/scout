import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { SandboxXProvider } from "@/lib/providers/x/sandbox";
import { LiveXProvider } from "@/lib/providers/x/live";

export async function GET() {
  const db = getDb();
  const allSettings = await db.select().from(settings).all();
  const settingsMap = Object.fromEntries(
    (allSettings as any[]).map((s) => [s.key, s.value])
  );

  const hasXKeys = !!(settingsMap.x_bearer_token || settingsMap.x_access_token);
  const hasLLMKey = !!(
    settingsMap.google_api_key ||
    settingsMap.openai_api_key ||
    settingsMap.anthropic_api_key ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  if (hasXKeys) {
    try {
      const live = new LiveXProvider({
        bearerToken: settingsMap.x_bearer_token || settingsMap.x_access_token,
        accessToken: settingsMap.x_access_token || settingsMap.x_bearer_token,
      });
      const health = await live.getHealth();
      return NextResponse.json({
        ...health,
        hasLLMKey,
        mode: "live",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({
        connected: false,
        error: msg,
        hasLLMKey,
        mode: "live",
      });
    }
  }

  // Fallback to Sandbox
  const sandbox = new SandboxXProvider();
  const health = await sandbox.getHealth();
  return NextResponse.json({
    ...health,
    hasLLMKey,
    note: "Running in Safe Sandbox Mode. Zero X API credits consumed.",
  });
}
