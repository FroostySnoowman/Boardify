import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { resendVerificationEmail, deleteUnverifiedAccount } from '../api/auth';
import { useRouter } from 'expo-router';
import { isNetworkError } from '../utils/networkError';

const BACKGROUND_COLOR = '#020617';

export default function VerifyEmailScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
      return;
    }
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, [resendCooldown]);

  async function handleResend() {
    setResendError('');
    setResendSuccess('');
    setResendLoading(true);
    try {
      await resendVerificationEmail();
      setResendSuccess('Check your inbox for the verification link.');
      setResendCooldown(30);
    } catch (err: unknown) {
      setResendError(
        isNetworkError(err)
          ? "You're offline. Try again when you're back online."
          : err instanceof Error ? err.message : 'Failed to send email'
      );
    } finally {
      setResendLoading(false);
    }
  }

  async function handleSignOut() {
    await logout();
    router.replace('/login');
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await deleteUnverifiedAccount();
      await logout();
      router.replace('/login');
    } catch (err: unknown) {
      setDeleteError(
        isNetworkError(err)
          ? "You're offline. Try again when you're back online."
          : err instanceof Error ? err.message : 'Failed to delete account'
      );
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  }

  const displayEmail = user?.email ?? 'your email';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <LinearGradient
        colors={['rgba(0, 6, 42, 0.5)', 'rgba(0, 0, 0, 0.3)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Feather name="mail" size={32} color="#60a5fa" />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.body}>
            We sent a verification link to <Text style={styles.emailHighlight}>{displayEmail}</Text>.
            Click the link in that email to verify your account and start using MyBreakPoint.
          </Text>
          <Text style={styles.hint}>
            Can&apos;t find it? Check your spam folder. The link expires in 24 hours.
          </Text>

          {resendSuccess ? (
            <View style={styles.successBanner}>
              <Feather name="check-circle" size={18} color="#22c55e" />
              <Text style={styles.successText}>{resendSuccess}</Text>
            </View>
          ) : null}
          {resendError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{resendError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, (resendLoading || resendCooldown > 0) && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={resendLoading || resendCooldown > 0}
          >
            <LinearGradient
              colors={['#22c55e', '#10b981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              {resendLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : resendCooldown > 0 ? (
                <Text style={styles.primaryButtonText}>Resend in {resendCooldown}s</Text>
              ) : (
                <Text style={styles.primaryButtonText}>Resend verification email</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Need to use a different email?</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut} disabled={deleteLoading}>
            <Feather name="log-out" size={18} color="#94a3b8" />
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => setShowDeleteConfirm(true)}
            disabled={deleteLoading}
          >
            <Feather name="trash-2" size={18} color="#f87171" />
            <Text style={styles.dangerButtonText}>Delete account</Text>
          </TouchableOpacity>
          <Text style={styles.dangerHint}>
            Delete your account if you signed up with the wrong email. You can then register again with the correct one.
          </Text>
        </View>

        {showDeleteConfirm && (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete this account?</Text>
            <Text style={styles.confirmBody}>
              Your account and any data will be permanently removed. You can sign up again with a different email.
            </Text>
            {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                disabled={deleteLoading}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDelete, deleteLoading && styles.buttonDisabled]}
                onPress={handleDeleteAccount}
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.dangerButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  emailHighlight: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
    color: '#86efac',
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#fca5a5',
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 10,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d1d5db',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 8,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f87171',
  },
  dangerHint: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmBody: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  confirmCancel: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
  },
  confirmDelete: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 10,
  },
});
