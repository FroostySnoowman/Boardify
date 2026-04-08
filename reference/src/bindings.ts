export interface Env {
  DB: D1Database
  IMAGES: R2Bucket
  AUTH_SECRET: string
  AUTH_URL?: string
  WEB_APP_URL?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  APPLE_CLIENT_ID?: string
  APPLE_CLIENT_SECRET?: string
  APPLE_BUNDLE_ID?: string
  MATCH_SPECTATE: DurableObjectNamespace
  MATCH_RADIO: DurableObjectNamespace
  LIVE_MATCHES_LIST: DurableObjectNamespace
  MESSAGE_WS: DurableObjectNamespace
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_STREAMS_API_TOKEN?: string
  APNS_KEY_ID?: string
  APNS_TEAM_ID?: string
  APNS_BUNDLE_ID?: string
  APNS_KEY_P8?: string
  APNS_PRODUCTION?: string
  /** Optional: set in .dev.vars to allow POST /live-activity-push-token/test without session when X-Test-Secret header matches */
  LIVE_ACTIVITY_TEST_SECRET?: string
  /** Optional: Discord webhook URL to post Live Activity cron run summary (events in window, tokens, pushes, errors) */
  LIVE_ACTIVITY_LOG_WEBHOOK?: string
  /** Optional: Discord webhook URL for in-app bug reports (More Settings) */
  BUG_REPORT_WEBHOOK_URL?: string
  /** Optional: Discord webhook URL for in-app feature suggestions (More Settings) */
  SUGGESTIONS_WEBHOOK_URL?: string
  /** Optional: Klipy API key for GIF search (Tenor-compatible migration API) */
  KLIPY_API_KEY?: string
  /** Optional: OpenAI moderations API (omni-moderation-latest). When set with no IMAGE_MODERATION_API_URL, chat images are checked before storage. */
  OPENAI_API_KEY?: string
  /** Optional: custom moderation — POST image body, JSON `{ "safe": boolean }`. Used when OPENAI_API_KEY is unset. If neither is set, chat images upload without verification. */
  IMAGE_MODERATION_API_URL?: string
  SMTP_HOST?: string
  SMTP_PORT?: string
  SMTP_USER?: string
  SMTP_PASS?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  /** Stripe Price ID for Plus monthly (e.g. price_xxx, recurring monthly). */
  STRIPE_PLUS_PRICE_ID?: string
  /** Stripe Price ID for Plus yearly/annual (e.g. price_1TDdCoEiF8IzZjCRJaTG1ZXr). */
  STRIPE_PLUS_ANNUAL_PRICE_ID?: string
  APPLE_IAP_SHARED_SECRET?: string
  APP_STORE_CONNECT_KEY_ID?: string
  APP_STORE_CONNECT_ISSUER_ID?: string
  APP_STORE_CONNECT_KEY_P8?: string
  GOOGLE_PLAY_CLIENT_EMAIL?: string
  GOOGLE_PLAY_PRIVATE_KEY?: string
}

export interface AuthenticatedUser {
  id: string
  email: string | null
  username: string | null
  mode: string | null
  statProfile: string | null
  profilePictureUrl: string | null
  emailVerified: boolean
  birthdate: string | null
  chatDisabled: boolean
  parentalConsentAt: string | null
  subscriptionStatus: string | null
}