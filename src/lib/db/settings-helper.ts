import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export interface LiveXGateStatus {
  hasBearerToken: boolean;
  hasAccessToken: boolean;
  hasAllTokens: boolean;
  liveVerified: boolean;
  gateReason: string | null;
}

/**
 * Loads all key-value rows from the settings table into a plain map.
 */
export async function getSettingsMap(): Promise<Record<string, string>> {
  const db = getDb();
  const rows = await db.select().from(settings).all();
  return Object.fromEntries((rows as { key: string; value: string }[]).map((s) => [s.key, s.value]));
}

/**
 * Inserts or updates a single key in the settings table.
 */
export async function upsertSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = await db.select().from(settings).where(eq(settings.key, key)).get();

  if (existing) {
    await db.update(settings).set({ value, updatedAt: now }).where(eq(settings.key, key)).run();
  } else {
    await db.insert(settings).values({ key, value, updatedAt: now }).run();
  }
}

/**
 * Evaluates whether Live X API mode is unlocked (both tokens present + health verified).
 */
export function getLiveXStatus(settingsMap: Record<string, string>): LiveXGateStatus {
  const hasBearerToken = Boolean(settingsMap.x_bearer_token?.trim());
  const hasAccessToken = Boolean(settingsMap.x_access_token?.trim());
  const hasAllTokens = hasBearerToken && hasAccessToken;
  const liveVerified = hasAllTokens && settingsMap.x_live_verified === "true";

  let gateReason: string | null = null;
  if (!hasAllTokens) {
    gateReason =
      "X API credentials missing: save both Bearer Token and User OAuth 2.0 Access Token in Settings before enabling Live mode.";
  } else if (!liveVerified) {
    gateReason =
      "X API connection not verified yet: click 'Run Diagnostics & Test Connection' in Settings until Verified before enabling Live mode.";
  }

  return {
    hasBearerToken,
    hasAccessToken,
    hasAllTokens,
    liveVerified,
    gateReason,
  };
}
