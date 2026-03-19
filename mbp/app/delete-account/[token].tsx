import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { confirmDeleteAccount } from '../../src/api/auth';
import { useAuth } from '../../src/contexts/AuthContext';
import { hapticMedium } from '../../src/utils/haptics';

export default function DeleteAccountScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { logout } = useAuth();

  const [status, setStatus] = useState<'confirm' | 'loading' | 'error'>('confirm');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleConfirmDelete() {
    if (!token) return;
    setStatus('loading');
    try {
      await confirmDeleteAccount(token);
      hapticMedium();
      await logout();
      router.dismissAll();
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to delete account');
      setStatus('error');
    }
  }

  function handleGoHome() {
    router.dismissAll();
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 100);
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(239, 68, 68, 0.15)', 'rgba(2, 6, 23, 0.95)', '#020617']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {status === 'confirm' && (
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Feather name="alert-triangle" size={32} color="#ef4444" />
            </View>
            <Text style={styles.title}>Delete Your Account?</Text>
            <Text style={styles.subtitle}>
              This will permanently delete your account and all associated data including teams you own, matches, messages, and stats.
            </Text>
            <Text style={[styles.subtitle, { color: '#fbbf24', fontWeight: '600' }]}>
              This action cannot be undone.
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={handleGoHome} activeOpacity={0.8} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmDelete} activeOpacity={0.8} style={styles.buttonWrapper}>
                <LinearGradient
                  colors={['#ef4444', '#dc2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>Delete Forever</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {status === 'loading' && (
          <View style={styles.card}>
            <ActivityIndicator size="large" color="#ef4444" />
            <Text style={styles.title}>Deleting Account...</Text>
            <Text style={styles.subtitle}>Please wait while we remove your data.</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Feather name="x" size={32} color="#ef4444" />
            </View>
            <Text style={styles.title}>Deletion Failed</Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>
            <TouchableOpacity onPress={handleGoHome} activeOpacity={0.8} style={styles.buttonWrapper}>
              <LinearGradient
                colors={['#3b82f6', '#06b6d4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Go Home</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 32, alignItems: 'center', gap: 16,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#ffffff', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#9ca3af', textAlign: 'center', lineHeight: 22 },
  buttonWrapper: { overflow: 'hidden', borderRadius: 10, marginTop: 8 },
  button: {
    paddingHorizontal: 28, paddingVertical: 14, minHeight: 48,
    justifyContent: 'center', alignItems: 'center', borderRadius: 10,
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' },
  secondaryButton: {
    paddingHorizontal: 20, paddingVertical: 14, minHeight: 48,
    justifyContent: 'center', alignItems: 'center', borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600', color: '#d1d5db' },
});
