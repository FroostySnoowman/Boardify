export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  AI?: Ai;
  NOTIFICATION_QUEUE?: Queue;
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
  SMTP_FROM?: string;
  EXPO_ACCESS_TOKEN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PREMIUM_PRICE_ID?: string;
  APPLE_IAP_SHARED_SECRET?: string;
  GOOGLE_PLAY_CLIENT_EMAIL?: string;
  GOOGLE_PLAY_PRIVATE_KEY?: string;
  GOOGLE_PLAY_PACKAGE_NAME?: string;
  DIGEST_DRY_RUN?: string;
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
