import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
    GoogleSignin,
    statusCodes,
} from '@react-native-google-signin/google-signin';
import { ENV } from '../config/env';
import { nativeFetch } from './http';
import {
    getStoredSessionToken,
    storeSessionToken,
    clearSessionToken,
} from './session';

const API_BASE = ENV.API_BASE || '';

let googleSignInConfigured = false;

function configureGoogleSignIn() {
    if (googleSignInConfigured) return;

    const webClientId = ENV.GOOGLE_OAUTH_CLIENT_ID || ENV.GOOGLE_OAUTH_CLIENT_ID_DEV;
    if (!webClientId) {
        console.warn('Google OAuth Web Client ID not configured');
        return;
    }

    const config: any = {
        webClientId,
        offlineAccess: true,
        forceCodeForRefreshToken: true,
    };

    if (Platform.OS === 'ios') {
        const iosClientId = ENV.GOOGLE_OAUTH_CLIENT_ID_IOS || ENV.GOOGLE_OAUTH_CLIENT_ID_IOS_DEV;
        if (iosClientId) {
            config.iosClientId = iosClientId;
        }
    }

    GoogleSignin.configure(config);
    googleSignInConfigured = true;
}

export { getStoredSessionToken } from './session';

export async function signInWithEmail(email: string, password: string): Promise<void> {
    const response = await nativeFetch('/api/auth/sign-in/email', {
        method: 'POST',
        data: { email, password },
        auth: false,
    });

    if (response.data?.data?.session?.token) {
        await storeSessionToken(response.data.data.session.token);
    }
}

export async function signUpWithEmail(email: string, password: string, name?: string): Promise<void> {
    const response = await nativeFetch('/api/auth/sign-up/email', {
        method: 'POST',
        data: { email, password, name: name || email.split('@')[0] },
        auth: false,
    });

    if (response.data?.data?.session?.token) {
        await storeSessionToken(response.data.data.session.token);
    }
}

export async function signInWithGoogle(): Promise<void> {
    if (Platform.OS === 'web') {
        const returnTo =
            typeof window !== 'undefined'
                ? `${window.location.origin}/login`
                : '';
        const qs = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : '';
        window.location.href = `${API_BASE}/api/auth/sign-in/google${qs}`;
        return;
    }

    configureGoogleSignIn();

    try {
        if (Platform.OS === 'android') {
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        }

        const userInfo = await GoogleSignin.signIn();

        let idToken: string | null = null;
        if (userInfo.data?.idToken) {
            idToken = userInfo.data.idToken;
        } else {
            const tokens = await GoogleSignin.getTokens();
            idToken = tokens.idToken;
        }

        if (!idToken) {
            throw new Error('Google sign-in failed: no ID token received');
        }

        const response = await nativeFetch('/api/auth/sign-in/social', {
            method: 'POST',
            data: {
                provider: 'google',
                idToken: { token: idToken },
            },
            auth: false,
        });

        if (response.data?.data?.session?.token) {
            await storeSessionToken(response.data.data.session.token);
        }
    } catch (error: any) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            throw new Error('Google sign-in was cancelled');
        } else if (error.code === statusCodes.IN_PROGRESS) {
            throw new Error('Google sign-in is already in progress');
        } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            throw new Error('Google Play Services not available');
        }
        throw error;
    }
}

export async function signInWithApple(): Promise<void> {
    if (Platform.OS === 'web') {
        window.location.href = `${API_BASE}/api/auth/sign-in/apple`;
        return;
    }

    if (Platform.OS !== 'ios') {
        throw new Error('Apple sign-in is only available on iOS');
    }

    try {
        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
        });

        if (!credential.identityToken) {
            throw new Error('Apple sign-in failed: no identity token');
        }

        const response = await nativeFetch('/api/auth/sign-in/social', {
            method: 'POST',
            data: {
                provider: 'apple',
                idToken: { token: credential.identityToken },
            },
            auth: false,
        });

        if (response.data?.data?.session?.token) {
            await storeSessionToken(response.data.data.session.token);
        }
    } catch (error: any) {
        if (error.code === 'ERR_REQUEST_CANCELED' || error.code === 1000) {
            throw new Error('Apple sign-in was cancelled');
        }
        throw error;
    }
}

export async function signOut(): Promise<void> {
    try {
        await nativeFetch('/api/auth/sign-out', {
            method: 'POST',
        });
    } catch (error) {
        console.error('Sign out error:', error);
    } finally {
        await clearSessionToken();
    }
}

export async function getSession() {
    try {
        const response = await nativeFetch('/api/auth/session', {
            method: 'GET',
        });
        return response.data?.data || { session: null, user: null };
    } catch {
        return { session: null, user: null };
    }
}

export interface User {
    id: string;
    email: string;
    username: string;
    mode?: 'tennis' | 'pickleball';
    statProfile?: 'basic' | 'intermediate' | 'advanced';
    profilePictureUrl?: string | null;
    displayName?: string;
    emailVerified?: boolean;
    birthdate?: string | null;
    chatDisabled?: boolean;
    parentalConsentAt?: string | null;
    subscriptionStatus?: 'free' | 'plus' | 'plus_grace';
}

export async function fetchCurrentUser(): Promise<User> {
    const res = await nativeFetch('/auth/me', {
        method: 'GET',
    });
    return (res.data as any).user;
}

export async function logout(): Promise<void> {
    await signOut();
}

export async function getAuthToken(): Promise<string | undefined> {
    return (await getStoredSessionToken()) || undefined;
}

// ── Password Reset ──────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<string> {
    const res = await nativeFetch('/api/auth/forgot-password', {
        method: 'POST',
        data: { email },
        auth: false,
    });
    return res.data?.message || 'Reset code sent';
}

export async function verifyResetCode(email: string, code: string): Promise<string> {
    const res = await nativeFetch('/api/auth/verify-reset-code', {
        method: 'POST',
        data: { email, code },
        auth: false,
    });
    return res.data?.resetToken;
}

export async function resetPassword(resetToken: string, password: string): Promise<string> {
    const res = await nativeFetch('/api/auth/reset-password', {
        method: 'POST',
        data: { resetToken, password },
        auth: false,
    });
    return res.data?.message || 'Password reset successfully';
}

// ── Account Deletion ────────────────────────────────────────────────

export async function requestDeleteAccount(): Promise<string> {
    const res = await nativeFetch('/api/auth/request-delete-account', {
        method: 'POST',
    });
    return res.data?.message || 'Confirmation email sent';
}

export async function confirmDeleteAccount(token: string): Promise<string> {
    const res = await nativeFetch(`/api/auth/confirm-delete-account/${token}`, {
        method: 'POST',
        auth: false,
    });
    return res.data?.message || 'Account deleted';
}

export async function verifyEmailWithToken(token: string): Promise<string> {
    const res = await nativeFetch('/api/auth/verify-email', {
        method: 'POST',
        data: { token },
        auth: false,
    });
    return (res.data as any)?.message || 'Email verified';
}

export async function resendVerificationEmail(): Promise<string> {
    const res = await nativeFetch('/api/auth/resend-verification-email', {
        method: 'POST',
    });
    return (res.data as any)?.message || 'Verification email sent';
}

export async function deleteUnverifiedAccount(): Promise<string> {
    const res = await nativeFetch('/api/auth/delete-unverified-account', {
        method: 'POST',
    });
    return (res.data as any)?.message || 'Account deleted';
}
