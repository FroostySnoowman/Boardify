import { Platform } from 'react-native';
import { ENV } from '../config/env';
import { getStoredSessionToken } from './session';

let _d1Bookmark: string | null = null;

function stringifyParams(p?: Record<string, any>) {
  if (!p) return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v == null) continue;
    if (Array.isArray(v)) out[k] = v.map(x => String(x));
    else out[k] = String(v);
  }
  return out;
}

function buildUrl(path: string, params?: Record<string, any>): string {
  let base = ENV.API_BASE.replace(/\/$/, '');

  if (Platform.OS === 'android' && base.includes('localhost')) {
    base = base.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }

  if (base.startsWith('http')) {
    const url = new URL(base + path);
    if (params) {
      const qp = stringifyParams(params);
      for (const [k, v] of Object.entries(qp)) {
        if (Array.isArray(v)) {
          v.forEach(x => url.searchParams.append(k, x as string));
        } else {
          url.searchParams.set(k, v as string);
        }
      }
    }
    return url.toString();
  } else {
    const fallbackBase = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
    const url = new URL(base + path, ENV.APP_URL || fallbackBase);
    if (params) {
      const qp = stringifyParams(params);
      for (const [k, v] of Object.entries(qp)) {
        if (Array.isArray(v)) {
          v.forEach(x => url.searchParams.append(k, x as string));
        } else {
          url.searchParams.set(k, v as string);
        }
      }
    }
    return url.toString();
  }
}

async function getAuthToken(): Promise<string | undefined> {
  try {
    return (await getStoredSessionToken()) || undefined;
  } catch {
    return undefined;
  }
}

export interface HttpResponse {
  status: number;
  data: any;
}

export async function nativeFetch(
  path: string,
  opts: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    data?: any;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    auth?: boolean;
  }
): Promise<HttpResponse> {
  const useAuth = opts.auth !== false;
  const token = useAuth ? await getAuthToken() : undefined;
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  if (token) {
    baseHeaders.Authorization = `Bearer ${token}`;
  }
  if (_d1Bookmark) {
    baseHeaders['x-d1-bookmark'] = _d1Bookmark;
  }

  const url = buildUrl(path, opts.params);

  try {
    const response = await fetch(url, {
      method: opts.method,
      headers: baseHeaders,
      body: opts.data ? JSON.stringify(opts.data) : undefined,
      credentials: Platform.OS === 'web' ? 'include' : 'omit',
    });

    const bookmark = response.headers.get('x-d1-bookmark');
    if (bookmark) {
      _d1Bookmark = bookmark;
    }

    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = text;
    }

    if (!response.ok) {
      const errorMessage =
        typeof data === 'object'
          ? (data as any).error?.message || (data as any).error || (data as any).message || 'Request failed'
          : data;
      
      const error: any = new Error(typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : String(errorMessage));
      error.status = response.status;
      error.data = data;
      error.response = { status: response.status, data };
      throw error;
    }

    return { status: response.status, data };
  } catch (error: any) {
    const isNetworkError = error instanceof TypeError ||
      error.message?.includes('Network request failed') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError');

    if (__DEV__ && isNetworkError) {
      console.error(`Network request failed [${opts.method}] ${url}:`, error);
      if (Platform.OS === 'android') {
        console.error('Android network troubleshooting:');
        console.error('- Make sure backend is running on host machine');
        console.error('- For emulator, using 10.0.2.2 instead of localhost');
      } else if (Platform.OS === 'web') {
        console.error('Web network troubleshooting:');
        console.error('- Make sure backend is running on http://localhost:8787');
        console.error('- Check CORS settings on the backend');
      }
    }
    throw error;
  }
}