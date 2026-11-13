import { NextRequest, NextResponse } from "next/server";
import { getDb, getRawDb } from "@/lib/db";
import { prospects, campaigns, settings, auditLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { SandboxXProvider } from "@/lib/providers/x/sandbox";
import { LiveXProvider } from "@/lib/providers/x/live";
import type { IXProvider } from "@/lib/providers/x/types";

export async function POST(req: NextRequest) {
  const db = getDb();
  const raw = getRawDb();
  const body = await req.json();
  const { campaignId } = body;

  if (!campaignId) {
    return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  }

  // Get campaign to determine mode
  const campaign = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .get();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Create provider
  let provider: IXProvider;
  if (campaign.mode === "sandbox") {
    provider = new SandboxXProvider();
  } else {
    const allSettings = await db.select().from(settings).all();
    const settingsMap = Object.fromEntries((allSettings as any[]).map((s) => [s.key, s.value]));
    if (!settingsMap.x_access_token) {
      return NextResponse.json(
        { error: "X API Access Token not configured. Go to Settings." },
        { status: 400 }
      );
    }
    provider = new LiveXProvider({
      bearerToken: settingsMap.x_bearer_token || settingsMap.x_access_token,
      accessToken: settingsMap.x_access_token,
    });
  }

  // Get all APPROVED prospects for this campaign
  const approved = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.campaignId, campaignId), eq(prospects.status, "APPROVED")))
    .all();

  const results: { id: string; username: string; status: string; error?: string }[] = [];

  for (const prospect of approved) {
    // ★ ATOMIC STATUS TRANSITION with optimistic locking ★
    // Only pick up if still APPROVED and not locked
    const nowIso = new Date().toISOString();
    const lockUntilIso = new Date(Date.now() + 30_000).toISOString();
    const lockResult = await raw.execute({
      sql: `UPDATE prospects
            SET status = 'SENDING', locked_until = ?, updated_at = ?, send_attempts = send_attempts + 1
            WHERE id = ? AND status = 'APPROVED' AND (locked_until IS NULL OR locked_until < ?)`,
      args: [lockUntilIso, nowIso, prospect.id, nowIso],
    });

    if (lockResult.rowsAffected === 0) {
      results.push({
        id: prospect.id,
        username: prospect.xUsername || "",
        status: "skipped",
        error: "Already being processed or locked",
      });
      continue;
    }

    // ★ PRE-SEND ASSERTION ★
    const recheck = await raw.execute({
      sql: "SELECT status FROM prospects WHERE id = ?",
      args: [prospect.id],
    });

    const currentStatus = recheck.rows[0]?.status as string | undefined;

    if (currentStatus !== "SENDING") {
      results.push({
        id: prospect.id,
        username: prospect.xUsername || "",
        status: "skipped",
        error: "Status changed during lock acquisition",
      });
      continue;
    }

    try {
      const dmResult = await provider.sendDM(
        prospect.xUserId,
        prospect.draftMessage || ""
      );

      if (dmResult.success) {
        const sentStatus = campaign.mode === "sandbox" ? "SENT_SANDBOX" : "SENT";
        await db
          .update(prospects)
          .set({
            status: sentStatus,
            sentAt: new Date().toISOString(),
            dmConversationId: dmResult.dm_conversation_id || null,
            lastError: null,
            lockedUntil: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(prospects.id, prospect.id))
          .run();

        // Audit log
        await db
          .insert(auditLog)
          .values({
            action: "DM_SENT",
            prospectId: prospect.id,
            details: {
              username: prospect.xUsername || "",
              mode: campaign.mode,
              dm_conversation_id: dmResult.dm_conversation_id,
            },
          })
          .run();

        results.push({ id: prospect.id, username: prospect.xUsername || "", status: sentStatus });
      } else {
        // Handle failure
        const failStatus =
          dmResult.error_code === 403
            ? "BLOCKED_DM_CLOSED"
            : dmResult.error_code === 429
            ? "FAILED_RETRYABLE"
            : "FAILED_PERMANENT";

        await db
          .update(prospects)
          .set({
            status: failStatus,
            lastError: dmResult.error_message || `Error ${dmResult.error_code}`,
            lockedUntil: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(prospects.id, prospect.id))
          .run();

        results.push({
          id: prospect.id,
          username: prospect.xUsername || "",
          status: failStatus,
          error: dmResult.error_message,
        });
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      // On error, set to FAILED_RETRYABLE if we haven't exceeded max attempts
      const currentAttempts = (prospect.sendAttempts || 0) + 1;
      const failStatus = currentAttempts >= 3 ? "FAILED_PERMANENT" : "FAILED_RETRYABLE";

      await db
        .update(prospects)
        .set({
          status: failStatus,
          lastError: errMsg,
          lockedUntil: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(prospects.id, prospect.id))
        .run();

        results.push({
          id: prospect.id,
          username: prospect.xUsername || "",
          status: failStatus,
          error: errMsg,
        });
      }
  }

  return NextResponse.json({
    total: approved.length,
    results,
  });
}
