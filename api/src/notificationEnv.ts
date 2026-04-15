import type { Env } from './bindings';

export function getAppUrlFromEnv(env: Env): string {
  const w = env.WEB_APP_URL?.trim();
  if (w) return w.replace(/\/$/, '');
  const first = env.ALLOWED_ORIGINS?.split(',')?.[0]?.trim();
  if (first) return first.replace(/\/$/, '');
  return 'https://boardify.mybreakpoint.app';
}
