export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  BOARD_ROOM?: DurableObjectNamespace;
  AUTH_SECRET?: string;
  AUTH_URL?: string;
  WEB_APP_URL?: string;
  ALLOWED_ORIGINS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
  APPLE_BUNDLE_ID?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  /** Optional Expo access token for higher push rate limits (https://expo.dev/accounts/[account]/settings/access-tokens). */
  EXPO_ACCESS_TOKEN?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  username: string | null;
  mode: string | null;
  statProfile: string | null;
  profilePictureUrl: string | null;
  emailVerified: boolean;
  birthdate: string | null;
  chatDisabled: boolean;
  parentalConsentAt: string | null;
  subscriptionStatus: string | null;
}
