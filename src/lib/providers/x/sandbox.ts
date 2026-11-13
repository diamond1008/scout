import type {
  IXProvider,
  UserProfile,
  TweetData,
  DMResult,
  DMEvent,
  HealthStatus,
} from "./types";
import seedProfilesJson from "@/data/seed-profiles.json";

interface SeedProfile {
  x_user_id: string;
  username: string;
  display_name: string;
  bio: string;
  location: string;
  follower_count: number;
  verified: boolean;
  profile_image_url: string;
  recent_tweets: TweetData[];
  pinned_tweet: TweetData | null;
  discovery_source: string;
}

// Track sandbox DM sends for simulating replies
interface SandboxDMRecord {
  recipientId: string;
  text: string;
  sentAt: number;
  conversationId: string;
}

const SIMULATED_REPLIES = [
  "Thanks for reaching out! I'd love to chat — what times work for you?",
  "Interesting — we're actually looking for investors right now. Let me send you our deck.",
  "Appreciate the message! Can you tell me more about GenAI Fund's thesis?",
  "Hey! Yeah happy to connect. I'll DM you my calendar link.",
  "Thanks! We just closed our pre-seed but always happy to chat with folks in the ecosystem.",
  "Cool to hear from you! We're heads-down building right now but open to a quick call next week.",
];

export class SandboxXProvider implements IXProvider {
  private seedProfiles: SeedProfile[] = seedProfilesJson as SeedProfile[];
  private sentDMs: SandboxDMRecord[] = [];
  private repliedSet: Set<string> = new Set();

  async searchUsers(query: string, maxResults: number = 20): Promise<UserProfile[]> {
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/);

    const matches = this.seedProfiles.filter((profile) => {
      const searchable = [
        profile.bio,
        profile.display_name,
        profile.username,
        profile.location,
        ...profile.recent_tweets.map((t) => t.text),
      ]
        .join(" ")
        .toLowerCase();

      return keywords.some((kw) => searchable.includes(kw));
    });

    return matches.slice(0, maxResults).map(this.toUserProfile);
  }

  async getUserByUsername(username: string): Promise<UserProfile | null> {
    const clean = username.replace(/^@/, "");
    const profile = this.seedProfiles.find(
      (p) => p.username.toLowerCase() === clean.toLowerCase()
    );
    return profile ? this.toUserProfile(profile) : null;
  }

  async getUserTweets(userId: string, maxResults: number = 10): Promise<TweetData[]> {
    const profile = this.seedProfiles.find((p) => p.x_user_id === userId);
    if (!profile) return [];
    return profile.recent_tweets.slice(0, maxResults);
  }

  async sendDM(recipientId: string, text: string): Promise<DMResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 10% chance the user has DMs closed
    if (Math.random() < 0.1) {
      return {
        success: false,
        error_code: 403,
        error_message: "You cannot send messages to this user (DMs are closed).",
      };
    }

    const conversationId = `sandbox_conv_${recipientId}_${Date.now()}`;
    this.sentDMs.push({
      recipientId,
      text,
      sentAt: Date.now(),
      conversationId,
    });

    return {
      success: true,
      dm_conversation_id: conversationId,
    };
  }

  async getDMEvents(): Promise<DMEvent[]> {
    const events: DMEvent[] = [];
    const now = Date.now();

    for (const dm of this.sentDMs) {
      // Only generate replies for DMs sent > 10s ago
      if (now - dm.sentAt < 10_000) continue;
      // Only 30% reply rate
      if (this.repliedSet.has(dm.recipientId)) continue;

      if (Math.random() < 0.3) {
        this.repliedSet.add(dm.recipientId);
        const replyText =
          SIMULATED_REPLIES[Math.floor(Math.random() * SIMULATED_REPLIES.length)];
        events.push({
          event_id: `sandbox_event_${dm.recipientId}_${Date.now()}`,
          sender_id: dm.recipientId,
          recipient_id: "self",
          text: replyText,
          created_at: new Date(dm.sentAt + 15_000).toISOString(),
        });
      }
    }

    return events;
  }

  async getHealth(): Promise<HealthStatus> {
    return {
      connected: true,
      username: "sandbox_operator",
      mode: "sandbox",
      endpoints: {
        dm_send: { remaining: 15, limit: 15, reset_at: new Date(Date.now() + 900_000).toISOString() },
        tweets_search: { remaining: 450, limit: 450, reset_at: new Date(Date.now() + 900_000).toISOString() },
        users_lookup: { remaining: 300, limit: 300, reset_at: new Date(Date.now() + 900_000).toISOString() },
      },
    };
  }

  private toUserProfile(p: SeedProfile): UserProfile {
    return {
      x_user_id: p.x_user_id,
      username: p.username,
      display_name: p.display_name,
      bio: p.bio,
      location: p.location,
      follower_count: p.follower_count,
      verified: p.verified,
      profile_image_url: p.profile_image_url,
      recent_tweets: p.recent_tweets,
      pinned_tweet: p.pinned_tweet,
    };
  }
}
