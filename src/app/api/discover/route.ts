import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { prospects, campaigns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SandboxXProvider } from "@/lib/providers/x/sandbox";
import { LiveXProvider } from "@/lib/providers/x/live";
import { settings } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { campaignId } = body;

  if (!campaignId) {
    return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  }

  // Get campaign
  const campaign = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .get();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Create provider based on mode
  let provider;
  if (campaign.mode === "sandbox") {
    provider = new SandboxXProvider();
  } else {
    // Get API keys from settings
    const allSettings = await db.select().from(settings).all();
    const settingsMap = Object.fromEntries((allSettings as any[]).map((s) => [s.key, s.value]));

    if (!settingsMap.x_bearer_token) {
      return NextResponse.json(
        { error: "X API Bearer Token not configured. Go to Settings." },
        { status: 400 }
      );
    }

    provider = new LiveXProvider({
      bearerToken: settingsMap.x_bearer_token,
      accessToken: settingsMap.x_access_token || settingsMap.x_bearer_token,
    });
  }

  const discovered: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // Search by keywords
  const keywords = campaign.keywords || [];
  for (const keyword of keywords) {
    try {
      const profiles = await provider.searchUsers(keyword, 10);
      for (const profile of profiles) {
        try {
          // Fetch tweets if not already populated
          if (!profile.recent_tweets || profile.recent_tweets.length === 0) {
            profile.recent_tweets = await provider.getUserTweets(profile.x_user_id, 5);
          }

          await db
            .insert(prospects)
            .values({
              campaignId,
              xUserId: profile.x_user_id,
              xUsername: profile.username,
              xDisplayName: profile.display_name,
              xBio: profile.bio,
              xProfileImageUrl: profile.profile_image_url,
              xFollowerCount: profile.follower_count,
              xLocation: profile.location,
              xVerified: profile.verified,
              recentTweets: profile.recent_tweets,
              pinnedTweet: profile.pinned_tweet,
              discoverySource: `search:${keyword}`,
              status: "DISCOVERED",
            })
            .run();
          discovered.push(profile.username);
        } catch (e: unknown) {
          // UNIQUE constraint violation = already exists (this is the anti-duplicate working!)
          const fullErr = (e instanceof Error ? e.message : "") + " " + String((e as any)?.cause?.message || (e as any)?.cause || "");
          if (fullErr.includes("UNIQUE") || fullErr.includes("unique") || fullErr.includes("SQLITE_CONSTRAINT")) {
            skipped.push(profile.username);
          } else {
            errors.push(`${profile.username}: ${fullErr}`);
          }
        }
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      errors.push(`Search "${keyword}": ${errMsg}`);
    }
  }

  // Lookup seed handles
  const seedHandles = campaign.seedHandles || [];
  for (const handle of seedHandles) {
    try {
      const profile = await provider.getUserByUsername(handle);
      if (!profile) continue;

      if (!profile.recent_tweets || profile.recent_tweets.length === 0) {
        profile.recent_tweets = await provider.getUserTweets(profile.x_user_id, 5);
      }

      try {
        await db
          .insert(prospects)
          .values({
            campaignId,
            xUserId: profile.x_user_id,
            xUsername: profile.username,
            xDisplayName: profile.display_name,
            xBio: profile.bio,
            xProfileImageUrl: profile.profile_image_url,
            xFollowerCount: profile.follower_count,
            xLocation: profile.location,
            xVerified: profile.verified,
            recentTweets: profile.recent_tweets,
            pinnedTweet: profile.pinned_tweet,
            discoverySource: `seed:@${handle.replace(/^@/, "")}`,
            status: "DISCOVERED",
          })
          .run();
        discovered.push(profile.username);
      } catch (e: unknown) {
        const fullErr = (e instanceof Error ? e.message : "") + " " + String((e as any)?.cause?.message || (e as any)?.cause || "");
        if (fullErr.includes("UNIQUE") || fullErr.includes("unique") || fullErr.includes("SQLITE_CONSTRAINT")) {
          skipped.push(profile.username);
        } else {
          errors.push(`${profile.username}: ${fullErr}`);
        }
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      errors.push(`Seed @${handle}: ${errMsg}`);
    }
  }

  return NextResponse.json({
    discovered: discovered.length,
    skipped: skipped.length,
    errors,
    details: { discovered, skipped },
  });
}
