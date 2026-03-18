import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getEnvVar = (key: string, defaultValue?: string): string => {
  const fromExpoConfig = Constants.expoConfig?.extra?.[key];
  const fromManifest2 = (Constants as any).manifest2?.extra?.[key];
  const fromManifest = (Constants as any).manifest?.extra?.[key];
  const fromEnv = process.env[key];
  const value = fromExpoConfig || fromManifest2 || fromManifest || fromEnv || defaultValue;

  if (!value && !defaultValue) {
    console.warn(`Missing environment variable: ${key}`);
  }
  return value || '';
};

type EnvConfig = {
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_ID_IOS?: string;
  GOOGLE_OAUTH_CLIENT_ID_DEV?: string;
  GOOGLE_OAUTH_CLIENT_ID_IOS_DEV?: string;
  GOOGLE_OAUTH_CLIENT_ID_ANDROID?: string;
  API_BASE: string;
  APP_URL: string;
  DEV: boolean;
};

export const ENV: EnvConfig = {
  GOOGLE_OAUTH_CLIENT_ID: getEnvVar('GOOGLE_OAUTH_CLIENT_ID'),
  GOOGLE_OAUTH_CLIENT_ID_IOS: getEnvVar('GOOGLE_OAUTH_CLIENT_ID_IOS'),
  GOOGLE_OAUTH_CLIENT_ID_DEV: getEnvVar('GOOGLE_OAUTH_CLIENT_ID_DEV'),
  GOOGLE_OAUTH_CLIENT_ID_IOS_DEV: getEnvVar('GOOGLE_OAUTH_CLIENT_ID_IOS_DEV'),
  GOOGLE_OAUTH_CLIENT_ID_ANDROID: getEnvVar('GOOGLE_OAUTH_CLIENT_ID_ANDROID'),

  API_BASE: getEnvVar('VITE_API_BASE', Platform.OS === 'web' && __DEV__ ? 'http://localhost:8787' : '/api'),
  APP_URL: getEnvVar('VITE_APP_URL', ''),

  DEV: __DEV__ || process.env.NODE_ENV === 'development',
};

const DEFAULT_PROD_API = 'https://api.mybreakpoint.app';
const DEFAULT_PROD_APP_URL = 'https://mybreakpoint.app';

if (!ENV.DEV) {
  const isLocal =
    ENV.API_BASE.includes('localhost') ||
    ENV.API_BASE.includes('127.0.0.1') ||
    ENV.API_BASE.startsWith('/api');
  if (isLocal) {
    ENV.API_BASE = getEnvVar('VITE_API_BASE_PROD', DEFAULT_PROD_API) || DEFAULT_PROD_API;
  }

  if (!ENV.APP_URL || ENV.APP_URL.includes('localhost') || ENV.APP_URL.includes('127.0.0.1')) {
    ENV.APP_URL = DEFAULT_PROD_APP_URL;
  }
}

export const SHARE_BASE_URL = DEFAULT_PROD_APP_URL;
