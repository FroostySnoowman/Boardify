import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SESSION_TOKEN_KEY = 'auth_session_token';

export async function getStoredSessionToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage.getItem(SESSION_TOKEN_KEY);
            }
        } catch (error) {
            console.error('Failed to get session token from localStorage:', error);
        }
        return null;
    }
    try {
        return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    } catch {
        return null;
    }
}

export async function storeSessionToken(token: string): Promise<void> {
    if (Platform.OS === 'web') {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(SESSION_TOKEN_KEY, token);
            }
        } catch (error) {
            console.error('Failed to store session token in localStorage:', error);
        }
    } else {
        try {
            await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
        } catch (error) {
            console.error('Failed to store session token:', error);
        }
    }
}

export async function clearSessionToken(): Promise<void> {
    if (Platform.OS === 'web') {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(SESSION_TOKEN_KEY);
            }
        } catch (error) {
            console.error('Failed to clear session token from localStorage:', error);
        }
    } else {
        try {
            await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
        } catch (error) {
            console.error('Failed to clear session token from SecureStore:', error);
        }
    }
}
