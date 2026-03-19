import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { acceptInvite } from '../../../src/api/teams';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useTeams } from '../../../src/contexts/TeamsContext';
import { hapticMedium, hapticLight } from '../../../src/utils/haptics';

const BACKGROUND_COLOR = '#020617';

export default function AcceptInviteScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { refresh } = useTeams();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'auth-required'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setStatus('auth-required');
      return;
    }

    if (!inviteId || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        await acceptInvite(inviteId);
        await refresh();
        hapticMedium();
        setStatus('success');
      } catch (e: any) {
        const msg = e?.message || 'Failed to accept invite';
        setErrorMessage(msg);
        setStatus('error');
      }
    })();
  }, [authLoading, user, inviteId]);

  const handleGoToTeams = () => {
    hapticLight();
    router.replace('/(tabs)/team');
  };

  const handleGoToLogin = () => {
    hapticLight();
    router.push('/login');
  };

  const handleGoHome = () => {
    hapticLight();
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(96, 165, 250, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {status === 'loading' && (
          <View style={styles.card}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.title}>Accepting Invite...</Text>
            <Text style={styles.subtitle}>Please wait while we add you to the team.</Text>
          </View>
        )}

        {status === 'success' && (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Feather name="check" size={32} color="#22c55e" />
            </View>
            <Text style={styles.title}>You're In!</Text>
            <Text style={styles.subtitle}>You've successfully joined the team.</Text>
            <TouchableOpacity onPress={handleGoToTeams} activeOpacity={0.8} style={styles.buttonWrapper}>
              <LinearGradient
                colors={['#3b82f6', '#06b6d4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Go to Teams</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Feather name="x" size={32} color="#ef4444" />
            </View>
            <Text style={styles.title}>Invite Failed</Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={handleGoHome} activeOpacity={0.8} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Go Home</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  attempted.current = false;
                  setStatus('loading');
                  setErrorMessage('');
                }}
                activeOpacity={0.8}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={['#3b82f6', '#06b6d4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>Try Again</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {status === 'auth-required' && (
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
              <Feather name="log-in" size={32} color="#fbbf24" />
            </View>
            <Text style={styles.title}>Sign In Required</Text>
            <Text style={styles.subtitle}>
              You need to sign in before you can accept this invite.
            </Text>
            <TouchableOpacity onPress={handleGoToLogin} activeOpacity={0.8} style={styles.buttonWrapper}>
              <LinearGradient
                colors={['#3b82f6', '#06b6d4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonWrapper: {
    overflow: 'hidden',
    borderRadius: 10,
    marginTop: 8,
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d1d5db',
  },
});
