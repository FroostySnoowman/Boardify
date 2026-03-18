import { Platform } from 'react-native';
import { ENV } from '../config/env';

export const getImageUrl = (src: string | null | undefined): string | null => {
  if (!src) return null;
  if (src.startsWith('http://') || src.startsWith('https://')) {
    if (Platform.OS === 'android' && src.includes('localhost')) {
      return src.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
    }
    return src;
  }
  
  let API_BASE = ENV.API_BASE.replace(/\/$/, '');
  
  if (Platform.OS === 'android' && API_BASE.includes('localhost')) {
    API_BASE = API_BASE.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }
  
  if (src.startsWith('/api/')) {
    return src.replace('/api/', `${API_BASE}/`);
  }
  
  return src.startsWith('/') ? `${API_BASE}${src}` : `${API_BASE}/${src}`;
};
