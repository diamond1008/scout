import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { prospects, campaigns } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { LiveXProvider } from "@/lib/providers/x/live";
import { getLiveXStatus, getSettingsMap } from "@/lib/db/settings-helper";

const REALISTIC_SANDBOX_REPLIES = [
  "Hi! Thanks for reaching out. Yes, we're currently raising our pre-seed round — would love to find 15 mins next Tuesday to share what we're building.",
  "Hey, great to connect! GenAI Fund's focus on regional AI infra aligns closely with what we're doing. Let's definitely set up a quick intro chat.",
  "Thanks for the warm note! We just shipped our new grasping policy benchmark this week. Happy to walk you through our sim2real roadmap over Zoom.",
  "Appreciate the message! We're heads-down in our testing cycle right now, but open to an informal chat later this week. What's your calendar look like?",
  "Hi! Really glad you noticed our recent developer tools launch. Would be great to hear your thesis on Southeast Asian B2B software.",
];

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { campaignId } = body;

  if (!campaignId) {
    return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  }

  const campaign = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .get();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const sentProspects = await db
    .select()
    .from(prospects)
    .where(
      and(
        eq(prospects.campaignId, campaignId),
        inArray(prospects.status, ["SENT", "SENT_SANDBOX"])
      )
    )
    .all();

  if (sentProspects.length === 0) {
    return NextResponse.json({
      updated: 0,
      message: "No sent messages awaiting replies. Send approved DMs first.",
      replies: [],
    });
  }

  const newReplies: { username: string; reply: string }[] = [];

  if (campaign.mode === "sandbox") {
    // In sandbox mode: simulate realistic replies for sent prospects that haven't replied yet
    for (let i = 0; i < sentProspects.length; i++) {
      const p = sentProspects[i];
      if (p.replyPreview) continue;

      const randomReply =
        REALISTIC_SANDBOX_REPLIES[i % REALISTIC_SANDBOX_REPLIES.length];

      await db
        .update(prospects)
        .set({
          status: "REPLIED",
          repliedAt: new Date().toISOString(),
          replyPreview: randomReply,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(prospects.id, p.id))
        .run();

      newReplies.push({ username: p.xUsername, reply: randomReply });
    }
  } else {
    // Live mode: Poll official X API v2 dm_events
    const settingsMap = await getSettingsMap();
    const xGate = getLiveXStatus(settingsMap);

    if (!xGate.liveVerified) {
      return NextResponse.json(
        { error: xGate.gateReason || "Live X API mode is locked until verified in Settings." },
        { status: 400 }
      );
    }

    const liveProvider = new LiveXProvider({
      bearerToken: settingsMap.x_bearer_token,
      accessToken: settingsMap.x_access_token,
    });

    try {
      const events = await liveProvider.getDMEvents();
      for (const event of events) {
        // Find matching sent prospect
        const matching = sentProspects.find(
          (p) => p.xUserId === event.sender_id
        );
        if (matching && !matching.replyPreview) {
          await db
            .update(prospects)
            .set({
              status: "REPLIED",
              repliedAt: event.created_at || new Date().toISOString(),
              replyPreview: event.text,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(prospects.id, matching.id))
            .run();

          newReplies.push({ username: matching.xUsername, reply: event.text });
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }
  }

  return NextResponse.json({
    updated: newReplies.length,
    message:
      newReplies.length > 0
        ? `Synced ${newReplies.length} new replies!`
        : "All sent messages checked. No new replies yet.",
    replies: newReplies,
  });
}
