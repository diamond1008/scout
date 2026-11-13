import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: "file:scout.db",
});

// Initialize tables if they don't exist
client.executeMultiple(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    keywords TEXT,
    seed_handles TEXT,
    mode TEXT NOT NULL DEFAULT 'sandbox',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prospects (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    x_user_id TEXT NOT NULL,
    x_username TEXT NOT NULL,
    x_display_name TEXT,
    x_bio TEXT,
    x_profile_image_url TEXT,
    x_follower_count INTEGER,
    x_location TEXT,
    x_verified INTEGER,
    recent_tweets TEXT,
    pinned_tweet TEXT,
    discovery_source TEXT,
    fit_score REAL,
    fit_reasoning TEXT,
    evidence_sources TEXT,
    draft_message TEXT,
    draft_edited_by TEXT,
    status TEXT NOT NULL DEFAULT 'DISCOVERED',
    sent_at TEXT,
    send_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    dm_conversation_id TEXT,
    replied_at TEXT,
    reply_preview TEXT,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(x_user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
  CREATE INDEX IF NOT EXISTS idx_prospects_campaign_id ON prospects(campaign_id);

  CREATE TABLE IF NOT EXISTS api_health (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    remaining INTEGER,
    limit_val INTEGER,
    reset_at TEXT,
    last_checked TEXT,
    last_error_code TEXT,
    last_error_msg TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    prospect_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`).catch((err) => {
  console.error("Error creating tables:", err);
});

export const db = drizzle(client, { schema });
export function getDb() {
  return db;
}
export function getRawDb() {
  return client;
}
export { client };
export default db;
