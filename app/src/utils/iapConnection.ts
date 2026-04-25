import { Platform } from 'react-native';

type RNIapModule = typeof import('react-native-iap');

let ready: Promise<RNIapModule> | null = null;

export function getIapModuleAfterInit(): Promise<RNIapModule> {
  if (Platform.OS === 'web') {
    return Promise.reject(new Error('IAP is not available on web'));
  }
  if (!ready) {
    ready = import('react-native-iap')
      .then(async (mod) => {
        await mod.initConnection();
        return mod;
      })
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  return ready;
}

