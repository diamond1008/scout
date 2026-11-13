import type {
  IXProvider,
  UserProfile,
  TweetData,
  DMResult,
  DMEvent,
  HealthStatus,
} from "./types";
import { RateLimitError, AuthenticationError, XApiError } from "./types";
import { TokenBucketRateLimiter } from "./rate-limiter";

const X_API_BASE = "https://api.x.com/2";

const USER_FIELDS = "id,name,username,description,location,public_metrics,profile_image_url,verified_type";
const TWEET_FIELDS = "text,created_at,public_metrics";

export class LiveXProvider implements IXProvider {
  private bearerToken: string;
  private accessToken: string;
  private rateLimiter: TokenBucketRateLimiter;

  constructor(config: {
    bearerToken: string;
    accessToken: string;
  }) {
    this.bearerToken = config.bearerToken;
    this.accessToken = config.accessToken;
    this.rateLimiter = new TokenBucketRateLimiter();
  }

  async searchUsers(query: string, maxResults: number = 20): Promise<UserProfile[]> {
    await this.rateLimiter.acquire("tweets_search");

    // Search recent tweets with expansions to get author profiles
    const params = new URLSearchParams({
      query: `${query} -is:retweet`,
      max_results: String(Math.min(maxResults * 2, 100)),
      "tweet.fields": TWEET_FIELDS,
      expansions: "author_id",
      "user.fields": USER_FIELDS,
    });

    const resp = await this.fetchWithAuth(
      `${X_API_BASE}/tweets/search/recent?${params}`,
      "bearer"
    );
    const data = await this.handleResponse(resp, "tweets_search");

    // Extract unique users
    const usersMap = new Map<string, UserProfile>();
    const includes = data.includes?.users || [];
    const tweets = data.data || [];

    for (const user of includes) {
      if (usersMap.has(user.id)) continue;
      // Gather this user's tweets from the search
      const userTweets = tweets
        .filter((t: { author_id: string }) => t.author_id === user.id)
        .map(this.mapTweet);

      usersMap.set(user.id, {
        x_user_id: user.id,
        username: user.username,
        display_name: user.name,
        bio: user.description || "",
        location: user.location || "",
        follower_count: user.public_metrics?.followers_count || 0,
        verified: !!user.verified_type,
        profile_image_url: user.profile_image_url || "",
        recent_tweets: userTweets,
        pinned_tweet: null,
      });
    }

    return Array.from(usersMap.values()).slice(0, maxResults);
  }

  async getUserByUsername(username: string): Promise<UserProfile | null> {
    await this.rateLimiter.acquire("users_lookup");

    const clean = username.replace(/^@/, "");
    const params = new URLSearchParams({ "user.fields": USER_FIELDS });
    const resp = await this.fetchWithAuth(
      `${X_API_BASE}/users/by/username/${clean}?${params}`,
      "bearer"
    );
    const data = await this.handleResponse(resp, "users_lookup");

    if (!data.data) return null;

    const user = data.data;
    const tweets = await this.getUserTweets(user.id, 10);

    return {
      x_user_id: user.id,
      username: user.username,
      display_name: user.name,
      bio: user.description || "",
      location: user.location || "",
      follower_count: user.public_metrics?.followers_count || 0,
      verified: !!user.verified_type,
      profile_image_url: user.profile_image_url || "",
      recent_tweets: tweets,
      pinned_tweet: null,
    };
  }

  async getUserTweets(userId: string, maxResults: number = 10): Promise<TweetData[]> {
    await this.rateLimiter.acquire("user_tweets");

    const params = new URLSearchParams({
      max_results: String(Math.min(maxResults, 100)),
      "tweet.fields": TWEET_FIELDS,
    });

    const resp = await this.fetchWithAuth(
      `${X_API_BASE}/users/${userId}/tweets?${params}`,
      "bearer"
    );
    const data = await this.handleResponse(resp, "user_tweets");

    return (data.data || []).map(this.mapTweet);
  }

