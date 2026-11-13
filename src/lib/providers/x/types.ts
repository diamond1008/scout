// X Provider types — shared between Live and Sandbox implementations

export interface TweetData {
  tweet_id: string;
  text: string;
  created_at: string;
  metrics: { likes: number; retweets: number; replies: number };
}

export interface UserProfile {
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
}

export interface DMResult {
  success: boolean;
  dm_conversation_id?: string;
  error_code?: number;
  error_message?: string;
}

export interface DMEvent {
  event_id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  created_at: string;
}

export interface HealthStatus {
  connected: boolean;
  username?: string;
  mode: "live" | "sandbox";
  endpoints: Record<string, { remaining: number; limit: number; reset_at: string }>;
  error?: string;
}

export interface IXProvider {
  searchUsers(query: string, maxResults?: number): Promise<UserProfile[]>;
  getUserByUsername(username: string): Promise<UserProfile | null>;
  getUserTweets(userId: string, maxResults?: number): Promise<TweetData[]>;
  sendDM(recipientId: string, text: string): Promise<DMResult>;
  getDMEvents(): Promise<DMEvent[]>;
  getHealth(): Promise<HealthStatus>;
}

// Typed errors for the Live provider
export class RateLimitError extends Error {
  resetAt: Date;
  endpoint: string;
  constructor(endpoint: string, resetAt: Date) {
    super(`Rate limited on ${endpoint}. Resets at ${resetAt.toISOString()}`);
    this.name = "RateLimitError";
    this.endpoint = endpoint;
    this.resetAt = resetAt;
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class XApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "XApiError";
    this.statusCode = statusCode;
  }
}
