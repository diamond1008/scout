import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  keywords: text("keywords", { mode: "json" }).$type<string[]>(),
  seedHandles: text("seed_handles", { mode: "json" }).$type<string[]>(),
  mode: text("mode", { enum: ["sandbox", "live"] }).notNull().default("sandbox"),
  status: text("status", { enum: ["active", "paused", "completed"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ── Prospect statuses ────────────────────────────────────────────────────────

export const PROSPECT_STATUSES = [
  "DISCOVERED",
  "SCORED",
  "DRAFTED",
  "APPROVED",
  "REJECTED",
  "SENDING",
  "SENT",
  "SENT_SANDBOX",
  "REPLIED",
  "BLOCKED_DM_CLOSED",
  "FAILED_RETRYABLE",
  "FAILED_PERMANENT",
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

// ── Prospects ────────────────────────────────────────────────────────────────

export const prospects = sqliteTable(
  "prospects",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    xUserId: text("x_user_id").notNull(),
    xUsername: text("x_username").notNull(),
    xDisplayName: text("x_display_name"),
    xBio: text("x_bio"),
    xProfileImageUrl: text("x_profile_image_url"),
    xFollowerCount: integer("x_follower_count"),
    xLocation: text("x_location"),
    xVerified: integer("x_verified", { mode: "boolean" }),
    recentTweets: text("recent_tweets", { mode: "json" }).$type<any[]>(),
    pinnedTweet: text("pinned_tweet", { mode: "json" }).$type<any | null>(),
    discoverySource: text("discovery_source"),
    fitScore: real("fit_score"),
    fitReasoning: text("fit_reasoning"),
    evidenceSources: text("evidence_sources", { mode: "json" }).$type<any[]>(),
    draftMessage: text("draft_message"),
    draftEditedBy: text("draft_edited_by"),
    status: text("status", {
      enum: PROSPECT_STATUSES as unknown as [string, ...string[]],
    })
      .notNull()
      .default("DISCOVERED"),
    sentAt: text("sent_at"),
    sendAttempts: integer("send_attempts").notNull().default(0),
    lastError: text("last_error"),
    dmConversationId: text("dm_conversation_id"),
    repliedAt: text("replied_at"),
    replyPreview: text("reply_preview"),
    lockedUntil: text("locked_until"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    unique("uq_prospects_x_user_id").on(table.xUserId),
    index("idx_prospects_status").on(table.status),
    index("idx_prospects_campaign_id").on(table.campaignId),
  ]
);

// ── API Health ───────────────────────────────────────────────────────────────

export const apiHealth = sqliteTable("api_health", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  endpoint: text("endpoint").notNull(),
  remaining: integer("remaining"),
  limitVal: integer("limit_val"),
  resetAt: text("reset_at"),
  lastChecked: text("last_checked"),
  lastErrorCode: text("last_error_code"),
  lastErrorMsg: text("last_error_msg"),
});

// ── Settings ─────────────────────────────────────────────────────────────────

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ── Audit Log ────────────────────────────────────────────────────────────────

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  action: text("action").notNull(),
  prospectId: text("prospect_id"),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