  async sendDM(recipientId: string, text: string): Promise<DMResult> {
    await this.rateLimiter.acquire("dm_send");

    try {
      const resp = await this.fetchWithAuth(
        `${X_API_BASE}/dm_conversations/with/${recipientId}/messages`,
        "oauth",
        {
          method: "POST",
          body: JSON.stringify({ text }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (resp.status === 403) {
        return {
          success: false,
          error_code: 403,
          error_message: "Cannot send DM: user has DMs closed or has blocked you.",
        };
      }

      const data = await this.handleResponse(resp, "dm_send");

      return {
        success: true,
        dm_conversation_id: data.data?.dm_conversation_id,
      };
    } catch (err) {
      if (err instanceof RateLimitError) throw err; // let caller handle
      return {
        success: false,
        error_code: err instanceof XApiError ? err.statusCode : 500,
        error_message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async getDMEvents(): Promise<DMEvent[]> {
    await this.rateLimiter.acquire("dm_events");

    const params = new URLSearchParams({
      "dm_event.fields": "text,created_at,sender_id,participant_ids",
      max_results: "100",
    });

    const resp = await this.fetchWithAuth(
      `${X_API_BASE}/dm_events?${params}`,
      "oauth"
    );
    const data = await this.handleResponse(resp, "dm_events");

    return (data.data || []).map((e: Record<string, string>) => ({
      event_id: e.id,
      sender_id: e.sender_id,
      recipient_id: "", // derived from conversation context
      text: e.text || "",
      created_at: e.created_at || "",
    }));
  }

  async getHealth(): Promise<HealthStatus> {
    try {
      const resp = await this.fetchWithAuth(
        `${X_API_BASE}/users/me?user.fields=username`,
        "oauth"
      );
      const data = await resp.json();

      if (!resp.ok) {
        return {
          connected: false,
          mode: "live",
          endpoints: {},
          error: data.detail || data.title || `HTTP ${resp.status}`,
        };
      }

      return {
        connected: true,
        username: data.data?.username,
        mode: "live",
        endpoints: this.rateLimiter.getStatus(),
      };
    } catch (err) {
      return {
        connected: false,
        mode: "live",
        endpoints: {},
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async fetchWithAuth(
    url: string,
    authType: "bearer" | "oauth",
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(options.headers);

    if (authType === "bearer") {
      headers.set("Authorization", `Bearer ${this.bearerToken}`);
    } else {
      // OAuth 2.0 User Context — using the access token directly
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    return fetch(url, { ...options, headers });
  }

  private async handleResponse(resp: Response, endpoint: string): Promise<any> {
    // Update rate limiter from headers
    this.rateLimiter.updateFromHeaders(endpoint, resp.headers);

    if (resp.status === 429) {
      const resetHeader = resp.headers.get("x-rate-limit-reset");
      const resetAt = resetHeader
        ? new Date(parseInt(resetHeader, 10) * 1000)
        : new Date(Date.now() + 60_000);
      throw new RateLimitError(endpoint, resetAt);
    }

    if (resp.status === 401) {
      throw new AuthenticationError(
        "Invalid or expired authentication token. Please update your X API credentials in Settings."
      );
    }

    if (resp.status >= 500) {
      throw new XApiError(resp.status, `X API server error: ${resp.statusText}`);
    }

    if (!resp.ok && resp.status !== 403) {
      const body = await resp.text();
      throw new XApiError(resp.status, `X API error (${resp.status}): ${body}`);
    }

    return resp.json();
  }

  private mapTweet(t: Record<string, unknown>): TweetData {
    const metrics = (t.public_metrics || {}) as Record<string, number>;
    return {
      tweet_id: t.id as string,
      text: t.text as string,
      created_at: t.created_at as string || "",
      metrics: {
        likes: metrics.like_count || 0,
        retweets: metrics.retweet_count || 0,
        replies: metrics.reply_count || 0,
      },
    };
  }
}
